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
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { OrchestratorFlow } from "./OrchestratorFlow";
import { WidgetFactory } from "./WidgetFactory";
import { ContentWithSources } from "./ContentWithSources";
import type {
    TopicSection,
    GeneratedTopicContent,
    OrchestrationState,
    AgentStep
} from "@/lib/widget-types";
import { TopicWithGroup } from "@/lib/syllabus-hierarchy";

// ============================================
// TIPOS
// ============================================

interface TopicContentViewerProps {
    topic: TopicWithGroup;
    initialContent?: GeneratedTopicContent;
    initialRecordId?: string;
    variant?: "page" | "embedded";
    onContentChange?: (content: GeneratedTopicContent | null) => void;
    onRecordIdChange?: (recordId?: string) => void;
}

interface GenerationError {
    message: string;
    timestamp: Date;
    telemetry?: Record<string, unknown>;
    retryCount: number;
    severity?: "error" | "warning";
}

const contentStorageKey = (topicId: string) => `topic_content_${topicId}`;
const stableTopicKey = (topic: TopicWithGroup) =>
    `${topic.originalFilename || ""} ${topic.title || ""}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
const stableContentStorageKey = (topic: TopicWithGroup) => `topic_content_key_${stableTopicKey(topic)}`;
const traceStorageKey = (topicId: string) => `topic_trace_${topicId}`;
const MAX_RETRIES = 3;
const CLIENT_GENERATION_GUARD_MS = 9 * 60 * 1000; // 9 min (server suele ser 10 min)

function hydrateContent(data?: GeneratedTopicContent | null): GeneratedTopicContent | null {
    if (!data) return null;
    const metadata = (data as any).metadata || {};
    const generatedAtRaw = (metadata as any).generatedAt;
    const generatedAt = generatedAtRaw ? new Date(generatedAtRaw) : new Date(0);
    return {
        ...data,
        metadata: {
            ...metadata,
            generatedAt,
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

function getGeneratedAtMs(content: GeneratedTopicContent | null): number {
    if (!content?.metadata?.generatedAt) return 0;
    const d = content.metadata.generatedAt instanceof Date ? content.metadata.generatedAt : new Date(content.metadata.generatedAt as any);
    const t = d.getTime();
    return Number.isFinite(t) ? t : 0;
}

function countSections(sections: TopicSection[] | undefined): number {
    if (!sections?.length) return 0;
    let count = 0;
    const stack = [...sections];
    while (stack.length) {
        const s = stack.pop();
        if (!s) continue;
        count += 1;
        if (s.children?.length) stack.push(...s.children);
    }
    return count;
}

function estimateWordCountFromSections(sections: TopicSection[] | undefined): number {
    if (!sections?.length) return 0;
    let words = 0;
    const stack = [...sections];
    while (stack.length) {
        const s = stack.pop();
        if (!s) continue;
        const text = s.content?.text || "";
        if (text) {
            const w = text.trim().split(/\s+/).filter(Boolean).length;
            words += w;
        }
        if (s.children?.length) stack.push(...s.children);
    }
    return words;
}

function getContentWordCount(content: GeneratedTopicContent | null): number {
    const healthWords = content?.metadata?.health?.totalWords;
    if (typeof healthWords === "number" && Number.isFinite(healthWords)) return healthWords;
    return estimateWordCountFromSections(content?.sections);
}

function countGeneratedWidgets(content: GeneratedTopicContent | null): number {
    if (!content?.sections?.length) return 0;
    let count = 0;

    const visitSection = (section: TopicSection) => {
        const widgets = section.content?.widgets || [];
        for (const w of widgets) {
            if (!w) continue;
            if ((w as any).generated === true) {
                count += 1;
                continue;
            }
            const c = (w as any).content;
            if (c && typeof c === "object") {
                if ((c as any).imageUrl || (c as any).generatedRule || (c as any).scenario) {
                    count += 1;
                }
            }
        }
        if (section.children?.length) section.children.forEach(visitSection);
    };

    content.sections.forEach(visitSection);
    return count;
}

function pickNewestContent(...candidates: Array<GeneratedTopicContent | null | undefined>): GeneratedTopicContent | null {
    let best: GeneratedTopicContent | null = null;
    let bestTime = 0;
    let bestWords = 0;
    let bestSections = 0;
    let bestWidgets = 0;
    for (const c of candidates) {
        const cc = c || null;
        if (!cc) continue;
        const t = getGeneratedAtMs(cc);
        const words = getContentWordCount(cc);
        const sections = countSections(cc.sections);
        const widgets = countGeneratedWidgets(cc);
        const isBetter =
            !best ||
            t > bestTime ||
            (t === bestTime &&
                (words > bestWords ||
                    (words === bestWords &&
                        (widgets > bestWidgets || (widgets === bestWidgets && sections > bestSections)))));

        if (isBetter) {
            best = cc;
            bestTime = t;
            bestWords = words;
            bestSections = sections;
            bestWidgets = widgets;
        }
    }
    return best;
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

export function TopicContentViewer({
    topic,
    initialContent,
    initialRecordId,
    variant = "page",
    onContentChange,
    onRecordIdChange,
}: TopicContentViewerProps) {
    const [content, setContent] = useState<GeneratedTopicContent | null>(() => hydrateContent(initialContent));
    const [recordId, setRecordId] = useState<string | undefined>(initialRecordId);
    const [orchestrationState, setOrchestrationState] = useState<OrchestrationState>(() =>
        hydrateOrchestrationState(topic.id)
    );
    const eventSourceRef = useRef<EventSource | null>(null);
    const guardTimeoutRef = useRef<number | null>(null);
    const [showOrchestrator, setShowOrchestrator] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<GenerationError | null>(null);
    const retryCountRef = useRef(0);

    const commitRecordId = useCallback(
        (next?: string) => {
            setRecordId(next);
            onRecordIdChange?.(next);
        },
        [onRecordIdChange]
    );

    useEffect(() => {
        if (initialRecordId) commitRecordId(initialRecordId);
    }, [initialRecordId, commitRecordId]);

    // Cargar persistencia local (desde Supabase o localStorage) cuando cambia el tema
    // IMPORTANTE: no depender de eventSource/timeoutId para no sobrescribir el contenido generado en vivo.
    useEffect(() => {
        // En /study usamos variant="embedded" y la fuente de verdad es Supabase.
        // Evitamos desincronizaciones con localStorage (p.ej. IDs de secciones distintos) que rompen la persistencia de widgets.
        if (variant === "embedded") {
            if (initialContent) setContent(hydrateContent(initialContent));
            return;
        }

        let storedCanonical: GeneratedTopicContent | null = null;
        let storedStable: GeneratedTopicContent | null = null;
        let serverContent: GeneratedTopicContent | null = null;

        try {
            const stored = localStorage.getItem(contentStorageKey(topic.id));
            if (stored) storedCanonical = hydrateContent(JSON.parse(stored));
        } catch {
            // ignore
        }

        try {
            const stableStored = localStorage.getItem(stableContentStorageKey(topic));
            if (stableStored) storedStable = hydrateContent(JSON.parse(stableStored));
        } catch {
            // ignore
        }

        if (initialContent) {
            serverContent = hydrateContent(initialContent);
        }

        const winner = pickNewestContent(serverContent, storedCanonical, storedStable);
        if (winner) setContent(winner);

        // Cargar trace pasando si hay contenido para evitar estados "stuck"
        try {
            const storedTrace = localStorage.getItem(traceStorageKey(topic.id));
            if (storedTrace) {
                const hasContent = Boolean(winner);
                const parsedTrace = hydrateOrchestrationState(topic.id, JSON.parse(storedTrace), hasContent);
                setOrchestrationState(parsedTrace);
            }
        } catch {
            // ignore storage parse errors
        }
    }, [topic.id, initialContent, variant]);

    // Cleanup de recursos asíncronos
    useEffect(() => {
        return () => {
            try {
                eventSourceRef.current?.close();
            } catch {
                // ignore
            }
            eventSourceRef.current = null;
            if (guardTimeoutRef.current) {
                clearTimeout(guardTimeoutRef.current);
                guardTimeoutRef.current = null;
            }
        };
    }, []);

    // Persistir cambios
    useEffect(() => {
        if (!content) return;
        if (variant === "embedded") return;
        try {
            localStorage.setItem(contentStorageKey(topic.id), JSON.stringify(content));
            localStorage.setItem(stableContentStorageKey(topic), JSON.stringify(content));
        } catch {
            // ignore storage errors
        }
    }, [content, topic.id, topic.title, topic.originalFilename, variant]);

    useEffect(() => {
        onContentChange?.(content);
    }, [content, onContentChange]);

    useEffect(() => {
        if (!orchestrationState || (!orchestrationState.steps.length && !orchestrationState.result)) return;
        if (variant === "embedded") return;
        try {
            localStorage.setItem(traceStorageKey(topic.id), JSON.stringify(orchestrationState));
        } catch {
            // ignore
        }
    }, [orchestrationState, topic.id, variant]);

    // Cancelar generación en curso
    const handleCancel = useCallback(async () => {
        try {
            eventSourceRef.current?.close();
        } catch {
            // ignore
        }
        eventSourceRef.current = null;
        if (guardTimeoutRef.current) {
            clearTimeout(guardTimeoutRef.current);
            guardTimeoutRef.current = null;
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
    }, [topic.id]);

    // Generar contenido
    const handleGenerate = useCallback(async (isRetry = false) => {
        // Cerrar cualquier stream previo
        try {
            eventSourceRef.current?.close();
        } catch {
            // ignore
        }
        eventSourceRef.current = null;
        if (guardTimeoutRef.current) {
            clearTimeout(guardTimeoutRef.current);
            guardTimeoutRef.current = null;
        }

        // Limpiar error previo
        setError(null);

        const isForce = Boolean(content) || isRetry;

        // Si es regeneración, limpiar trazas previas (pero mantener el contenido actual hasta que haya nuevo resultado)
        if (isForce && !isRetry) {
            if (variant !== "embedded") {
                try {
                    localStorage.removeItem(traceStorageKey(topic.id));
                } catch {
                    // ignore storage cleanup
                }
            }
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
            eventSourceRef.current = es;

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

            es.addEventListener("done", async (evt) => {
                try {
                    const data = JSON.parse((evt as MessageEvent).data);
                    const hydratedContent = hydrateContent(data.result);
                    if (hydratedContent) setContent(hydratedContent);
                    if (typeof data.recordId === "string" && data.recordId.length) {
                        commitRecordId(data.recordId);
                    }

                    const health = data.health || hydratedContent?.metadata?.health;
                    const needsImprovement = data.qualityStatus === 'needs_improvement' || health?.wordGoalMet === false;
                    const warnings = (data.warnings as string[]) || [];
                    let persistOk = Boolean(data.persisted);
                    let persistError = typeof data.persistError === "string" && data.persistError.length ? data.persistError : null;

                    // En /study (embedded) si el SSE no logra persistir, intentar un guardado "backup" via POST (más fiable que el stream).
                    if (!persistOk && variant === "embedded" && hydratedContent) {
                        try {
                            const res = await fetch("/api/generated-content/save", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ topicId: topic.id, contentJson: data.result }),
                            });
                            const saved = await res.json().catch(() => ({}));
                            if (res.ok && saved?.success) {
                                persistOk = true;
                                persistError = null;
                                if (typeof saved?.id === "string" && saved.id.length) {
                                    commitRecordId(saved.id);
                                }
                            } else {
                                persistError = saved?.error || persistError || "No se pudo guardar";
                            }
                        } catch (e) {
                            persistError = e instanceof Error ? e.message : persistError || "No se pudo guardar";
                        }
                    }

                    setOrchestrationState(prev => ({
                        ...prev,
                        // Si hay contenido pero "needs_improvement", tratarlo como aviso (no error)
                        status: hydratedContent ? 'completed' : 'error',
                        currentStep: null,
                        result: hydratedContent || prev.result
                    }));

                    const persistWarning = !persistOk
                        ? variant === "embedded"
                            ? `Persistencia: no se pudo guardar en tu cuenta${persistError ? ` (${persistError})` : ""}. Al recargar podrías ver una versión anterior.`
                            : `Persistencia: no se pudo guardar en tu cuenta${persistError ? ` (${persistError})` : ""}. Se mantiene guardado en este dispositivo.`
                        : null;

                    if (needsImprovement || persistWarning) {
                        const warningMessage =
                            [...warnings, persistWarning].filter(Boolean).join(' | ') ||
                            (data.qualityStatus === 'needs_improvement'
                                ? 'Calidad mejorable: el contenido no alcanza el objetivo. Puedes reintentar para enriquecer.'
                                : 'Contenido mejorable: algunas secciones pueden ser demasiado cortas.');
                        setError({
                            message: warningMessage,
                            timestamp: new Date(),
                            retryCount: retryCountRef.current,
                            telemetry: { health },
                            severity: hydratedContent ? 'warning' : 'error',
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
                    try {
                        es.close();
                    } catch {
                        // ignore
                    }
                    if (eventSourceRef.current === es) eventSourceRef.current = null;
                    setIsGenerating(false);
                    if (guardTimeoutRef.current) {
                        clearTimeout(guardTimeoutRef.current);
                        guardTimeoutRef.current = null;
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
                try {
                    es.close();
                } catch {
                    // ignore
                }
                if (eventSourceRef.current === es) eventSourceRef.current = null;
                setIsGenerating(false);
                if (guardTimeoutRef.current) {
                    clearTimeout(guardTimeoutRef.current);
                    guardTimeoutRef.current = null;
                }
            });

            // Seguridad: si el stream no cierra, marcamos error (sin depender de estado para evitar closures stale)
            guardTimeoutRef.current = window.setTimeout(() => {
                // Si ya no es el EventSource activo, no hacer nada
                if (eventSourceRef.current !== es) return;
                try {
                    es.close();
                } catch {
                    // ignore
                }
                eventSourceRef.current = null;
                setIsGenerating(false);
                setOrchestrationState(prev => ({ ...prev, status: 'error' }));
                setError({
                    message: `Tiempo de generación agotado en cliente (${Math.round(CLIENT_GENERATION_GUARD_MS / 1000)}s)`,
                    timestamp: new Date(),
                    retryCount: retryCountRef.current
                });
            }, CLIENT_GENERATION_GUARD_MS);
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
    }, [topic.id, topic.title, content, variant]);

    // Reintento automático (solo si no superó MAX_RETRIES)
    const handleRetry = useCallback(() => {
        if (retryCountRef.current < MAX_RETRIES) {
            handleGenerate(true);
        }
    }, [handleGenerate]);

    // Status badge - SOLO usa isGenerating para mostrar "Generando", NO orchestrationState.status
    const getStatusBadge = () => {
        // Error tiene prioridad (pero solo si no estamos generando activamente)
        if (!isGenerating && ((error && (error.severity ?? 'error') === 'error') || orchestrationState.status === 'error')) {
            return { icon: XCircle, text: 'Error', color: 'text-red-700 bg-red-100', animate: false };
        }
        if (!isGenerating && error && (error.severity ?? 'error') === 'warning') {
            return { icon: AlertTriangle, text: 'Mejorable', color: 'text-amber-800 bg-amber-100', animate: false };
        }
        // Solo mostrar "Generando" cuando isGenerating es true (acción del usuario)
        if (isGenerating) {
            return { icon: Loader2, text: 'Generando...', color: 'text-purple-700 bg-purple-100', animate: true };
        }
        // Contenido generado exitosamente
        if (content && orchestrationState.status === 'completed') {
            return { icon: CheckCircle, text: 'Generado', color: 'text-green-700 bg-green-100', animate: false };
        }
        // Hay contenido pero no sabemos el status (cargado de caché)
        if (content) {
            return { icon: CheckCircle, text: 'Generado', color: 'text-green-700 bg-green-100', animate: false };
        }
        return { icon: FileText, text: 'Pendiente', color: 'text-slate-600 bg-slate-100', animate: false };
    };

    const status = getStatusBadge();
    const canRetry = error && retryCountRef.current < MAX_RETRIES;

    if (variant === "embedded") {
        return (
            <div className="bg-white text-slate-900">
                <div className="p-4 border-b border-slate-200 bg-white/80 backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                        <div
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold",
                                status.color
                            )}
                        >
                            <status.icon className={cn("w-4 h-4", status.animate && "animate-spin")} />
                            {status.text}
                        </div>

                        <div className="flex items-center gap-2">
                            {isGenerating && (
                                <button
                                    onClick={handleCancel}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition-all"
                                >
                                    <StopCircle className="w-4 h-4" />
                                    Cancelar
                                </button>
                            )}

                            {canRetry && !isGenerating && (
                                <button
                                    onClick={handleRetry}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Reintentar
                                </button>
                            )}

                            <button
                                onClick={() => handleGenerate(false)}
                                disabled={isGenerating}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                                    isGenerating
                                        ? "bg-slate-100 text-slate-500 cursor-wait border-slate-200"
                                        : "bg-blue-600 text-white hover:bg-blue-700 border-transparent"
                                )}
                            >
                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                {content ? "Regenerar" : "Generar tema"}
                            </button>

                            <button
                                onClick={() => setShowOrchestrator(!showOrchestrator)}
                                className="px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                            >
                                {showOrchestrator ? "Ocultar" : "Ver"} proceso IA
                            </button>
                        </div>
                    </div>

                    {(showOrchestrator || isGenerating) && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-4">
                            <OrchestratorFlow state={orchestrationState} onClose={() => setShowOrchestrator(false)} />
                        </motion.div>
                    )}

                    <AnimatePresence>
                        {error && !isGenerating && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-4"
                            >
                                <div
                                    className={cn(
                                        "rounded-xl p-4 border",
                                        (error.severity ?? "error") === "warning"
                                            ? "bg-amber-500/10 border-amber-500/30"
                                            : "bg-red-500/10 border-red-500/30"
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle
                                            className={cn(
                                                "w-5 h-5 flex-shrink-0 mt-0.5",
                                                (error.severity ?? "error") === "warning" ? "text-amber-400" : "text-red-400"
                                            )}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <h4
                                                className={cn(
                                                    "text-sm font-bold mb-1",
                                                    (error.severity ?? "error") === "warning" ? "text-amber-400" : "text-red-400"
                                                )}
                                            >
                                                {(error.severity ?? "error") === "warning" ? "Aviso de calidad" : "Error en la generación"}
                                            </h4>
                                            <p
                                                className={cn(
                                                    "text-xs mb-2",
                                                    (error.severity ?? "error") === "warning" ? "text-amber-300/80" : "text-red-300/80"
                                                )}
                                            >
                                                {error.message}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setError(null)}
                                            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                                            aria-label="Cerrar"
                                        >
                                            <XCircle
                                                className={cn(
                                                    "w-4 h-4",
                                                    (error.severity ?? "error") === "warning" ? "text-amber-400" : "text-red-400"
                                                )}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="p-8 space-y-10">
                    {!content ? (
                        <div className="py-12 flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-5 border border-slate-200">
                                <Sparkles className="w-8 h-8 text-slate-500" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 mb-2">Contenido pendiente de generación</h2>
                            <p className="text-slate-600 max-w-md mb-6 text-sm">
                                Haz clic en “Generar tema” para crear un temario más extenso, pedagógico y trazable.
                            </p>
                            <button
                                onClick={() => handleGenerate(false)}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                <Sparkles className="w-5 h-5" />
                                Generar tema
                            </button>
                        </div>
                    ) : (
                        <>
                            {content.sections.map((section) => (
                                <article
                                    id={section.id}
                                    key={section.id}
                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 scroll-mt-24"
                                >
                                    <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-5 flex items-center gap-3 text-slate-900">
                                        {section.title}
                                        {section.sourceMetadata && section.sourceMetadata.articles.length > 0 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-blue-100 bg-blue-50 text-blue-700">
                                                <FileText className="h-3 w-3" />
                                                {section.sourceMetadata.articles.length} refs
                                            </span>
                                        )}
                                    </h2>

                                    <ContentWithSources text={section.content.text} sourceMetadata={section.sourceMetadata} />

                                    {section.content.widgets && section.content.widgets.length > 0 && (
                                        <div className="mt-6">
                                            <WidgetFactory
                                                widgets={section.content.widgets}
                                                topicId={content.topicId}
                                                widgetIdPrefix={section.id}
                                                recordId={recordId}
                                            />
                                        </div>
                                    )}
                                </article>
                            ))}
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
            {/* Header limpio estilo NotebookLM */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href={`/syllabus/group/${topic.groupIndex}`}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            </Link>
                            <div>
                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">
                                    {topic.groupTitle}
                                </p>
                                <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                                    {topic.title}
                                </h1>
                                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                                    {content?.metadata && (
                                        <>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-4 w-4" />
                                                {content.metadata.estimatedStudyTime} min
                                            </span>
                                            <span className={cn(
                                                "px-2 py-0.5 rounded text-xs font-medium",
                                                content.metadata.complexity === 'High' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                content.metadata.complexity === 'Medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            )}>
                                                {content.metadata.complexity}
                                            </span>
                                        </>
                                    )}
                                </div>
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

                        <div className="flex items-center gap-3">
                            {/* Status Badge */}
                            <div className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
                                status.color
                            )}>
                                <status.icon className={cn("w-4 h-4", status.animate && "animate-spin")} />
                                {status.text}
                            </div>

                            {/* Generate Button */}
                            <button
                                onClick={() => handleGenerate(false)}
                                disabled={isGenerating}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                                    isGenerating
                                        ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-wait"
                                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                )}
                            >
                                {isGenerating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4" />
                                )}
                                {content ? 'Regenerar' : 'Generar Tema'}
                            </button>

                            {/* Toggle Orchestrator */}
                            <button
                                onClick={() => setShowOrchestrator(!showOrchestrator)}
                                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                {showOrchestrator ? 'Ocultar' : 'Ver'} proceso IA
                            </button>
                        </div>
                    </div>
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

                {/* Aviso/Error Banner */}
                <AnimatePresence>
                    {error && !isGenerating && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-4"
                        >
                            <div
                                className={cn(
                                    "rounded-xl p-4 border",
                                    (error.severity ?? "error") === "warning"
                                        ? "bg-amber-500/10 border-amber-500/30"
                                        : "bg-red-500/10 border-red-500/30"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <AlertTriangle
                                        className={cn(
                                            "w-5 h-5 flex-shrink-0 mt-0.5",
                                            (error.severity ?? "error") === "warning" ? "text-amber-400" : "text-red-400"
                                        )}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h4 className={cn("text-sm font-bold mb-1", (error.severity ?? "error") === "warning" ? "text-amber-400" : "text-red-400")}>
                                            {(error.severity ?? "error") === "warning" ? "Aviso de calidad" : "Error en la generación"}
                                        </h4>
                                        <p className={cn("text-xs mb-2", (error.severity ?? "error") === "warning" ? "text-amber-300/80" : "text-red-300/80")}>
                                            {error.message}
                                        </p>
                                        <div className={cn("flex items-center gap-4 text-[10px]", (error.severity ?? "error") === "warning" ? "text-amber-300/60" : "text-red-300/60")}>
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
                                                className={cn(
                                                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors",
                                                    (error.severity ?? "error") === "warning"
                                                        ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300"
                                                        : "bg-red-500/20 hover:bg-red-500/30 text-red-300"
                                                )}
                                            >
                                                <RefreshCw className="w-3 h-3" />
                                                Reintentar
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setError(null)}
                                            className={cn(
                                                "p-1.5 rounded-lg transition-colors",
                                                (error.severity ?? "error") === "warning" ? "hover:bg-amber-500/20" : "hover:bg-red-500/20"
                                            )}
                                        >
                                            <XCircle
                                                className={cn(
                                                    "w-4 h-4",
                                                    (error.severity ?? "error") === "warning" ? "text-amber-400" : "text-red-400"
                                                )}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            {/* Layout 2 columnas: Contenido + Sidebar */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
                    {/* Columna principal: Contenido */}
                    <main className="space-y-8">
                        {!content ? (
                            // Empty State
                            <div className="h-full flex flex-col items-center justify-center text-center py-16">
                                <div className="w-20 h-20 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
                                    <Sparkles className="w-10 h-10 text-gray-400 dark:text-gray-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                                    Contenido pendiente de generación
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
                                    Haz clic en &quot;Generar Tema&quot; para que los agentes de IA analicen
                                    este tema y creen contenido optimizado para tu estudio.
                                </p>
                                <button
                                    onClick={() => handleGenerate(false)}
                                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm"
                                >
                                    <Sparkles className="w-5 h-5" />
                                    Generar Tema
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Índice sticky */}
                                <nav className="sticky top-24 bg-white dark:bg-gray-900 rounded-xl border p-6 shadow-sm">
                                    <h3 className="text-sm font-semibold mb-4 text-gray-900 dark:text-white">En esta página</h3>
                                    <ol className="space-y-2 text-sm">
                                        {content.sections.map(s => (
                                            <li key={s.id}>
                                                <a
                                                    href={`#${s.id}`}
                                                    className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                >
                                                    {s.title}
                                                </a>
                                            </li>
                                        ))}
                                    </ol>
                                </nav>

                                {/* Secciones con referencias */}
                                {content.sections.map((section) => (
                                    <article
                                        id={section.id}
                                        key={section.id}
                                        className="bg-white dark:bg-gray-900 rounded-2xl border shadow-sm p-8 scroll-mt-24"
                                    >
                                        <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-gray-900 dark:text-white">
                                            {section.title}
                                            {section.sourceMetadata && section.sourceMetadata.articles.length > 0 && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-normal rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                                    <FileText className="h-3 w-3" />
                                                    {section.sourceMetadata.articles.length} refs
                                                </span>
                                            )}
                                        </h2>

                                        <ContentWithSources
                                            text={section.content.text}
                                            sourceMetadata={section.sourceMetadata}
                                        />

                                        {/* Widgets */}
                                        {section.content.widgets && section.content.widgets.length > 0 && (
                                            <div className="mt-6">
                                                <WidgetFactory
                                                    widgets={section.content.widgets}
                                                    topicId={content.topicId}
                                                    widgetIdPrefix={section.id}
                                                    recordId={recordId}
                                                />
                                            </div>
                                        )}
                                    </article>
                                ))}
                            </>
                        )}
                    </main>

                    {/* Sidebar: Fuentes y métricas */}
                    {content && (
                        <aside className="space-y-6">
                            {/* Documentos fuente */}
                            <div className="sticky top-24 bg-white dark:bg-gray-900 rounded-xl border p-6 shadow-sm">
                                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                                    <FileText className="h-4 w-4" />
                                    Fuentes
                                </h3>
                                <ul className="space-y-3 text-sm">
                                    {content.metadata.sourceDocuments?.map(doc => (
                                        <li key={doc} className="flex items-start gap-2">
                                            <div className="mt-0.5 h-5 w-5 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                                                <FileText className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white text-xs">{doc}</div>
                                                <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1">
                                                    Ver documento completo →
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Practice Metrics */}
                            {content.metadata.practiceMetrics && (
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl border border-green-200 dark:border-green-800 p-6">
                                    <h3 className="text-sm font-semibold mb-4 text-gray-900 dark:text-white">Métricas Prácticas</h3>
                                    <div className="space-y-3 text-sm">
                                        {content.metadata.practiceMetrics.practiceReadiness !== undefined && (
                                            <div>
                                                <div className="text-gray-600 dark:text-gray-400 text-xs">Readiness</div>
                                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                                    {(content.metadata.practiceMetrics.practiceReadiness * 100).toFixed(0)}%
                                                </div>
                                            </div>
                                        )}
                                        {content.metadata.practiceMetrics.formulasIncluded !== undefined && (
                                            <div>
                                                <div className="text-gray-600 dark:text-gray-400 text-xs">Fórmulas</div>
                                                <div className="font-semibold text-gray-900 dark:text-white">
                                                    {content.metadata.practiceMetrics.formulasIncluded}
                                                </div>
                                            </div>
                                        )}
                                        {content.metadata.practiceMetrics.appearsInSupuestos && content.metadata.practiceMetrics.appearsInSupuestos.length > 0 && (
                                            <div>
                                                <div className="text-gray-600 dark:text-gray-400 text-xs">Aparece en</div>
                                                <div className="font-semibold text-gray-900 dark:text-white">
                                                    {content.metadata.practiceMetrics.appearsInSupuestos.length} supuestos
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Audio UI moved to /study sidebar */}
                        </aside>
                    )}
                </div>
            </div>
            
            {/* Audio UI moved to /study sidebar */}
        </div>
    );
}

// ============================================
// RENDERIZADOR DE SECCIÓN
// ============================================

interface SectionRendererProps {
    section: TopicSection;
    topicId: string;
    recordId?: string;
    isActive: boolean;
    onActivate: () => void;
}

function SectionRenderer({ section, topicId, recordId, isActive, onActivate }: SectionRendererProps) {
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
                                    <WidgetFactory 
                                        widgets={section.content.widgets} 
                                        topicId={topicId}
                                        widgetIdPrefix={section.id}
                                        recordId={recordId}
                                    />
                                </div>
                            )}

                            {/* Children Sections */}
                            {section.children && section.children.length > 0 && (
                                <div className="mt-6 space-y-4 pl-4 border-l border-white/10">
                                    {section.children.map(child => (
                                        <SectionRenderer
                                            key={child.id}
                                            section={child}
                                            topicId={topicId}
                                            recordId={recordId}
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
