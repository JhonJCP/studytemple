"use client";

import { useState } from "react";
import { FileText, Loader2, Sparkles, RefreshCw, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

interface CasePracticeWidgetProps {
    content: {
        frame: string;
        concept: string;
        scenario?: string;
        solution?: string;
        widgetId: string;
        topicId: string;
    };
}

export function CasePracticeWidget({ content }: CasePracticeWidgetProps) {
    const [scenario, setScenario] = useState(content.scenario);
    const [solution, setSolution] = useState(content.solution);
    const [showSolution, setShowSolution] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);
        setShowSolution(false);
        
        try {
            const res = await fetch('/api/widgets/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    widgetType: 'case_practice',
                    widgetData: {
                        frame: content.frame,
                        concept: content.concept,
                        widgetId: content.widgetId
                    },
                    topicId: content.topicId
                })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Error generating case practice');
            }
            
            setScenario(data.result.scenario);
            setSolution(data.result.solution);
        } catch (err) {
            console.error('Error generating case practice:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsGenerating(false);
        }
    };
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-amber-500/10 to-transparent rounded-2xl p-6 border border-amber-500/20 backdrop-blur-sm"
        >
            <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Caso Práctico Mini
            </h4>
            
            {!scenario ? (
                <div className="text-center py-8">
                    <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-amber-400" />
                    </div>
                    <p className="text-sm text-white/60 mb-2">
                        Genera un caso práctico aplicando:
                    </p>
                    <p className="text-base text-white font-bold mb-6">
                        {content.concept}
                    </p>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="px-6 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors flex items-center gap-2 mx-auto disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generando...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Generar Caso
                            </>
                        )}
                    </button>
                    {error && (
                        <p className="text-xs text-red-400 mt-4">
                            Error: {error}
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Enunciado */}
                    <div className="bg-black/40 p-4 rounded-xl">
                        <h5 className="text-xs font-bold text-amber-400 mb-2 uppercase">
                            📋 Enunciado
                        </h5>
                        <p className="text-sm text-white/90 leading-relaxed">
                            {scenario}
                        </p>
                    </div>
                    
                    {/* Botón mostrar solución */}
                    {!showSolution ? (
                        <button
                            onClick={() => setShowSolution(true)}
                            className="w-full py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Ver Solución
                        </button>
                    ) : (
                        <div className="bg-black/40 p-4 rounded-xl border border-amber-500/30">
                            <h5 className="text-xs font-bold text-amber-400 mb-2 uppercase">
                                ✅ Solución
                            </h5>
                            <div className="text-sm text-white/90 leading-relaxed whitespace-pre-line">
                                {solution}
                            </div>
                        </div>
                    )}
                    
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="text-xs text-amber-400 hover:text-amber-300 underline flex items-center gap-1 mx-auto disabled:opacity-50"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Regenerar Caso
                    </button>
                </div>
            )}
        </motion.div>
    );
}

