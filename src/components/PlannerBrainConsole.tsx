"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, X, Terminal, CheckCircle, AlertTriangle, Code, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlannerBrainConsoleProps {
    isOpen: boolean;
    onClose: () => void;
    status: 'idle' | 'thinking' | 'success' | 'error';
    diagnostics?: { prompt: string; rawResponse: string; analysis?: string };
    onActivate: () => void;
}

export function PlannerBrainConsole({ isOpen, onClose, status, diagnostics, onActivate }: PlannerBrainConsoleProps) {
    const [view, setView] = useState<'prompt' | 'response' | 'strategy'>('strategy');
    const [elapsed, setElapsed] = useState(0);

    // Timer Logic
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (status === 'thinking') {
            const start = Date.now();
            timer = setInterval(() => {
                setElapsed(Math.floor((Date.now() - start) / 1000));
            }, 1000);
        } else {
            setElapsed(0);
        }
        return () => clearInterval(timer);
    }, [status]);

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60).toString().padStart(2, '0');
        const secs = (s % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <BrainCircuit className={cn("w-6 h-6", status === 'thinking' ? "text-purple-400 animate-pulse" : "text-purple-500")} />
                        <div>
                            <h3 className="text-lg font-bold text-blue-400">Consola Cerebro Cortez v2</h3>
                            <p className="text-xs text-white/50">Planificador Generativo Gemini Pro (Stable)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-white/50" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Sidebar / Status */}
                    <div className="w-full md:w-64 border-r border-white/5 p-6 bg-black/20 flex flex-col gap-6">
                        <div className="space-y-4">
                            <div className={cn("flex items-center gap-3 p-3 rounded-lg transition-colors", status === 'idle' ? "bg-white/10" : "text-white/30")}>
                                <div className="w-2 h-2 rounded-full bg-white/50" />
                                <span className="text-sm font-bold">1. Configuración</span>
                            </div>
                            <div className={cn("flex items-center gap-3 p-3 rounded-lg transition-colors", status === 'thinking' ? "bg-purple-500/20 text-purple-300" : "text-white/30")}>
                                {status === 'thinking' ? <Cpu className="w-4 h-4 animate-spin" /> : <div className="w-2 h-2 rounded-full bg-white/50" />}
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold">2. Razonamiento IA</span>
                                    {status === 'thinking' && <span className="text-xs font-mono opacity-75">{formatTime(elapsed)}</span>}
                                </div>
                            </div>
                            <div className={cn("flex items-center gap-3 p-3 rounded-lg transition-colors", status === 'success' ? "bg-green-500/20 text-green-400" : "text-white/30")}>
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-sm font-bold">3. Calendario Generado</span>
                            </div>
                        </div>

                        <div className="mt-auto">
                            {status === 'idle' && (
                                <button
                                    onClick={onActivate}
                                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-purple-900/20 flex justify-center items-center gap-2"
                                >
                                    <BrainCircuit className="w-4 h-4" /> INICIAR PROCESO
                                </button>
                            )}
                            {status === 'success' && (
                                <button
                                    onClick={onClose}
                                    className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors flex justify-center items-center gap-2"
                                >
                                    <CheckCircle className="w-4 h-4" /> APLICAR PLAN
                                </button>
                            )}

                            {/* Hint for closing */}
                            {status === 'thinking' && (
                                <p className="text-[10px] text-white/30 text-center mt-2 animate-pulse">
                                    Puede cerrar esta ventana. El proceso continuará en segundo plano.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Terminal View */}
                    <div className="flex-1 flex flex-col min-h-0 bg-[#050505]">
                        {/* Tabs */}
                        <div className="flex border-b border-white/5 overflow-x-auto">
                            <button
                                onClick={() => setView('strategy')}
                                className={cn("px-6 py-3 text-xs font-mono font-bold uppercase border-b-2 transition-colors whitespace-nowrap", view === 'strategy' ? "border-blue-500 text-blue-400" : "border-transparent text-white/30 hover:text-white/70")}
                            >
                                1. Master Plan
                            </button>
                            <button
                                onClick={() => setView('prompt')}
                                className={cn("px-6 py-3 text-xs font-mono font-bold uppercase border-b-2 transition-colors whitespace-nowrap", view === 'prompt' ? "border-purple-500 text-purple-400" : "border-transparent text-white/30 hover:text-white/70")}
                            >
                                2. Input Prompt
                            </button>
                            <button
                                onClick={() => setView('response')}
                                className={cn("px-6 py-3 text-xs font-mono font-bold uppercase border-b-2 transition-colors whitespace-nowrap", view === 'response' ? "border-green-500 text-green-400" : "border-transparent text-white/30 hover:text-white/70")}
                            >
                                3. Raw JSON
                            </button>
                        </div>

                        {/* Code Block */}
                        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                            {diagnostics ? (
                                <div className="font-mono text-xs text-white/70 leading-relaxed">
                                    {view === 'strategy' && (
                                        <div className="prose prose-invert max-w-none">
                                            <h4 className="text-blue-400 font-bold mb-4 uppercase tracking-widest border-b border-blue-500/20 pb-2">Análisis Estratégico (Gemini 3 Pro)</h4>
                                            <pre className="whitespace-pre-wrap font-sans text-sm text-white/80">
                                                {diagnostics.analysis || "No Master Plan Analysis generated. Check JSON tab."}
                                            </pre>
                                        </div>
                                    )}
                                    {view === 'prompt' && <pre className="whitespace-pre-wrap text-purple-200/50">{diagnostics.prompt}</pre>}
                                    {view === 'response' && <pre className="whitespace-pre-wrap text-green-200/50">{diagnostics.rawResponse}</pre>}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                                    <Terminal className="w-12 h-12" />
                                    <p className="font-mono text-sm">Esperando ejecución del núcleo...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
