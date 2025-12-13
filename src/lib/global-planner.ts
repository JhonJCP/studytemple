/**
 * GLOBAL PLANNER - Lee planning real del usuario y decide estrategia
 * 
 * Este módulo lee el planning existente (Planing.txt) y lo usa para:
 * - Determinar cuánto tiempo asignar a cada tema
 * - Definir estrategia de generación (detailed/balanced/condensed)
 * - Analizar BOE y PRACTICE para scoring de importancia
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ConcisionStrategy } from "./widget-types";
import fs from "fs";
import path from "path";

// ============================================
// TYPES
// ============================================

export interface TopicTimeEstimate {
    group: string;
    topicTitle: string;
    topicId: string;
    complexity: 'High' | 'Medium' | 'Low';
    baseStudyMinutes: number;
    recommendedContentLength: 'extended' | 'standard' | 'concise';
    reviewPlan: Array<{
        offsetDays: number;
        type: 'review_flashcards' | 'test_practice';
        minutes: number;
    }>;
    totalPlannedMinutes: number;
    rationale: string;
}

export interface DailyScheduleEntry {
    date: string;
    topicTitle: string;
    topicId: string;
    type: 'study' | 'test_practice' | 'review_flashcards';
    durationMinutes: number;
    startTime: string;
    endTime: string;
    complexity: 'High' | 'Medium' | 'Low';
    aiReasoning: string;
}

export interface PlanningData {
    strategic_analysis: string;
    topic_time_estimates: TopicTimeEstimate[];
    daily_schedule: DailyScheduleEntry[];
}

export interface BOEAnalysis {
    examStructure: {
        numSupuestos: number;
        duracion: number;
        puntuacion: number;
    };
    topics: Array<{
        id: string;
        title: string;
        priority: 'HIGH' | 'MEDIUM' | 'LOW';
        examWeight: number;
    }>;
    exerciseTypes: string[];
}

export interface PracticePatterns {
    topicFrequency: Array<{
        topic: string;
        appearances: number;
        percentage: number;
        examples: string[];
    }>;
    commonCalculations: Array<{
        type: string;
        frequency: number;
        formula: string;
    }>;
    criticalLaws: Array<{
        law: string;
        articles: string[];
        appearances: number;
    }>;
    solutionStructure: {
        typical: string[];
    };
}

export interface StrategicPlan {
    timeAllocation: number;
    strategy: ConcisionStrategy;
    targetWords: number;
    targetSections: number;
    practiceRelevance: number;
    practiceExamples: string[];
    commonCalculations: string[];
    criticalLaws: Array<{
        law: string;
        articles: string[];
    }>;
    complexity: 'High' | 'Medium' | 'Low';
    reasoning: string;
}

// ============================================
// GLOBAL PLANNER CLASS
// ============================================

export class GlobalPlannerWithRealPlanning {
    private topicTimeEstimates: TopicTimeEstimate[];
    private dailySchedule: DailyScheduleEntry[];
    private boeAnalysisCache: BOEAnalysis | null = null;
    private practicePatternsCache: PracticePatterns | null = null;
    private supabase: ReturnType<typeof createSupabaseClient> | null;
    private planningLoadedFromDB: boolean = false;
    
    constructor() {
        // Inicializar Supabase primero
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        
        if (SUPABASE_URL && SUPABASE_KEY) {
            this.supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            this.supabase = null;
            console.warn('[PLANNER] Supabase not configured');
        }
        
        // Inicializar con valores vacíos (se cargarán después)
        this.topicTimeEstimates = [];
        this.dailySchedule = [];
    }

    /**
     * Inyectar planning ya cargado (por ejemplo, desde el API route con Supabase authed).
     * Esto evita depender de RLS/anon keys dentro del planner.
     */
    primePlanning(planningData: PlanningData) {
        this.topicTimeEstimates = planningData.topic_time_estimates || [];
        this.dailySchedule = planningData.daily_schedule || [];
        this.planningLoadedFromDB = true;
    }
    
    /**
     * Cargar planning desde base de datos (si aún no está cargado)
     */
    private async ensurePlanningLoaded(userId?: string): Promise<void> {
        if (this.planningLoadedFromDB) return;
        
        const planningData = await this.loadPlanningFromDB(userId);
        
        this.topicTimeEstimates = planningData.topic_time_estimates;
        this.dailySchedule = planningData.daily_schedule;
        this.planningLoadedFromDB = true;
    }
    
    /**
     * Planifica estrategia para un tema específico
     */
    async plan(params: {
        currentTopic: string;
        topicTitle?: string;
        originalFilename?: string;
        currentDate?: string;
        userId?: string;
    }): Promise<StrategicPlan> {
        
        console.log(`[PLANNER] Planning for topic: ${params.currentTopic}`);
        
        // PASO 0: Cargar planning desde DB si no está cargado
        await this.ensurePlanningLoaded(params.userId);
        
        // PASO 1: Buscar el tema en topic_time_estimates
        const topicEstimate =
            this.findTopicEstimate(params.currentTopic) ||
            (params.topicTitle ? this.findTopicEstimate(params.topicTitle) : null);
        
        if (!topicEstimate) {
            // Fallback: buscar en daily_schedule (muchos topicIds viven aquí)
            const normalize = (s: string) =>
                (s || '')
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "");

            const search = normalize(params.currentTopic);
            const scheduleMatch = (this.dailySchedule || []).find((s) => {
                const id = normalize(s.topicId);
                return id === search || id.includes(search) || search.includes(id);
            });

            if (scheduleMatch) {
                const isLegalTopic = /ley|decreto|reglamento/i.test(scheduleMatch.topicTitle);
                const timeAllocation = scheduleMatch.durationMinutes || 60;
                const strategy: ConcisionStrategy =
                    scheduleMatch.complexity === 'High'
                        ? 'detailed'
                        : scheduleMatch.complexity === 'Low'
                            ? 'condensed'
                            : 'balanced';

                return {
                    timeAllocation,
                    strategy,
                    targetWords: isLegalTopic ? 1600 : 1200,
                    targetSections: isLegalTopic ? 7 : 6,
                    practiceRelevance: 0,
                    practiceExamples: [],
                    commonCalculations: [],
                    criticalLaws: [],
                    complexity: scheduleMatch.complexity || 'Medium',
                    reasoning: `Tema encontrado en daily_schedule (${scheduleMatch.topicTitle}). Usando duración ${timeAllocation} min como planificación.`
                };
            }

            console.warn(`[PLANNER] Topic ${params.currentTopic} not found in planning, using defaults`);
            return this.createDefaultPlan(params.currentTopic, params.topicTitle, params.originalFilename);
        }
        
        console.log(`[PLANNER] Found topic: ${topicEstimate.topicTitle}, complexity: ${topicEstimate.complexity}, time: ${topicEstimate.baseStudyMinutes}min`);
        
        // PASO 2: Analizar BOE + PRACTICE (cachear para eficiencia)
        if (!this.boeAnalysisCache) {
            this.boeAnalysisCache = await this.analyzeBOE();
        }
        
        if (!this.practicePatternsCache) {
            this.practicePatternsCache = await this.analyzePracticePatterns();
        }
        
        // PASO 3: Buscar frecuencia del tema en supuestos prácticos
        const topicPattern = this.practicePatternsCache.topicFrequency.find(
            t => this.isTopicMatch(t.topic, topicEstimate.topicTitle)
        );
        
        // PASO 4: Crear Strategic Plan usando datos del planning
        const strategy = this.mapComplexityToStrategy(
            topicEstimate.complexity,
            topicEstimate.recommendedContentLength
        );
        
        const targetWordsBase = this.calculateTargetWords(topicEstimate.recommendedContentLength);
        const isLegalTopic =
            /ley|decreto|reglamento/i.test(topicEstimate.topicTitle) ||
            /ley|decreto|reglamento/i.test(params.topicTitle || "") ||
            /ley|decreto|reglamento/i.test(params.originalFilename || "");
        const targetWords = isLegalTopic ? Math.max(targetWordsBase, 1600) : targetWordsBase;
        
        return {
            // USAR TIEMPO DEL PLANNING (no calcularlo)
            timeAllocation: topicEstimate.baseStudyMinutes,
            
            // USAR ESTRATEGIA DEL PLANNING
            strategy,
            
            // Calcular target words según recommendedContentLength
            targetWords,
            
            targetSections: Math.max(strategy === 'detailed' ? 8 : 6, isLegalTopic ? 7 : 6),
            
            // DATOS DE SUPUESTOS PRÁCTICOS
            practiceRelevance: topicPattern?.percentage || 0,
            practiceExamples: topicPattern?.examples || [],
            
            commonCalculations: this.practicePatternsCache.commonCalculations
                .filter(c => this.isRelevantToTopic(c.type, topicEstimate.topicTitle))
                .map(c => c.formula),
            
            criticalLaws: this.practicePatternsCache.criticalLaws
                .filter(l => this.isRelevantToTopic(l.law, topicEstimate.topicTitle))
                .map(l => ({ law: l.law, articles: l.articles })),
            
            complexity: topicEstimate.complexity,
            
            reasoning: `${topicEstimate.rationale}. Frecuencia en supuestos: ${
                topicPattern 
                    ? `${topicPattern.appearances}/15 (${(topicPattern.percentage * 100).toFixed(0)}%)`
                    : 'No aparece directamente'
            }`
        };
    }
    
    /**
     * Obtener practice patterns (cached)
     */
    async getPracticePatterns(): Promise<PracticePatterns> {
        if (!this.practicePatternsCache) {
            this.practicePatternsCache = await this.analyzePracticePatterns();
        }
        return this.practicePatternsCache;
    }
    
    /**
     * Analizar BOE (convocatoria oficial)
     */
    private async analyzeBOE(): Promise<BOEAnalysis> {
        console.log('[PLANNER] Analyzing BOE documents...');
        
        if (!this.supabase) {
            console.warn('[PLANNER] Supabase not available, using default BOE analysis');
            return this.getDefaultBOEAnalysis();
        }
        
        try {
            // Buscar documentos BOE
            const { data: boeChunks, error } = await this.supabase
                .from('library_documents')
                .select('content, metadata')
                .eq('metadata->>category', 'BOE')
                .limit(100);
            
            if (error || !boeChunks || boeChunks.length === 0) {
                console.warn('[PLANNER] No BOE documents found or error:', error);
                return this.getDefaultBOEAnalysis();
            }
            
            console.log(`[PLANNER] Found ${boeChunks.length} BOE chunks, analyzing with LLM...`);
            
            // TODO: Implementar análisis con LLM cuando sea necesario
            // Por ahora, retornar análisis por defecto
            return this.getDefaultBOEAnalysis();
            
        } catch (err) {
            console.error('[PLANNER] Error analyzing BOE:', err);
            return this.getDefaultBOEAnalysis();
        }
    }
    
    /**
     * Analizar patrones de supuestos prácticos
     */
    private async analyzePracticePatterns(): Promise<PracticePatterns> {
        console.log('[PLANNER] Analyzing PRACTICE patterns...');
        
        if (!this.supabase) {
            console.warn('[PLANNER] Supabase not available, using default patterns');
            return this.getDefaultPracticePatterns();
        }
        
        try {
            // Buscar supuestos PRACTICE
            const { data: practiceChunks, error } = await this.supabase
                .from('library_documents')
                .select('content, metadata')
                .eq('metadata->>category', 'PRACTICE')
                .limit(500);
            
            if (error || !practiceChunks || practiceChunks.length === 0) {
                console.warn('[PLANNER] No PRACTICE documents found or error:', error);
                return this.getDefaultPracticePatterns();
            }
            
            console.log(`[PLANNER] Found ${practiceChunks.length} PRACTICE chunks`);
            
            // Análisis simple basado en filenames
            const patterns = this.analyzeSupuestosFromMetadata(practiceChunks);
            
            console.log('[PLANNER] Practice patterns:', {
                topics: patterns.topicFrequency.length,
                calculations: patterns.commonCalculations.length,
                laws: patterns.criticalLaws.length
            });
            
            return patterns;
            
        } catch (err) {
            console.error('[PLANNER] Error analyzing PRACTICE:', err);
            return this.getDefaultPracticePatterns();
        }
    }
    
    /**
     * Analizar supuestos desde metadata (simple pattern matching)
     */
    private analyzeSupuestosFromMetadata(chunks: any[]): PracticePatterns {
        const filenames = [...new Set(chunks.map(c => c.metadata?.filename || ''))];
        
        // Contar apariciones por tema
        const topicCounts: Record<string, { count: number; examples: string[] }> = {};
        
        filenames.forEach(filename => {
            const lower = filename.toLowerCase();
            
            // Detectar temas
            if (lower.includes('carretera') || lower.includes('gc-')) {
                topicCounts['Carreteras'] = topicCounts['Carreteras'] || { count: 0, examples: [] };
                topicCounts['Carreteras'].count++;
                topicCounts['Carreteras'].examples.push(filename);
            }
            if (lower.includes('costa') || lower.includes('dpmt') || lower.includes('litoral')) {
                topicCounts['Costas'] = topicCounts['Costas'] || { count: 0, examples: [] };
                topicCounts['Costas'].count++;
                topicCounts['Costas'].examples.push(filename);
            }
            if (lower.includes('agua') || lower.includes('vertido')) {
                topicCounts['Aguas'] = topicCounts['Aguas'] || { count: 0, examples: [] };
                topicCounts['Aguas'].count++;
                topicCounts['Aguas'].examples.push(filename);
            }
            if (lower.includes('expropiacion')) {
                topicCounts['Expropiación'] = topicCounts['Expropiación'] || { count: 0, examples: [] };
                topicCounts['Expropiación'].count++;
                topicCounts['Expropiación'].examples.push(filename);
            }
        });
        
        const totalSupuestos = 15; // Según el planning
        
        return {
            topicFrequency: Object.entries(topicCounts).map(([topic, data]) => ({
                topic,
                appearances: data.count,
                percentage: data.count / totalSupuestos,
                examples: data.examples.slice(0, 5)
            })),
            commonCalculations: [
                { type: 'Zona de protección', frequency: 6, formula: 'zona = distancia según tipo carretera' },
                { type: 'CBR y firmes', frequency: 5, formula: 'espesor = f(CBR) según 6.1-IC' }
            ],
            criticalLaws: [
                { law: 'Ley 9/1991 Carreteras', articles: ['Art. 3', 'Art. 5', 'Art. 7'], appearances: 8 },
                { law: 'Ley de Costas', articles: ['DPMT', 'Servidumbres'], appearances: 7 },
                { law: 'Ley de Expropiación', articles: ['Procedimiento urgencia'], appearances: 4 }
            ],
            solutionStructure: {
                typical: [
                    '1. Análisis normativo aplicable',
                    '2. Identificación de parámetros',
                    '3. Cálculos justificados',
                    '4. Conclusiones y recomendaciones'
                ]
            }
        };
    }
    
    /**
     * Cargar planning desde base de datos
     */
    private async loadPlanningFromDB(userId?: string): Promise<PlanningData> {
        try {
            // 1) Preferir cliente autenticado (server client) si estamos en contexto Next.js
            try {
                const { createClient: createServerClient } = await import("@/utils/supabase/server");
                const supabase = await createServerClient();
                const { data: { user } } = await supabase.auth.getUser();
                const targetUserId = userId || user?.id;
                
                if (targetUserId) {
                    const { data, error } = await supabase
                        .from('user_planning')
                        .select('strategic_analysis, topic_time_estimates, daily_schedule')
                        .eq('user_id', targetUserId)
                        .eq('is_active', true)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    
                    if (!error && data) {
                        const topicEstimates = (data as any).topic_time_estimates || [];
                        const dailySchedule = (data as any).daily_schedule || [];
                        console.log(`[PLANNER] Loaded planning from DB (authed) with ${topicEstimates.length} topics`);
                        return {
                            strategic_analysis: (data as any).strategic_analysis || '',
                            topic_time_estimates: topicEstimates,
                            daily_schedule: dailySchedule
                        };
                    }
                }
            } catch (e) {
                // No hay contexto de cookies / import no disponible: continuar a fallback
                console.warn('[PLANNER] Server supabase client unavailable, falling back');
            }

            // 1.5) Fallback global: variable de entorno PLANNING_DATA (Vercel)
            if (process.env.PLANNING_DATA) {
                try {
                    const parsed = JSON.parse(process.env.PLANNING_DATA) as PlanningData;
                    if (parsed?.topic_time_estimates && parsed?.daily_schedule) {
                        console.log(`[PLANNER] Loaded planning from env var with ${parsed.topic_time_estimates.length} topics`);
                        return parsed;
                    }
                } catch (e) {
                    console.warn('[PLANNER] PLANNING_DATA parse error, ignoring');
                }
            }
            
            // 2) Fallback: cliente supabase-js sin sesión (solo funcionará si RLS/ACL lo permite o hay service role)
            if (!this.supabase) {
                console.warn('[PLANNER] Supabase not configured, trying filesystem fallback');
                return this.loadPlanningFromFilesystem();
            }
            
            const targetUserId = userId;
            if (!targetUserId) {
                console.warn('[PLANNER] No userId provided, using filesystem fallback');
                return this.loadPlanningFromFilesystem();
            }
            
            const { data, error } = await this.supabase
                .from('user_planning')
                .select('strategic_analysis, topic_time_estimates, daily_schedule')
                .eq('user_id', targetUserId)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle() as {
                    data: {
                        strategic_analysis: string;
                        topic_time_estimates: any;
                        daily_schedule: any;
                    } | null;
                    error: any
                };
            
            if (error) {
                console.error('[PLANNER] Error loading planning from DB:', error);
                return this.loadPlanningFromFilesystem();
            }
            
            if (!data) {
                console.warn('[PLANNER] No active planning found in DB for user, using filesystem fallback');
                return this.loadPlanningFromFilesystem();
            }
            
            const topicEstimates = data.topic_time_estimates || [];
            const dailySchedule = data.daily_schedule || [];
            
            console.log(`[PLANNER] Loaded planning from DB with ${topicEstimates.length} topics`);
            
            return {
                strategic_analysis: data.strategic_analysis || '',
                topic_time_estimates: topicEstimates,
                daily_schedule: dailySchedule
            };
            
        } catch (err) {
            console.error('[PLANNER] Exception loading planning from DB:', err);
            return this.loadPlanningFromFilesystem();
        }
    }
    
    /**
     * Fallback: Cargar planning desde filesystem (desarrollo local)
     */
    private loadPlanningFromFilesystem(): PlanningData {
        try {
            const planningPath = path.join(process.cwd(), '..', 'Temario', 'Planing.txt');
            
            if (fs.existsSync(planningPath)) {
                const content = fs.readFileSync(planningPath, 'utf-8');
                const data = JSON.parse(content);
                console.log(`[PLANNER] Loaded planning from filesystem with ${data.topic_time_estimates?.length || 0} topics`);
                return data;
            } else {
                console.warn('[PLANNER] Planning file not found at:', planningPath);
            }
        } catch (err) {
            console.error('[PLANNER] Error loading planning from filesystem:', err);
        }
        
        // Última opción: datos por defecto
        console.warn('[PLANNER] Using default planning data');
        return {
            strategic_analysis: '',
            topic_time_estimates: [],
            daily_schedule: []
        };
    }
    
    /**
     * Buscar topic estimate (fuzzy matching)
     */
    private findTopicEstimate(topicId: string): TopicTimeEstimate | null {
        const normalize = (s: string) =>
            (s || '')
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");

        const search = normalize(topicId);
        if (!search) return null;

        // Buscar por ID exacto (normalizado)
        let found = this.topicTimeEstimates.find(t => normalize(t.topicId) === search);
        if (found) return found;
        
        // Buscar por ID parcial
        found = this.topicTimeEstimates.find(t => {
            const id = normalize(t.topicId);
            return id.includes(search) || search.includes(id);
        });
        if (found) return found;
        
        // Buscar por título
        found = this.topicTimeEstimates.find(t => {
            const title = normalize(t.topicTitle);
            return title.includes(search) || search.includes(title);
        });
        
        return found || null;
    }
    
    /**
     * Crear plan por defecto si no se encuentra en planning
     */
    private createDefaultPlan(topicId: string, topicTitle?: string, originalFilename?: string): StrategicPlan {
        const hasPlanningData =
            (this.topicTimeEstimates && this.topicTimeEstimates.length > 0) ||
            (this.dailySchedule && this.dailySchedule.length > 0);

        const isLegalTopic =
            /ley|decreto|reglamento/i.test(topicTitle || "") ||
            /ley|decreto|reglamento/i.test(originalFilename || "");

        return {
            timeAllocation: 60,
            strategy: isLegalTopic ? 'detailed' : 'balanced',
            targetWords: isLegalTopic ? 1600 : 1200,
            targetSections: isLegalTopic ? 7 : 6,
            practiceRelevance: 0,
            practiceExamples: [],
            commonCalculations: [],
            criticalLaws: [],
            complexity: 'Medium',
            reasoning: hasPlanningData
                ? 'Sin estimación en planning para este tema. Usando valores por defecto'
                : 'Sin planning activo/cargado (p.ej. sin login). Usando valores por defecto'
        };
    }
    
    /**
     * Mapear complejidad a estrategia
     */
    private mapComplexityToStrategy(
        complexity: 'High' | 'Medium' | 'Low',
        contentLength: 'extended' | 'standard' | 'concise'
    ): ConcisionStrategy {
        if (contentLength === 'extended') return 'detailed';
        if (contentLength === 'concise') return 'condensed';
        return 'balanced';
    }
    
    /**
     * Calcular palabras objetivo
     */
    private calculateTargetWords(contentLength: string): number {
        switch (contentLength) {
            case 'extended': return 1600;
            case 'standard': return 1200;
            case 'concise': return 800;
            default: return 700;
        }
    }
    
    /**
     * Verificar si dos topics coinciden (fuzzy)
     */
    private isTopicMatch(topic1: string, topic2: string): boolean {
        const t1 = topic1.toLowerCase();
        const t2 = topic2.toLowerCase();
        
        return t1.includes(t2) || t2.includes(t1) ||
               t1.split(/\s+/).some(word => t2.includes(word) && word.length > 4) ||
               t2.split(/\s+/).some(word => t1.includes(word) && word.length > 4);
    }
    
    /**
     * Verificar si algo es relevante para un topic
     */
    private isRelevantToTopic(text: string, topicTitle: string): boolean {
        const keywords = topicTitle.toLowerCase().split(/\s+/)
            .filter(w => w.length > 3);
        
        const textLower = text.toLowerCase();
        
        return keywords.some(keyword => textLower.includes(keyword));
    }
    
    /**
     * BOE analysis por defecto
     */
    private getDefaultBOEAnalysis(): BOEAnalysis {
        return {
            examStructure: {
                numSupuestos: 1,
                duracion: 240,
                puntuacion: 40
            },
            topics: [
                { id: 'carreteras', title: 'Carreteras', priority: 'HIGH', examWeight: 0.25 },
                { id: 'costas', title: 'Costas', priority: 'HIGH', examWeight: 0.25 },
                { id: 'aguas', title: 'Aguas', priority: 'MEDIUM', examWeight: 0.20 },
                { id: 'gestion', title: 'Gestión de Obra', priority: 'MEDIUM', examWeight: 0.15 },
                { id: 'ambiental', title: 'Medio Ambiente', priority: 'MEDIUM', examWeight: 0.15 }
            ],
            exerciseTypes: ['informe', 'propuesta', 'calculo']
        };
    }
    
    /**
     * Practice patterns por defecto
     */
    private getDefaultPracticePatterns(): PracticePatterns {
        return {
            topicFrequency: [
                { topic: 'Carreteras', appearances: 8, percentage: 0.53, examples: ['Supuesto 1', 'Supuesto 11'] },
                { topic: 'Costas', appearances: 7, percentage: 0.47, examples: ['Supuesto 4', 'Supuesto 9'] },
                { topic: 'Aguas', appearances: 5, percentage: 0.33, examples: ['Supuesto 12'] },
                { topic: 'Expropiación', appearances: 4, percentage: 0.27, examples: ['Supuesto 11'] }
            ],
            commonCalculations: [
                { type: 'Zona protección carreteras', frequency: 6, formula: 'zona = 50m (estatal), 25m (autonómica)' },
                { type: 'CBR y firmes', frequency: 5, formula: 'espesor = f(CBR) según 6.1-IC' }
            ],
            criticalLaws: [
                { law: 'Ley 9/1991 Carreteras', articles: ['Art. 3', 'Art. 5', 'Art. 7'], appearances: 8 },
                { law: 'Ley de Costas', articles: ['DPMT', 'Servidumbres'], appearances: 7 }
            ],
            solutionStructure: {
                typical: [
                    '1. Análisis normativo aplicable',
                    '2. Identificación de parámetros',
                    '3. Cálculos justificados',
                    '4. Conclusiones y recomendaciones'
                ]
            }
        };
    }
}
