/**
 * TOPIC CONTENT GENERATOR - Flujo multi-cerebro con RAG desde Supabase
 * Librarian -> Auditor -> TimeKeeper/Planificador -> Strategist -> Orchestrator (final)
 * 
 * IMPORTANTE: Los documentos están almacenados y chunkeados en Supabase (tabla library_documents).
 * El Librarian busca chunks relevantes basados en el filename del topic y los usa como contexto.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import type {
    TopicSection,
    GeneratedTopicContent,
    OrchestrationState,
    AgentStep,
    AgentRole,
    TimeKeeperDecision,
    ConcisionStrategy
} from "./widget-types";
import { getTopicById, generateBaseHierarchy, TopicWithGroup } from "./syllabus-hierarchy";

// Lazy loading con verificación explícita de API Key
function getAPIKey(): string {
    const key = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!key) {
        throw new Error(
            "GEMINI_API_KEY no configurada. Añádela en Vercel Dashboard → Settings → Environment Variables"
        );
    }
    return key;
}

// Helper para obtener API Key de forma segura (sin lanzar error)
function safeGetAPIKey(): string | null {
    return process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || null;
}

// Modelo Gemini 3 Pro (probando sin -preview según documentación)
let MODEL = process.env.GEMINI_MODEL || "gemini-3-pro";

// Initialized lazily
let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
    if (!_genAI) {
        _genAI = new GoogleGenerativeAI(getAPIKey());
    }
    return _genAI;
}

// Función para cambiar a modelo fallback si el principal falla (ej: 404 Not Found)
function switchToFallbackModel() {
    if (MODEL !== "gemini-1.5-pro") {
        console.warn(`[GENERATOR] Switching model from ${MODEL} to gemini-1.5-pro due to API error.`);
        MODEL = "gemini-1.5-pro";
    }
}
// Nota: Si gemini-3-pro-preview falla, intentará con gemini-1.5-pro como fallback

// Supabase para RAG (lazy initialization)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabaseClient() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return null;
    }
    return createClient(SUPABASE_URL, SUPABASE_KEY);
}

const STEP_TIMEOUT_MS = parseInt(process.env.AGENT_STEP_TIMEOUT_MS || "120000", 10); // A 2 min para evitar cortes en cold start
const MIN_WORDS_PER_SECTION = 120; // Mínimo de palabras por sección para salud
const MIN_TOTAL_WORDS = 800; // Objetivo mínimo global para evitar respuestas pobres (Aumentado de 700)
const BASE_GENERATION_CONFIG = {
    temperature: 0.7,
    maxOutputTokens: 8192,
    responseMimeType: "application/json"
} as const;
// Siempre habilitar logs para trazabilidad en Vercel
const DEBUG_LOG = true;

function logDebug(message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? JSON.stringify(data, null, 0).slice(0, 800) : '';
    console.log(`[GENERATOR][${timestamp}] ${message}`, dataStr);
}

// ============================================
// TELEMETRÍA Y LOGGING
// ============================================

interface TelemetryEvent {
    timestamp: Date;
    agent: AgentRole | 'global';
    event: 'start' | 'complete' | 'timeout' | 'error' | 'fallback';
    durationMs?: number;
    details?: string;
}

class GeneratorTelemetry {
    private events: TelemetryEvent[] = [];
    private startTime: number = Date.now();

    log(agent: AgentRole | 'global', event: TelemetryEvent['event'], details?: string) {
        const entry: TelemetryEvent = {
            timestamp: new Date(),
            agent,
            event,
            durationMs: Date.now() - this.startTime,
            details
        };
        this.events.push(entry);
        // Siempre loguear para trazabilidad
        const timestamp = new Date().toISOString();
        console.log(`[TELEMETRY][${timestamp}] ${entry.agent.toUpperCase()} ${entry.event}${details ? `: ${details}` : ''} (+${entry.durationMs}ms)`);
    }

    reset() {
        this.events = [];
        this.startTime = Date.now();
    }

    getEvents() {
        return this.events;
    }

    getSummary() {
        const byAgent: Record<string, { count: number; totalMs: number; errors: number }> = {};
        for (const ev of this.events) {
            if (!byAgent[ev.agent]) byAgent[ev.agent] = { count: 0, totalMs: 0, errors: 0 };
            byAgent[ev.agent].count++;
            if (ev.event === 'error' || ev.event === 'timeout') byAgent[ev.agent].errors++;
        }
        return byAgent;
    }
}

function getThinkingModel() {
    return getGenAI().getGenerativeModel({
        model: MODEL,
        generationConfig: BASE_GENERATION_CONFIG
    });
}

// Modelo sin responseMimeType forzado, útil para prompts de texto libre/enriquecimiento
function getTextModel() {
    return getGenAI().getGenerativeModel({
        model: MODEL,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048 // Aumentado de 1024 a 2048 para mejor enriquecimiento
        }
    });
}

// ============================================
// UTILIDADES GENERALES
// ============================================

function countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
        promise.then(
            (res) => {
                clearTimeout(timer);
                resolve(res);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            }
        );
    });
}

// ============================================
// RAG DESDE SUPABASE - Búsqueda de documentos chunkeados
// ============================================

function slugify(str: string): string {
    return (str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

interface DocumentChunk {
    source_id: string;
    filename: string;
    fragment: string;
    category: string;
    chunk_index: number;
    confidence: number;
}

/**
 * Genera múltiples variantes del nombre de archivo para búsqueda flexible
 * Ej: "Ley 9-1991, de 8 de mayo, de Carreteras" -> ["ley_9-1991", "ley 9 1991", "carreteras", etc.]
 */
