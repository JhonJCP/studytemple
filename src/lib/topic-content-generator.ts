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

const API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
// Modelo Gemini 3 Pro - verificado en Google AI Studio
const MODEL = process.env.GEMINI_MODEL || "gemini-3-pro";
const genAI = new GoogleGenerativeAI(API_KEY);

// Supabase para RAG (lazy initialization)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getSupabaseClient() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return null;
    }
    return createClient(SUPABASE_URL, SUPABASE_KEY);
}

const STEP_TIMEOUT_MS = parseInt(process.env.AGENT_STEP_TIMEOUT_MS || "90000", 10);
const BASE_GENERATION_CONFIG = { 
    temperature: 0.7,
    maxOutputTokens: 8192,
    responseMimeType: "application/json"
} as const;
const DEBUG_LOG = process.env.NODE_ENV !== "production";

function logDebug(message: string, data?: unknown) {
    console.log(`[GENERATOR] ${message}`, data ? JSON.stringify(data).slice(0, 500) : '');
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
        if (DEBUG_LOG) {
            console.log(`[GENERATOR] ${entry.agent.toUpperCase()} ${entry.event}${details ? `: ${details}` : ''} (+${entry.durationMs}ms)`);
        }
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
    return genAI.getGenerativeModel({
        model: MODEL,
        generationConfig: BASE_GENERATION_CONFIG
    });
}

// ============================================
// UTILIDADES GENERALES
// ============================================

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
 * Busca chunks relevantes en Supabase basándose en el filename del topic
 * Los documentos ya están chunkeados y almacenados en library_documents
 */
