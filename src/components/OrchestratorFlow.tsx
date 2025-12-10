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
    X
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
};

const AGENT_ORDER: AgentRole[] = ['librarian', 'auditor', 'timekeeper', 'strategist'];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function OrchestratorFlow({ state, onClose }: OrchestratorFlowProps) {
    const [selectedAgent, setSelectedAgent] = useState<AgentRole | null>(null);

    const getStepForAgent = (role: AgentRole): AgentStep | undefined => {
        return state.steps.find(s => s.role === role);
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
                        {step.input ? JSON.stringify(step.input, null, 2) : 'Sin entrada'}
                    </pre>
                ) : activeTab === 'reasoning' ? (
                    <p className="text-xs text-white/70 leading-relaxed">
                        {step.reasoning || 'Sin razonamiento registrado'}
                    </p>
                ) : (
                    <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap">
                        {step.output ? JSON.stringify(step.output, null, 2) : 'Sin salida'}
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