function generateFilenameVariants(filename: string): string[] {
    const base = filename
        .replace(/\.pdf$/i, '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // quitar acentos

    const variants: string[] = [];

    // Variante original sin extensión
    variants.push(base);

    // Variante con guiones bajos en vez de espacios/comas
    variants.push(base.replace(/[,\s]+/g, '_').replace(/_+/g, '_'));

    // Variante solo con guiones bajos (como está en Supabase)
    variants.push(base.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_'));

    // Extraer referencias de ley (ej: "Ley 9-1991" -> "Ley_9-1991")
    const lawMatch = base.match(/ley\s*(\d+[-/]?\d*)/i);
    if (lawMatch) {
        variants.push(`Ley_${lawMatch[1].replace('/', '-')}`);
        variants.push(`ley ${lawMatch[1]}`);
    }

    // Extraer decreto (ej: "Decreto 131-1995" -> "Decreto_131-1995")
    const decretoMatch = base.match(/decreto\s*(\d+[-/]?\d*)/i);
    if (decretoMatch) {
        variants.push(`Decreto_${decretoMatch[1].replace('/', '-')}`);
    }

    // Palabras clave importantes (más de 5 caracteres, no comunes)
    const stopWords = ['de', 'del', 'la', 'el', 'los', 'las', 'por', 'que', 'para', 'con', 'en', 'una', 'uno', 'mayo', 'abril', 'marzo', 'junio', 'julio'];
    const keywords = base
        .toLowerCase()
        .split(/[\s,\-_]+/)
        .filter(w => w.length > 4 && !stopWords.includes(w));

    variants.push(...keywords);

    return [...new Set(variants)].filter(v => v.length > 2);
}

/**
 * Busca chunks relevantes en Supabase con múltiples estrategias de búsqueda
 * 1. Búsqueda por variantes normalizadas del filename
 * 2. Búsqueda por palabras clave del título
 * 3. Búsqueda por contenido con términos específicos
 */
async function fetchDocumentChunksFromSupabase(
    originalFilename: string,
    topicTitle: string,
    maxChunks: number = 15
): Promise<DocumentChunk[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
        logDebug('RAG: Supabase no configurado');
        return [];
    }

    const variants = generateFilenameVariants(originalFilename);
    logDebug('RAG: Buscando chunks', {
        originalFilename,
        topicTitle,
        searchVariants: variants.slice(0, 5) // Log primeras 5 variantes
    });

    let chunks: DocumentChunk[] = [];
    const seenIds = new Set<string>();

    // Función helper para añadir chunks sin duplicados
    const addChunks = (docs: any[], confidence: number) => {
        for (const doc of docs) {
            const id = `db-${doc.id}`;
            if (!seenIds.has(id)) {
                seenIds.add(id);
                chunks.push({
                    source_id: id,
                    filename: doc.metadata?.filename || originalFilename,
                    fragment: doc.content || '',
                    category: doc.metadata?.category || 'UNKNOWN',
                    chunk_index: doc.metadata?.chunk_index ?? chunks.length,
                    confidence
                });
            }
        }
    };

    try {
        // ESTRATEGIA 1: Buscar por cada variante del filename (PARALELO para velocidad)
        const variantPromises = variants.slice(0, 6).map(async (variant) => {
            const qStart = Date.now();
            const { data, error } = await supabase
                .from('library_documents')
                .select('id, content, metadata')
                .ilike('metadata->>filename', `%${variant}%`)
                .order('metadata->chunk_index', { ascending: true })
                .limit(5); // Reducir límite individual para no saturar

            logDebug(`RAG Q1 filename variant "${variant}"`, { rows: data?.length || 0, error: error?.message, ms: Date.now() - qStart });
            return !error && data ? data : [];
        });

        const variantResults = await Promise.all(variantPromises);
        variantResults.forEach(data => addChunks(data, 0.95));

        if (chunks.length >= maxChunks) return chunks.slice(0, maxChunks);

        // ESTRATEGIA 2: Buscar por keywords del título si no hay suficientes chunks
        if (chunks.length < 5) {
            const titleKeywords = topicTitle
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .split(/[\s,\-_]+/)
                .filter(w => w.length > 4 && !['parte', 'tema', 'general', 'especifica'].includes(w))
                .slice(0, 4);

            logDebug('RAG: Buscando por keywords del título', titleKeywords);

            for (const keyword of titleKeywords) {
                if (chunks.length >= maxChunks) break;

                // Buscar en filename
                const qStart1 = Date.now();
                const { data: byFilename, error: err1 } = await supabase
                    .from('library_documents')
                    .select('id, content, metadata')
                    .ilike('metadata->>filename', `%${keyword}%`)
                    .limit(5);

                logDebug(`RAG Q2 keyword filename "${keyword}"`, { rows: byFilename?.length || 0, error: err1?.message, ms: Date.now() - qStart1 });

                if (!err1 && byFilename) {
                    addChunks(byFilename, 0.85);
                }

                // Buscar en contenido
                const qStart2 = Date.now();
                const { data: byContent, error: err2 } = await supabase
                    .from('library_documents')
                    .select('id, content, metadata')
                    .ilike('content', `%${keyword}%`)
                    .limit(5);

                logDebug(`RAG Q2 keyword content "${keyword}"`, { rows: byContent?.length || 0, error: err2?.message, ms: Date.now() - qStart2 });

                if (!err2 && byContent) {
                    addChunks(byContent, 0.70);
                }
            }
        }

        // ESTRATEGIA 3: Si aún no hay chunks, buscar términos legales específicos
        if (chunks.length < 3) {
            // Extraer números de ley/decreto del filename o título
            const legalRefs = [originalFilename, topicTitle].join(' ')
                .match(/(?:ley|decreto|orden|real decreto)\s*(\d+[-/]\d+|\d+)/gi) || [];

            logDebug('RAG: Buscando referencias legales', legalRefs);

            for (const ref of legalRefs.slice(0, 3)) {
                const qStart = Date.now();
                const { data, error } = await supabase
                    .from('library_documents')
                    .select('id, content, metadata')
                    .or(`metadata->>filename.ilike.%${ref}%,content.ilike.%${ref}%`)
                    .limit(5);

                logDebug(`RAG Q3 legal ref "${ref}"`, { rows: data?.length || 0, error: error?.message, ms: Date.now() - qStart });

                if (!error && data) {
                    addChunks(data, 0.80);
                }
            }
        }

        // Ordenar por confidence y chunk_index
        chunks.sort((a, b) => {
            if (b.confidence !== a.confidence) return b.confidence - a.confidence;
            return a.chunk_index - b.chunk_index;
        });

        const finalChunks = chunks.slice(0, maxChunks);
        logDebug(`RAG: Total chunks encontrados: ${finalChunks.length}`, {
            sources: [...new Set(finalChunks.map(c => c.filename))].slice(0, 5)
        });

        return finalChunks;

    } catch (error) {
        logDebug('RAG: Error en fetchDocumentChunksFromSupabase', error);
        return [];
    }
}

// ============================================
// EXTRACCIÓN DE RATIONALE MEJORADA
// ============================================

function extractRationale(text: string, json: any): string | null {
    // 1) Buscar campo rationale en el JSON
    if (json?.rationale && typeof json.rationale === 'string') {
        return json.rationale;
    }
    // 2) Buscar campo reasoning
    if (json?.reasoning && typeof json.reasoning === 'string') {
        return json.reasoning;
    }
    // 3) Buscar campo explanation
    if (json?.explanation && typeof json.explanation === 'string') {
        return json.explanation;
    }
    // 4) Intentar extraer de bloques <think> o similares (algunos modelos lo usan)
    const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
        return thinkMatch[1].trim().slice(0, 500);
    }
    // 5) Buscar comentarios al inicio tipo "// Razonamiento:" o "Análisis:"
    const commentMatch = text.match(/(?:Razonamiento|Análisis|Rationale|Thinking):\s*([^\n]+(?:\n[^\n{]+)*)/i);
    if (commentMatch) {
        return commentMatch[1].trim().slice(0, 400);
    }
    return null;
}

function safeParseJSON(text: string): { json: any; error: string | null } {
    try {
        // Limpiar markdown y texto extra antes/después del JSON
        let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }

        // Si hay texto antes de la llave de apertura, eliminarlo
        if (!cleaned.trim().startsWith("{")) {
            const bracePos = cleaned.indexOf("{");
            if (bracePos >= 0) {
                cleaned = cleaned.slice(bracePos);
            }
        }

        // Intento directo
        return { json: JSON.parse(cleaned), error: null };
    } catch (e) {
        return { json: null, error: e instanceof Error ? e.message : 'Parse error' };
    }
}

