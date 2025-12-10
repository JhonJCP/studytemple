/**
 * TOPIC CONTENT GENERATOR - Flujo multi-cerebro
 * Librarian -> Auditor -> TimeKeeper/Planificador -> Strategist -> Orchestrator (final)
 * Cada paso genera JSON y se guarda en el estado (se puede persistir fuera si se desea).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
    TopicSection,
    GeneratedTopicContent,
    OrchestrationState,
    AgentStep,
    AgentRole,
    TimeKeeperDecision,
    ConcisionStrategy,
    WidgetDefinition
} from "./widget-types";
import { getTopicById, generateBaseHierarchy, TopicWithGroup } from "./syllabus-hierarchy";

const API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const MODEL = "gemini-3-pro-preview";
const genAI = new GoogleGenerativeAI(API_KEY);

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
        this.updateStep('librarian', { status: 'running', startedAt: new Date() });

        const structure = generateBaseHierarchy(topic);
        const documents = [topic.originalFilename];
        let evidence: any[] = [];

        try {
            const model = genAI.getGenerativeModel({ model: MODEL, generationConfig: { responseMimeType: "application/json" } });
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
  "documents": ["${topic.originalFilename}"]
}
No inventes texto largo; resume en frases cortas.`;
            const res = await model.generateContent(prompt);
            const json = JSON.parse(res.response.text().replace(/```json/g, "").replace(/```/g, "").trim());
            evidence = json.evidence || [];
        } catch {
            evidence = [];
        }

        this.updateStep('librarian', {
            status: 'completed',
            completedAt: new Date(),
            reasoning: `Estructura base generada. Evidencias: ${evidence.length}.`,
            output: { documentCount: documents.length, sectionCount: structure.length, evidence }
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
        this.updateState({ currentStep: 'auditor' });
        this.updateStep('auditor', {
            status: 'running',
            startedAt: new Date(),
            input: { topic: topic.title, documents: library.documents }
        });

        let parsed: { gaps: string[]; optimizations: string[]; widgets: any[]; quality_score: number } = {
            gaps: [],
            optimizations: [],
            widgets: [],
            quality_score: 60
        };

        try {
            const model = genAI.getGenerativeModel({ model: MODEL, generationConfig: { responseMimeType: "application/json" } });
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
  "quality_score": 0-100
}`;
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = { ...parsed, ...JSON.parse(jsonMatch[0]) };
            }
        } catch {
            parsed = parsed;
        }

        this.updateStep('auditor', {
            status: 'completed',
            completedAt: new Date(),
            reasoning: `Gaps: ${parsed.gaps.length}, widgets: ${parsed.widgets.length}, score: ${parsed.quality_score}`,
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
        const availableMinutes = 60;
        let strategy: ConcisionStrategy = 'balanced';
        let recommendedTokens = 2000;
        let widgetBudget = 5;

        if (availableMinutes < 20) { strategy = 'executive_summary'; recommendedTokens = 500; widgetBudget = 2; }
        else if (availableMinutes < 40) { strategy = 'condensed'; recommendedTokens = 1200; widgetBudget = 3; }
        else if (availableMinutes < 90) { strategy = 'balanced'; recommendedTokens = 2200; widgetBudget = 5; }
        else { strategy = 'detailed'; recommendedTokens = 4000; widgetBudget = 8; }

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
        this.updateState({ currentStep: 'strategist' });
        this.updateStep('strategist', {
            status: 'running',
            startedAt: new Date(),
            input: { gaps: auditorData.gaps, strategy: timeDecision.strategy, tokenLimit: timeDecision.recommendedTokens }
        });

        let parsed: any = { sections: structure, widgets: [] };
        try {
            const model = genAI.getGenerativeModel({
                model: MODEL,
                generationConfig: { responseMimeType: "application/json" }
            });

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
- Genera texto explicativo por sección (<= 400 palabras) en "content.text".
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
  ]
}
`;

            const result = await model.generateContent(prompt);
            const rawText = result.response.text();
            try {
                const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                const firstBrace = cleaned.indexOf("{");
                const lastBrace = cleaned.lastIndexOf("}");
                const jsonText = firstBrace >= 0 && lastBrace > firstBrace ? cleaned.substring(firstBrace, lastBrace + 1) : cleaned;
                parsed = JSON.parse(jsonText);
            } catch {
                parsed = { sections: structure, widgets: [] };
            }
        } catch {
            parsed = { sections: structure, widgets: [] };
        }

        // Asegurar que haya texto en content.text aunque sea placeholder
        const safeSections = (parsed.sections || structure).map((s: any, idx: number) => ({
            ...s,
            id: s.id || `sec-${idx}`,
            content: {
                text: s.content?.text || 'Contenido generado. Expande para ver detalles.',
                widgets: s.content?.widgets || []
            },
            children: s.children || []
        }));

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
            reasoning: `Secciones: ${parsed.sections?.length || 0}, widgets: ${(parsed.widgets || []).length}. Estrategia: ${timeDecision.strategy}.`,
            output: { sectionCount: parsed.sections?.length || 0, widgetCount: (parsed.widgets || []).length }
        });

        return generatedContent;
    }

    // ============================================
    // ORQUESTACIÓN PRINCIPAL (sin auto-guardar)
    // ============================================
    async generate(): Promise<GeneratedTopicContent> {
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
