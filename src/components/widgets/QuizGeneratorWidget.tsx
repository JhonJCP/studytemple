"use client";

import { useState } from "react";
import { HelpCircle, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

import { QuizWidget } from "./QuizWidget";

interface QuizGeneratorWidgetProps {
    content: {
        frame: string;
        focus: string;
        questions?: Array<{
            question: string;
            options: string[];
            correctIndex: number;
        }>;
        widgetId: string;
        topicId: string;
    };
}

export function QuizGeneratorWidget({ content }: QuizGeneratorWidgetProps) {
    const [questions, setQuestions] = useState(content.questions);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);

        try {
            const res = await fetch("/api/widgets/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    widgetType: "quiz",
                    widgetData: {
                        frame: content.frame,
                        focus: content.focus,
                        widgetId: content.widgetId,
                    },
                    topicId: content.topicId,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error generating quiz");

            const next = data.result?.questions || data.result;
            setQuestions(next);
        } catch (err) {
            console.error("Error generating quiz:", err);
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {!questions ? (
                <div className="bg-gradient-to-br from-purple-500/10 to-transparent rounded-2xl p-6 border border-purple-500/20 backdrop-blur-sm">
                    <h4 className="text-xs font-black uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4" /> Test rápido (generable)
                    </h4>
                    <p className="text-sm text-white/70 mb-2">Genera un mini-test sobre:</p>
                    <p className="text-base text-white font-bold mb-6">{content.focus}</p>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="px-6 py-3 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-600 transition-colors flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generando...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Generar test
                            </>
                        )}
                    </button>
                    {error && <p className="text-xs text-red-400 mt-4 text-center">Error: {error}</p>}
                </div>
            ) : (
                <div className="space-y-3">
                    <QuizWidget content={{ questions }} />
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="text-xs text-purple-300 hover:text-purple-200 underline flex items-center gap-1 mx-auto disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Regenerar test
                    </button>
                </div>
            )}
        </motion.div>
    );
}