async function generateJSONWithRetry(
    prompt: string,
    label: string,
    maxRetries: number = 1
): Promise<{ json: any; raw: string; error: string | null }> {
    const model = getThinkingModel();
    let lastError: string | null = null;
    let raw = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const attemptPrompt = attempt === 0
            ? prompt
            : `${prompt}\n\nRESPONDE SOLO CON JSON PLANO. SIN markdown, SIN comentarios, SIN explicaciones. Empieza con { y termina con }.`;

        // Update step input with prompt preview if possible (hacky access to state/updateStep needed, or pass callback)
        // For now just logging
        logDebug(`${label}: Prompt Preview`, { prompt: attemptPrompt.slice(0, 500) });

        try {
            const result = await withTimeout(
                model.generateContent(attemptPrompt),
                STEP_TIMEOUT_MS,
                `${label} LLM (intento ${attempt + 1})`
            );
            raw = result.response.text();
            const { json, error } = safeParseJSON(raw);
            if (!error && json) {
                return { json, raw, error: null };
            }
            lastError = error || 'Unknown parse error';
            logDebug(`${label}: JSON parse failed (intento ${attempt + 1})`, { error: lastError, sample: raw.slice(0, 400) });
        } catch (err) {
            lastError = err instanceof Error ? err.message : 'LLM error';

            // Detectar error 404 o Not Found e intentar con fallback
            if (lastError.includes('404') || lastError.toLowerCase().includes('not found')) {
                switchToFallbackModel();
                // Reintentar inmediatamente con el nuevo modelo en la siguiente iteración si quedan intentos,
                // o forzar uno extra si era el último
                if (attempt === maxRetries) maxRetries++;
            }

            logDebug(`${label}: LLM error (intento ${attempt + 1})`, lastError);
        }
    }

    return { json: null, raw, error: lastError };
}

async function generateTextWithRetry(
    prompt: string,
    label: string,
    timeoutMs: number
): Promise<string | null> {
    const model = getTextModel();
    try {
        const res = await withTimeout(
            model.generateContent(prompt),
            timeoutMs,
            label
        );
        return res.response.text().trim();
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('404') || errMsg.toLowerCase().includes('not found')) {
            switchToFallbackModel();
            // Retry once with new model
            try {
                const modelFallback = getTextModel();
                const res = await withTimeout(
                    modelFallback.generateContent(prompt),
                    timeoutMs,
                    `${label} (fallback)`
                );
                return res.response.text().trim();
            } catch (retryErr) {
                logDebug(`${label}: Fallback LLM failed`, retryErr);
            }
        }
        logDebug(`${label}: LLM failed`, err);
        return null;
    }
}

// ============================================
// CLASE PRINCIPAL
// ============================================

export class TopicContentGenerator {
    private state: OrchestrationState;
    private onStateChange?: (state: OrchestrationState) => void;
    private telemetry: GeneratorTelemetry;
    private abortController: AbortController | null = null;
    private cancelled: boolean = false;

    constructor(topicId: string, onStateChange?: (state: OrchestrationState) => void) {
        this.state = {
            topicId,
            status: 'idle',
            steps: [],
            currentStep: null,
        };
        this.onStateChange = onStateChange;
        this.telemetry = new GeneratorTelemetry();
    }

    /**
     * Cancela la generación en curso
     */
    cancel() {
        this.cancelled = true;
        this.abortController?.abort();
        this.telemetry.log('global', 'error', 'Cancelado por el usuario');
        this.updateState({
            status: 'error',
            currentStep: null
        });
        // Marcar el paso actual como error
        if (this.state.currentStep) {
            this.updateStep(this.state.currentStep, {
                status: 'error',
                reasoning: 'Generación cancelada por el usuario',
                completedAt: new Date()
            });
        }
    }

    isCancelled(): boolean {
        return this.cancelled;
    }

    private updateState(updates: Partial<OrchestrationState>) {
        this.state = { ...this.state, ...updates };
        this.onStateChange?.(this.state);
    }

    getState(): OrchestrationState {
        return this.state;
    }

    getTelemetry() {
        return this.telemetry.getEvents();
    }

    getTelemetrySummary() {
        return this.telemetry.getSummary();
    }

    private updateStep(role: AgentRole, updates: Partial<AgentStep>) {
        const idx = this.state.steps.findIndex(s => s.role === role);
        if (idx >= 0) {
            this.state.steps[idx] = { ...this.state.steps[idx], ...updates };
        } else {
            this.state.steps.push({ role, status: 'pending', ...updates });
        }
        this.onStateChange?.(this.state);
    }

    private checkCancelled() {
        if (this.cancelled) {
            throw new Error('Generación cancelada');
        }
    }

