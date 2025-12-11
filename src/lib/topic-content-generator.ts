/**
 * TOPIC CONTENT GENERATOR - Flujo multi-cerebro
 * Librarian -> Auditor -> TimeKeeper/Planificador -> Strategist -> Orchestrator (final)
 * Cada paso genera JSON y se guarda en el estado (se puede persistir fuera si se desea).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";
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
const MODEL = "gemini-3-pro-preview";
const genAI = new GoogleGenerativeAI(API_KEY);
const TEMARIO_ROOT = path.resolve(process.cwd(), "..", "Temario");
const STEP_TIMEOUT_MS = parseInt(process.env.AGENT_STEP_TIMEOUT_MS || "90000", 10); // timeout genérico por cerebro (por defecto 90s)
const BASE_GENERATION_CONFIG = { responseMimeType: "application/json", includeThoughts: true } as const;

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
// UTILIDADES DE EVIDENCIA LOCAL (RAG SIMPLE)
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

async function findDocumentPath(originalFilename: string): Promise<string | null> {
    const target = slugify(originalFilename);

    // Estrategia: buscar en carpetas candidatas poco profundas, evitando recorrer todo el Temario
    const candidates = [
        path.join(TEMARIO_ROOT, "Legislacion y Material fundacional"),
        path.join(TEMARIO_ROOT, "Legislación y Material fundacional"), // por si hay acento
        TEMARIO_ROOT,
        path.resolve(process.cwd(), "Temario"),
    ];

    async function walk(dir: string, depth = 0): Promise<string | null> {
        if (depth > 3) return null; // límite para evitar cuelgues
        let entries: any[] = [];
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
            return null;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const found = await walk(fullPath, depth + 1);
                if (found) return found;
            } else {
                const norm = slugify(entry.name);
                if (norm.includes(target) || target.includes(norm)) {
                    return fullPath;
                }
            }
        }
        return null;
    }

    for (const base of candidates) {
        const found = await walk(base);
        if (found) return found;
    }
    return null;
}

function chunkText(text: string, size = 1100, overlap = 120): string[] {
    const clean = text.replace(/\s+/g, " ").trim();
    const chunks: string[] = [];
    let idx = 0;
    while (idx < clean.length) {
        const slice = clean.slice(idx, idx + size);
        chunks.push(slice);
        idx += size - overlap;
    }
    return chunks;
}

async function loadPdfEvidence(filePath: string): Promise<Array<{ source_id: string; filename: string; fragment: string; law_refs: string[]; confidence: number }>> {
    try {
        const buffer = await fs.readFile(filePath);
        const parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText({ pageJoiner: "\n" });
        const text = textResult.text || "";
        const pieces = chunkText(text).slice(0, 12);
        return pieces.map((fragment, i) => ({
            source_id: `pdf-${i + 1}`,
            filename: path.basename(filePath),
            fragment,
            law_refs: [],
            confidence: 0.92
        }));
    } catch {
        return [];
    }
}

// ============================================
// CLASE PRINCIPAL
// ============================================

export class TopicContentGenerator {
    private state: OrchestrationState;
    private onStateChange?: (state: OrchestrationState) => void;

    constructor(topicId: string, onStateChange?: (state: OrchestrationState) => void) {
        this.state = {
            topicId,
            status: 'idle',
            steps: [],
            currentStep: null,
        };
        this.onStateChange = onStateChange;
    }

    private updateState(updates: Partial<OrchestrationState>) {
        this.state = { ...this.state, ...updates };
        this.onStateChange?.(this.state);
    }

    getState(): OrchestrationState {
        return this.state;
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

    // ============================================
    // LIBRARIAN: estructura base + evidencia breve
    // ============================================
    private async runLibrarian(topic: TopicWithGroup): Promise<{
        structure: TopicSection[];
        documents: string[];
        evidence: any[];
    }> {
        this.updateState({ currentStep: 'librarian' });
        const structure = generateBaseHierarchy(topic);
        let docPath: string | null = null;
        try {
            docPath = await withTimeout(findDocumentPath(topic.originalFilename), Math.min(STEP_TIMEOUT_MS, 60000), "Búsqueda de PDF");
        } catch (err) {
            docPath = null;
            this.updateStep('librarian', {
                status: 'running',
                reasoning: `Búsqueda lenta o fallida (${err instanceof Error ? err.message : 'error desconocido'}). Uso fallback LLM.`
            });
        }
        const documents = docPath ? [docPath] : [topic.originalFilename];
        let evidence: any[] = [];

        this.updateStep('librarian', {
            status: 'running',
            startedAt: new Date(),
            input: { docPath, topic: topic.title },
            reasoning: docPath ? `Buscando evidencia en ${path.basename(docPath)}` : 'Buscando evidencia (sin ruta directa, usando LLM si no se encuentra PDF)'
        });

        // 1) Intentar cargar evidencia real desde el PDF
        if (docPath) {
            try {
                evidence = await withTimeout(loadPdfEvidence(docPath), Math.min(STEP_TIMEOUT_MS, 60000), "Parseo PDF");
                this.updateStep('librarian', {
                    reasoning: `Evidencia cargada desde PDF (${evidence.length} fragmentos).`
                });
            } catch (err) {
                evidence = [];
                this.updateStep('librarian', {
                    reasoning: `Fallo al leer PDF (${err instanceof Error ? err.message : 'error'}). Se intentará LLM.`
                });
            }
        }

        // 2) Fallback a prompt LLM si no hay evidencia local
        if (!evidence.length) {
            const prompt = `
Eres el Bibliotecario. Devuelve evidencia breve (fragmentos) para el tema:
- Título: "${topic.title}"
- Grupo: "${topic.groupTitle}"
- Archivo principal: "${topic.originalFilename}"

Salida JSON:
{
  "evidence": [
    { "source_id": "doc-1", "filename": "${topic.originalFilename}", "fragment": "fragmento literal (<=400 chars)", "law_refs": ["ref1","ref2"], "confidence": 0.85 }
  ],
  "documents": ["${topic.originalFilename}"],
  "rationale": "razonamiento breve (2 frases) sobre cómo seleccionaste los fragmentos"
}
No inventes texto largo; resume en frases cortas.`;

            try {
                const model = getThinkingModel();
                const res = await withTimeout(model.generateContent(prompt), STEP_TIMEOUT_MS, "Bibliotecario LLM");
                const json = JSON.parse(res.response.text().replace(/```json/g, "").replace(/```/g, "").trim());
                evidence = json.evidence || [];
                const rationale = json.rationale ? `LLM: ${json.rationale}` : 'LLM ejecutado sin rationale explícito';
                this.updateStep('librarian', { reasoning: rationale });
            } catch (err) {
                evidence = [];
                this.updateStep('librarian', {
                    reasoning: `LLM sin respuesta (${err instanceof Error ? err.message : 'error'}).`
                });
            }
        }

        this.updateStep('librarian', {
            status: 'completed',
            completedAt: new Date(),
            reasoning: (() => {
                if (docPath && evidence.length) return `Estructura base generada y ${evidence.length} fragmentos reales desde PDF.`;
                if (docPath && !evidence.length) return `Estructura base generada. Sin evidencia del PDF, se usará LLM.`;
                return `Estructura base generada. Evidencias (LLM): ${evidence.length}.`;
            })(),
            output: { documentCount: documents.length, sectionCount: structure.length, evidence, docPath }
        });

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
                prompt
            },
            reasoning: 'Auditor: analizando cobertura y riesgos...'
        });

        let parsed: { gaps: string[]; optimizations: string[]; widgets: any[]; quality_score: number } = {
            gaps: [],
            optimizations: [],
            widgets: [],
            quality_score: 60
        };

        try {
            const model = getThinkingModel();
            const result = await withTimeout(model.generateContent(prompt), STEP_TIMEOUT_MS, "Auditor LLM");
            const text = result.response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = { ...parsed, ...JSON.parse(jsonMatch[0]) };
                if ((parsed as any).rationale) {
                    this.updateStep('auditor', { reasoning: (parsed as any).rationale });
                }
            }
        } catch (err) {
            this.updateStep('auditor', {
                reasoning: `Auditor sin respuesta (${err instanceof Error ? err.message : 'error'}).`
            });
            parsed = parsed;
        }

        this.updateStep('auditor', {
            status: 'completed',
            completedAt: new Date(),
            reasoning: (parsed as any).rationale
                ? (parsed as any).rationale
                : `Gaps: ${parsed.gaps.length}, widgets: ${parsed.widgets.length}, score: ${parsed.quality_score}`,
            output: parsed
        });
        return parsed;
    }

    // ============================================
    // TIMEKEEPER / PLANIFICADOR (simulado, usar plan diario en futuro)
    // ============================================
    private async runTimeKeeper(topic: TopicWithGroup): Promise<TimeKeeperDecision> {
        this.updateState({ currentStep: 'timekeeper' });
        this.updateStep('timekeeper', {
            status: 'running',
            startedAt: new Date(),
            input: { topic: topic.title }
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

        this.updateStep('timekeeper', {
            status: 'completed',
            completedAt: new Date(),
            output: decision,
            reasoning: `Estrategia: ${strategy}, min: ${availableMinutes}, widgets: ${widgetBudget}`
        });

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
                prompt
            },
            reasoning: 'Estratega: generando outline y widgets con pensamiento incluido...'
        });

        let parsed: any = { sections: structure, widgets: [] };
        try {
            const model = getThinkingModel();

            const result = await withTimeout(model.generateContent(prompt), STEP_TIMEOUT_MS, "Estratega LLM");
            const rawText = result.response.text();
            try {
                const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                const firstBrace = cleaned.indexOf("{");
                const lastBrace = cleaned.lastIndexOf("}");
                const jsonText = firstBrace >= 0 && lastBrace > firstBrace ? cleaned.substring(firstBrace, lastBrace + 1) : cleaned;
                parsed = JSON.parse(jsonText);
                if (parsed.rationale) {
                    this.updateStep('strategist', { reasoning: parsed.rationale });
                }
            } catch {
                parsed = { sections: structure, widgets: [] };
            }
        } catch (err) {
            this.updateStep('strategist', {
                reasoning: `Estratega sin respuesta (${err instanceof Error ? err.message : 'error'}).`
            });
            parsed = { sections: structure, widgets: [] };
        }

        // Asegurar que haya texto en content.text aunque sea placeholder
        const safeSections = (parsed.sections || structure).map((s: any, idx: number) => {
            const rawText = (s.content?.text || '').trim();
            const enrichedText = rawText || `## ${s.title}\nContenido generado. Expande para ver detalles y completa con tus notas.`;

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

        this.updateStep('strategist', {
            status: 'completed',
            completedAt: new Date(),
            reasoning: (parsed as any).rationale
                ? (parsed as any).rationale
                : `Secciones: ${parsed.sections?.length || 0}, widgets: ${(parsed.widgets || []).length}. Estrategia: ${timeDecision.strategy}.`,
            output: { sectionCount: parsed.sections?.length || 0, widgetCount: (parsed.widgets || []).length }
        });

        return generatedContent;
    }

    // ============================================
    // ORQUESTACIÓN PRINCIPAL (sin auto-guardar)
    // ============================================
    async generate(): Promise<GeneratedTopicContent> {
        if (!API_KEY) {
            this.updateState({
                status: 'error',
                currentStep: null
            });
            throw new Error("Falta GEMINI_API_KEY / NEXT_PUBLIC_GEMINI_API_KEY para generar el temario.");
        }

        const topic = getTopicById(this.state.topicId);
        if (!topic) {
            throw new Error(`Topic not found: ${this.state.topicId}`);
        }

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
            this.updateState({
                status: 'completed',
                currentStep: null,
                result
            });

            return result;
        } catch (error) {
            this.updateState({
                status: 'error',
                currentStep: null
            });
            throw error;
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
