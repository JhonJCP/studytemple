"use client";

import { useEffect, useState } from "react";
import { agentMonitor, AgentLog } from "@/lib/agent-monitor";
import { Brain, Terminal, Database, ShieldAlert, Cpu, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function BrainDashboard() {
    const [logs, setLogs] = useState<AgentLog[]>([]);
    const [selectedLog, setSelectedLog] = useState<AgentLog | null>(null);

    // Poll for logs (simulating real-time socket)
    useEffect(() => {
        const interval = setInterval(() => {
            setLogs([...agentMonitor.getRecentLogs()]);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen p-6 bg-[#0a0a0a] flex gap-6 font-mono text-sm">
            {/* LEFT: Agent Stream */}
            <div className="w-1/3 flex flex-col gap-4">
                <header className="mb-4">
                    <h1 className="text-2xl font-black text-green-500 flex items-center gap-3">
                        <Activity className="animate-pulse" /> CORE SYSTEM
                    </h1>
                    <p className="text-white/40 text-xs">Monitoreo de Procesos Cognitivos</p>
                </header>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar max-h-[80vh]">
                    <AnimatePresence initial={false}>
                        {logs.map((log) => (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                onClick={() => setSelectedLog(log)}
                                className={cn(
                                    "p-4 rounded border cursor-pointer transition-all hover:bg-white/5",
                                    selectedLog?.id === log.id ? "border-green-500 bg-green-500/10" : "border-white/10 bg-black/40"
                                )}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <AgentBadge name={log.agentName} />
                                    <span className="text-xs text-white/30">{log.latencyMs}ms</span>
                                </div>
                                <div className="text-white/80 font-bold mb-1">{log.action}</div>
                                <div className="text-xs text-white/40 truncate">{log.output}</div>
                            </motion.div>
                        ))}
                        {logs.length === 0 && (
                            <div className="text-center text-white/20 py-10 italic">
                                Esperando actividad neuronal...
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* RIGHT: Inspector */}
            <div className="flex-1 bg-black/60 border border-white/10 rounded-xl overflow-hidden flex flex-col">
                {selectedLog ? (
                    <>
                        <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-white mb-1">Detalle del Pensamiento</h2>
                                <p className="text-xs text-white/50">{selectedLog.timestamp.toLocaleTimeString()}</p>
                            </div>
                            <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-xs border border-green-500/30">
                                STATUS: OK
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Input Prompt */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
                                    <Terminal className="w-4 h-4" /> Prompt (Input)
                                </label>
                                <div className="bg-black border border-white/10 rounded p-4 text-white/70 whitespace-pre-wrap leading-relaxed">
                                    {selectedLog.promptUsed}
                                </div>
                            </div>

                            {/* Divider with Arrow */}
                            <div className="flex justify-center text-white/20">
                                <Activity className="w-6 h-6 animate-bounce" />
                            </div>

                            {/* Output */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-green-400 uppercase tracking-wider">
                                    <Cpu className="w-4 h-4" /> Respuesta Generada (Output)
                                </label>
                                <div className="bg-black border border-green-900/30 rounded p-4 text-green-100 whitespace-pre-wrap leading-relaxed shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                                    {selectedLog.output}
                                </div>
                            </div>

                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-white/20">
                        <Brain className="w-24 h-24 mb-4 opacity-20" />
                        <p>Selecciona un log para inspeccionar sus sinapsis.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function AgentBadge({ name }: { name: string }) {
    let color = "bg-gray-500";
    let icon = Brain;

    if (name === "Bibliotecario") { color = "bg-blue-500"; icon = Database; }
    if (name === "Auditor BOE") { color = "bg-red-500"; icon = ShieldAlert; }
    if (name === "Estratega") { color = "bg-purple-500"; icon = Brain; }
    if (name === "Optimizador Tiempo") { color = "bg-amber-500"; icon = Activity; }

    const Icon = icon;

    return (
        <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold text-white flex items-center gap-1 w-fit", color)}>
            <Icon className="w-3 h-3" /> {name}
        </span>
    );
}