    // ============================================
    // LIBRARIAN: estructura base + evidencia desde Supabase
    // ============================================
    private async runLibrarian(topic: TopicWithGroup): Promise<{
        structure: TopicSection[];
        documents: string[];
        evidence: any[];
    }> {
        this.checkCancelled();

        // FASE 0: Diagnóstico de Conexión (Para debuguear el "bloqueo")
        this.updateStep('librarian', {
            status: 'running',
            startedAt: new Date(),
            input: {
                topic: topic.title,
                filename: topic.originalFilename,
                model: MODEL,
                check: "Verificando conexión con Supabase y Gemini..."
            },
            reasoning: 'Iniciando diagnóstico de servicios...'
        });

        // Verificar Supabase
        const supabase = getSupabaseClient();
        if (!supabase) {
            this.updateStep('librarian', {
                reasoning: 'ADVERTENCIA: Supabase no está configurado (variables de entorno faltantes). Se usará solo conocimiento del modelo.'
            });
        }

        this.telemetry.log('librarian', 'start', topic.title);
        logDebug('Librarian iniciando con RAG desde Supabase', { topic: topic.title, filename: topic.originalFilename });
        this.updateState({ currentStep: 'librarian' });
        const structure = generateBaseHierarchy(topic);

        this.updateStep('librarian', {
            // Merge with previous check info, don't overwrite
            input: {
                topic: topic.title,
                filename: topic.originalFilename,
                model: MODEL,
                prompt_preview: "Buscando chunks en Supabase...",
                check: "Supabase client OK. Starting legacy + parallel search."
            },
            reasoning: 'Buscando documentos en la biblioteca (Supabase)...'
        });

        let evidence: any[] = [];
        const documents: string[] = [topic.originalFilename];

        // 1) Buscar chunks en Supabase (RAG)
        const ragStart = Date.now();
        try {
            const chunks = await withTimeout(
                fetchDocumentChunksFromSupabase(topic.originalFilename, topic.title, 15),
                Math.min(STEP_TIMEOUT_MS, 30000),
                "RAG Supabase"
            );

            if (chunks.length > 0) {
                evidence = chunks.map(chunk => ({
                    source_id: chunk.source_id,
                    filename: chunk.filename,
                    fragment: chunk.fragment.slice(0, 1500), // Limitar tamaño
                    category: chunk.category,
                    confidence: chunk.confidence
                }));

                // Añadir documentos únicos encontrados
                const uniqueFiles = [...new Set(chunks.map(c => c.filename))];
                documents.push(...uniqueFiles.filter(f => f !== topic.originalFilename));

                this.telemetry.log('librarian', 'complete', `RAG encontró ${chunks.length} chunks en ${Date.now() - ragStart}ms`);
                this.updateStep('librarian', {
                    reasoning: `Encontrados ${chunks.length} fragmentos de ${uniqueFiles.length} documento(s) en Supabase.`
                });
            } else {
                this.telemetry.log('librarian', 'fallback', 'No se encontraron chunks en Supabase');
                this.updateStep('librarian', {
                    reasoning: 'No se encontraron documentos en la biblioteca. Usando conocimiento del modelo.'
                });
            }
        } catch (err) {
            this.telemetry.log('librarian', 'error', `RAG error: ${err instanceof Error ? err.message : 'error'}`);
            this.updateStep('librarian', {
                reasoning: `Error buscando en Supabase (${err instanceof Error ? err.message : 'error'}). Intentando fallback con modelo.`
            });
        }

        this.checkCancelled();

        // 2) Si no hay evidencia de Supabase o hay muy poca, pedir al LLM que genere contexto base
        const MIN_EVIDENCE_FRAGMENTS = 5;
        if (evidence.length < MIN_EVIDENCE_FRAGMENTS) {
            this.telemetry.log('librarian', 'fallback', `Evidencia insuficiente (${evidence.length}/${MIN_EVIDENCE_FRAGMENTS}), usando LLM para completar`);
            this.updateStep('librarian', {
                reasoning: `Evidencia RAG insuficiente (${evidence.length} fragmentos). Generando contexto adicional con LLM...`
            });

            const prompt = `
Eres el Bibliotecario experto de una plataforma de estudio de oposiciones (ITOP - Ingeniero Técnico de Obras Públicas en España).

TEMA A DOCUMENTAR: "${topic.title}"
GRUPO TEMÁTICO: "${topic.groupTitle}"
DOCUMENTO BASE: "${topic.originalFilename}"

Tu tarea es generar información REAL, PRECISA y DETALLADA sobre este tema de oposiciones españolas.
IMPORTANTE: La información debe ser técnicamente correcta y útil para preparar oposiciones.

Debes generar EXACTAMENTE 5 fragmentos de evidencia que cubran:
1. Objeto y ámbito de aplicación de la normativa
2. Definiciones y conceptos fundamentales
3. Competencias y órganos responsables
4. Régimen jurídico y procedimientos principales
5. Infracciones, sanciones y disposiciones específicas

Para cada fragmento incluye:
- Referencias específicas a artículos de ley (ej: "Art. 3 de la Ley 9/1991")
- Definiciones técnicas exactas
- Plazos y procedimientos cuando aplique

RESPONDE EXCLUSIVAMENTE CON JSON VÁLIDO (sin markdown, sin \`\`\`):
{
  "evidence": [
    {
      "source_id": "llm-1",
      "filename": "${topic.originalFilename}",
      "fragment": "[Texto detallado de 300-500 palabras sobre objeto y ámbito]",
      "law_refs": ["Ley X/YYYY, Art. N"],
      "confidence": 0.8,
      "section_hint": "objeto_ambito"
    },
    {
      "source_id": "llm-2",
      "filename": "${topic.originalFilename}",
      "fragment": "[Texto detallado sobre definiciones y conceptos]",
      "law_refs": [],
      "confidence": 0.8,
      "section_hint": "definiciones"
    },
    {
      "source_id": "llm-3",
      "filename": "${topic.originalFilename}",
      "fragment": "[Texto sobre competencias]",
      "law_refs": [],
      "confidence": 0.8,
      "section_hint": "competencias"
    },
    {
      "source_id": "llm-4",
      "filename": "${topic.originalFilename}",
      "fragment": "[Texto sobre régimen jurídico]",
      "law_refs": [],
      "confidence": 0.8,
      "section_hint": "regimen_juridico"
    },
    {
      "source_id": "llm-5",
      "filename": "${topic.originalFilename}",
      "fragment": "[Texto sobre infracciones y sanciones]",
      "law_refs": [],
      "confidence": 0.8,
      "section_hint": "infracciones"
    }
  ],
  "rationale": "[Explicación de cómo has estructurado la información]"
}`;

            const llmStart = Date.now();
            try {
                logDebug('Librarian LLM: Enviando prompt', { promptLength: prompt.length });
                const { json, raw, error: parseError } = await generateJSONWithRetry(prompt, 'Bibliotecario', 1);
                logDebug('Librarian LLM: Respuesta recibida', { responseLength: raw.length });

                if (!parseError && json && Array.isArray(json.evidence)) {
                    // Añadir evidencia del LLM a la existente
                    const llmEvidence = json.evidence.filter((e: any) =>
                        e.fragment && e.fragment.length > 100 // Solo fragmentos con contenido real
                    );

                    // Combinar: primero RAG (más confiable), luego LLM
                    evidence = [...evidence, ...llmEvidence].slice(0, 15);

                    const rationale = extractRationale(raw, json);
                    this.updateStep('librarian', {
                        reasoning: rationale || `LLM generó ${llmEvidence.length} fragmentos adicionales. Total: ${evidence.length}`
                    });
                    this.telemetry.log('librarian', 'complete', `LLM añadió ${llmEvidence.length} fragmentos en ${Date.now() - llmStart}ms`);
                } else {
                    logDebug('Librarian LLM: Error parseando respuesta', { error: parseError });
                    this.telemetry.log('librarian', 'error', `LLM respuesta no válida: ${parseError}`);
                }
            } catch (err) {
                this.telemetry.log('librarian', 'error', `LLM error: ${err instanceof Error ? err.message : 'error'}`);
                logDebug('Librarian LLM: Exception', err);
            }
        }

        const finalReasoning = evidence.length > 0
            ? `Estructura generada con ${evidence.length} fragmentos de evidencia de ${documents.length} documento(s).`
            : 'FALLO CRÍTICO: No se encontró evidencia ni en biblioteca ni mediante generación LLM.';

        if (evidence.length === 0) {
            const msg = "Librarian falló: No se encontró evidencia (RAG falló y LLM fallback falló). Revisa configuración de API Key y Supabase.";
            this.telemetry.log('librarian', 'error', msg);
            this.updateStep('librarian', {
                status: 'error',
                reasoning: finalReasoning,
                error: msg
            });
            throw new Error(msg);
        }

        this.updateStep('librarian', {
            status: 'completed',
            completedAt: new Date(),
            reasoning: finalReasoning,
            output: {
                documentCount: documents.length,
                sectionCount: structure.length,
                evidenceCount: evidence.length,
                sources: [...new Set(evidence.map((e: any) => e.filename))]
            }
        });

        this.telemetry.log('librarian', 'complete', finalReasoning);
        return { structure, documents, evidence };
    }

