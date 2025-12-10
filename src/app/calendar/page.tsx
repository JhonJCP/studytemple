"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar as CalendarIcon, CheckCircle, Clock, Flame, Play, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { generateSchedule, StudyPlan } from "@/lib/planner-brain";

export default function CalendarPage() {
    const [intensity, setIntensity] = useState<StudyPlan['intensity']>('balanced');
    const [isSimulating, setIsSimulating] = useState(false);

    // Default Plan Config (Mock User Input)
    const plan: StudyPlan = useMemo(() => ({
        availability: {
            monday: 60, tuesday: 60, wednesday: 60, thursday: 60, friday: 60, saturday: 180, sunday: 0
        },
        goalDate: new Date(new Date().setDate(new Date().getDate() + 30)), // 30 days out
        intensity: intensity
    }), [intensity]);

    // The Brain Calculation
    const schedule = useMemo(() => generateSchedule(plan), [plan]);

    // Filter for "Today" (Using first scheduled day as proxy for demo)
    const today = new Date();
    // Simplified date matching for demo purposes
    const todaysMissions = schedule.slice(0, 3);
    const upcomingCount = Math.max(0, schedule.length - todaysMissions.length);

    const handleOptimize = (newIntensity: StudyPlan['intensity']) => {
        setIsSimulating(true);
        setTimeout(() => {
            setIntensity(newIntensity);
            setIsSimulating(false);
        }, 800);
    };

    return (
        <div className="min-h-screen p-8 bg-background flex flex-col">
            <Link href="/dashboard" className="flex items-center text-white/50 hover:text-white mb-8 transition-colors w-fit">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver al Templo
            </Link>

            <div className="flex items-center justify-between mb-12">
                <div>
                    <h1 className="text-5xl font-black text-green-400 mb-2 flex items-center gap-3">
                        EL CALENDARIO <BrainCircuit className="w-10 h-10 text-white/20" />
                    </h1>
                    <p className="text-xl text-white/60">
                        Cortez Planning Brain v1.0 • {schedule.length} sesiones generadas.
                    </p>
                </div>

                {/* Stats / Controls */}
                <div className="flex items-center gap-4">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                        {(['relaxed', 'balanced', 'intense'] as const).map((level) => (
                            <button
                                key={level}
                                onClick={() => handleOptimize(level)}
                                className={cn(
                                    "px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all",
                                    intensity === level ? "bg-green-500 text-black shadow-lg shadow-green-500/20" : "text-white/40 hover:text-white"
                                )}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
                {/* LEFT: Today's Missions */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Flame className="text-orange-500" /> Misiones de Hoy
                        </h2>
                        {todaysMissions.length > 0 && (
                            <button className="px-6 py-2 bg-green-500 text-black font-bold rounded-lg hover:scale-105 transition-transform flex items-center gap-2">
                                <Play className="w-4 h-4 fill-current" />
                                Iniciar Sesión de Estudio
                            </button>
                        )}
                    </div>

                    <AnimatePresence mode="wait">
                        {isSimulating ? (
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="h-64 flex flex-col items-center justify-center text-white/50 space-y-4"
                            >
                                <BrainCircuit className="w-12 h-12 animate-pulse text-green-500" />
                                <p>Optimizando ruta de aprendizaje...</p>
                            </motion.div>
                        ) : (
                            <div className="grid gap-4">
                                {todaysMissions.map((session, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="glass-card p-6 flex items-center justify-between group border-l-4 border-l-green-500"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={cn(
                                                    "text-xs font-bold px-2 py-0.5 rounded bg-white/10 text-white/60",
                                                    session.mode === 'summary' && "bg-amber-500/20 text-amber-500"
                                                )}>
                                                    MODO: {session.mode.toUpperCase().replace('_', ' ')}
                                                </span>
                                                <span className="text-xs font-mono text-white/30 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {session.durationMinutes} min
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-bold text-white group-hover:text-green-400 transition-colors">
                                                {session.topicTitle}
                                            </h3>
                                            <p className="text-xs text-white/40 mt-1 italic">
                                                🤖 IA: "{session.reason}"
                                            </p>
                                        </div>
                                        <Link href={`/library?open=${encodeURIComponent(session.topicId)}`}>
                                            <button className="px-4 py-2 border border-white/10 rounded hover:bg-white/10 text-white transition-colors">
                                                Estudiar
                                            </button>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Empty State */}
                    {!isSimulating && todaysMissions.length === 0 && (
                        <div className="p-12 text-center border border-dashed border-white/10 rounded-xl">
                            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <h3 className="text-2xl font-bold text-white">¡Día Libre!</h3>
                            <p className="text-white/50">El cerebro no ha programado nada para hoy según tus restricciones.</p>
                        </div>
                    )}
                </div>

                {/* RIGHT: Forecast */}
                <div className="space-y-8">
                    <div className="glass-card p-6">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-purple-400" /> Proyección IA
                        </h3>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                                <div className="text-3xl font-bold text-white">{upcomingCount}</div>
                                <div className="text-sm text-white/40">Sesiones Pendientes</div>
                            </div>

                            <div className="text-xs text-white/30 p-2">
                                Próximos 5 hitos del plan:
                            </div>
                            {schedule.slice(3, 8).map((s, idx) => (
                                <div key={idx} className="flex flex-col gap-1 pb-3 border-b border-white/5 last:border-0">
                                    <div className="flex justify-between items-center">
                                        <span className="text-green-400 font-bold text-xs">{s.date.toLocaleDateString()}</span>
                                        <span className="text-white/20 text-[10px] uppercase">{s.mode}</span>
                                    </div>
                                    <span className="text-white/70 text-sm truncate">{s.topicTitle}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
