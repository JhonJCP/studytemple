"use client";

import { useState } from "react";
import { Zap, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { postWidgetGenerate } from "./widget-generate";

interface MnemonicGeneratorWidgetProps {
    content: {
        frame: string;
        termsToMemorize: string[];
        generatedRule?: string;
        explanation?: string;
        widgetId: string;
        topicId: string;
    };
}

export function MnemonicGeneratorWidget({ content }: MnemonicGeneratorWidgetProps) {
    const [rule, setRule] = useState(content.generatedRule);
    const [explanation, setExplanation] = useState(content.explanation);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);
        
        try {
            const data = await postWidgetGenerate({
                widgetType: "mnemonic",
                widgetData: {
                    frame: content.frame,
                    termsToMemorize: content.termsToMemorize,
                    widgetId: content.widgetId,
                },
                topicId: content.topicId,
            });
            
            setRule(data.result.rule);
            setExplanation(data.result.explanation);
        } catch (err) {
            console.error('Error generating mnemonic:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsGenerating(false);
        }
    };
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-green-500/10 to-transparent rounded-2xl p-6 border border-green-500/20 backdrop-blur-sm relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-4 opacity-50">
                <Zap className="w-12 h-12 text-green-500/20" />
            </div>

            <h4 className="text-xs font-black uppercase tracking-widest text-green-700 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4" /> Mnemotecnia Inteligente
            </h4>
            
            {!rule ? (
                <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Zap className="w-8 h-8 text-green-700" />
                    </div>
                    <p className="text-sm text-slate-600 mb-2">
                        Genera una regla mnemotécnica para:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center mb-6">
                        {content.termsToMemorize.map((term, i) => (
                            <span key={i} className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                {term}
                            </span>
                        ))}
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generando...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Generar Mnemotecnia
                            </>
                        )}
                    </button>
                    {error && (
                        <p className="text-xs text-red-600 mt-4">
                            Error: {error}
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="text-center py-6">
                        <div className="text-5xl font-black text-slate-900 tracking-tighter mb-4 drop-shadow-2xl">
                            {rule}
                        </div>
                        <div className="text-lg text-slate-700 font-medium">
                            {explanation?.split('.').map((part, i) => (
                                part.trim() && (
                                    <span key={i} className="block border-b border-slate-200 py-1 last:border-0">
                                        {part.trim()}
                                    </span>
                                )
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="text-xs text-green-700 hover:text-green-800 underline flex items-center gap-1 mx-auto disabled:opacity-50"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Regenerar
                    </button>
                </div>
            )}
        </motion.div>
    );
}
