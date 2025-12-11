"use client";

import { useState, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Sparkles,
    Clock,
    FileText,
    Loader2,
    CheckCircle,
    ChevronDown
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { HierarchicalOutline } from "./HierarchicalOutline";
import { OrchestratorFlow } from "./OrchestratorFlow";
import { WidgetFactory } from "./WidgetFactory";
import { generateTopicContentAction } from "@/app/actions/generate-topic-content";
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

const contentStorageKey = (topicId: string) => `topic_content_${topicId}`;
const traceStorageKey = (topicId: string) => `topic_trace_${topicId}`;

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

function hydrateOrchestrationState(topicId: string, raw?: OrchestrationState): OrchestrationState {
    if (!raw) {
        return {
            topicId,
            status: 'idle',
            steps: [],
            currentStep: null,
        };
    }

    return {
        ...raw,
        topicId,
        currentStep: raw.currentStep || null,
        steps: (raw.steps || []).map(step => ({
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
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [showOrchestrator, setShowOrchestrator] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Secciones a mostrar (generadas o base)
    const sections = content?.sections || generateBaseHierarchy(topic);
    const flatSections = flattenSections(sections);

    // Cargar persistencia local (si no hay contenido inicial desde Supabase)
    useEffect(() => {
        if (initialContent) {
            const hydrated = hydrateContent(initialContent);
            setContent(hydrated);
            try {
                localStorage.setItem(contentStorageKey(topic.id), JSON.stringify(hydrated));
            } catch {
                // ignore storage errors
            }
        } else {
            try {
                const stored = localStorage.getItem(contentStorageKey(topic.id));
                if (stored) {
                    const parsed = hydrateContent(JSON.parse(stored));
                    if (parsed) {
                        setContent(parsed);
                    }
                }
            } catch {
                // ignore
            }
        }

        try {
            const storedTrace = localStorage.getItem(traceStorageKey(topic.id));
            if (storedTrace) {
                const parsedTrace = hydrateOrchestrationState(topic.id, JSON.parse(storedTrace));
                setOrchestrationState(parsedTrace);
            }
        } catch {
            // ignore storage parse errors
        }

        return () => {
            eventSource?.close();
        };
    }, [topic.id, initialContent, eventSource]);

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

    // Generar contenido
    const handleGenerate = useCallback(async () => {
        // Cerrar cualquier stream previo
        if (eventSource) {
            eventSource.close();
            setEventSource(null);
        }

        const isForce = Boolean(content);

        // Si es regeneración, limpiar estado local y trazas previas
        if (isForce) {
            try {
                localStorage.removeItem(contentStorageKey(topic.id));
                localStorage.removeItem(traceStorageKey(topic.id));
            } catch {
                // ignore storage cleanup
            }
            setContent(null);
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
                    setOrchestrationState(hydrateOrchestrationState(topic.id, data));
                } catch {
                    // ignore parse errors
                }
            });

            es.addEventListener("done", (evt) => {
                try {
                    const data = JSON.parse((evt as MessageEvent).data);
                    const hydratedContent = hydrateContent(data.result);
                    if (hydratedContent) setContent(hydratedContent);
                    setOrchestrationState(prev => ({
                        ...prev,
                        status: 'completed',
                        currentStep: null,
                        result: hydratedContent || prev.result
                    }));
                } catch {
                    setOrchestrationState(prev => ({ ...prev, status: 'error' }));
                } finally {
                    es.close();
                    setEventSource(null);
                    setIsGenerating(false);
                }
            });

            es.addEventListener("error", (evt) => {
                console.error("SSE error", evt);
                setOrchestrationState(prev => ({ ...prev, status: 'error' }));
                es.close();
                setEventSource(null);
                setIsGenerating(false);
            });

            setEventSource(es);
        } catch (error) {
            console.error("Error during topic generation", error);
            setOrchestrationState(prev => ({ ...prev, status: 'error' }));
        } finally {
            // isGenerating se desactiva en listeners para no cortar el stream
        }
    }, [topic.id, topic.title, content, orchestrationState, eventSource]);

    // Status badge
    const getStatusBadge = () => {
        if (isGenerating) {
            return { icon: Loader2, text: 'Generando...', color: 'text-purple-400 bg-purple-500/20', animate: true };
        }
        if (content) {
            return { icon: CheckCircle, text: 'Generado', color: 'text-green-400 bg-green-500/20', animate: false };
        }
        return { icon: FileText, text: 'Pendiente', color: 'text-white/40 bg-white/5', animate: false };
    };

    const status = getStatusBadge();

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

                        {/* Generate Button */}
                        <motion.button
                            onClick={handleGenerate}
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
                                onClick={handleGenerate}
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
                <footer className="border-t border-white/5 px-6 py-3 bg-black/20 flex items-center justify-between text-xs text-white/40">
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
                </footer>
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
