"use client";

import { useState } from "react";
import { Image as ImageIcon, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface InfografiaWidgetProps {
    content: {
        frame: string;
        concept: string;
        imageUrl?: string;
        widgetId: string;
        topicId: string;
    };
}

export function InfografiaWidget({ content }: InfografiaWidgetProps) {
    const [imageUrl, setImageUrl] = useState(content.imageUrl);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);
        
        try {
            const res = await fetch('/api/widgets/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    widgetType: 'infografia',
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
                throw new Error(data.error || 'Error generating infografia');
            }
            
            setImageUrl(data.result);
        } catch (err) {
            console.error('Error generating infografia:', err);
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsGenerating(false);
        }
    };
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-blue-500/10 to-transparent rounded-2xl p-6 border border-blue-500/20 backdrop-blur-sm"
        >
            <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Infografía Visual
            </h4>
            
            {!imageUrl ? (
                <div className="text-center py-8">
                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ImageIcon className="w-8 h-8 text-blue-400" />
                    </div>
                    <p className="text-sm text-white/60 mb-2">
                        Genera una infografía visual de:
                    </p>
                    <p className="text-base text-white font-bold mb-6">
                        {content.concept}
                    </p>
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
                                Generar Infografía
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
                    <img 
                        src={imageUrl} 
                        alt={`Infografía: ${content.concept}`}
                        className="w-full rounded-xl shadow-2xl"
                    />
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-white/40">
                            {content.concept}
                        </p>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1 disabled:opacity-50"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Regenerar
                        </button>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

