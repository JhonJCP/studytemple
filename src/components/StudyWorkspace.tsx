"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Columns2, Headphones, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GeneratedTopicContent } from "@/lib/widget-types";
import { generateBaseHierarchy, type TopicWithGroup } from "@/lib/syllabus-hierarchy";
import { TopicContentViewer } from "@/components/TopicContentViewer";
import { AIFlowPanel } from "@/components/AIFlowPanel";
import { StudyPodcastPanel } from "@/components/StudyPodcastPanel";
import { TopicMetaPanel } from "@/components/TopicMetaPanel";

interface Props {
    date: string;
    topic: TopicWithGroup;
    initialContent?: GeneratedTopicContent;
    initialAudioUrl?: string;
    initialAudioScript?: string;
    initialAudioDuration?: number | null;
}

export function StudyWorkspace({
    date,
    topic,
    initialContent,
    initialAudioUrl,
    initialAudioScript,
    initialAudioDuration,
}: Props) {
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightOpen, setRightOpen] = useState(true);
    const [content, setContent] = useState<GeneratedTopicContent | null>(initialContent || null);

    const sections = content?.sections || generateBaseHierarchy(topic);

    const gridCols = useMemo(() => {
        if (leftOpen && rightOpen) return "xl:grid-cols-[280px_minmax(0,1fr)_360px]";
        if (leftOpen && !rightOpen) return "xl:grid-cols-[280px_minmax(0,1fr)]";
        if (!leftOpen && rightOpen) return "xl:grid-cols-[minmax(0,1fr)_360px]";
        return "xl:grid-cols-[minmax(0,1fr)]";
    }, [leftOpen, rightOpen]);

    return (
        <div className="min-h-screen bg-background">
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 backdrop-blur-xl z-20">
                <div className="flex items-center gap-4 min-w-0">
                    <Link href="/calendar" className="p-2 rounded-lg hover:bg-white/10 text-white/70">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-primary uppercase tracking-widest">Sesión {date}</p>
                        <h1 className="text-2xl font-black text-white leading-tight truncate">{topic.title}</h1>
                        <p className="text-white/40 text-sm truncate">{topic.groupTitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setLeftOpen(v => !v)}
                        className={cn(
                            "p-2 rounded-lg border border-white/10 hover:bg-white/10 transition",
                            leftOpen ? "text-white/80" : "text-white/50"
                        )}
                        aria-label={leftOpen ? "Ocultar índice" : "Mostrar índice"}
                        title={leftOpen ? "Ocultar índice" : "Mostrar índice"}
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setRightOpen(v => !v)}
                        className={cn(
                            "p-2 rounded-lg border border-white/10 hover:bg-white/10 transition",
                            rightOpen ? "text-white/80" : "text-white/50"
                        )}
                        aria-label={rightOpen ? "Ocultar panel" : "Mostrar panel"}
                        title={rightOpen ? "Ocultar panel" : "Mostrar panel"}
                    >
                        <Columns2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl">
                        <Headphones className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-white/70">
                            {initialAudioUrl ? "Podcast disponible" : "Podcast pendiente"}
                        </span>
                    </div>
                </div>
            </header>

            <main className={cn("grid gap-6 p-6", gridCols)}>
                {leftOpen && (
                    <aside className="space-y-3">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 sticky top-24">
                            <h3 className="text-sm font-bold text-white/60 uppercase mb-3">En esta página</h3>
                            <ol className="space-y-2 text-sm">
                                {sections.map(s => (
                                    <li key={s.id}>
                                        <a
                                            href={`#${s.id}`}
                                            className="text-white/70 hover:text-white transition-colors"
                                        >
                                            {s.title}
                                        </a>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </aside>
                )}

                <section className="min-w-0 rounded-2xl border border-white/10 bg-black/30 overflow-hidden">
                    <TopicContentViewer
                        topic={topic}
                        initialContent={initialContent}
                        variant="embedded"
                        onContentChange={setContent}
                    />
                </section>

                {rightOpen && (
                    <aside className="space-y-4">
                        <AIFlowPanel topicTitle={topic.title} topicId={topic.id} date={date} groupTitle={topic.groupTitle} />
                        <StudyPodcastPanel
                            topicId={topic.id}
                            initialAudioUrl={initialAudioUrl}
                            initialScript={initialAudioScript}
                            initialDuration={initialAudioDuration}
                        />
                        {content && <TopicMetaPanel content={content} />}

                        <details className="glass-card p-4">
                            <summary className="cursor-pointer text-sm font-bold text-white/70 uppercase">
                                Acciones rápidas
                            </summary>
                            <div className="mt-3 space-y-2 text-sm text-white/70">
                                <p>- Generar / Regenerar contenido desde el panel principal.</p>
                                <p>- Ver proceso IA con el toggle dentro del visor.</p>
                                <p>- Próximo: guardar progreso y marcar secciones completadas.</p>
                            </div>
                        </details>
                    </aside>
                )}
            </main>
        </div>
    );
}