    // ============================================
    // AUDITOR: gaps + widgets + score
    // ============================================
    private async runAuditor(topic: TopicWithGroup, library: { documents: string[]; evidence: any[] }): Promise<{
        gaps: string[];
        optimizations: string[];
        widgets: any[];
        quality_score: number;
    }> {
        this.checkCancelled();
        this.telemetry.log('auditor', 'start', topic.title);

        const prompt = `
Analiza el tema y detecta vacíos:
- Tema: "${topic.title}"
- Documentos: ${library.documents.join(', ')}
- Evidencia (recortada): ${JSON.stringify(library.evidence).slice(0, 1200)}...

Responde SOLO JSON:
{
  "gaps": ["concepto faltante"],
  "optimizations": ["mejora"],
  "widgets": [
    { "type": "mnemonic|diagram|timeline|quiz|alert", "section": "intro|conceptos|desarrollo|practica", "why": "razón", "prompt": "micro-prompt" }
  ],
  "quality_score": 0-100,
  "rationale": "2-3 frases sobre la cobertura y riesgos detectados"
}`;

        this.updateState({ currentStep: 'auditor' });
        this.updateStep('auditor', {
            status: 'running',
            startedAt: new Date(),
            input: {
                topic: topic.title,
                documents: library.documents,
                evidenceCount: library.evidence.length
            },
            reasoning: 'Auditor: analizando cobertura y riesgos...'
        });

        let parsed: { gaps: string[]; optimizations: string[]; widgets: any[]; quality_score: number } = {
            gaps: [],
            optimizations: [],
            widgets: [],
            quality_score: 60
        };

        const llmStart = Date.now();
        try {
            const { json, raw, error } = await generateJSONWithRetry(prompt, 'Auditor', 1);

            if (error) {
                this.telemetry.log('auditor', 'error', `Parse JSON error: ${error}`);
                logDebug('Auditor parse error', { error, raw: raw?.slice(0, 400) });
            } else if (json) {
                parsed = { ...parsed, ...json };
                const rationale = extractRationale(raw, json);
                if (rationale) {
                    this.updateStep('auditor', { reasoning: rationale });
                }
                this.telemetry.log('auditor', 'complete', `LLM respondió en ${Date.now() - llmStart}ms (gaps: ${parsed.gaps.length}, score: ${parsed.quality_score})`);
            }
        } catch (err) {
            this.telemetry.log('auditor', 'timeout', `LLM timeout después de ${Date.now() - llmStart}ms: ${err instanceof Error ? err.message : 'error'}`);
            this.updateStep('auditor', {
                reasoning: `Auditor sin respuesta (${err instanceof Error ? err.message : 'error'}). Usando valores por defecto.`
            });
        }

        this.checkCancelled();

        const finalReasoning = (parsed as any).rationale
            ? (parsed as any).rationale
            : `Gaps: ${parsed.gaps.length}, widgets: ${parsed.widgets.length}, score: ${parsed.quality_score}`;

        this.updateStep('auditor', {
            status: 'completed',
            completedAt: new Date(),
            reasoning: finalReasoning,
            output: parsed
        });

        this.telemetry.log('auditor', 'complete', finalReasoning);
        return parsed;
    }

