/**
 * WIDGET TYPES - Sistema de Widgets y Estructura de Contenido
 * 
 * Tipos TypeScript para el sistema de generación de temarios
 * con orquestación de agentes IA.
 */

// ============================================
// TIPOS DE WIDGET
// ============================================

export type WidgetType =
    | 'mnemonic'    // Regla mnemotécnica
    | 'timeline'    // Línea temporal
    | 'diagram'     // Diagrama Mermaid
    | 'analogy'     // Analogía/Historia
    | 'image'       // Imagen generada
    | 'audio'       // Audio TTS
    | 'formula'     // Fórmula matemática
    | 'quiz'        // Mini-test
    | 'alert'       // Alerta de contenido augmentado
    | 'video_loop'; // Video/animación

// Definición genérica de widget
export interface WidgetDefinition {
    type: WidgetType;
    content: unknown;
    generatable: boolean; // Si requiere generación adicional (ej: imagen)
    generated?: boolean;  // Si ya fue generado
}

// Contenidos específicos por tipo de widget
export interface MnemonicContent {
    rule: string;
    explanation: string;
}

export interface TimelineContent {
    steps: Array<{ time: string; action: string }>;
}

export interface DiagramContent {
    structure: string; // Código Mermaid
}

export interface AnalogyContent {
    story: string;
}

export interface ImageContent {
    prompt: string;
    url?: string;
    alt?: string;
}

export interface AudioContent {
    text: string;
    url?: string;
    duration?: number;
}

export interface FormulaContent {
    latex: string;
    variables?: Array<{ symbol: string; description: string }>;
}

export interface QuizContent {
    questions: Array<{
        question: string;
        options: string[];
        correctIndex: number;
    }>;
}

export interface AlertContent {
    message: string;
    severity: 'info' | 'warning' | 'gap';
}

export interface VideoContent {
    concept: string;
    visual_prompt: string;
    url?: string;
}

// ============================================
// ESTRUCTURA DE SECCIONES
// ============================================

export type SectionLevel = 'h1' | 'h2' | 'h3';
export type SourceType = 'library' | 'augmented' | 'mixed';

export interface TopicSection {
    id: string;
    title: string;
    level: SectionLevel;
    sourceType: SourceType;
    content: {
        text: string;
        widgets: WidgetDefinition[];
    };
    children?: TopicSection[];
}

// ============================================
// CONTENIDO GENERADO
// ============================================

export type ComplexityLevel = 'High' | 'Medium' | 'Low';

export interface TopicMetadata {
    complexity: ComplexityLevel;
    estimatedStudyTime: number; // minutos
    sourceDocuments: string[];
    generatedAt: Date;
    health?: {
        totalWords: number;
        avgWordsPerSection: number;
        sectionsBelowThreshold: number;
        minWordsPerSection: number;
        totalSections: number;
        wordGoalMet: boolean;
    };
    practiceMetrics?: {
        practiceReadiness?: number; // 0-1 (% de contenido útil para supuestos)
        conceptsFromRealSupuestos?: number;
        formulasIncluded?: number;
        examplesProvided?: number;
        appearsInSupuestos?: string[];
    };
}

export interface GeneratedTopicContent {
    topicId: string;
    title: string;
    metadata: TopicMetadata;
    sections: TopicSection[];
    widgets?: WidgetDefinition[]; // placeholders o widgets generados
    qualityStatus?: 'ok' | 'needs_improvement';
    warnings?: string[];
}

// ============================================
// ESTADOS DE GENERACIÓN
// ============================================

export type GenerationStatus =
    | 'idle'           // Sin generar
    | 'queued'         // En cola
    | 'fetching'       // Obteniendo de biblioteca
    | 'analyzing'      // Analizando gaps
    | 'planning'       // Calculando tiempo
    | 'generating'     // Generando contenido
    | 'completed'      // Completado
    | 'error';         // Error

// ============================================
// AGENTES DE ORQUESTACIÓN
// ============================================

export type AgentRole = 'librarian' | 'auditor' | 'timekeeper' | 'strategist' | 'planner' | 'expert-teorico' | 'expert-practical' | 'expert-tecnico' | 'curator';

export interface AgentStep {
    role: AgentRole;
    status: 'pending' | 'running' | 'completed' | 'error';
    input?: unknown;
    output?: unknown;
    reasoning?: string;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
}

export interface OrchestrationState {
    topicId: string;
    status: GenerationStatus;
    steps: AgentStep[];
    currentStep: AgentRole | null;
    result?: GeneratedTopicContent;
}

// ============================================
// ESTRATEGIA DE CONCISIÓN (TimeKeeper)
// ============================================

export type ConcisionStrategy =
    | 'executive_summary'  // Muy poco tiempo: solo puntos clave
    | 'condensed'          // Poco tiempo: resumen con lo esencial
    | 'balanced'           // Tiempo normal: explicación equilibrada
    | 'detailed'           // Mucho tiempo: explicación profunda
    | 'exhaustive';        // Sin límite: máximo detalle

export interface TimeKeeperDecision {
    availableMinutes: number;
    recommendedTokens: number;
    strategy: ConcisionStrategy;
    widgetBudget: number; // Número máximo de widgets a generar
}
