"use client";

import { useState } from "react";
import { Variable, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

import { DiagramWidget } from "./index";
import { postWidgetGenerate } from "./widget-generate";

interface DiagramGeneratorWidgetProps {
    content: {
        frame: string;
        concept: string;
        structure?: string;
        widgetId: string;
        topicId: string;
        recordId?: string;
    };
}

export function DiagramGeneratorWidget({ content }: DiagramGeneratorWidgetProps) {
    const [structure, setStructure] = useState<string | undefined>(content.structure);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);

        try {
            const data = await postWidgetGenerate({
                widgetType: "diagram",
                widgetData: {
                    frame: content.frame,
                    concept: content.concept,
                    widgetId: content.widgetId,
                },
                topicId: content.topicId,
                recordId: content.recordId,
            });

            const next = data.result?.structure || data.result;
            setStructure(next);
        } catch (err) {
            console.error("Error generating diagram:", err);
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {!structure ? (
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 backdrop-blur-sm">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 mb-4 flex items-center gap-2">
                        <Variable className="w-4 h-4" /> Diagrama (generable)
                    </h4>
                    <p className="text-sm text-slate-600 mb-2">Genera un diagrama Mermaid para:</p>
                    <p className="text-base text-slate-900 font-bold mb-6">{content.concept}</p>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generando...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Generar diagrama
                            </>
                        )}
                    </button>
                    {error && <p className="text-xs text-red-600 mt-4 text-center">Error: {error}</p>}
                </div>
            ) : (
                <div className="space-y-3">
                    <DiagramWidget content={{ structure }} />
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="text-xs text-slate-600 hover:text-slate-700 underline flex items-center gap-1 mx-auto disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Regenerar diagrama
                    </button>
                </div>
            )}
        </motion.div>
    );
}