    // ============================================
    // TIMEKEEPER / PLANIFICADOR (simulado, usar plan diario en futuro)
    // ============================================
    private async runTimeKeeper(topic: TopicWithGroup): Promise<TimeKeeperDecision> {
        this.checkCancelled();
        this.telemetry.log('timekeeper', 'start', topic.title);

        this.updateState({ currentStep: 'timekeeper' });
        this.updateStep('timekeeper', {
            status: 'running',
            startedAt: new Date(),
            input: { topic: topic.title, time_heuristic: "default: 90min" },
            reasoning: 'Planificador: calculando estrategia de tiempo...'
        });

        // TODO: Leer plan diario/topic_time_estimates; por ahora heurística
        const availableMinutes = 90;
        let strategy: ConcisionStrategy = 'balanced';
        let recommendedTokens = 3200;
        let widgetBudget = 6;

        if (availableMinutes < 20) { strategy = 'executive_summary'; recommendedTokens = 500; widgetBudget = 2; }
        else if (availableMinutes < 40) { strategy = 'condensed'; recommendedTokens = 1400; widgetBudget = 3; }
        else if (availableMinutes < 90) { strategy = 'balanced'; recommendedTokens = 2600; widgetBudget = 5; }
        else { strategy = 'detailed'; recommendedTokens = 4200; widgetBudget = 8; }

        const decision: TimeKeeperDecision = {
            availableMinutes,
            recommendedTokens,
            strategy,
            widgetBudget
        };

        const finalReasoning = `Estrategia: ${strategy}, tiempo: ${availableMinutes}min, tokens: ${recommendedTokens}, widgets: ${widgetBudget}`;

        this.updateStep('timekeeper', {
            status: 'completed',
            completedAt: new Date(),
            output: decision,
            reasoning: finalReasoning
        });

        this.telemetry.log('timekeeper', 'complete', finalReasoning);
        return decision;
    }

    // ============================================
    // STRATEGIST: outline refinado + widgets placeholders
    // ============================================
    private async runStrategist(
        topic: TopicWithGroup,
        structure: TopicSection[],
        auditorData: { gaps: string[]; optimizations: string[]; widgets?: any[] },
        timeDecision: TimeKeeperDecision,
        evidence: any[] = []
    ): Promise<GeneratedTopicContent> {
        this.checkCancelled();
        const evidenceSummary = evidence.map(e => `- [${e.filename}]: ${e.fragment.slice(0, 300)}...`).join('\n');

        this.telemetry.log('strategist', 'start', `${topic.title} (strategy: ${timeDecision.strategy}, evidence: ${evidence.length} chunks)`);

        const prompt = `
Eres el Estratega. Genera contenido y widgets listos para disparar manualmente.

Tema: "${topic.title}" (Grupo: "${topic.groupTitle}")
Gaps: ${auditorData.gaps.join(', ') || 'Ninguno'}
Optimizations: ${auditorData.optimizations.join(', ') || 'Ninguna'}
Widgets sugeridos (Auditor): ${JSON.stringify(auditorData.widgets || [])}
Plan: estrategia ${timeDecision.strategy}, tokens ${timeDecision.recommendedTokens}, widget_budget ${timeDecision.widgetBudget}

EVIDENCIA DISPONIBLE (Úsala obligatoriamente para dar profundidad técnica):
${evidenceSummary}

Estructura base:
${JSON.stringify(structure, null, 2)}

Instrucciones:
- Debes mantener TODAS las secciones de la estructura base; no elimines niveles. Si propones nuevas, conserva las originales.
- Cada sección debe tener texto explicativo en Markdown, con al menos 3 párrafos y ≥180 palabras (≥220 si es detailed, ≥150 si es condensed). Objetivo global ≥${MIN_TOTAL_WORDS} palabras.
- Usa viñetas, negritas y subtítulos en "content.text" para legibilidad; incluye referencias legales específicas (Ley/Art. X) y ejemplos técnicos.
- Inserta widgets como placeholders con prompts accionables; no generes el widget completo si no es trivial. Respeta widget_budget.
- NO incluyas markdown externo ni código; responde solo JSON plano.

RESPUESTA SOLO JSON:
{
  "sections": [
    {
      "id": "string",
      "title": "string",
      "level": "h1|h2|h3",
      "sourceType": "library|augmented|mixed",
      "content": {
        "text": "texto explicativo",
        "widgets": []
      },
      "children": []
    }
  ],
  "widgets": [
    { "type": "mnemonic|timeline|diagram|quiz|alert", "title": "string", "prompt": "micro prompt", "section": "Visión General|Conceptos Clave|Desarrollo del Contenido|Aplicación Práctica" }
  ],
  "rationale": "2-3 frases sobre decisiones de estructura y tono"
}
`;

        this.updateState({ currentStep: 'strategist' });
        this.updateStep('strategist', {
            status: 'running',
            startedAt: new Date(),
            input: {
                gaps: auditorData.gaps,
                strategy: timeDecision.strategy,
                tokenLimit: timeDecision.recommendedTokens,
                widgetBudget: timeDecision.widgetBudget,
                prompt_preview: prompt.slice(0, 1000) + "..."
            },
            reasoning: 'Estratega: generando outline y widgets con pensamiento incluido...'
        });

        let parsed: any = { sections: structure, widgets: [] };
        const llmStart = Date.now();

        try {
            const { json, raw, error } = await generateJSONWithRetry(prompt, 'Estratega', 1);

            if (error) {
                this.telemetry.log('strategist', 'error', `Parse JSON error: ${error}`);
                parsed = { sections: structure, widgets: [] };
            } else if (json) {
                parsed = json;
                const rationale = extractRationale(raw, json);
                if (rationale) {
                    this.updateStep('strategist', { reasoning: rationale });
                }
                this.telemetry.log('strategist', 'complete', `LLM respondió en ${Date.now() - llmStart}ms (secciones: ${parsed.sections?.length || 0}, widgets: ${(parsed.widgets || []).length})`);
            }
        } catch (err) {
            this.updateStep('strategist', {
                reasoning: `Estratega sin respuesta (${err instanceof Error ? err.message : 'error'}).`
            });
            // Critical failure for strategist
            throw new Error(`Strategist LLM Failure: ${err instanceof Error ? err.message : 'timeout/error'}`);
            // parsed = { sections: structure, widgets: [] }; // Don't fallback to empty structure blindly
        }

        this.checkCancelled();

        // VALIDACIÓN RIGUROSA:
        // Si el LLM devolvió un JSON válido pero las secciones están vacías (o son copias de la estructura base sin texto),
        // esto es un fallo de generación, no un éxito parcial.

        let rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];

