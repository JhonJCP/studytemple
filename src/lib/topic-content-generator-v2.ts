/**
 * TOPIC CONTENT GENERATOR V2 - Arquitectura Multi-Agente Paralela
 * 
 * Flujo optimizado:
 * 1. Planning Global (lee topic_time_estimates)
 * 2. Expertos en PARALELO (Teórico, Práctico, Técnico)
 * 3. Curator (scoring de criticidad basado en PRACTICE)
 * 4. Strategist Synthesizer (síntesis final)
 * 
 * Mejoras vs V1:
 * - Sin cascada de errores (cada experto accede a RAG independientemente)
 * - Paralelización (90s vs 260s)
 * - Mejor uso de contexto (30K tokens vs 5K)
 * - Enfoque en parte práctica del examen
 */

import { GlobalPlannerWithRealPlanning, type StrategicPlan } from "./global-planner";
import { ExpertPractical, type ExpertOutput } from "./expert-practical";
import { ExpertTeorico } from "./expert-teorico";
import { ExpertTecnico } from "./expert-tecnico";
import { ExpertCurator } from "./expert-curator";
import { StrategistSynthesizer } from "./strategist-synthesizer";
import { getTopicById, type TopicWithGroup } from "./syllabus-hierarchy";
import type {
    GeneratedTopicContent,
    OrchestrationState,
    AgentStep,
    AgentRole
} from "./widget-types";

// ============================================
// HELPER FUNCTIONS
// ============================================

function getAPIKey(): string {
    const key = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!key) {
        throw new Error("GEMINI_API_KEY no configurada");
    }
    return key;
}

function safeGetAPIKey(): string | null {
    return process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || null;
}

// ============================================
// TELEMETRY
// ============================================

interface TelemetryEvent {
    timestamp: Date;
    agent: string;
    event: 'start' | 'complete' | 'timeout' | 'error';
    durationMs?: number;
    details?: string;
}

class GeneratorTelemetry {
    private events: TelemetryEvent[] = [];
    private startTime: number = Date.now();

