/**
 * GLOBAL PLANNER - Lee planning real del usuario y decide estrategia
 * 
 * Este módulo lee el planning existente (Planing.txt) y lo usa para:
 * - Determinar cuánto tiempo asignar a cada tema
 * - Definir estrategia de generación (detailed/balanced/condensed)
 * - Analizar BOE y PRACTICE para scoring de importancia
 */

import { createClient } from "@supabase/supabase-js";
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
    private supabase: ReturnType<typeof createClient> | null;
    
    constructor() {
        // Cargar planning del archivo JSON
        const planningData = this.loadPlanningFile();
        this.topicTimeEstimates = planningData.topic_time_estimates;
        this.dailySchedule = planningData.daily_schedule;
        
        // Inicializar Supabase
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
        
        if (SUPABASE_URL && SUPABASE_KEY) {
            this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        } else {
            this.supabase = null;
            console.warn('[PLANNER] Supabase not configured');
        }
    }
    
    /**
     * Planifica estrategia para un tema específico
     */
    async plan(params: {
        currentTopic: string;
        currentDate?: string;
    }): Promise<StrategicPlan> {
        
        console.log(`[PLANNER] Planning for topic: ${params.currentTopic}`);
        
        // PASO 1: Buscar el tema en topic_time_estimates
        const topicEstimate = this.findTopicEstimate(params.currentTopic);
        
        if (!topicEstimate) {
            console.warn(`[PLANNER] Topic ${params.currentTopic} not found in planning, using defaults`);
            return this.createDefaultPlan(params.currentTopic);
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
        
        const targetWords = this.calculateTargetWords(topicEstimate.recommendedContentLength);
        
        return {
            // USAR TIEMPO DEL PLANNING (no calcularlo)
            timeAllocation: topicEstimate.baseStudyMinutes,
            
            // USAR ESTRATEGIA DEL PLANNING
            strategy,
            
            // Calcular target words según recommendedContentLength
            targetWords,
            
            targetSections: strategy === 'detailed' ? 5 : 4,
            
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
     * Cargar planning desde archivo o variable de entorno
     */
    private loadPlanningFile(): PlanningData {
        // 1. Intentar desde variable de entorno (producción - Vercel)
        try {
            if (process.env.PLANNING_DATA) {
                const data = JSON.parse(process.env.PLANNING_DATA);
                console.log(`[PLANNER] Loaded planning from env var with ${data.topic_time_estimates?.length || 0} topics`);
                return data;
            }
        } catch (err) {
            console.error('[PLANNER] Error parsing PLANNING_DATA env var:', err);
        }
        
        // 2. Intentar leer desde el archivo en el proyecto (desarrollo local)
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
            console.error('[PLANNER] Error loading planning file:', err);
        }
        
        // 3. Fallback: datos por defecto
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
        // Buscar por ID exacto
        let found = this.topicTimeEstimates.find(t => t.topicId === topicId);
        if (found) return found;
        
        // Buscar por ID parcial
        found = this.topicTimeEstimates.find(t => 
            t.topicId.includes(topicId) || topicId.includes(t.topicId)
        );
        if (found) return found;
        
        // Buscar por título
        const lowerSearch = topicId.toLowerCase();
        found = this.topicTimeEstimates.find(t => 
            t.topicTitle.toLowerCase().includes(lowerSearch) ||
            lowerSearch.includes(t.topicTitle.toLowerCase())
        );
        
        return found || null;
    }
    
    /**
     * Crear plan por defecto si no se encuentra en planning
     */
    private createDefaultPlan(topicId: string): StrategicPlan {
        return {
            timeAllocation: 60,
            strategy: 'balanced',
            targetWords: 700,
            targetSections: 4,
            practiceRelevance: 0,
            practiceExamples: [],
            commonCalculations: [],
            criticalLaws: [],
            complexity: 'Medium',
            reasoning: 'Tema no encontrado en planning, usando valores por defecto'
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
            case 'extended': return 1000;
            case 'standard': return 700;
            case 'concise': return 500;
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

