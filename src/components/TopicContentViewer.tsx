"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Sparkles,
    Clock,
    FileText,
    Loader2,
    CheckCircle,
    ChevronDown,
    XCircle,
    AlertTriangle,
    RefreshCw,
    StopCircle,
    Volume2,
    Play,
    Pause
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { HierarchicalOutline } from "./HierarchicalOutline";
import { OrchestratorFlow } from "./OrchestratorFlow";
import { WidgetFactory } from "./WidgetFactory";
import type {
    TopicSection,
    GeneratedTopicContent,
    OrchestrationState,
    AgentStep
} from "@/lib/widget-types";
import { TopicWithGroup, generateBaseHierarchy, flattenSections } from "@/lib/syllabus-hierarchy";

// ============================================
// TIPOS
// ============================================

interface TopicContentViewerProps {
    topic: TopicWithGroup;
    initialContent?: GeneratedTopicContent;
}

interface GenerationError {
    message: string;
    timestamp: Date;
    telemetry?: Record<string, unknown>;
    retryCount: number;
}

const contentStorageKey = (topicId: string) => `topic_content_${topicId}`;
const traceStorageKey = (topicId: string) => `topic_trace_${topicId}`;
const MAX_RETRIES = 3;

function hydrateContent(data?: GeneratedTopicContent | null): GeneratedTopicContent | null {
    if (!data) return null;
    return {
        ...data,
        metadata: {
            ...data.metadata,
            generatedAt: new Date(data.metadata.generatedAt),
        },
        sections: (data.sections || []).map(section => ({
            ...section,
            content: {
                text: section.content?.text || "",
                widgets: section.content?.widgets || [],
            },
            children: section.children || [],
        })),
    };
}