async function fetchDocumentChunksFromSupabase(
    originalFilename: string,
    topicTitle: string,
    maxChunks: number = 15
): Promise<DocumentChunk[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
        logDebug('Supabase no configurado, no se puede hacer RAG');
        return [];
    }

    logDebug('Buscando chunks en Supabase', { originalFilename, topicTitle });

    try {
        // 1. Buscar por filename exacto o parcial
        const filenameSearch = originalFilename.replace(/\.pdf$/i, '');
        
        const { data: byFilename, error: err1 } = await supabase
            .from('library_documents')
            .select('id, content, metadata')
            .ilike('metadata->>filename', `%${filenameSearch}%`)
            .order('metadata->chunk_index', { ascending: true })
            .limit(maxChunks);

        if (err1) {
            logDebug('Error buscando por filename', err1);
        }

        let chunks: DocumentChunk[] = [];

        if (byFilename && byFilename.length > 0) {
            logDebug(`Encontrados ${byFilename.length} chunks por filename`);
            chunks = byFilename.map((doc: any, i: number) => ({
                source_id: `db-${doc.id}`,
                filename: doc.metadata?.filename || originalFilename,
                fragment: doc.content || '',
                category: doc.metadata?.category || 'UNKNOWN',
                chunk_index: doc.metadata?.chunk_index ?? i,
                confidence: 0.95
            }));
        }

        // 2. Si no hay suficientes chunks, buscar por palabras clave del título
        if (chunks.length < 5) {
            const keywords = topicTitle
                .toLowerCase()
                .replace(/[^a-záéíóúñ\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 4)
                .slice(0, 3);

            logDebug('Buscando por keywords', keywords);

            for (const keyword of keywords) {
                if (chunks.length >= maxChunks) break;

                const { data: byKeyword, error: err2 } = await supabase
                    .from('library_documents')
                    .select('id, content, metadata')
                    .ilike('content', `%${keyword}%`)
                    .limit(5);

                if (!err2 && byKeyword) {
                    const newChunks = byKeyword
                        .filter((doc: any) => !chunks.some(c => c.source_id === `db-${doc.id}`))
                        .map((doc: any) => ({
                            source_id: `db-${doc.id}`,
                            filename: doc.metadata?.filename || 'unknown',
                            fragment: doc.content || '',
                            category: doc.metadata?.category || 'UNKNOWN',
                            chunk_index: doc.metadata?.chunk_index ?? 0,
                            confidence: 0.75
                        }));
                    chunks.push(...newChunks);
                }
            }
        }

        logDebug(`Total chunks RAG: ${chunks.length}`);
        return chunks.slice(0, maxChunks);

    } catch (error) {
        logDebug('Error en fetchDocumentChunksFromSupabase', error);
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
        // Limpiar markdown code blocks
        let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
        // Encontrar el objeto JSON principal
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
        return { json: JSON.parse(cleaned), error: null };
    } catch (e) {
        return { json: null, error: e instanceof Error ? e.message : 'Parse error' };
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
        this.telemetry.log('librarian', 'start', topic.title);
        logDebug('Librarian iniciando con RAG desde Supabase', { topic: topic.title, filename: topic.originalFilename });
        this.updateState({ currentStep: 'librarian' });
        const structure = generateBaseHierarchy(topic);
        
        this.updateStep('librarian', {
            status: 'running',
            startedAt: new Date(),
            input: { topic: topic.title, filename: topic.originalFilename },
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
                reasoning: `Error buscando en Supabase (${err instanceof Error ? err.message : 'error'}). Usando conocimiento del modelo.`
            });
        }

        this.checkCancelled();

        // 2) Si no hay evidencia de Supabase, pedir al LLM que genere contexto base
        if (!evidence.length) {
            this.telemetry.log('librarian', 'fallback', 'Sin evidencia Supabase, usando LLM para contexto base');
            const prompt = `
Eres el Bibliotecario de una plataforma de estudio de oposiciones (ITOP - Ingeniero Técnico de Obras Públicas).
Genera un resumen estructurado del tema para usar como base de estudio.

Tema: "${topic.title}"
Grupo temático: "${topic.groupTitle}"
Documento de referencia: "${topic.originalFilename}"

Proporciona información REAL y PRECISA sobre este tema de oposiciones españolas.
Incluye referencias a artículos de ley, normativa aplicable y conceptos clave.

Salida JSON:
{
  "evidence": [
    { "source_id": "base-1", "filename": "${topic.originalFilename}", "fragment": "resumen del contenido principal (máx 500 chars)", "law_refs": ["Ley X/YYYY", "RD Z"], "confidence": 0.7 },
    { "source_id": "base-2", "filename": "${topic.originalFilename}", "fragment": "conceptos y definiciones clave", "law_refs": [], "confidence": 0.7 }
  ],
  "documents": ["${topic.originalFilename}"],
  "rationale": "He generado un resumen base del tema basándome en la normativa española aplicable"
}`;

            const llmStart = Date.now();
            try {
                const model = getThinkingModel();
                const res = await withTimeout(model.generateContent(prompt), STEP_TIMEOUT_MS, "Bibliotecario LLM");
                const rawText = res.response.text();
                const { json, error } = safeParseJSON(rawText);
                
                if (!error && json) {
                    evidence = json.evidence || [];
                    const rationale = extractRationale(rawText, json);
                    this.updateStep('librarian', { 
                        reasoning: rationale || `Modelo generó ${evidence.length} fragmentos de contexto base.` 
                    });
                    this.telemetry.log('librarian', 'complete', `LLM generó contexto en ${Date.now() - llmStart}ms`);
                }
            } catch (err) {
                this.telemetry.log('librarian', 'error', `LLM error: ${err instanceof Error ? err.message : 'error'}`);
            }
        }

        const finalReasoning = evidence.length > 0
            ? `Estructura generada con ${evidence.length} fragmentos de evidencia de ${documents.length} documento(s).`
            : 'Estructura base generada. El contenido se completará con el modelo.';

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
            const model = getThinkingModel();
            const result = await withTimeout(model.generateContent(prompt), STEP_TIMEOUT_MS, "Auditor LLM");
            const rawText = result.response.text();
            const { json, error } = safeParseJSON(rawText);
            
            if (error) {
                this.telemetry.log('auditor', 'error', `Parse JSON error: ${error}`);
            } else if (json) {
                parsed = { ...parsed, ...json };
                const rationale = extractRationale(rawText, json);
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
            input: { topic: topic.title },
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
        timeDecision: TimeKeeperDecision
    ): Promise<GeneratedTopicContent> {
        this.checkCancelled();
        this.telemetry.log('strategist', 'start', `${topic.title} (strategy: ${timeDecision.strategy})`);
        
        const prompt = `
Eres el Estratega. Genera contenido y widgets listos para disparar manualmente.

Tema: "${topic.title}" (Grupo: "${topic.groupTitle}")
Gaps: ${auditorData.gaps.join(', ') || 'Ninguno'}
Optimizations: ${auditorData.optimizations.join(', ') || 'Ninguna'}
Widgets sugeridos (Auditor): ${JSON.stringify(auditorData.widgets || [])}
Plan: estrategia ${timeDecision.strategy}, tokens ${timeDecision.recommendedTokens}, widget_budget ${timeDecision.widgetBudget}

Estructura base:
${JSON.stringify(structure, null, 2)}

Instrucciones:
- Refina la estructura con bullets claros por sección.
- Genera texto explicativo en Markdown por sección (mínimo 2 párrafos o 180-220 palabras para estrategia balanced/detailed, 120+ para condensed).
- Usa viñetas, negritas y subtítulos en "content.text" para que no se vea raw.
- Incluye ejemplos o mini-casos cuando aplique. 
- Inserta widgets como placeholders con prompts accionables; no generes el widget completo si no es trivial.
- Respeta presupuesto de widgets y tono según estrategia (executive/condensed/balanced/detailed/exhaustive).

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
                widgetBudget: timeDecision.widgetBudget
            },
            reasoning: 'Estratega: generando outline y widgets con pensamiento incluido...'
        });

        let parsed: any = { sections: structure, widgets: [] };
        const llmStart = Date.now();
        
        try {
            const model = getThinkingModel();
            const result = await withTimeout(model.generateContent(prompt), STEP_TIMEOUT_MS, "Estratega LLM");
            const rawText = result.response.text();
            const { json, error } = safeParseJSON(rawText);
            
            if (error) {
                this.telemetry.log('strategist', 'error', `Parse JSON error: ${error}`);
                parsed = { sections: structure, widgets: [] };
            } else if (json) {
                parsed = json;
                const rationale = extractRationale(rawText, json);
                if (rationale) {
                    this.updateStep('strategist', { reasoning: rationale });
                }
                this.telemetry.log('strategist', 'complete', `LLM respondió en ${Date.now() - llmStart}ms (secciones: ${parsed.sections?.length || 0}, widgets: ${(parsed.widgets || []).length})`);
            }
        } catch (err) {
            this.telemetry.log('strategist', 'timeout', `LLM timeout después de ${Date.now() - llmStart}ms: ${err instanceof Error ? err.message : 'error'}`);
            this.updateStep('strategist', {
                reasoning: `Estratega sin respuesta (${err instanceof Error ? err.message : 'error'}). Usando estructura base.`
            });
            parsed = { sections: structure, widgets: [] };
        }

        this.checkCancelled();

        // Asegurar que haya texto en content.text aunque sea placeholder
        const safeSections = (parsed.sections || structure).map((s: any, idx: number) => {
            const sectionText = (s.content?.text || '').trim();
            const enrichedText = sectionText || `## ${s.title}\nContenido generado. Expande para ver detalles y completa con tus notas.`;

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

        const generatedContent: GeneratedTopicContent = {
            topicId: topic.id,
            title: topic.title,
            metadata: {
                complexity: 'Medium',
                estimatedStudyTime: timeDecision.availableMinutes,
                sourceDocuments: [topic.originalFilename],
                generatedAt: new Date()
            },
            sections: safeSections,
            widgets: parsed.widgets || []
        };

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
        
        logDebug('Iniciando generación', { 
            topicId: this.state.topicId, 
            hasApiKey: !!API_KEY,
            apiKeyLength: API_KEY.length,
            model: MODEL,
            supabaseConfigured: !!SUPABASE_URL
        });
        console.log(`[GENERATOR] Usando modelo: ${MODEL}, API Key presente: ${!!API_KEY} (${API_KEY.slice(0,8)}...), Supabase: ${!!SUPABASE_URL}`);
        this.telemetry.log('global', 'start', `Iniciando generación para ${this.state.topicId} (RAG: ${!!SUPABASE_URL})`);
        
        if (!API_KEY) {
            const errorMsg = "Falta GEMINI_API_KEY en las variables de entorno del servidor. Configúrala en Vercel Dashboard > Settings > Environment Variables.";
            this.telemetry.log('global', 'error', 'Falta API KEY');
            logDebug('ERROR: API KEY no configurada');
            this.updateState({
                status: 'error',
                currentStep: null
            });
            throw new Error(errorMsg);
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
            const result = await this.runStrategist(topic, librarian.structure, auditor, plan);

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
