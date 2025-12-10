"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar as CalendarIcon, Play, BrainCircuit, Timer, FileQuestion, BookOpen, Layers, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { generateSmartSchedule, StudyPlan, ScheduledSession } from "@/lib/planner-brain";
import { CalendarGrid } from "@/components/CalendarGrid";

export default function CalendarPage() {
    const [intensity, setIntensity] = useState<StudyPlan['intensity']>('balanced');
    const [selectedDate, setSelectedDate] = useState(new Date("2025-12-15")); // Demo start
    const [activeTimer, setActiveTimer] = useState<string | null>(null);

    // Default Plan Config (Sprint: Dec 15 - Jan 15)
    // In a real app, these dates would come from user settings/onboarding.
    const plan: StudyPlan = useMemo(() => ({
        availability: {
            monday: 120, tuesday: 120, wednesday: 120, thursday: 120, friday: 120, saturday: 240, sunday: 60
        },
        startDate: new Date("2025-12-15"),
        goalDate: new Date("2026-01-15"),
        intensity: intensity
    }), [intensity]);

    // The Brain Calculation
    const schedule = useMemo(() => generateSmartSchedule(plan), [plan]);

    // Filter Missions by Selected Date
    const dailyMissions = schedule.filter(s =>
        s.date.getDate() === selectedDate.getDate() &&
        s.date.getMonth() === selectedDate.getMonth()
    );

    // Filter for Today (for Stats/Header)
    const today = new Date("2025-12-15"); // Demo Today
    const todaysMissions = schedule.filter(s => s.date.getDate() === today.getDate() && s.date.getMonth() === today.getMonth());
    const isToday = selectedDate.getDate() === today.getDate() && selectedDate.getMonth() === today.getMonth();

    // Helpers
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
                        Cortez Brain v3.0: <span className="text-green-400 font-bold">Análisis de Complejidad Activado</span>
                    </p>
                </div>
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
                                <p className="text-white/50">No hay misiones programadas para este día.</p>
                            </div>
                        ) : (
                            dailyMissions.map((session, i) => {
                                const Icon = getIconForType(session.type);
                                const isActive = activeTimer === session.id;

                                return (
                                    <motion.div
                                        key={session.id}
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
                                                    {session.complexity && (
                                                        <span className={cn(
                                                            "text-[10px] font-bold px-2 py-0.5 rounded text-black uppercase",
                                                            session.complexity === 'High' ? "bg-red-400" :
                                                                session.complexity === 'Medium' ? "bg-amber-400" : "bg-green-400"
                                                        )}>
                                                            {session.complexity} Complexity
                                                        </span>
                                                    )}
                                                    <span className="text-xs font-mono text-white/30 flex items-center gap-1">
                                                        <Timer className="w-3 h-3" /> {session.durationMinutes} min
                                                    </span>
                                                </div>

                                                <h3 className="text-xl font-bold text-white group-hover:text-green-400 transition-colors">
                                                    {session.topicTitle}
                                                </h3>

                                                {/* AI REASONING BOX */}
                                                <div className="mt-3 p-3 bg-black/30 rounded-lg border border-white/5 flex gap-3 items-start">
                                                    <BrainCircuit className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                                                    <p className="text-xs text-purple-200/80 italic leading-relaxed">
                                                        "{session.aiReasoning}"
                                                    </p>
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
                        currentDate={selectedDate}
                        schedule={schedule}
                        selectedDate={selectedDate}
                        onSelectDate={setSelectedDate}
                    />

                    {/* Stats Widget */}
                    <div className="glass-card p-6">
                        <h4 className="text-sm font-bold text-white/50 mb-4 uppercase">Estadísticas del Plan (IA)</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center bg-white/5 p-3 rounded">
                                <span className="text-xs text-white/50">Sesiones de Estudio</span>
                                <span className="text-xl font-bold text-green-400">{schedule.filter(s => s.type === 'study').length}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 p-3 rounded">
                                <span className="text-xs text-white/50">Tests Simulados</span>
                                <span className="text-xl font-bold text-purple-400">{schedule.filter(s => s.type === 'test_practice').length}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 p-3 rounded">
                                <span className="text-xs text-white/50">Flashcards SRS</span>
                                <span className="text-xl font-bold text-blue-400">{schedule.filter(s => s.type === 'review_flashcards').length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