function hydrateOrchestrationState(topicId: string, raw?: OrchestrationState, hasContent?: boolean): OrchestrationState {
    if (!raw) {
        return {
            topicId,
            status: 'idle',
            steps: [],
            currentStep: null,
        };
    }

    // Estados "ocupados" que no deberían persistir si no hay contenido generado
    const busyStatuses: Array<OrchestrationState["status"]> = ['fetching', 'analyzing', 'planning', 'generating', 'queued'];
    const wasStuck = busyStatuses.includes(raw.status) && !hasContent;
    
    return {
        ...raw,
        topicId,
        // Si el estado estaba "ocupado" pero no hay contenido, resetear a idle
        status: wasStuck ? 'idle' : raw.status,
        currentStep: wasStuck ? null : (raw.currentStep || null),
        steps: wasStuck ? [] : (raw.steps || []).map(step => ({
            ...step,
            startedAt: step.startedAt ? new Date(step.startedAt) : undefined,
            completedAt: step.completedAt ? new Date(step.completedAt) : undefined,
        })),
        result: hydrateContent(raw.result) || undefined,
    };
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function TopicContentViewer({ topic, initialContent }: TopicContentViewerProps) {
    const [content, setContent] = useState<GeneratedTopicContent | null>(() => hydrateContent(initialContent));
    const [orchestrationState, setOrchestrationState] = useState<OrchestrationState>(() =>
        hydrateOrchestrationState(topic.id)
    );
    const [eventSource, setEventSource] = useState<EventSource | null>(null);
    const [timeoutId, setTimeoutId] = useState<number | null>(null);
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [showOrchestrator, setShowOrchestrator] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<GenerationError | null>(null);
    const retryCountRef = useRef(0);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);

    // Secciones a mostrar (generadas o base)
    const sections = content?.sections || generateBaseHierarchy(topic);
    const flatSections = flattenSections(sections);

    // Cargar persistencia local (si no hay contenido inicial desde Supabase)
    useEffect(() => {
        let loadedContent: GeneratedTopicContent | null = null;
        
        if (initialContent) {
            loadedContent = hydrateContent(initialContent);
            setContent(loadedContent);
            try {
                localStorage.setItem(contentStorageKey(topic.id), JSON.stringify(loadedContent));
            } catch {
                // ignore storage errors
            }
        } else {
            try {
                const stored = localStorage.getItem(contentStorageKey(topic.id));
                if (stored) {
                    const parsed = hydrateContent(JSON.parse(stored));
                    if (parsed) {
                        loadedContent = parsed;
                        setContent(parsed);
                    }
                }
            } catch {
                // ignore
            }
        }

        // Cargar trace pasando si hay contenido para evitar estados "stuck"
        try {
            const storedTrace = localStorage.getItem(traceStorageKey(topic.id));
            if (storedTrace) {
                const hasContent = Boolean(loadedContent || initialContent);
                const parsedTrace = hydrateOrchestrationState(topic.id, JSON.parse(storedTrace), hasContent);
                setOrchestrationState(parsedTrace);
            }
        } catch {
            // ignore storage parse errors
        }

        return () => {
            eventSource?.close();
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [topic.id, initialContent, eventSource, timeoutId]);

    // Persistir cambios
    useEffect(() => {
        if (!content) return;
        try {
            localStorage.setItem(contentStorageKey(topic.id), JSON.stringify(content));
        } catch {
            // ignore storage errors
        }
    }, [content, topic.id]);

    useEffect(() => {
        if (!orchestrationState || (!orchestrationState.steps.length && !orchestrationState.result)) return;
        try {
            localStorage.setItem(traceStorageKey(topic.id), JSON.stringify(orchestrationState));
        } catch {
            // ignore
        }
    }, [orchestrationState, topic.id]);

    // Cancelar generación en curso
    const handleCancel = useCallback(async () => {
        if (eventSource) {
            eventSource.close();
            setEventSource(null);
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
            setTimeoutId(null);
        }

        // También notificar al servidor para limpiar recursos
        try {
            await fetch(`/api/generate-topic-stream?topicId=${encodeURIComponent(topic.id)}&action=cancel`, {
                method: 'POST'
            });
        } catch {
            // Ignorar errores de cancelación en servidor
        }

        setIsGenerating(false);
        setOrchestrationState(prev => ({
            ...prev,
            status: 'error',
            currentStep: null
        }));
        setError({
            message: 'Generación cancelada por el usuario',
            timestamp: new Date(),
            retryCount: retryCountRef.current
        });
    }, [eventSource, timeoutId, topic.id]);

    // Generar contenido
    const handleGenerate = useCallback(async (isRetry = false) => {
        // Cerrar cualquier stream previo
        if (eventSource) {
            eventSource.close();
            setEventSource(null);
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
            setTimeoutId(null);
        }

        // Limpiar error previo
        setError(null);

        const isForce = Boolean(content) || isRetry;

        // Si es regeneración, limpiar estado local y trazas previas
        if (isForce && !isRetry) {
            try {
                localStorage.removeItem(contentStorageKey(topic.id));
                localStorage.removeItem(traceStorageKey(topic.id));
            } catch {
                // ignore storage cleanup
            }
            setContent(null);
            retryCountRef.current = 0;
        }

        if (isRetry) {
            retryCountRef.current += 1;
        }

        setIsGenerating(true);
        setShowOrchestrator(true);

        // Simular pipeline mientras llegan los datos reales
        const bootstrapSteps: AgentStep[] = [
            { role: 'librarian', status: 'running', startedAt: new Date(), input: { topic: topic.title } },
            { role: 'auditor', status: 'pending' },
            { role: 'timekeeper', status: 'pending' },
            { role: 'strategist', status: 'pending' },
        ];

        setOrchestrationState({
            topicId: topic.id,
            status: 'fetching',
            steps: bootstrapSteps,
            currentStep: 'librarian',
        });

        try {
            // Preferimos streaming SSE para ver onStateChange en vivo
            const url = `/api/generate-topic-stream?topicId=${encodeURIComponent(topic.id)}&force=${isForce}`;
            const es = new EventSource(url);

            es.addEventListener("state", (evt) => {
                try {
                    const data = JSON.parse((evt as MessageEvent).data);
                    // NO usar hydrateOrchestrationState en eventos SSE en vivo (solo para localStorage)
                    // Usar el estado directamente para evitar el reset de "wasStuck"
                    setOrchestrationState({
                        ...data,
                        topicId: topic.id,
                        steps: (data.steps || []).map((step: any) => ({
                            ...step,
                            startedAt: step.startedAt ? new Date(step.startedAt) : undefined,
                            completedAt: step.completedAt ? new Date(step.completedAt) : undefined,
                        }))
                    });
                } catch {
                    // ignore parse errors
                }
            });

            es.addEventListener("done", (evt) => {
                try {
                    const data = JSON.parse((evt as MessageEvent).data);
                    const hydratedContent = hydrateContent(data.result);
                    if (hydratedContent) setContent(hydratedContent);

                    const health = data.health || hydratedContent?.metadata?.health;
                    const needsImprovement = data.qualityStatus === 'needs_improvement' || health?.wordGoalMet === false;
                    const warnings = (data.warnings as string[]) || [];

                    setOrchestrationState(prev => ({
                        ...prev,
                        status: needsImprovement ? 'error' : 'completed',
                        currentStep: null,
                        result: hydratedContent || prev.result
                    }));

                    if (needsImprovement) {
                        setError({
                            message: warnings.join(' | ') || 'Contenido insuficiente: secciones con pocas palabras.',
                            timestamp: new Date(),
                            retryCount: retryCountRef.current,
                            telemetry: { health }
                        });
                    } else {
                        setError(null);
                    }
                    retryCountRef.current = 0;
                } catch {
                    setOrchestrationState(prev => ({ ...prev, status: 'error' }));
                    setError({
                        message: 'Error al procesar la respuesta',
                        timestamp: new Date(),
                        retryCount: retryCountRef.current
                    });
                } finally {
                    es.close();
                    setEventSource(null);
                    setIsGenerating(false);
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        setTimeoutId(null);
                    }
                }
            });

            es.addEventListener("error", (evt) => {
                console.error("SSE error", evt);
                // Intentar extraer mensaje de error del evento
                let errorMessage = 'Error de conexión con el servidor';
                try {
                    const data = JSON.parse((evt as MessageEvent).data);
                    errorMessage = data.message || errorMessage;
                } catch {
                    // usar mensaje por defecto
                }
                
                setOrchestrationState(prev => ({ ...prev, status: 'error' }));
                setError({
                    message: errorMessage,
                    timestamp: new Date(),
                    retryCount: retryCountRef.current
                });
                es.close();
                setEventSource(null);
                setIsGenerating(false);
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    setTimeoutId(null);
                }
            });

            setEventSource(es);

            // Seguridad: si el stream no cierra en 300s (5 min), marcamos error
            const guard = window.setTimeout(() => {
                es.close();
                setEventSource(null);
                setIsGenerating(false);
                setOrchestrationState(prev => ({
                    ...prev,
                    status: 'error'
                }));
                setError({
                    message: 'Tiempo de generación agotado en cliente (130s)',
                    timestamp: new Date(),
                    retryCount: retryCountRef.current
                });
            }, 300000); // 5 minutos para permitir razonamiento profundo de todos los cerebros
            setTimeoutId(guard);
        } catch (err) {
            console.error("Error during topic generation", err);
            setOrchestrationState(prev => ({ ...prev, status: 'error' }));
            setError({
                message: err instanceof Error ? err.message : 'Error desconocido',
                timestamp: new Date(),
                retryCount: retryCountRef.current
            });
            setIsGenerating(false);
        }
    }, [topic.id, topic.title, content, eventSource, timeoutId]);

    // Reintento automático (solo si no superó MAX_RETRIES)
    const handleRetry = useCallback(() => {
        if (retryCountRef.current < MAX_RETRIES) {
            handleGenerate(true);
        }
    }, [handleGenerate]);
    
    // Generar audio/podcast
    const handleGenerateAudio = useCallback(async () => {
        if (!content) return;
        
        setIsGeneratingAudio(true);
        setAudioError(null);
        
        try {
            const res = await fetch('/api/generate-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topicId: topic.id })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Error generating audio');
            }
            
            // Actualizar content con audioUrl
            setContent(prev => prev ? {
                ...prev,
                metadata: {
                    ...prev.metadata,
                    audioUrl: data.audioUrl
                }
            } : null);
            
            console.log('[VIEWER] Audio generated:', data.cached ? '(cached)' : '(new)');
            
        } catch (err) {
            console.error('[VIEWER] Error generating audio:', err);
            setAudioError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsGeneratingAudio(false);
        }
    }, [content, topic.id]);

    // Status badge - SOLO usa isGenerating para mostrar "Generando", NO orchestrationState.status
    const getStatusBadge = () => {
        // Error tiene prioridad (pero solo si no estamos generando activamente)
        if (!isGenerating && (error || orchestrationState.status === 'error')) {
            return { icon: XCircle, text: 'Error', color: 'text-red-400 bg-red-500/20', animate: false };
        }
        // Solo mostrar "Generando" cuando isGenerating es true (acción del usuario)
        if (isGenerating) {
            return { icon: Loader2, text: 'Generando...', color: 'text-purple-400 bg-purple-500/20', animate: true };
        }
        // Contenido generado exitosamente
        if (content && orchestrationState.status === 'completed') {
            return { icon: CheckCircle, text: 'Generado', color: 'text-green-400 bg-green-500/20', animate: false };
        }
        // Hay contenido pero no sabemos el status (cargado de caché)
        if (content) {
            return { icon: CheckCircle, text: 'Generado', color: 'text-green-400 bg-green-500/20', animate: false };
        }
        return { icon: FileText, text: 'Pendiente', color: 'text-white/40 bg-white/5', animate: false };
    };

    const status = getStatusBadge();
    const canRetry = error && retryCountRef.current < MAX_RETRIES;

    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/syllabus/group/${topic.groupIndex}`}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-white/50" />
                        </Link>
                        <div>
                            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
                                {topic.groupTitle}
                            </p>
                            <h1 className="text-xl font-black text-white leading-tight max-w-2xl">
                                {topic.title}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Status Badge */}
                        <div className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold",
                            status.color
                        )}>
                            <status.icon className={cn("w-4 h-4", status.animate && "animate-spin")} />
                            {status.text}
                        </div>

                        {/* Cancel Button - Solo visible durante generación */}
                        {isGenerating && (
                            <motion.button
                                onClick={handleCancel}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
                            >
                                <StopCircle className="w-4 h-4" />
                                Cancelar
                            </motion.button>
                        )}

                        {/* Retry Button - Solo visible en error */}
                        {canRetry && !isGenerating && (
                            <motion.button
                                onClick={handleRetry}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Reintentar ({MAX_RETRIES - retryCountRef.current} restantes)
                            </motion.button>
                        )}

                        {/* Generate Button */}
                        <motion.button
                            onClick={() => handleGenerate(false)}
                            disabled={isGenerating}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all",
                                isGenerating
                                    ? "bg-white/10 text-white/50 cursor-wait"
                                    : "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40"
                            )}
                        >
                            {isGenerating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            {content ? 'Regenerar' : 'Generar Temario'}
                        </motion.button>
                    </div>
                </div>

                {/* Orchestrator Toggle */}
                {(showOrchestrator || isGenerating) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="mt-4"
                    >
                        <OrchestratorFlow
                            state={orchestrationState}
                            onClose={() => setShowOrchestrator(false)}
                        />
                    </motion.div>
                )}

                {/* Error Banner */}
                <AnimatePresence>
                    {error && !isGenerating && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-4"
                        >
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-red-400 mb-1">
                                            Error en la generación
                                        </h4>
                                        <p className="text-xs text-red-300/80 mb-2">
                                            {error.message}
                                        </p>
                                        <div className="flex items-center gap-4 text-[10px] text-red-300/60">
                                            <span>
                                                {error.timestamp.toLocaleTimeString()}
                                            </span>
                                            {error.retryCount > 0 && (
                                                <span>
                                                    Intentos: {error.retryCount}/{MAX_RETRIES}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {canRetry && (
                                            <button
                                                onClick={handleRetry}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold rounded-lg transition-colors"
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                Reintentar
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setError(null)}
                                            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                                        >
                                            <XCircle className="w-4 h-4 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            {/* Main Layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar: Hierarchical Outline */}
                <aside className="w-80 border-r border-white/5 bg-black/20 flex-shrink-0 overflow-hidden">
                    <HierarchicalOutline
                        sections={sections}
                        activeSectionId={activeSectionId || undefined}
                        onSectionClick={setActiveSectionId}
                        generatingIds={isGenerating ? flatSections.map(s => s.id) : []}
                    />
                </aside>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto p-8">
                    {!content ? (
                        // Empty State
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                                <Sparkles className="w-10 h-10 text-white/20" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">
                                Contenido pendiente de generación
                            </h2>
                            <p className="text-white/50 max-w-md mb-8">
                                Haz clic en &quot;Generar Temario&quot; para que los agentes de IA analicen
                                este tema y creen contenido optimizado para tu estudio.
                            </p>
                            <button
                                onClick={() => handleGenerate(false)}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:scale-105 transition-transform"
                            >
                                <Sparkles className="w-5 h-5" />
                                Generar Temario
                            </button>
                        </div>
                    ) : (
                        // Content Sections
                        <div className="max-w-4xl mx-auto space-y-8">
                            {content.sections.map((section) => (
                                <SectionRenderer
                                    key={section.id}
                                    section={section}
                                    isActive={section.id === activeSectionId}
                                    onActivate={() => setActiveSectionId(section.id)}
                                />
                            ))}
                        </div>
                    )}
                </main>
            </div>

            {/* Metadata Footer */}
            {content && (
                <footer className="border-t border-white/5 px-6 py-3 bg-black/20 text-xs text-white/40">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {content.metadata.estimatedStudyTime} min estimados
                            </span>
                            <span>
                                Complejidad: {content.metadata.complexity}
                            </span>
                        </div>
                        <span>
                            Generado: {new Date(content.metadata.generatedAt).toLocaleString()}
                        </span>
                    </div>
                    
                    {/* Practice Metrics */}
                    {content.metadata.practiceMetrics && (
                        <div className="pt-2 border-t border-white/5 flex items-center gap-6">
                            {content.metadata.practiceMetrics.practiceReadiness !== undefined && (
                                <div className="flex items-center gap-2">
                                    <span className="text-white/60 font-semibold">🎯 Practice Ready:</span>
                                    <span className={cn(
                                        "font-bold",
                                        content.metadata.practiceMetrics.practiceReadiness >= 0.9 ? "text-green-400" :
                                        content.metadata.practiceMetrics.practiceReadiness >= 0.8 ? "text-yellow-400" :
                                        "text-orange-400"
                                    )}>
                                        {(content.metadata.practiceMetrics.practiceReadiness * 100).toFixed(0)}%
                                    </span>
                                </div>
                            )}
                            
                            {content.metadata.practiceMetrics.conceptsFromRealSupuestos !== undefined && (
                                <div className="flex items-center gap-2">
                                    <span className="text-white/60">📚 Conceptos de supuestos reales:</span>
                                    <span className="text-white/80 font-semibold">
                                        {content.metadata.practiceMetrics.conceptsFromRealSupuestos}
                                    </span>
                                </div>
                            )}
                            
                            {content.metadata.practiceMetrics.formulasIncluded !== undefined && (
                                <div className="flex items-center gap-2">
                                    <span className="text-white/60">🧮 Fórmulas:</span>
                                    <span className="text-white/80 font-semibold">
                                        {content.metadata.practiceMetrics.formulasIncluded}
                                    </span>
                                </div>
                            )}
                            
                            {content.metadata.practiceMetrics.appearsInSupuestos && 
                             content.metadata.practiceMetrics.appearsInSupuestos.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-white/60">📋 Aparece en:</span>
                                    <span className="text-white/80 font-semibold">
                                        {content.metadata.practiceMetrics.appearsInSupuestos.slice(0, 3).join(', ')}
                                        {content.metadata.practiceMetrics.appearsInSupuestos.length > 3 && 
                                            ` +${content.metadata.practiceMetrics.appearsInSupuestos.length - 3} más`
                                        }
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </footer>
            )}
            
            {/* Audio Player - Solo si ya está generado */}
            {content && content.metadata.audioUrl && (
                <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/10 p-4 z-50">
                    <div className="max-w-4xl mx-auto">
                        <audio 
                            controls 
                            className="w-full"
                            src={content.metadata.audioUrl}
                        >
                            Tu navegador no soporta audio HTML5.
                        </audio>
                        <p className="text-xs text-white/40 text-center mt-2">
                            🎧 Podcast resumen - Duración estimada: ~15 min
                        </p>
                    </div>
                </div>
            )}
            
            {/* Botón para generar audio si no existe */}
            {content && !content.metadata.audioUrl && !isGeneratingAudio && (
                <button
                    onClick={handleGenerateAudio}
                    className="fixed bottom-4 right-4 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl shadow-lg flex items-center gap-2 font-bold transition-colors z-40"
                >
                    <Volume2 className="w-4 h-4" />
                    Generar Podcast
                </button>
            )}
            
            {/* Indicador de generación de audio */}
            {isGeneratingAudio && (
                <div className="fixed bottom-4 right-4 px-4 py-3 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl shadow-lg flex items-center gap-2 font-bold z-40">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando podcast...
                </div>
            )}
            
            {/* Error de audio */}
            {audioError && (
                <div className="fixed bottom-4 right-4 px-4 py-3 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl shadow-lg max-w-xs z-40">
                    <p className="text-xs font-bold mb-1">Error al generar audio</p>
                    <p className="text-xs">{audioError}</p>
                    <button
                        onClick={() => setAudioError(null)}
                        className="text-xs underline mt-2"
                    >
                        Cerrar
                    </button>
                </div>
            )}
        </div>
    );
}

// ============================================
// RENDERIZADOR DE SECCIÓN
// ============================================

interface SectionRendererProps {
    section: TopicSection;
    isActive: boolean;
    onActivate: () => void;
}

function SectionRenderer({ section, isActive, onActivate }: SectionRendererProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    const levelStyles = {
        h1: 'text-3xl font-black',
        h2: 'text-xl font-bold',
        h3: 'text-lg font-semibold',
    };

    const sourceStyles = {
        library: 'border-l-blue-500',
        augmented: 'border-l-purple-500',
        mixed: 'border-l-amber-500',
    };

    return (
        <motion.div
            id={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "bg-white/5 rounded-2xl border border-white/10 overflow-hidden transition-all",
                isActive && "ring-2 ring-primary/50"
            )}
            onClick={onActivate}
        >
            {/* Section Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
            >
                <div className={cn("text-white text-left", levelStyles[section.level])}>
                    {section.title}
                </div>
                <ChevronDown className={cn(
                    "w-5 h-5 text-white/30 transition-transform",
                    isExpanded && "rotate-180"
                )} />
            </button>

            {/* Section Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className={cn(
                            "p-6 pt-0 border-l-4 ml-6",
                            sourceStyles[section.sourceType]
                        )}>
                            {/* Text Content */}
                            {section.content.text && (
                                <div className="prose prose-invert prose-lg max-w-none mb-6">
                                    <ReactMarkdown>
                                        {section.content.text}
                                    </ReactMarkdown>
                                </div>
                            )}

                            {/* Widgets */}
                            {section.content.widgets.length > 0 && (
                                <div className="space-y-4">
                                    <WidgetFactory widgets={section.content.widgets} />
                                </div>
                            )}

                            {/* Children Sections */}
                            {section.children && section.children.length > 0 && (
                                <div className="mt-6 space-y-4 pl-4 border-l border-white/10">
                                    {section.children.map(child => (
                                        <SectionRenderer
                                            key={child.id}
                                            section={child}
                                            isActive={false}
                                            onActivate={() => { }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
