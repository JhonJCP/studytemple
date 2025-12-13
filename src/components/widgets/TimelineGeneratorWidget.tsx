"use client";

import { useState } from "react";
import { Clock, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

import { TimelineWidget } from "./index";
import { postWidgetGenerate } from "./widget-generate";

interface TimelineGeneratorWidgetProps {
    content: {
        frame: string;
        concept: string;
        steps?: Array<{ time: string; action: string }>;
        widgetId: string;
        topicId: string;
    };
}

export function TimelineGeneratorWidget({ content }: TimelineGeneratorWidgetProps) {
    const [steps, setSteps] = useState<Array<{ time: string; action: string }> | undefined>(content.steps);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);

        try {
            const data = await postWidgetGenerate({
                widgetType: "timeline",
                widgetData: {
                    frame: content.frame,
                    concept: content.concept,
                    widgetId: content.widgetId,
                },
                topicId: content.topicId,
            });

            const next = data.result?.steps || data.result;
            setSteps(next);
        } catch (err) {
            console.error("Error generating timeline:", err);
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {!steps ? (
                <div className="bg-gradient-to-br from-blue-500/10 to-transparent rounded-2xl p-6 border border-blue-500/20 backdrop-blur-sm">
                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-700 mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Timeline (generable)
                    </h4>
                    <p className="text-sm text-slate-600 mb-2">Genera una secuencia/pasos para:</p>
                    <p className="text-base text-slate-900 font-bold mb-6">{content.concept}</p>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="px-6 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-colors flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generando...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Generar timeline
                            </>
                        )}
                    </button>
                    {error && <p className="text-xs text-red-600 mt-4 text-center">Error: {error}</p>}
                </div>
            ) : (
                <div className="space-y-3">
                    <TimelineWidget content={{ steps }} />
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="text-xs text-blue-700 hover:text-blue-800 underline flex items-center gap-1 mx-auto disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Regenerar timeline
                    </button>
                </div>
            )}
        </motion.div>
    );
}
