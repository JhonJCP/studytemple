"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, FileText, Zap, Brain, MessageSquare, ChevronDown, BookOpen, Layers, Image as ImageIcon, GraduationCap, Loader2, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { MnemonicWidget, TimelineWidget, AnalogyWidget, DiagramWidget, VideoWidget } from "@/components/widgets";
import { analyzeContentAction, generateSmartAudioAction } from "@/app/actions";

// Mock Data structure simulating parsed PDF sections
const MOCK_SECTIONS = [
    {
        id: "sec-1",
        title: "Artículo 1. Objeto de la Ley",
        content: "La presente Ley tiene por objeto regular las carreteras cuyo itinerario discurra íntegramente por el territorio de la Comunidad Autónoma de Canarias. Se consideran carreteras las vías de dominio público y uso público proyectadas y construidas fundamentalmente para la circulación de vehículos automóviles.",
        hasBaseMaterial: true
    },
    {
        id: "sec-4",
        title: "Artículo 4. Competencias de la Comunidad Autónoma",
        content: `1. Corresponde a la Comunidad Autónoma de Canarias la planificación, proyecto, construcción, conservación, explotación y financiación de las carreteras de titularidad de la Comunidad Autónoma.\n2. Asimismo le corresponde...`,
        hasBaseMaterial: true
    },
    {
        id: "sec-concept",
        title: "Concepto Clave: Zona de Servidumbre",
        content: null, // No base text, AI must generate
        hasBaseMaterial: false
    }
];

interface StudyCellProps {
    topicId: string;
    topicTitle: string;
}

export function StudyCell({ topicId, topicTitle }: StudyCellProps) {
    const [viewMode, setViewMode] = useState<"study" | "quiz">("study");
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ "sec-4": true });

    // Audio State
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isAudioLoading, setIsAudioLoading] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const toggleSection = (id: string) => {
        setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const expandAll = () => {
        const all = MOCK_SECTIONS.reduce((acc, sec) => ({ ...acc, [sec.id]: true }), {});
        setExpandedSections(all);
    };

    const collapseAll = () => setExpandedSections({});

    const handlePlayAudio = async () => {
        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
            return;
        }

        if (audioUrl) {
            audioRef.current?.play();
            setIsPlaying(true);
            return;
        }

        // Generate Audio
        setIsAudioLoading(true);
        // Concatenate text for context
        const fullText = MOCK_SECTIONS.filter(s => s.content).map(s => s.title + ". " + s.content).join(". ");

        try {
            // Using Smart Audio Action (Summary -> TTS)
            const { audioUrl: url, summary } = await generateSmartAudioAction(fullText.substring(0, 2000), topicId);

            if (url) {
                setAudioUrl(url);
                // Create audio element
                if (!audioRef.current) {
                    audioRef.current = new Audio(url);
                    audioRef.current.onended = () => setIsPlaying(false);
                } else {
                    audioRef.current.src = url;
                }
                audioRef.current.play();
                setIsPlaying(true);

                // Optional: Show summary toast or visual indication?
                console.log("Audio Summary:", summary);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsAudioLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col max-w-5xl mx-auto">
            {/* Header Sticky */}
            <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl pb-6 pt-2 border-b border-white/5 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <motion.h2
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-4xl font-black text-white tracking-tight"
                        >
                            {topicTitle}
                        </motion.h2>
                        <p className="text-sm text-white/50 flex items-center gap-2 mt-2 font-medium">
                            <Layers className="w-4 h-4 text-primary" /> 3 Secciones • 15 min lectura
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setViewMode(viewMode === "study" ? "quiz" : "study")}
                            className={cn(
                                "flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all border",
                                viewMode === "quiz"
                                    ? "bg-amber-500/20 text-amber-500 border-amber-500/50"
                                    : "bg-white/5 text-white border-white/10 hover:bg-white/10"
                            )}
                        >
                            <GraduationCap className="w-5 h-5" />
                            {viewMode === "study" ? "Modo Examen" : "Volver al Temario"}
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handlePlayAudio}
                            disabled={isAudioLoading}
                            className={cn(
                                "p-4 rounded-full transition-all shadow-lg flex items-center justify-center border",
                                isPlaying
                                    ? "bg-red-500/20 border-red-500/50 text-red-500"
                                    : "bg-primary text-black border-primary"
                            )}
                        >
                            {isAudioLoading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : isPlaying ? (
                                <Pause className="w-6 h-6 fill-current" />
                            ) : (
                                <Play className="w-6 h-6 fill-current" />
                            )}
                        </motion.button>
                    </div>
                </div>

                {viewMode === "study" && (
                    <div className="flex gap-4 text-xs font-bold text-white/30 uppercase tracking-widest">
                        <button onClick={expandAll} className="hover:text-white transition-colors">Expandir Todo</button>
                        <span className="text-white/10">|</span>
                        <button onClick={collapseAll} className="hover:text-white transition-colors">Colapsar Todo</button>
                    </div>
                )}
            </div>

            {/* Main Content Scroll */}
            <div className="flex-1 overflow-y-auto pb-40 custom-scrollbar px-1">
                {viewMode === "study" ? (
                    <div className="space-y-6">
                        {MOCK_SECTIONS.map((section, idx) => (
                            <SectionCard
                                key={section.id}
                                section={section}
                                isExpanded={!!expandedSections[section.id]}
                                onToggle={() => toggleSection(section.id)}
                                index={idx}
                            />
                        ))}
                    </div>
                ) : (
                    <QuizMode />
                )}
            </div>
        </div>
    );
}

