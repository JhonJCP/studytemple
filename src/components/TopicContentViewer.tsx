"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Sparkles,
    Clock,
    FileText,
    Loader2,
    CheckCircle,
    AlertCircle,
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
    GenerationStatus
} from "@/lib/widget-types";
import { TopicWithGroup, generateBaseHierarchy, flattenSections } from "@/lib/syllabus-hierarchy";

// ============================================
// TIPOS
// ============================================

interface TopicContentViewerProps {
    topic: TopicWithGroup;
    initialContent?: GeneratedTopicContent;
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function TopicContentViewer({ topic, initialContent }: TopicContentViewerProps) {
    const [content, setContent] = useState<GeneratedTopicContent | null>(initialContent || null);
    const [orchestrationState, setOrchestrationState] = useState<OrchestrationState>({
        topicId: topic.id,
        status: 'idle',
        steps: [],
        currentStep: null,
    });
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [showOrchestrator, setShowOrchestrator] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Secciones a mostrar (generadas o base)
    const sections = content?.sections || generateBaseHierarchy(topic);
    const flatSections = flattenSections(sections);

    // Generar contenido
    const handleGenerate = useCallback(async () => {
        setIsGenerating(true);
        setShowOrchestrator(true);

        // Simular estados de orquestación para UI
        setOrchestrationState(prev => ({ ...prev, status: 'fetching' }));

        try {
            const result = await generateTopicContentAction(topic.id);

            if (result.success && result.data) {
                setContent(result.data);
                setOrchestrationState(prev => ({
                    ...prev,
                    status: 'completed',
                    result: result.data
                }));
            } else {
                setOrchestrationState(prev => ({ ...prev, status: 'error' }));
            }
        } catch (error) {
            setOrchestrationState(prev => ({ ...prev, status: 'error' }));
        } finally {
            setIsGenerating(false);
        }
    }, [topic.id]);

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
                            {content.sections.map((section, index) => (
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
                                    <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
                                        {section.content.text}
                                    </p>
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
