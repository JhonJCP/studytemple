"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, X, Play, Save, CheckCircle, Terminal, Cpu, Loader2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlannerBrainConsoleProps {
    isOpen: boolean;
    onClose: () => void;
    status: 'idle' | 'thinking' | 'success' | 'error';
    diagnostics?: { prompt: string; rawResponse: string; analysis?: string };
    onActivate: () => void;
    onSave: () => void;
    onPromptChange: (newPrompt: string) => void;
    onLoadBlitzkrieg?: () => void;
    onPasteFromClipboard?: () => void | Promise<void>;
}

export function PlannerBrainConsole({ isOpen, onClose, status, diagnostics, onActivate, onSave, onPromptChange, onLoadBlitzkrieg, onPasteFromClipboard }: PlannerBrainConsoleProps) {
    // Auto-scroll logic
    const consoleRef = useRef<HTMLDivElement>(null);
    const [showRaw, setShowRaw] = useState(false);

    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [diagnostics]);

    // Persist simple history in localStorage for later review
    useEffect(() => {
        if (status === "success" && diagnostics?.rawResponse) {
            try {
                const prev = JSON.parse(localStorage.getItem("planner_history") || "[]");
                prev.unshift({
                    ts: new Date().toISOString(),
                    analysis: diagnostics.analysis || "",
                    raw: diagnostics.rawResponse
                });
                // keep last 5 entries
                localStorage.setItem("planner_history", JSON.stringify(prev.slice(0, 5)));
            } catch {
                // ignore storage errors
            }
        }
    }, [status, diagnostics]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-[95vw] h-[90vh] bg-[#09090b] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", status === 'thinking' ? "bg-purple-500/20" : "bg-white/5")}>
                            <BrainCircuit className={cn("w-5 h-5", status === 'thinking' ? "text-purple-400 animate-pulse" : "text-purple-500")} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white tracking-wide">CEREBRO CORTEZ (Gemini 3 Pro)</h3>
                            <p className="text-[10px] text-white/40 font-mono">Planificador Estratégico de Oposiciones</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {onLoadBlitzkrieg && (
                            <button onClick={onLoadBlitzkrieg} className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold rounded border border-blue-500/30 uppercase tracking-wider transition-colors">
                                Cargar Preset 'Blitzkrieg'
                            </button>
                        )}
                        {onPasteFromClipboard && (
                            <button
                                onClick={onPasteFromClipboard}
                                className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold rounded border border-amber-500/30 uppercase tracking-wider transition-colors flex items-center gap-2"
                                title="Pegar JSON del plan desde el portapapeles"
                            >
                                <Copy className="w-3 h-3" /> Pegar Plan
                            </button>
                        )}
                        <button
                            onClick={() => onPromptChange("")}
                            className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-xs font-bold rounded border border-white/10 uppercase tracking-wider transition-colors flex items-center gap-2"
                            title="Limpiar Prompt"
                        >
                            <Copy className="w-3 h-3" /> Limpiar
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-5 h-5 text-white/50" />
                        </button>
                    </div>
                </div>

                {/* Main Split Grid */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-0 bg-[#050505]">

                    {/* LEFT COLUMN: Prompt / Instructions */}
                    <div className="flex flex-col border-r border-white/5 min-h-0">
                        <div className="px-4 py-2 border-b border-white/5 bg-zinc-900/30 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Instrucciones (Prompt)</span>
                            <div className="flex gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                                <div className="w-2 h-2 rounded-full bg-red-500/20 border border-red-500/50" />
                                <div className="w-2 h-2 rounded-full bg-green-500/20 border border-green-500/50" />
                            </div>
                        </div>
                        <div className="flex-1 p-0 overflow-auto custom-scrollbar relative font-mono text-xs bg-[#0c0c0c] flex">
                            {/* Line Numbers */}
                            <div className="w-8 bg-zinc-900/50 border-r border-white/5 flex flex-col items-end py-4 pr-2 text-white/20 select-none shrink-0 z-10">
                                {Array.from({ length: 50 }).map((_, i) => (
                                    <div key={i} className="leading-6">{i + 1}</div>
                                ))}
                            </div>

                            {/* Editable Content */}
                            <textarea
                                className="flex-1 bg-transparent text-white/70 font-mono text-xs resize-none focus:outline-none p-4 leading-6 custom-scrollbar focus:bg-white/5 transition-colors"
                                value={diagnostics?.prompt || ""}
                                onChange={(e) => onPromptChange(e.target.value)}
                                spellCheck={false}
                                placeholder="// Esperando instrucciones del sistema..."
                            />
                        </div>

                        {/* Data Injection Visual Indicator */}
                        <div className="p-3 bg-[#0c0c0c] border-t border-white/5 border-b border-white/5 flex flex-col gap-2 opacity-50 select-none">
                            <div className="flex items-center gap-2 text-[10px] text-blue-400 font-mono">
                                <Terminal className="w-3 h-3" />
                                <span>SYSTEM_DATA_INJECTION_LAYER</span>
                            </div>
                            <div className="flex gap-2 text-[10px] text-white/20 font-mono pl-5">
                                <span className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5">+ JSON(Syllabus)</span>
                                <span className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5">+ JSON(Timeline)</span>
                                <span className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5">+ JSON(Context)</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Output / Result */}
                    <div className="flex flex-col min-h-0">
                        <div className="px-4 py-2 border-b border-white/5 bg-zinc-900/30 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Resultado (Master Plan Analysis)</span>
                            <div className="flex items-center gap-3">
                                {diagnostics?.rawResponse && (
                                    <button
                                        onClick={() => setShowRaw(!showRaw)}
                                        className="text-[10px] px-2 py-1 rounded border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors"
                                        title="Mostrar/ocultar JSON completo"
                                    >
                                        {showRaw ? "Ocultar JSON" : "Ver JSON"}
                                    </button>
                                )}
                                {diagnostics?.rawResponse && (
                                    <button
                                        onClick={() => navigator.clipboard.writeText(diagnostics.rawResponse)}
                                        className="text-[10px] px-2 py-1 rounded border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors flex items-center gap-1"
                                        title="Copiar JSON al portapapeles"
                                    >
                                        <Copy className="w-3 h-3" /> Copiar JSON
                                    </button>
                                )}
                                {status === 'thinking' && <span className="text-[10px] text-purple-400 font-mono animate-pulse">GENERANDO...</span>}
                            </div>
                        </div>
                        <div className="flex-1 p-6 overflow-auto custom-scrollbar bg-black text-sm text-white/80 leading-relaxed font-sans relative">
                            {status === 'thinking' ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                                    <p className="text-xs text-purple-300/50 font-mono animate-pulse">Consultando a Gemini 3 Pro...</p>
                                </div>
                            ) : diagnostics?.analysis ? (
                                <div className="prose prose-invert max-w-none prose-p:text-white/80 prose-headings:text-blue-400 prose-strong:text-white space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold mb-2 text-purple-400 border-b border-white/10 pb-2">Estrategia Generada:</h2>
                                        <pre className="whitespace-pre-wrap font-sans bg-transparent p-0">
                                            {diagnostics.analysis}
                                        </pre>
                                    </div>
                                    {diagnostics.rawResponse && showRaw && (
                                        <div className="border border-white/10 rounded-lg bg-white/5 p-3 text-xs font-mono whitespace-pre overflow-auto max-h-[45vh] custom-scrollbar">
                                            {diagnostics.rawResponse}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-white/10 gap-4">
                                    <Cpu className="w-16 h-16 stroke-1" />
                                    <p className="font-mono text-sm max-w-[200px] text-center">Ejecuta el análisis para visualizar la estrategia propuesta.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-zinc-900 border-t border-white/10 flex items-center justify-between gap-4">
                    <button
                        onClick={onActivate}
                        disabled={status === 'thinking'}
                        className={cn(
                            "flex items-center gap-2 px-8 py-4 rounded-lg font-bold uppercase tracking-wider transition-all w-full md:w-auto justify-center",
                            status === 'thinking'
                                ? "bg-white/5 text-white/30 cursor-wait"
                                : "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 hover:shadow-purple-700/40"
                        )}
                    >
                        {status === 'thinking' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                        {status === 'thinking' ? "Analizando..." : "Ejecutar Análisis"}
                    </button>

                    <button
                        onClick={onSave}
                        disabled={status !== 'success'}
                        className={cn(
                            "flex items-center gap-2 px-8 py-4 rounded-lg font-bold uppercase tracking-wider transition-all w-full md:w-auto justify-center border",
                            status === 'success'
                                ? "bg-white/5 border-white/10 hover:bg-white/10 text-green-400 border-green-500/30"
                                : "bg-transparent border-white/5 text-white/20 cursor-not-allowed"
                        )}
                    >
                        <Save className="w-5 h-5" />
                        Guardar Plan (Memoria)
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
