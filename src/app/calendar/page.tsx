"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar as CalendarIcon, Play, BrainCircuit, Timer, FileQuestion, BookOpen, Layers, Info, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { generateSmartSchedule, StudyPlan, ScheduledSession } from "@/lib/planner-brain";
import { CalendarGrid } from "@/components/CalendarGrid";
import { generateDeepPlan } from "@/app/actions/ai-planner"; // Server Action

export default function CalendarPage() {
    // State
    const [intensity, setIntensity] = useState<StudyPlan['intensity']>('balanced');
    const [selectedDate, setSelectedDate] = useState(new Date("2025-12-15")); // Viewport selected day
    const [viewDate, setViewDate] = useState(new Date("2025-12-15")); // Viewport month
    const [activeTimer, setActiveTimer] = useState<string | null>(null);

    // AI State
    const [isThinking, setIsThinking] = useState(false);
    const [aiPlan, setAiPlan] = useState<ScheduledSession[] | null>(null);

    // Default Plan (Local Fallback)
    const planConfig: StudyPlan = useMemo(() => ({
        availability: {
            monday: 120, tuesday: 120, wednesday: 120, thursday: 120, friday: 120, saturday: 240, sunday: 60
        },
        startDate: new Date("2025-12-15"),
        goalDate: new Date("2026-01-15"),
        intensity: intensity
    }), [intensity]);

    // Local Algo Schedule
    const localSchedule = useMemo(() => generateSmartSchedule(planConfig), [planConfig]);

    // Active Schedule (Prefer AI if exists)
    const schedule = aiPlan || localSchedule;

    // Filter Missions
    const dailyMissions = schedule.filter(s => {
        const d = new Date(s.date);
        return d.getDate() === selectedDate.getDate() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getFullYear() === selectedDate.getFullYear();
    });

    // Handlers
    const handleMonthNav = (dir: 1 | -1) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + dir);
        setViewDate(newDate);
    };

    const handleBrainActivation = async () => {
        setIsThinking(true);
        // Call Server Action
        const result = await generateDeepPlan({
            startDate: "2025-12-15",
            goalDate: "2026-01-15",
            availability: planConfig.availability,
            intensity: intensity
        });

        if (result.success && result.schedule) {
            // Convert strings back to Dates if JSON lost them
            const hydrated = result.schedule.map((s: any) => ({
                ...s,
                date: new Date(s.date)
            }));
            setAiPlan(hydrated);
        } else {
            alert("El Cerebro Cortez no pudo completar el análisis profundo. Usando algoritmo local.");
        }
        setIsThinking(false);
    };

    // UI Helpers
    const getIconForType = (type: ScheduledSession['type']) => {
        switch (type) {
            case 'study': return BookOpen;
            case 'review_flashcards': return Layers;
            case 'test_practice': return FileQuestion;
            default: return CalendarIcon;
        }
    };

    return (
        <div className="min-h-screen p-8 bg-background flex flex-col">
            <Link href="/dashboard" className="flex items-center text-white/50 hover:text-white mb-8 transition-colors w-fit">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver al Templo
            </Link>

            <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
                <div>
                    <h1 className="text-5xl font-black text-green-400 mb-2 flex items-center gap-3">
                        EL CALENDARIO <BrainCircuit className="w-10 h-10 text-white/20" />
                    </h1>
                    <p className="text-xl text-white/60">
                        {aiPlan ? (
                            <span className="flex items-center gap-2 text-purple-400 font-bold">
                                <Sparkles className="w-4 h-4" /> Planificación Generativa (Gemini Pro) Activa
                            </span>
                        ) : (
                            <span>Modo Algorítmico (Local). Activa el Cerebro para profundidad real.</span>
                        )}
                    </p>
                </div>

                <button
                    onClick={handleBrainActivation}
                    disabled={isThinking}
                    className={cn(
                        "group relative px-6 py-3 rounded-xl font-bold flex items-center gap-3 overflow-hidden transition-all",
                        isThinking ? "bg-purple-500/20 text-purple-200 cursor-wait" : "bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105 shadow-lg shadow-purple-500/20 text-white"
                    )}
                >
                    {isThinking ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Analizando Temario...
                        </>
                    ) : (
                        <>
                            <BrainCircuit className="w-5 h-5 fill-current" />
                            ACTIVAR CEREBRO CORTEZ
                        </>
                    )}

                    {/* Glow Effect */}
                    {!isThinking && <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />}
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
                {/* LEFT: Task List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2 capitalize">
                            <CalendarIcon className="text-orange-500" /> Agenda: {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </h2>
                    </div>

                    <div className="grid gap-4">
                        {dailyMissions.length === 0 ? (
                            <div className="p-12 text-center border border-dashed border-white/10 rounded-xl">
                                <p className="text-white/50">Toque un día en el calendario para ver detalles.</p>
                            </div>
                        ) : (
                            dailyMissions.map((session, i) => {
                                const Icon = getIconForType(session.type);
                                const isActive = activeTimer === session.id;

                                return (
                                    <motion.div
                                        key={session.id || i}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className={cn(
                                            "glass-card p-6 flex flex-col gap-4 group border-l-4",
                                            activeTimer === session.id ? "border-l-green-400 bg-green-500/5" : "border-l-white/10"
                                        )}
                                    >
                                        <div className="flex gap-4 items-start">
                                            <div className="p-3 bg-white/5 rounded-lg shrink-0">
                                                <Icon className="w-6 h-6 text-white/70" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <span className={cn(
                                                        "text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-white/60 uppercase",
                                                        session.type.includes("test") && "bg-purple-500/20 text-purple-300",
                                                        session.type === "study" && "bg-blue-500/20 text-blue-300"
                                                    )}>
                                                        {session.type.replace('_', ' ')}
                                                    </span>
                                                    {/* If AI Plan has explicit breaks or start time, show them */}
                                                    {(session as any).startTime && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                                            Starts: {(session as any).startTime}
                                                        </span>
                                                    )}
                                                    <span className="text-xs font-mono text-white/30 flex items-center gap-1">
                                                        <Timer className="w-3 h-3" /> {session.durationMinutes} min
                                                    </span>
                                                </div>

                                                <h3 className="text-xl font-bold text-white group-hover:text-green-400 transition-colors">
                                                    {session.topicTitle}
                                                </h3>

                                                {/* Reasoning */}
                                                <div className="mt-3 p-3 bg-black/30 rounded-lg border border-white/5 flex gap-3 items-start">
                                                    <BrainCircuit className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-purple-200/80 italic leading-relaxed">
                                                            "{session.aiReasoning}"
                                                        </p>
                                                        {(session as any).breaks && (
                                                            <p className="text-[10px] text-white/40 uppercase font-bold flex items-center gap-1">
                                                                <Timer className="w-3 h-3" /> Break: {(session as any).breaks}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 justify-end pt-2 border-t border-white/5">
                                            <button
                                                onClick={() => setActiveTimer(isActive ? null : session.id)}
                                                className={cn(
                                                    "p-3 rounded-lg border transition-all flex items-center gap-2",
                                                    isActive
                                                        ? "bg-red-500/20 border-red-500/50 text-red-500 animate-pulse"
                                                        : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
                                                )}
                                                title="Temporizador"
                                            >
                                                <Timer className="w-5 h-5" />
                                                {isActive && <span className="text-sm font-mono font-bold">29:59</span>}
                                            </button>

                                            <Link href={`/library?open=${encodeURIComponent(session.topicId)}`} className="flex-1 md:flex-none">
                                                <button className="w-full md:w-auto px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                                                    <Play className="w-4 h-4 fill-current" />
                                                    {session.type.includes('test') ? 'Hacer Test' : 'Estudiar'}
                                                </button>
                                            </Link>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT: Calendar Grid */}
                <div className="space-y-8">
                    <CalendarGrid
                        currentDate={viewDate}
                        schedule={schedule}
                        selectedDate={selectedDate}
                        onSelectDate={(d) => { setSelectedDate(d); setViewDate(d); }}
                        onNavigateMonth={handleMonthNav}
                    />

                    {/* Stats Widget */}
                    <div className="glass-card p-6">
                        <h4 className="text-sm font-bold text-white/50 mb-4 uppercase">Estadísticas {aiPlan ? "(Generativa)" : "(Algorítmica)"}</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center bg-white/5 p-3 rounded">
                                <span className="text-xs text-white/50">Sesiones de Estudio</span>
                                <span className="text-xl font-bold text-green-400">{schedule.filter(s => s.type === 'study').length}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 p-3 rounded">
                                <span className="text-xs text-white/50">Tests Simulados</span>
                                <span className="text-xl font-bold text-purple-400">{schedule.filter(s => s.type === 'test_practice').length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
