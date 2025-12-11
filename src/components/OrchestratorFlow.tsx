"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BookOpen,
    Search,
    Clock,
    Brain,
    ChevronDown,
    CheckCircle,
    Loader2,
    AlertCircle,
    X,
    Timer
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentRole, AgentStep, OrchestrationState } from "@/lib/widget-types";

// ============================================
// TIPOS
// ============================================

interface OrchestratorFlowProps {
    state: OrchestrationState;
    onClose?: () => void;
}

// ============================================
// CONFIGURACIÓN DE AGENTES
// ============================================

const AGENT_CONFIG: Record<AgentRole, {
    label: string;
    icon: typeof Brain;
    color: string;
    description: string;
}> = {
    librarian: {
        label: 'Bibliotecario',
        icon: BookOpen,
        color: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
        description: 'Busca documentos en la biblioteca y genera la estructura base.',
    },
    auditor: {
        label: 'Auditor',
        icon: Search,
        color: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
        description: 'Detecta vacíos y propone optimizaciones.',
    },
    timekeeper: {
        label: 'Planificador',
        icon: Clock,
        color: 'text-green-400 bg-green-500/20 border-green-500/30',
        description: 'Calcula tiempo disponible y estrategia de concisión.',
    },
    strategist: {
        label: 'Estratega',
        icon: Brain,
        color: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
        description: 'Genera el contenido final y decide los widgets.',
    },
    planner: {
        label: 'Planificador Global',
        icon: Clock,
        color: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30',
        description: 'Lee planning del usuario y analiza supuestos prácticos.',
    },
    'expert-teorico': {
        label: 'Experto Teórico',
        icon: BookOpen,
        color: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
        description: 'Genera marco legal consultando CORE (leyes y decretos).',
    },
    'expert-practical': {
        label: 'Experto Práctico',
        icon: Brain,
        color: 'text-pink-400 bg-pink-500/20 border-pink-500/30',
        description: 'Analiza supuestos reales (PRACTICE) y genera guía de resolución.',
    },
    'expert-tecnico': {
        label: 'Experto Técnico',
        icon: Search,
        color: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/30',
        description: 'Genera fórmulas y cálculos desde CORE+SUPPLEMENTARY.',
    },
    curator: {
        label: 'Curador',
        icon: Search,
        color: 'text-orange-400 bg-orange-500/20 border-orange-500/30',
        description: 'Analiza criticidad de conceptos basado en frecuencia en supuestos.',
    },
};