function SectionCard({ section, isExpanded, onToggle, index }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
                "glass-card overflow-hidden transition-all duration-500 group",
                isExpanded ? "ring-1 ring-primary/30 bg-secondary/40" : "hover:bg-white/5"
            )}
        >
            {/* Section Header */}
            <div
                onClick={onToggle}
                className={cn(
                    "p-6 flex items-center justify-between cursor-pointer transition-all duration-300",
                    isExpanded ? "bg-white/5 border-b border-white/5" : ""
                )}
            >
                <div className="flex items-center gap-5">
                    <div className={cn(
                        "p-3 rounded-xl transition-colors shadow-inner",
                        isExpanded ? "bg-primary text-black" : "bg-black/40 text-white/40 group-hover:text-white group-hover:bg-white/10"
                    )}>
                        {section.hasBaseMaterial ? <FileText className="w-5 h-5" /> : <Brain className="w-5 h-5" />}
                    </div>
                    <div>
                        <h3 className={cn("text-lg font-bold transition-colors leading-tight", isExpanded ? "text-white" : "text-white/70 group-hover:text-white")}>
                            {section.title}
                        </h3>
                        {isExpanded && section.hasBaseMaterial && (
                            <span className="text-xs text-primary font-bold uppercase tracking-wider mt-1 block animate-pulse">
                                Análisis Activo
                            </span>
                        )}
                    </div>
                </div>
                <ChevronDown className={cn("w-5 h-5 text-white/20 transition-transform duration-500", isExpanded && "rotate-180 text-primary")} />
            </div>

            {/* Expandable Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-8 space-y-10">

                            {/* 1. Original Text (Expandable Extract) */}
                            {section.content && (
                                <div className="relative pl-6 border-l-2 border-primary/20 hover:border-primary/50 transition-colors">
                                    <h4 className="text-xs uppercase font-black tracking-widest text-white/20 mb-3 flex items-center gap-2">
                                        <BookOpen className="w-3 h-3" /> Fuente Oficial (BOE)
                                    </h4>
                                    <p className="font-serif text-lg text-white/80 leading-relaxed selection:bg-primary/30">
                                        {section.content}
                                    </p>
                                </div>
                            )}

                            {/* 2. AI Explanation (Automatic or On Demand) */}
                            <ExplanationBlock text={section.content} title={section.title} />

                            {/* 3. Visuals / Mnemonics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <motion.div whileHover={{ scale: 1.02 }} className="bg-gradient-to-br from-purple-500/10 to-transparent rounded-2xl p-5 border border-purple-500/20 backdrop-blur-sm">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-3 flex items-center gap-2">
                                        <ImageIcon className="w-3 h-3" /> Diagrama Mental
                                    </h4>
                                    <div className="h-32 flex items-center justify-center text-white/30 text-xs font-mono border border-dashed border-white/10 rounded-lg">
                                        (Diagrama Mermaid pendiente de generación)
                                    </div>
                                </motion.div>
                                <motion.div whileHover={{ scale: 1.02 }} className="bg-gradient-to-br from-green-500/10 to-transparent rounded-2xl p-5 border border-green-500/20 backdrop-blur-sm">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-green-400 mb-3 flex items-center gap-2">
                                        <Zap className="w-3 h-3" /> Regla Mnemotécnica
                                    </h4>
                                    <p className="text-base text-white/80 italic font-medium">
                                        &quot;PPC CEF&quot; &rarr; <span className="text-green-300">P</span>lanifica, <span className="text-green-300">P</span>royecta, <span className="text-green-300">C</span>onstruye | <span className="text-green-300">C</span>onserva, <span className="text-green-300">E</span>xplota, <span className="text-green-300">F</span>inancia.
                                    </p>
                                </motion.div>
                            </div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function ExplanationBlock({ text, title }: any) {
    const [data, setData] = useState<{ explanation: string, widgets: any[] } | null>(null);
    const [loading, setLoading] = useState(false);

    const generate = async () => {
        setLoading(true);
        const prompt = text || `Explica el concepto jurídico: ${title}`;
        const res = await analyzeContentAction(prompt);
        setData(res);
        setLoading(false);
    };

    if (!data && !loading) {
        return (
            <div className="bg-gradient-to-r from-secondary/40 to-transparent rounded-2xl p-8 border border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 transition-opacity group-hover:opacity-100 opacity-50"></div>

                <div className="flex items-center justify-between relative z-10">
                    <div>
                        <h4 className="text-xl font-black text-white mb-2 flex items-center gap-3">
                            <Brain className="w-6 h-6 text-primary" /> Consultar al Consejo
                        </h4>
                        <p className="text-sm text-white/40 max-w-md leading-relaxed">
                            Invoca a los agentes de IA para analizar este fragmento, generar widgets y simplificar el lenguaje jurídico.
                        </p>
                    </div>
                    <button
                        onClick={generate}
                        className="px-6 py-3 bg-white text-black font-black rounded-xl hover:scale-105 hover:bg-white/90 transition-all shadow-xl shadow-white/5"
                    >
                        Analizar Fragmento
                    </button>
                </div>
            </div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
        >
            <div className="bg-black/20 rounded-2xl p-8 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-transparent"></div>
                <h4 className="text-lg font-bold text-primary mb-6 flex items-center gap-3">
                    <Brain className="w-5 h-5" /> La Explicación del Ingeniero
                </h4>
                {loading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-4 bg-white/5 rounded w-3/4"></div>
                        <div className="h-4 bg-white/5 rounded w-full"></div>
                        <div className="h-4 bg-white/5 rounded w-5/6"></div>
                    </div>
                ) : (
                    <div className="prose prose-invert prose-lg max-w-none text-white/80 leading-loose">
                        <div className="whitespace-pre-wrap">{data?.explanation}</div>
                    </div>
                )}
            </div>

            {/* Dynamic Widgets Area */}
            {data?.widgets && data.widgets.length > 0 && (
                <div className="grid grid-cols-1 gap-6">
                    {data.widgets.map((widget: any, i: number) => {
                        const WidgetComponent = {
                            'mnemonic': MnemonicWidget,
                            'timeline': TimelineWidget,
                            'analogy': AnalogyWidget,
                            'diagram': DiagramWidget,
                            'video_loop': VideoWidget
                        }[widget.type as string];

                        return WidgetComponent ? (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 + (i * 0.1) }}
                            >
                                <WidgetComponent content={widget.content} />
                            </motion.div>
                        ) : null;
                    })}
                </div>
            )}
        </motion.div>
    )
}

function QuizMode() {
    return (
        <div className="p-12 text-center glass-card border-dashed border-2 border-white/10 m-4 rounded-3xl">
            <GraduationCap className="w-20 h-20 text-amber-500 mx-auto mb-8 animate-bounce" />
            <h3 className="text-3xl font-black text-white mb-3">Zona de Evaluación</h3>
            <p className="text-white/50 mb-8 max-w-lg mx-auto">
                El sistema generará 5 preguntas tipo test basadas en el contenido estudiado. Las respuestas correctas influirán en tu SRS.
            </p>
            <button className="px-10 py-4 bg-amber-500 text-black font-black rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] transition-all">
                Comenzar Test
            </button>
        </div>
    )
}
