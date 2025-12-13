/**
 * WIDGET TYPES - Sistema de Widgets y Estructura de Contenido
 *
 * Tipos TypeScript para el sistema de generaciÃ³n de temarios
 * con orquestaciÃ³n de agentes IA.
 */

// ============================================
// TIPOS DE WIDGET
// ============================================

export type WidgetType =
    | 'mnemonic'    // Regla mnemotÃ©cnica
    | 'mnemonic_generator' // Mnemotecnia on-demand (UI)
    | 'timeline'    // LÃ­nea temporal
    | 'timeline_generator' // Timeline on-demand (UI)
    | 'diagram'     // Diagrama Mermaid
    | 'diagram_generator' // Diagrama on-demand (UI)
    | 'analogy'     // AnalogÃ­a/Historia
    | 'image'       // Imagen generada
    | 'infografia'  // InfografÃ­a visual on-demand (UI)
    | 'audio'       // Audio TTS
    | 'formula'     // FÃ³rmula matemÃ¡tica
    | 'quiz'        // Mini-test
    | 'quiz_generator' // Quiz on-demand (UI)
    | 'case_practice' // Mini caso prÃ¡ctico on-demand (UI)
    | 'alert'       // Alerta de contenido augmentado
    | 'video_loop'; // Video/animaciÃ³n

// DefiniciÃ³n genÃ©rica de widget
export interface WidgetDefinition {
    type: WidgetType;
    content: unknown;
    generatable: boolean; // Si requiere generaciÃ³n adicional (ej: imagen)
    generated?: boolean;  // Si ya fue generado
}

// Contenidos especÃ­ficos por tipo de widget
export interface MnemonicContent {
    rule: string;
    explanation: string;
}

export interface TimelineContent {
    steps: Array<{ time: string; action: string }>;
}

export interface DiagramContent {
    structure: string; // CÃ³digo Mermaid
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

// ============================================
// SOURCE METADATA (para referencias interactivas)
// ============================================

export interface SourceChunkMetadata {
    chunkId: string;
    article: string;
    page?: number;
    originalText: string;
    confidence: number;
}

export interface SectionSourceMetadata {
    primaryDocument: string;
    articles: string[];
    chunks: SourceChunkMetadata[];
}

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
    sourceMetadata?: SectionSourceMetadata;
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
    audioUrl?: string; // URL del podcast generado
    audioGeneratedAt?: string; // Timestamp de generaciÃ³n de audio
    health?: {
        totalWords: number;
        avgWordsPerSection: number;
        sectionsBelowThreshold: number;
        minWordsPerSection: number;
        totalSections: number;
        wordGoalMet: boolean;
    };
    practiceMetrics?: {
        practiceReadiness?: number; // 0-1 (% de contenido Ãºtil para supuestos)
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
// ESTADOS DE GENERACIÃ“N
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
// AGENTES DE ORQUESTACIÃ“N
// ============================================

export type AgentRole =
    | 'librarian'
    | 'auditor'
    | 'timekeeper'
    | 'strategist'
    | 'planner'
    | 'expert-teorico'
    | 'expert-practical'
    | 'expert-tecnico'
    | 'curator';

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
// ESTRATEGIA DE CONCISIÃ“N (TimeKeeper)
// ============================================

export type ConcisionStrategy =
    | 'executive_summary'  // Muy poco tiempo: solo puntos clave
    | 'condensed'          // Poco tiempo: resumen con lo esencial
    | 'balanced'           // Tiempo normal: explicaciÃ³n equilibrada
    | 'detailed'           // Mucho tiempo: explicaciÃ³n profunda
    | 'exhaustive';        // Sin lÃ­mite: mÃ¡ximo detalle

export interface TimeKeeperDecision {
    availableMinutes: number;
    recommendedTokens: number;
    strategy: ConcisionStrategy;
    widgetBudget: number; // NÃºmero mÃ¡ximo de widgets a generar
}