        // Si no hay secciones parseadas o si detectamos que son placeholders vacíos
        const hasGeneratedText = rawSections.some((s: any) => countWords(s.content?.text || '') > 30);

        if (!hasGeneratedText) {
            // Check legacy structure or flat structure
            if (parsed.sections && parsed.sections.length > 0) {
                // Maybe it kept the structure but didn't write text
                this.telemetry.log('strategist', 'error', 'LLM devolvió estructura sin contenido de texto.');
            } else {
                this.telemetry.log('strategist', 'error', 'LLM no devolvió secciones válidas.');
            }

            // INTENTO DE RECUPERACIÓN: Usar la estructura base pero FORZAR enriquecimiento
            rawSections = structure; // Fallback to base structure TO FILL IT
        }

        // Verificar si las secciones tienen contenido suficiente
        const sectionsWithContent = rawSections.filter((s: any) => {
            const text = (s.content?.text || '').trim();
            return countWords(text) >= MIN_WORDS_PER_SECTION;
        });

        const contentCoverage = rawSections.length > 0
            ? (sectionsWithContent.length / rawSections.length) * 100
            : 0;

        logDebug('Strategist: Validación de contenido', {
            totalSections: rawSections.length,
            sectionsWithContent: sectionsWithContent.length,
            coveragePercent: contentCoverage.toFixed(1)
        });

        // Si menos del 70% de secciones tienen contenido real, intentar regenerar o enriquecer
        // Si menos del 70% de secciones tienen contenido real, O si estamos en modo recuperación (texto vacío)
        if (contentCoverage < 70 || !hasGeneratedText) {
            this.telemetry.log('strategist', 'fallback', `Contenido insuficiente (${contentCoverage.toFixed(0)}% cobertura). Iniciando enriquecimiento agresivo...`);
            this.updateStep('strategist', {
                reasoning: `Generación inicial débil. Iniciando enriquecimiento paso a paso de todas las secciones...`
            });

            // Generar contenido para secciones vacías
            for (let i = 0; i < rawSections.length; i++) {
                const section = rawSections[i];
                const sectionText = (section.content?.text || '').trim();

                if (countWords(sectionText) < MIN_WORDS_PER_SECTION) {
                    try {
                        const enrichPrompt = `
Genera contenido educativo DETALLADO para esta sección de oposiciones ITOP.

Tema general: "${topic.title}"
Sección: "${section.title}"
Nivel: ${section.level}

CONTEXTO CLAVE (Usar para precisión):
${evidenceSummary.slice(0, 3000)}

Requisitos:
- Escribe al menos 200 palabras de contenido técnico.
- Explica conceptos, procedimientos o artículos legales relevantes.
- Usa formato Markdown limpio (listas, negritas) sin bloques de código.
- NO devuelvas JSON, solo texto educativo.
`;
                        // Log enrichment attempt
                        logDebug(`Strategist: Enriqueciendo "${section.title}" (length: ${countWords(sectionText)} words)`, { evidenceLen: evidenceSummary.length });

                        const model = getTextModel();
                        const enrichRes = await withTimeout(
                            model.generateContent(enrichPrompt),
                            45000,
                            `Enriquecimiento ${section.title}`
                        );

                        const enrichedContent = enrichRes.response.text().trim();

                        if (countWords(enrichedContent) > 50) {
                            rawSections[i].content.text = enrichedContent; // Replace empty/short content
                            logDebug(`Strategist: Enriquecimiento EXITOSO para "${section.title}" (+${countWords(enrichedContent)} words)`);
                        } else {
                            logDebug(`Strategist: Enriquecimiento devolvió poco texto para "${section.title}": ${enrichedContent.slice(0, 50)}...`);
                        }
                    } catch (err) {
                        logDebug(`Strategist: Error enriqueciendo sección "${section.title}"`, err);
                    }
                }
            }
        }

        // Asegurar que todas las secciones tengan al menos placeholder con texto descriptivo
        const safeSections = rawSections.map((s: any, idx: number) => {
            const sectionText = (s.content?.text || '').trim();
            const hasRealContent = countWords(sectionText) >= MIN_WORDS_PER_SECTION;

            // Si no hay contenido real, crear placeholder informativo
            const enrichedText = hasRealContent
                ? sectionText
                : `## ${s.title}

Esta sección cubre aspectos fundamentales del tema **${topic.title}** relacionados con ${s.title.toLowerCase()}.

### Contenido pendiente de generación

El sistema no pudo generar contenido completo para esta sección. Puedes:
- **Regenerar** el tema completo para intentar obtener mejor contenido
- **Consultar** la documentación original en la biblioteca
- **Añadir** tus propias notas manualmente

*Tip: Si el problema persiste, verifica que el documento fuente esté correctamente indexado en la biblioteca.*`;

            return {
                ...s,
                id: s.id || `sec-${idx}`,
                content: {
                    text: enrichedText,
                    widgets: s.content?.widgets || []
                },
                children: s.children || []
            };
        });

        // Segunda pasada si el total sigue bajo: reforzar primeras secciones
        let totalWords = safeSections.reduce((acc: number, s: any) => acc + countWords(s.content?.text || ''), 0);
        if (totalWords < MIN_TOTAL_WORDS && safeSections.length) {
            const slots = Math.min(3, safeSections.length);
            for (let i = 0; i < slots; i++) {
                const section = safeSections[i];
                const boostPrompt = `
Amplía esta sección para un temario de oposiciones ITOP con más detalle y referencias legales.
Sección: "${section.title}"
Tema: "${topic.title}"

CONTEXTO RELEVANTE:
${evidenceSummary.slice(0, 2000)}

Requisitos:
- Añade 120-180 palabras adicionales.
- Incluye ejemplos y menciona artículos de ley concretos si aplican.
- Usa Markdown (listas, negritas) sin código y sin JSON.
`;
                try {
                    const model = getTextModel();
                    const boostRes = await withTimeout(model.generateContent(boostPrompt), 30000, `Refuerzo sección ${section.title}`);
                    const boostText = boostRes.response.text().trim();
                    if (boostText) {
                        section.content.text = `${section.content.text}\n\n${boostText}`;
                    }
                } catch (err) {
                    logDebug(`Strategist: Error reforzando sección "${section.title}"`, err);
                }
            }
            totalWords = safeSections.reduce((acc: number, s: any) => acc + countWords(s.content?.text || ''), 0);
        }

