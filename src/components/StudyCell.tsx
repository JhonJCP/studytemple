"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, FileText, Zap, Brain, MessageSquare, ChevronDown, BookOpen, Layers, Image as ImageIcon, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { simplifyTextAction } from "@/app/actions";

// Mock Data structure simulating parsed PDF sections
const MOCK_SECTIONS = [
    {
        id: "sec-1",
        title: "Artículo 1. Objeto de la Ley",
        content: "La presente Ley tiene por objeto regular las carreteras cuyo itinerario discurra íntegramente por el territorio de la Comunidad Autónoma de Canarias...",
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

    const toggleSection = (id: string) => {
        setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const expandAll = () => {
        const all = MOCK_SECTIONS.reduce((acc, sec) => ({ ...acc, [sec.id]: true }), {});
        setExpandedSections(all);
    };

    const collapseAll = () => setExpandedSections({});

    return (
        <div className="h-full flex flex-col max-w-5xl mx-auto">
            {/* Header Sticky */}
            <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md pb-6 pt-2 border-b border-white/10 mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-3xl font-black text-white">{topicTitle}</h2>
                        <p className="text-sm text-white/50 flex items-center gap-2 mt-1">
                            <Layers className="w-4 h-4" /> 3 Secciones • 15 min lectura
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode(viewMode === "study" ? "quiz" : "study")}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all",
                                viewMode === "quiz" ? "bg-amber-500 text-black" : "bg-white/10 text-white hover:bg-white/20"
                            )}
                        >
                            <GraduationCap className="w-5 h-5" />
                            {viewMode === "study" ? "Ir al Test" : "Volver al Estudio"}
                        </button>
                        <button className="p-3 bg-primary text-black rounded-full hover:scale-105 transition-transform shadow-[0_0_15px_rgba(var(--primary),0.4)]">
                            <Play className="w-5 h-5 fill-current" />
                        </button>
                    </div>
                </div>

                {viewMode === "study" && (
                    <div className="flex gap-4 text-sm text-white/40">
                        <button onClick={expandAll} className="hover:text-white transition-colors">Expandir Todo</button>
                        |
                        <button onClick={collapseAll} className="hover:text-white transition-colors">Colapsar Todo</button>
                    </div>
                )}
            </div>

            {/* Main Content Scroll */}
            <div className="flex-1 overflow-y-auto pb-40 custom-scrollbar">
                {viewMode === "study" ? (
                    <div className="space-y-6">
                        {MOCK_SECTIONS.map((section) => (
                            <SectionCard
                                key={section.id}
                                section={section}
                                isExpanded={!!expandedSections[section.id]}
                                onToggle={() => toggleSection(section.id)}
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

function SectionCard({ section, isExpanded, onToggle }: any) {
    return (
        <div className="glass-card border border-white/5 overflow-hidden transition-all duration-300">
            {/* Section Header */}
            <div
                onClick={onToggle}
                className={cn(
                    "p-6 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors",
                    isExpanded && "bg-white/5 border-b border-white/5"
                )}
            >
                <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-lg transition-colors", isExpanded ? "bg-primary/20 text-primary" : "bg-white/5 text-white/50")}>
                        {section.hasBaseMaterial ? <FileText className="w-5 h-5" /> : <Brain className="w-5 h-5" />}
                    </div>
                    <h3 className={cn("text-lg font-bold transition-colors", isExpanded ? "text-white" : "text-white/70")}>
                        {section.title}
                    </h3>
                </div>
                <ChevronDown className={cn("w-5 h-5 text-white/40 transition-transform duration-300", isExpanded && "rotate-180")} />
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
                        <div className="p-6 pt-0 space-y-8">

                            {/* 1. Original Text (Expandable Extract) */}
                            {section.content && (
                                <div className="mt-6 pl-4 border-l-2 border-white/10">
                                    <h4 className="text-xs uppercase tracking-wider text-white/30 mb-2 flex items-center gap-2">
                                        <BookOpen className="w-3 h-3" /> Texto Original
                                    </h4>
                                    <p className="font-mono text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                                        {section.content}
                                    </p>
                                </div>
                            )}

                            {/* 2. AI Explanation (Automatic or On Demand) */}
                            <ExplanationBlock text={section.content} title={section.title} />

                            {/* 3. Visuals / Mnemonics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-black/20 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                                    <h4 className="text-xs uppercase tracking-wider text-purple-400 mb-2 flex items-center gap-2">
                                        <ImageIcon className="w-3 h-3" /> Diagrama Mental
                                    </h4>
                                    <div className="h-32 flex items-center justify-center text-white/20 text-xs italic">
                                        (Aquí iría un diagrama Mermaid generado: "CA -> Planifica -> Carreteras")
                                    </div>
                                </div>
                                <div className="bg-black/20 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                                    <h4 className="text-xs uppercase tracking-wider text-green-400 mb-2 flex items-center gap-2">
                                        <Zap className="w-3 h-3" /> Regla Mnemotécnica
                                    </h4>
                                    <p className="text-sm text-white/70 italic">
                                        "PPC CEF" -> Planifica, Proyecta, Construye | Conserva, Explota, Financia.
                                    </p>
                                </div>
                            </div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ExplanationBlock({ text, title }: any) {
    const [explanation, setExplanation] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const generate = async () => {
        setLoading(true);
        // If no text, we ask AI to generate based on Title only (Knowledge)
        const prompt = text || `Explica el concepto jurídico: ${title}`;
        const res = await simplifyTextAction(prompt);
        setExplanation(res);
        setLoading(false);
    };

    if (!explanation && !loading) {
        return (
            <div className="bg-secondary/10 rounded-xl p-6 border border-secondary/20 dashed">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-lg font-bold text-primary mb-1 flex items-center gap-2">
                            <Brain className="w-5 h-5" /> La Explicación del Ingeniero
                        </h4>
                        <p className="text-sm text-white/50">
                            {text ? "Traducir este artículo a lenguaje humano." : "Generar explicación basada en conocimiento general (Sin texto base)."}
                        </p>
                    </div>
                    <button
                        onClick={generate}
                        className="px-4 py-2 bg-secondary text-primary font-bold rounded-lg text-sm hover:bg-secondary/80 transition-colors"
                    >
                        Generar
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-secondary/5 rounded-xl p-6 border border-secondary/20 relative">
            <h4 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5" /> La Explicación del Ingeniero
            </h4>
            {loading ? (
                <div className="space-y-2 animate-pulse">
                    <div className="h-4 bg-primary/20 rounded w-3/4"></div>
                    <div className="h-4 bg-primary/10 rounded w-full"></div>
                    <div className="h-4 bg-primary/10 rounded w-5/6"></div>
                </div>
            ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                    <div className="whitespace-pre-wrap">{explanation}</div>
                </div>
            )}
        </div>
    )
}

function QuizMode() {
    return (
        <div className="p-12 text-center glass-card">
            <GraduationCap className="w-16 h-16 text-amber-500 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-white mb-2">Zona de Evaluación</h3>
            <p className="text-white/50 mb-8">Preguntas tipo test generadas para estos artículos.</p>
            <button className="px-8 py-3 bg-amber-500 text-black font-bold rounded-full hover:scale-105 transition-transform">
                Comenzar Test (5 Preguntas)
            </button>
        </div>
    )
}
