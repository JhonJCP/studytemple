"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, FileText, Zap, Brain, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock content for demo
const MOCK_TEXT = `
Artículo 4. Competencias de la Comunidad Autónoma de Canarias.
1. Corresponde a la Comunidad Autónoma de Canarias la planificación, proyecto, construcción, conservación, explotación y financiación de las carreteras de titularidad de la Comunidad Autónoma.
...
`;

interface StudyCellProps {
    topicId: string;
    topicTitle: string;
}

export function StudyCell({ topicId, topicTitle }: StudyCellProps) {
    const [activeTab, setActiveTab] = useState<"original" | "simplified" | "map" | "quiz">("original");

    return (
        <div className="h-full flex flex-col">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                    {topicTitle}
                </h2>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
                        <Play className="w-4 h-4 text-primary" />
                        Escuchar Resumen
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors">
                        <MessageSquare className="w-4 h-4 text-green-400" />
                        Chat con Oráculo
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-white/10 mb-6 pb-1">
                <TabButton id="original" label="Fuente Original" icon={FileText} active={activeTab} onClick={setActiveTab} />
                <TabButton id="simplified" label="Explicación Humana" icon={Brain} active={activeTab} onClick={setActiveTab} />
                <TabButton id="map" label="Mapa Conceptual" icon={Zap} active={activeTab} onClick={setActiveTab} />
                <TabButton id="quiz" label="Simulador Test" icon={Zap} active={activeTab} onClick={setActiveTab} />
            </div>

            {/* Content Area */}
            <div className="flex-1 glass-card p-8 min-h-[500px] overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                    {activeTab === "original" && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="orig">
                            <pre className="whitespace-pre-wrap font-mono text-sm text-white/70 leading-relaxed">
                                {MOCK_TEXT}
                            </pre>
                        </motion.div>
                    )}
                    {activeTab === "simplified" && (
                        <SimplifiedContent />
                    )}
                    {/* Other tabs placeholders... */}
                </AnimatePresence>
            </div>
        </div>
    );
}

import { simplifyTextAction } from "@/app/actions";
// import ReactMarkdown from "react-markdown"; // Commented out to avoid build errors if pkg missing, using Pre for now

function SimplifiedContent() {
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        const result = await simplifyTextAction(MOCK_TEXT);
        setContent(result);
        setLoading(false);
    };

    if (!content && !loading) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full text-center py-20">
                <Brain className="w-16 h-16 text-primary mb-4 animate-pulse" />
                <h3 className="text-xl font-bold text-white mb-2">Ingeniería Inversa del Conocimiento</h3>
                <p className="text-white/60 mb-6 max-w-md">
                    Gemini 3 Pro analizará el texto legal y lo reescribirá con metáforas de ingeniería y puntos clave.
                </p>
                <button
                    onClick={handleGenerate}
                    className="px-8 py-3 bg-primary text-black font-bold rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                >
                    Generar Explicación
                </button>
            </motion.div>
        )
    }

    if (loading) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full py-20">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-primary animate-pulse">Consultando al Oráculo...</p>
            </motion.div>
        )
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose prose-invert max-w-none">
            <div className="whitespace-pre-wrap">{content}</div>
        </motion.div>
    )
}

function TabButton({ id, label, icon: Icon, active, onClick }: any) {
    const isActive = active === id;
    return (
        <button
            onClick={() => onClick(id)}
            className={cn(
                "flex items-center gap-2 px-4 py-2 mt-2 rounded-t-lg transition-all relative top-1",
                isActive ? "bg-secondary text-primary border border-white/10 border-b-black" : "text-white/40 hover:text-white/70"
            )}
        >
            <Icon className="w-4 h-4" />
            {label}
            {isActive && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />}
        </button>
    )
}