        const sectionsBelowThreshold = safeSections.filter((s: any) => countWords(s.content?.text || '') < MIN_WORDS_PER_SECTION).length;
        const health = {
            totalWords,
            avgWordsPerSection: safeSections.length ? Math.round(totalWords / safeSections.length) : 0,
            sectionsBelowThreshold,
            minWordsPerSection: MIN_WORDS_PER_SECTION,
            totalSections: safeSections.length,
            wordGoalMet: totalWords >= MIN_TOTAL_WORDS && sectionsBelowThreshold === 0
        };

        // FINAL CHECK: If after enrichment we still have < 100 words total, FAIL HARD.
        if (totalWords < 100) {
            const msg = `Fallo Crítico: El Estratega no pudo generar contenido (Total palabras: ${totalWords}). Posible saturación del modelo o fallo de prompt.`;
            this.telemetry.log('strategist', 'error', msg);
            throw new Error(msg);
        }

        const warnings: string[] = [];
        if (!health.wordGoalMet) {
            warnings.push(`Cobertura insuficiente: ${totalWords} palabras (mín ${MIN_TOTAL_WORDS}), ${sectionsBelowThreshold} sección(es) bajo ${MIN_WORDS_PER_SECTION} palabras.`);
        }

        const generatedContent: GeneratedTopicContent = {
            topicId: topic.id,
            title: topic.title,
            metadata: {
                complexity: 'Medium',
                estimatedStudyTime: timeDecision.availableMinutes,
                sourceDocuments: [topic.originalFilename],
                generatedAt: new Date(),
                health
            },
            sections: safeSections,
            widgets: parsed.widgets || [],
            qualityStatus: warnings.length ? 'needs_improvement' : 'ok',
            warnings
        };

        logDebug('Strategist: métricas de salud', health);
        if (warnings.length) {
            this.telemetry.log('strategist', 'fallback', warnings.join(' | '));
        }

        const finalReasoning = (parsed as any).rationale
            ? (parsed as any).rationale
            : `Secciones: ${parsed.sections?.length || 0}, widgets: ${(parsed.widgets || []).length}. Estrategia: ${timeDecision.strategy}.`;

        this.updateStep('strategist', {
            status: 'completed',
            completedAt: new Date(),
            reasoning: finalReasoning,
            output: { sectionCount: parsed.sections?.length || 0, widgetCount: (parsed.widgets || []).length }
        });

        this.telemetry.log('strategist', 'complete', finalReasoning);
        return generatedContent;
    }

    // ============================================
    // ORQUESTACIÓN PRINCIPAL (sin auto-guardar)
    // ============================================
    async generate(): Promise<GeneratedTopicContent> {
        this.telemetry.reset();
        this.cancelled = false;
        this.abortController = new AbortController();

        const apiKey = safeGetAPIKey();
        logDebug('Iniciando generación', {
            topicId: this.state.topicId,
            hasApiKey: !!apiKey,
            apiKeyLength: apiKey?.length || 0,
            model: MODEL,
            supabaseConfigured: !!SUPABASE_URL
        });
        console.log(`[GENERATOR] Usando modelo: ${MODEL}, API Key presente: ${!!apiKey} (${apiKey?.slice(0, 8) || 'N/A'}...), Supabase: ${!!SUPABASE_URL}`);
        this.telemetry.log('global', 'start', `Iniciando generación para ${this.state.topicId} (RAG: ${!!SUPABASE_URL})`);

        // Verificar API Key (getAPIKey() lanzará error si falta)
        try {
            getAPIKey();
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Falta GEMINI_API_KEY";
            this.telemetry.log('global', 'error', 'Falta API KEY');
            logDebug('ERROR: API KEY no configurada');
            this.updateState({
                status: 'error',
                currentStep: null
            });
            throw error;
        }

        const topic = getTopicById(this.state.topicId);
        if (!topic) {
            this.telemetry.log('global', 'error', `Topic no encontrado: ${this.state.topicId}`);
            throw new Error(`Topic not found: ${this.state.topicId}`);
        }

        logDebug('Topic encontrado', { title: topic.title, group: topic.groupTitle });

        this.updateState({ status: 'fetching' });

        try {
            // 1. Librarian
            const librarian = await this.runLibrarian(topic);

            // 2. Auditor
            this.updateState({ status: 'analyzing' });
            const auditor = await this.runAuditor(topic, { documents: librarian.documents, evidence: librarian.evidence });

            // 3. TimeKeeper / Planificador
            this.updateState({ status: 'planning' });
            const plan = await this.runTimeKeeper(topic);

            // 4. Strategist
            this.updateState({ status: 'generating' });
            const result = await this.runStrategist(topic, librarian.structure, auditor, plan, librarian.evidence);

            // 5. Final
            this.telemetry.log('global', 'complete', `Generación completada en ${this.telemetry.getEvents().length} eventos`);
            this.updateState({
                status: 'completed',
                currentStep: null,
                result
            });

            return result;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
            const isCancellation = errorMsg.includes('cancelada') || errorMsg.includes('Cancelled');

            this.telemetry.log('global', isCancellation ? 'error' : 'error', errorMsg);
            this.updateState({
                status: 'error',
                currentStep: null
            });

            // Actualizar el paso actual con el error
            if (this.state.currentStep) {
                this.updateStep(this.state.currentStep, {
                    status: 'error',
                    error: errorMsg,
                    reasoning: isCancellation ? 'Cancelado por el usuario' : `Error: ${errorMsg}`,
                    completedAt: new Date()
                });
            }

            throw error;
        } finally {
            this.abortController = null;
        }
    }
}

// Helper
export async function generateTopicContent(
    topicId: string,
    onStateChange?: (state: OrchestrationState) => void
): Promise<GeneratedTopicContent> {
    const generator = new TopicContentGenerator(topicId, onStateChange);
    return generator.generate();
}

export async function generateTopicContentWithTrace(
    topicId: string,
    onStateChange?: (state: OrchestrationState) => void
): Promise<{ result: GeneratedTopicContent; state: OrchestrationState }> {
    const generator = new TopicContentGenerator(topicId, onStateChange);
    const result = await generator.generate();
    return { result, state: generator.getState() };
}