const AGENT_ORDER: AgentRole[] = ['planner', 'expert-teorico', 'expert-practical', 'expert-tecnico', 'curator', 'strategist', 'librarian', 'auditor', 'timekeeper'];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function OrchestratorFlow({ state, onClose }: OrchestratorFlowProps) {
    const [selectedAgent, setSelectedAgent] = useState<AgentRole | null>(null);

    const getStepForAgent = (role: AgentRole): AgentStep | undefined => {
        return state.steps.find(s => s.role === role);
    };

    const formatDuration = (step?: AgentStep) => {
        if (!step?.startedAt || !step?.completedAt) return null;
        const ms = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
        const sec = Math.max(1, Math.round(ms / 1000));
        return `${sec}s`;
    };

    return (
        <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Brain className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">Orquestador de Agentes</h3>
                        <p className="text-[10px] text-white/40">
                            {state.status === 'completed' ? 'Generación completada' :
                                state.status === 'error' ? 'Error en la generación' :
                                    state.currentStep ? `Ejecutando: ${AGENT_CONFIG[state.currentStep].label}` :
                                        'Listo para generar'}
                        </p>
                    </div>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4 text-white/40" />
                    </button>
                )}
            </div>

            {/* Pipeline Visual */}
            <div className="p-4">
                <div className="flex items-center justify-between relative">
                    {/* Línea de conexión */}
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/10 -translate-y-1/2 z-0" />

                    {AGENT_ORDER.map((role, index) => {
                        const config = AGENT_CONFIG[role];
                        const step = getStepForAgent(role);
                        const isActive = state.currentStep === role;
                        const isCompleted = step?.status === 'completed';
                        const isError = step?.status === 'error';
                        const Icon = config.icon;

                        return (
                            <motion.button
                                key={role}
                                onClick={() => setSelectedAgent(selectedAgent === role ? null : role)}
                                className={cn(
                                    "relative z-10 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                                    selectedAgent === role ? "ring-2 ring-white/20" : "",
                                    isActive ? config.color :
                                        isCompleted ? "bg-green-500/10 border-green-500/30 text-green-400" :
                                            isError ? "bg-red-500/10 border-red-500/30 text-red-400" :
                                                "bg-white/5 border-white/10 text-white/40"
                                )}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <div className="relative">
                                    {isActive ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : isCompleted ? (
                                        <CheckCircle className="w-6 h-6" />
                                    ) : isError ? (
                                        <AlertCircle className="w-6 h-6" />
                                    ) : (
                                        <Icon className="w-6 h-6" />
                                    )}
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                    {config.label}
                                </span>
                                {step?.reasoning && (
                                    <span className="text-[10px] text-white/50 line-clamp-2 text-center">
                                        {step.reasoning}
                                    </span>
                                )}
                                {formatDuration(step) && (
                                    <span className="flex items-center gap-1 text-[10px] text-white/40">
                                        <Timer className="w-3 h-3" /> {formatDuration(step)}
                                    </span>
                                )}
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            {/* Detail Panel */}
            <AnimatePresence>
                {selectedAgent && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-white/5"
                    >
                        <AgentDetailPanel
                            role={selectedAgent}
                            step={getStepForAgent(selectedAgent)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Timeline estilo N8N */}
            <div className="border-t border-white/5 bg-black/30 px-4 py-3">
                <h4 className="text-xs uppercase text-white/50 font-bold mb-2">Bitácora de Cerebros</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {AGENT_ORDER.map((role) => {
                        const step = getStepForAgent(role);
                        const config = AGENT_CONFIG[role];
                        const status = step?.status || 'pending';
                        const isRunning = status === 'running';
                        const isDone = status === 'completed';
                        const isError = status === 'error';
                        const hasInput = step?.input !== undefined && step?.input !== null;
                        const hasOutput = step?.output !== undefined && step?.output !== null;
                        const safeInput = !hasInput
                            ? ''
                            : typeof step.input === 'string'
                                ? step.input
                                : (() => { try { return JSON.stringify(step.input); } catch { return ''; } })();
                        const safeOutput = !hasOutput
                            ? ''
                            : typeof step.output === 'string'
                                ? step.output
                                : (() => { try { return JSON.stringify(step.output); } catch { return ''; } })();
                        return (
                            <div
                                key={`${role}-log`}
                                className={cn(
                                    "flex items-start gap-3 rounded-lg border px-3 py-2",
                                    isRunning && "border-purple-400/50 bg-purple-500/5",
                                    isDone && "border-green-400/50 bg-green-500/5",
                                    isError && "border-red-400/50 bg-red-500/5",
                                    status === 'pending' && "border-white/10 bg-white/5"
                                )}
                            >
                                <config.icon className="w-4 h-4 mt-0.5 text-white/60" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-white truncate">{config.label}</span>
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase",
                                            isRunning && "text-purple-300",
                                            isDone && "text-green-300",
                                            isError && "text-red-300",
                                            status === 'pending' && "text-white/40"
                                        )}>
                                            {status}
                                        </span>
                                    </div>
                                    {hasInput && (
                                        <p className="text-[10px] text-white/50 line-clamp-2 mt-1">
                                        Entrada: {safeInput}
                                        </p>
                                    )}
                                    {step?.reasoning && (
                                            <p className="text-[10px] text-white/70 line-clamp-2 mt-0.5 italic">
                                                {step.reasoning}
                                            </p>
                                        )}
                                    {hasOutput && (
                                        <p className="text-[10px] text-green-300 line-clamp-2 mt-0.5">
                                                Salida: {safeOutput}
                                        </p>
                                    )}
                                </div>
                                {formatDuration(step) && (
                                    <span className="text-[10px] text-white/40">{formatDuration(step)}</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ============================================
// PANEL DE DETALLE DE AGENTE
// ============================================

interface AgentDetailPanelProps {
    role: AgentRole;
    step?: AgentStep;
}

function AgentDetailPanel({ role, step }: AgentDetailPanelProps) {
    const config = AGENT_CONFIG[role];
    const [activeTab, setActiveTab] = useState<'input' | 'reasoning' | 'output'>('reasoning');
    const renderValue = (val: unknown) => {
        if (val === undefined || val === null) return 'Sin datos';
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
        try {
            return JSON.stringify(val, null, 2);
        } catch {
            return String(val);
        }
    };

    return (
        <div className="p-4 bg-black/20">
            {/* Agent Info */}
            <div className="mb-4">
                <h4 className="text-sm font-bold text-white mb-1">{config.label}</h4>
                <p className="text-xs text-white/50">{config.description}</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-3">
                {(['input', 'reasoning', 'output'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors",
                            activeTab === tab
                                ? "bg-white/10 text-white"
                                : "text-white/40 hover:text-white/70"
                        )}
                    >
                        {tab === 'input' ? 'Entrada' : tab === 'reasoning' ? 'Razonamiento' : 'Salida'}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="bg-black/30 rounded-xl p-4 max-h-48 overflow-y-auto custom-scrollbar">
                {!step ? (
                    <p className="text-xs text-white/30 italic">Pendiente de ejecución...</p>
                ) : activeTab === 'input' ? (
                    <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap">
                        {renderValue(step.input)}
                    </pre>
                ) : activeTab === 'reasoning' ? (
                    <p className="text-xs text-white/70 leading-relaxed">
                        {step.reasoning || 'Sin razonamiento registrado'}
                    </p>
                ) : (
                    <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap">
                        {renderValue(step.output)}
                    </pre>
                )}
            </div>

            {/* Timestamps */}
            {step && (
                <div className="mt-3 flex gap-4 text-[10px] text-white/30">
                    {step.startedAt && (
                        <span>Inicio: {new Date(step.startedAt).toLocaleTimeString()}</span>
                    )}
                    {step.completedAt && (
                        <span>Fin: {new Date(step.completedAt).toLocaleTimeString()}</span>
                    )}
                </div>
            )}
        </div>
    );
}
