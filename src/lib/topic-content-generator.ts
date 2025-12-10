/**
 * TOPIC CONTENT GENERATOR - Servicio de Generación de Contenido
 * 
 * Orquesta los agentes para generar contenido de un tema:
 * Librarian -> Auditor -> TimeKeeper -> Strategist
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

// ============================================
// CONFIGURACIÓN
// ============================================

const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

// ============================================
// CLASE PRINCIPAL DEL GENERADOR
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

    getState(): OrchestrationState {
        return this.state;
    }

    private updateState(updates: Partial<OrchestrationState>) {
        this.state = { ...this.state, ...updates };
        this.onStateChange?.(this.state);
    }

    private updateStep(role: AgentRole, updates: Partial<AgentStep>) {
        const stepIndex = this.state.steps.findIndex(s => s.role === role);
        if (stepIndex >= 0) {
            this.state.steps[stepIndex] = { ...this.state.steps[stepIndex], ...updates };
        } else {
            this.state.steps.push({ role, status: 'pending', ...updates });
        }
        this.onStateChange?.(this.state);
    }

    // ============================================
    // AGENTE 1: LIBRARIAN
    // ============================================

    private async runLibrarian(topic: TopicWithGroup): Promise<{
        structure: TopicSection[];
        documents: string[];
    }> {
        this.updateState({ currentStep: 'librarian' });
        this.updateStep('librarian', { status: 'running', startedAt: new Date() });

        try {
            // Generar estructura base
            const structure = generateBaseHierarchy(topic);

            // TODO: Buscar documentos reales en Supabase
            const documents = [topic.originalFilename];

            this.updateStep('librarian', {
                status: 'completed',
                completedAt: new Date(),
                reasoning: `Encontrado documento principal: ${topic.originalFilename}. Estructura base generada con ${structure[0]?.children?.length || 0} secciones.`,
                output: { documentCount: documents.length, sectionCount: structure.length }
            });

            return { structure, documents };
        } catch (error) {
            this.updateStep('librarian', {
                status: 'error',
                error: String(error),
                completedAt: new Date()
            });
            throw error;
        }
    }

    // ============================================
    // AGENTE 2: AUDITOR
    // ============================================

    private async runAuditor(topic: TopicWithGroup, libraryContext: { documents: string[] }): Promise<{
        gaps: string[];
        optimizations: string[];
    }> {
        this.updateState({ currentStep: 'auditor' });
        this.updateStep('auditor', {
            status: 'running',
            startedAt: new Date(),
            input: { topic: topic.title, documents: libraryContext.documents }
        });

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

            const prompt = `
        Analiza el siguiente tema de oposición y detecta posibles vacíos (GAPS):
        
        TEMA: "${topic.title}"
        DOCUMENTOS DISPONIBLES: ${libraryContext.documents.join(', ')}
        
        Tu tarea:
        1. Identificar conceptos que deberían cubrirse pero no están en los documentos.
        2. Proponer optimizaciones para mejorar la comprensión.
        
        Responde SOLO en JSON con este formato:
        {
          "gaps": ["lista de conceptos faltantes"],
          "optimizations": ["lista de mejoras sugeridas"]
        }
      `;

            const result = await model.generateContent(prompt);
            const text = result.response.text();

            // Parsear JSON de la respuesta
            let parsed: { gaps: string[], optimizations: string[] } = { gaps: [], optimizations: [] };
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                }
            } catch {
                parsed = { gaps: ['Análisis general del BOE'], optimizations: ['Añadir ejemplos prácticos'] };
            }

            this.updateStep('auditor', {
                status: 'completed',
                completedAt: new Date(),
                reasoning: `Detectados ${parsed.gaps.length} vacíos y ${parsed.optimizations.length} optimizaciones.`,
                output: parsed
            });

            return parsed;
        } catch (error) {
            this.updateStep('auditor', {
                status: 'error',
                error: String(error),
                completedAt: new Date()
            });
            throw error;
        }
    }

    // ============================================
    // AGENTE 3: TIMEKEEPER
    // ============================================

    private async runTimeKeeper(topic: TopicWithGroup): Promise<TimeKeeperDecision> {
        this.updateState({ currentStep: 'timekeeper' });
        this.updateStep('timekeeper', {
            status: 'running',
            startedAt: new Date(),
            input: { topic: topic.title }
        });

        try {
            // TODO: Consultar al PlannerBrain para obtener tiempo real disponible
            // Por ahora, simulamos un tiempo moderado
            const availableMinutes = 45; // Simulado

            let strategy: ConcisionStrategy;
            let recommendedTokens: number;
            let widgetBudget: number;

            if (availableMinutes < 15) {
                strategy = 'executive_summary';
                recommendedTokens = 500;
                widgetBudget = 2;
            } else if (availableMinutes < 30) {
                strategy = 'condensed';
                recommendedTokens = 1000;
                widgetBudget = 3;
            } else if (availableMinutes < 60) {
                strategy = 'balanced';
                recommendedTokens = 2000;
                widgetBudget = 5;
            } else if (availableMinutes < 120) {
                strategy = 'detailed';
                recommendedTokens = 4000;
                widgetBudget = 8;
            } else {
                strategy = 'exhaustive';
                recommendedTokens = 8000;
                widgetBudget = 12;
            }

            const decision: TimeKeeperDecision = {
                availableMinutes,
                recommendedTokens,
                strategy,
                widgetBudget
            };

            this.updateStep('timekeeper', {
                status: 'completed',
                completedAt: new Date(),
                reasoning: `Tiempo disponible: ${availableMinutes}min. Estrategia: "${strategy}". Límite de widgets: ${widgetBudget}.`,
                output: decision
            });

            return decision;
        } catch (error) {
            this.updateStep('timekeeper', {
                status: 'error',
                error: String(error),
                completedAt: new Date()
            });
            throw error;
        }
    }

    // ============================================
    // AGENTE 4: STRATEGIST
    // ============================================

    private async runStrategist(
        topic: TopicWithGroup,
        structure: TopicSection[],
        gaps: string[],
        timeDecision: TimeKeeperDecision
    ): Promise<GeneratedTopicContent> {
        this.updateState({ currentStep: 'strategist' });
        this.updateStep('strategist', {
            status: 'running',
            startedAt: new Date(),
            input: { gaps, strategy: timeDecision.strategy, tokenLimit: timeDecision.recommendedTokens }
        });

        try {
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-pro-latest",
                generationConfig: { responseMimeType: "application/json" }
            });

            const prompt = `
        Eres un experto ingeniero y profesor. Genera contenido de estudio para este tema de oposición.
        
        TEMA: "${topic.title}"
        ESTRATEGIA: "${timeDecision.strategy}" (${timeDecision.recommendedTokens} tokens máximo)
        GAPS A CUBRIR: ${gaps.join(', ') || 'Ninguno detectado'}
        WIDGETS MÁXIMOS: ${timeDecision.widgetBudget}
        
        INSTRUCCIONES:
        1. Genera contenido claro y conciso adaptado a la estrategia.
        2. Incluye widgets donde sean útiles (mnemonic, timeline, diagram, analogy, quiz).
        3. Marca contenido augmentado (generado por ti) vs biblioteca.
        
        RESPONDE SOLO EN JSON con esta estructura:
        {
          "sections": [
            {
              "id": "string",
              "title": "string",
              "level": "h1|h2|h3",
              "sourceType": "library|augmented|mixed",
              "content": {
                "text": "contenido de la sección...",
                "widgets": [
                  { "type": "mnemonic", "content": { "rule": "ABC", "explanation": "..." }, "generatable": false }
                ]
              },
              "children": []
            }
          ]
        }
      `;

            const result = await model.generateContent(prompt);
            const text = result.response.text();

            let parsed = { sections: structure };
            try {
                parsed = JSON.parse(text);
            } catch {
                // Si falla el parsing, usar estructura base con mensaje de error
                if (parsed.sections[0]) {
                    parsed.sections[0].content = {
                        text: 'Error al generar contenido. Por favor, intenta de nuevo.',
                        widgets: []
                    };
                }
            }

            const generatedContent: GeneratedTopicContent = {
                topicId: topic.id,
                title: topic.title,
                metadata: {
                    complexity: 'Medium',
                    estimatedStudyTime: timeDecision.availableMinutes,
                    sourceDocuments: [topic.originalFilename],
                    generatedAt: new Date()
                },
                sections: parsed.sections
            };

            this.updateStep('strategist', {
                status: 'completed',
                completedAt: new Date(),
                reasoning: `Contenido generado con ${parsed.sections.length} secciones. Estrategia: ${timeDecision.strategy}.`,
                output: { sectionCount: parsed.sections.length }
            });

            return generatedContent;
        } catch (error) {
            this.updateStep('strategist', {
                status: 'error',
                error: String(error),
                completedAt: new Date()
            });
            throw error;
        }
    }

    // ============================================
    // ORQUESTACIÓN PRINCIPAL
    // ============================================

    async generate(): Promise<GeneratedTopicContent> {
        const topic = getTopicById(this.state.topicId);
        if (!topic) {
            throw new Error(`Topic not found: ${this.state.topicId}`);
        }

        this.updateState({ status: 'fetching' });

        try {
            // 1. Librarian: Obtener estructura y documentos
            const { structure, documents } = await this.runLibrarian(topic);

            // 2. Auditor: Detectar gaps
            this.updateState({ status: 'analyzing' });
            const { gaps, optimizations } = await this.runAuditor(topic, { documents });

            // 3. TimeKeeper: Determinar estrategia de tiempo
            this.updateState({ status: 'planning' });
            const timeDecision = await this.runTimeKeeper(topic);

            // 4. Strategist: Generar contenido final
            this.updateState({ status: 'generating' });
            const result = await this.runStrategist(topic, structure, gaps, timeDecision);

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

// ============================================
// FUNCIÓN HELPER
// ============================================

export async function generateTopicContent(
    topicId: string,
    onStateChange?: (state: OrchestrationState) => void
): Promise<GeneratedTopicContent> {
    const generator = new TopicContentGenerator(topicId, onStateChange);
    return generator.generate();
}