    log(agent: string, event: TelemetryEvent['event'], details?: string) {
        const entry: TelemetryEvent = {
            timestamp: new Date(),
            agent,
            event,
            durationMs: Date.now() - this.startTime,
            details
        };
        this.events.push(entry);
        console.log(`[TELEMETRY] ${entry.agent.toUpperCase()} ${entry.event}${details ? `: ${details}` : ''} (+${entry.durationMs}ms)`);
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

// ============================================
// MAIN GENERATOR CLASS V2
// ============================================

export class TopicContentGeneratorV2 {
    private state: OrchestrationState;
    private onStateChange?: (state: OrchestrationState) => void;
    private telemetry: GeneratorTelemetry;
    private cancelled: boolean = false;
    private userId?: string;
    
    private globalPlanner: GlobalPlannerWithRealPlanning;
    private expertPractical: ExpertPractical;
    private expertTeorico: ExpertTeorico;
    private expertTecnico: ExpertTecnico;
    private curator: ExpertCurator;
    private strategist: StrategistSynthesizer;
    
    constructor(
        topicId: string, 
        currentDate?: string,
        onStateChange?: (state: OrchestrationState) => void,
        userId?: string
    ) {
        this.state = {
            topicId,
            status: 'idle',
            steps: [],
            currentStep: null,
        };
        this.onStateChange = onStateChange;
        this.telemetry = new GeneratorTelemetry();
        this.userId = userId;
        
        // Inicializar expertos
        const apiKey = getAPIKey();
        this.globalPlanner = new GlobalPlannerWithRealPlanning();
        this.expertPractical = new ExpertPractical(apiKey);
        this.expertTeorico = new ExpertTeorico(apiKey);
        this.expertTecnico = new ExpertTecnico(apiKey);
        this.curator = new ExpertCurator(apiKey);
        this.strategist = new StrategistSynthesizer(apiKey);
    }
    
    cancel() {
        this.cancelled = true;
        console.log('[GENERATOR-V2] Generación cancelada');
    }
    
    isCancelled(): boolean {
        return this.cancelled;
    }
    
    private checkCancelled() {
        if (this.cancelled) {
            throw new Error('Generación cancelada');
        }
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
    
    private updateStep(role: AgentRole | string, updates: Partial<AgentStep>) {
        const idx = this.state.steps.findIndex(s => s.role === role);
        if (idx >= 0) {
            this.state.steps[idx] = { ...this.state.steps[idx], ...updates as any };
        } else {
            this.state.steps.push({ role: role as AgentRole, status: 'pending', ...updates as any });
        }
        this.onStateChange?.(this.state);
    }
    
    /**
     * FLUJO PRINCIPAL DE GENERACIÓN
     */
    async generate(): Promise<GeneratedTopicContent> {
        console.log('[GENERATOR-V2] ========== INICIO GENERACIÓN PARALELA ==========');
        console.log(`[GENERATOR-V2] TopicID: ${this.state.topicId}`);
        
        this.telemetry.reset();
        this.cancelled = false;
        
        const apiKey = safeGetAPIKey();
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY no configurada');
        }
        
        this.updateState({ status: 'queued' });
        
        const topic = getTopicById(this.state.topicId);
        if (!topic) {
            throw new Error(`Topic not found: ${this.state.topicId}`);
        }
        
        console.log(`[GENERATOR-V2] Topic: ${topic.title}`);
        
        try {
            // FASE 0: Planificación Global (10s)
            console.log('[GENERATOR-V2] FASE 0: Planning Global...');
            this.updateState({ status: 'planning' });
            this.updateStep('planner', {
                status: 'running',
                startedAt: new Date(),
                reasoning: '📋 Leyendo planning y analizando supuestos prácticos...'
            });
            
            this.telemetry.log('planner', 'start');
            
            const strategicPlan = await this.globalPlanner.plan({
                currentTopic: this.state.topicId,
                currentDate: new Date().toISOString().split('T')[0],
                userId: this.userId
            });
            
            this.updateStep('planner', {
                status: 'completed',
                completedAt: new Date(),
                output: strategicPlan,
                reasoning: strategicPlan.reasoning
            });
            
            this.telemetry.log('planner', 'complete', 
                `${strategicPlan.timeAllocation}min, ${strategicPlan.strategy}, ${strategicPlan.practiceRelevance * 100}% practice`
            );
            
            console.log('[GENERATOR-V2] Strategic plan:', {
                time: strategicPlan.timeAllocation,
                strategy: strategicPlan.strategy,
                targetWords: strategicPlan.targetWords,
                practiceRelevance: strategicPlan.practiceRelevance
            });
            
            this.checkCancelled();
            
            // FASE 1: Expertos en PARALELO (90s)
            console.log('[GENERATOR-V2] FASE 1: Ejecutando 3 expertos en PARALELO...');
            this.updateState({ status: 'fetching' });
            
            // Iniciar steps de expertos
            this.updateStep('expert-teorico', {
                status: 'running',
                startedAt: new Date(),
                reasoning: '⚖️ Experto Teórico buscando en CORE...'
            });
            
            this.updateStep('expert-practical', {
                status: 'running',
                startedAt: new Date(),
                reasoning: '🎯 Experto Práctico analizando PRACTICE...'
            });
            
            this.updateStep('expert-tecnico', {
                status: 'running',
                startedAt: new Date(),
                reasoning: '🔬 Experto Técnico consultando CORE+SUPPLEMENTARY...'
            });
            
            this.telemetry.log('experts', 'start', 'Iniciando 3 expertos en paralelo');
            
            const expertsStart = Date.now();
            
            const [draftTeorico, draftPractico, draftTecnico] = await Promise.all([
                this.expertTeorico.generate({
                    topic,
                    targetWords: Math.round(strategicPlan.targetWords * 0.30),
                    criticalLaws: strategicPlan.criticalLaws
                }).then(draft => {
                    this.updateStep('expert-teorico', {
                        status: 'completed',
                        completedAt: new Date(),
                        output: { words: this.countWords(draft.content), confidence: draft.confidence },
                        reasoning: `✅ Draft teórico: ${this.countWords(draft.content)} palabras`
                    });
                    return draft;
                }),
                
                this.expertPractical.generate({
                    topic,
                    targetWords: Math.round(strategicPlan.targetWords * 0.40),
                    practiceExamples: strategicPlan.practiceExamples,
                    commonCalculations: strategicPlan.commonCalculations
                }).then(draft => {
                    this.updateStep('expert-practical', {
                        status: 'completed',
                        completedAt: new Date(),
                        output: { words: this.countWords(draft.content), confidence: draft.confidence },
                        reasoning: `✅ Draft práctico: ${this.countWords(draft.content)} palabras`
                    });
                    return draft;
                }),
                
                this.expertTecnico.generate({
                    topic,
                    targetWords: Math.round(strategicPlan.targetWords * 0.30),
                    commonCalculations: strategicPlan.commonCalculations
                }).then(draft => {
                    this.updateStep('expert-tecnico', {
                        status: 'completed',
                        completedAt: new Date(),
                        output: { words: this.countWords(draft.content), confidence: draft.confidence },
                        reasoning: `✅ Draft técnico: ${this.countWords(draft.content)} palabras`
                    });
                    return draft;
                })
            ]);
            
            const expertsDuration = Date.now() - expertsStart;
            
            const totalDraftWords = this.countWords(draftTeorico.content) + 
                                   this.countWords(draftPractico.content) + 
                                   this.countWords(draftTecnico.content);
            
            this.telemetry.log('experts', 'complete', 
                `${totalDraftWords} palabras en ${expertsDuration}ms (paralelo)`
            );
            
            console.log(`[GENERATOR-V2] Expertos completados: ${totalDraftWords} palabras en ${expertsDuration}ms`);
            
            this.checkCancelled();
            
            // FASE 2: Curación (30s)
            console.log('[GENERATOR-V2] FASE 2: Curación...');
            this.updateState({ status: 'analyzing' });
            this.updateStep('curator', {
                status: 'running',
                startedAt: new Date(),
                reasoning: '🔍 Curator analizando criticidad de conceptos...'
            });
            
            this.telemetry.log('curator', 'start');
            
            const curationReport = await this.curator.analyze({
                drafts: [draftTeorico, draftPractico, draftTecnico],
                practicePatterns: await this.globalPlanner.getPracticePatterns(),
                topicImportance: strategicPlan.complexity === 'High' ? 'HIGH' : 'MEDIUM'
            });
            
            this.updateStep('curator', {
                status: 'completed',
                completedAt: new Date(),
                output: {
                    critical: curationReport.summary.critical,
                    droppable: curationReport.summary.droppable,
                    practiceReadiness: curationReport.practiceReadiness
                },
                reasoning: `✅ ${curationReport.summary.critical} críticos, ${curationReport.summary.droppable} prescindibles. Practice: ${(curationReport.practiceReadiness * 100).toFixed(0)}%`
            });
            
            this.telemetry.log('curator', 'complete', 
                `${curationReport.summary.critical} críticos, readiness ${(curationReport.practiceReadiness * 100).toFixed(0)}%`
            );
            
            console.log('[GENERATOR-V2] Curación completa:', {
                critical: curationReport.summary.critical,
                droppable: curationReport.summary.droppable,
                practiceReadiness: curationReport.practiceReadiness
            });
            
            this.checkCancelled();
            
            // FASE 3: Síntesis (120s)
            console.log('[GENERATOR-V2] FASE 3: Síntesis...');
            this.updateState({ status: 'generating' });
            this.updateStep('strategist', {
                status: 'running',
                startedAt: new Date(),
                reasoning: '✨ Estratega sintetizando contenido final enfocado en práctica...'
            });
            
            this.telemetry.log('strategist', 'start');
            
            const finalContent = await this.strategist.synthesize({
                topic,
                drafts: [draftTeorico, draftPractico, draftTecnico],
                curationReport,
                strategicPlan
            });
            
            this.updateStep('strategist', {
                status: 'completed',
                completedAt: new Date(),
                output: {
                    finalWords: finalContent.metadata.health?.totalWords || 0,
                    sections: finalContent.sections.length,
                    widgets: finalContent.widgets?.length || 0,
                    practiceReadiness: finalContent.metadata.practiceMetrics?.practiceReadiness || 0
                },
                reasoning: `✅ Contenido final: ${finalContent.metadata.health?.totalWords || 0} palabras, ${finalContent.widgets?.length || 0} widgets`
            });
            
            this.telemetry.log('strategist', 'complete', 
                `${finalContent.metadata.health?.totalWords || 0} palabras, ${finalContent.widgets?.length || 0} widgets`
            );
            
            console.log('[GENERATOR-V2] Síntesis completa:', {
                words: finalContent.metadata.health?.totalWords || 0,
                sections: finalContent.sections.length,
                widgets: finalContent.widgets?.length || 0
            });
            
            // FINAL
            this.telemetry.log('global', 'complete', 'Generación completada con arquitectura paralela');
            this.updateState({
                status: 'completed',
                currentStep: null,
                result: finalContent
            });
            
            console.log('[GENERATOR-V2] ========== GENERACIÓN COMPLETADA ==========');
            
            return finalContent;
            
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
            
            console.error('[GENERATOR-V2] Error:', errorMsg);
            
            this.telemetry.log('global', 'error', errorMsg);
            this.updateState({
                status: 'error',
                currentStep: null
            });
            
            if (this.state.currentStep) {
                this.updateStep(this.state.currentStep, {
                    status: 'error',
                    error: errorMsg,
                    completedAt: new Date()
                });
            }
            
            throw error;
        }
    }
    
    private countWords(text: string): number {
        if (!text) return 0;
        return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    }
}

// ============================================
// EXPORTS
// ============================================

/**
 * Función helper para generar contenido (compatible con API existente)
 */
export async function generateTopicContent(
    topicId: string,
    onStateChange?: (state: OrchestrationState) => void
): Promise<GeneratedTopicContent> {
    const generator = new TopicContentGeneratorV2(topicId, undefined, onStateChange);
    return generator.generate();
}

export async function generateTopicContentWithTrace(
    topicId: string,
    onStateChange?: (state: OrchestrationState) => void
): Promise<{ result: GeneratedTopicContent; state: OrchestrationState }> {
    const generator = new TopicContentGeneratorV2(topicId, undefined, onStateChange);
    const result = await generator.generate();
    return { result, state: generator.getState() };
}

