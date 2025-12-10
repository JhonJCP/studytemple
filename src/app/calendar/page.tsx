"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar as CalendarIcon, Play, BrainCircuit, Timer, FileQuestion, BookOpen, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { generateSmartSchedule, StudyPlan, ScheduledSession } from "@/lib/planner-brain";

export default function CalendarPage() {
    const [intensity, setIntensity] = useState<StudyPlan['intensity']>('balanced');
    const [examDate, setExamDate] = useState("2026-06-15"); // Default future date
    const [activeTimer, setActiveTimer] = useState<string | null>(null);

    // Default Plan Config (Sprint: Dec 15 - Jan 15)
    // In a real app, these dates would come from user settings/onboarding.
    const plan: StudyPlan = useMemo(() => ({
        availability: {
            monday: 90, tuesday: 90, wednesday: 90, thursday: 90, friday: 90, saturday: 180, sunday: 0
        },
        startDate: new Date("2025-12-15"),
        goalDate: new Date("2026-01-15"),
        intensity: intensity
    }), [intensity]);

    // The Brain Calculation
    const schedule = useMemo(() => generateSmartSchedule(plan), [plan]);

    // UI Helpers
    const getIconForType = (type: ScheduledSession['type']) => {
        switch (type) {
            case 'study': return BookOpen;
            case 'review_flashcards': return Layers;
            case 'test_practice': return FileQuestion;
            default: return CalendarIcon;
        }
    };

    const getLabelForType = (type: ScheduledSession['type']) => {
        switch (type) {
            case 'study': return 'Estudio Profundo';
            case 'review_flashcards': return 'Flashcards SRS';
            case 'test_practice': return 'Simulacro Test';
            case 'comprehensive_review': return 'Repaso General';
            default: return 'Sesión';
        }
    };

    // Filter "Today" (Simulating we are on Dec 15 for demo purposes, or showing first Plan day)
    const demoDate = new Date("2025-12-15");
    const todaysMissions = schedule.filter(s => s.date.getDate() === demoDate.getDate() && s.date.getMonth() === demoDate.getMonth());

    // Group upcoming
    const upcomingSessions = schedule.slice(todaysMissions.length, todaysMissions.length + 10);

    return (
        <div className="min-h-screen p-8 bg-background flex flex-col">
            <Link href="/dashboard" className="flex items-center text-white/50 hover:text-white mb-8 transition-colors w-fit">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver al Templo
            </Link>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
                <div>
                    <h1 className="text-5xl font-black text-green-400 mb-2 flex items-center gap-3">
                        EL CALENDARIO <BrainCircuit className="w-10 h-10 text-white/20" />
                    </h1>
                    <p className="text-xl text-white/60">
                        Estrategia SRS Activa: <span className="text-green-400 font-bold">Sprint 30 Días</span> (15 Dic - 15 Ene)
                    </p>
                </div>

                {/* Exam Date Input */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col gap-2">
                    <label className="text-xs text-white/40 uppercase font-bold">Fecha de Examen (Estimada)</label>
                    <input
                        type="date"
                        value={examDate}
                        onChange={(e) => setExamDate(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-green-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
                {/* LEFT: Today's Missions */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <CalendarIcon className="text-orange-500" /> Agenda: 15 de Diciembre (Inicio)
                        </h2>
                    </div>

                    <div className="grid gap-4">
                        {todaysMissions.map((session, i) => {
                            const Icon = getIconForType(session.type);
                            const isActive = activeTimer === session.id;

                            return (
                                <motion.div
                                    key={session.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={cn(
                                        "glass-card p-6 flex items-center justify-between group border-l-4",
                                        activeTimer === session.id ? "border-l-green-400 bg-green-500/5" : "border-l-white/10"
                                    )}
                                >
                                    <div className="flex gap-4 items-center">
                                        <div className="p-3 bg-white/5 rounded-lg">
                                            <Icon className="w-6 h-6 text-white/70" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={cn(
                                                    "text-xs font-bold px-2 py-0.5 rounded bg-white/10 text-white/60 uppercase",
                                                    session.type.includes("test") && "bg-purple-500/20 text-purple-300",
                                                    session.type === "study" && "bg-blue-500/20 text-blue-300"
                                                )}>
                                                    {getLabelForType(session.type)}
                                                </span>
                                                <span className="text-xs font-mono text-white/30 flex items-center gap-1">
                                                    <Timer className="w-3 h-3" /> {session.durationMinutes} min
                                                </span>
                                            </div>
                                            <h3 className="text-xl font-bold text-white group-hover:text-green-400 transition-colors">
                                                {session.topicTitle}
                                            </h3>
                                            <p className="text-xs text-white/40 mt-1 italic">
                                                "{session.notes}"
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Timer Button */}
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

                                        {/* Action Button */}
                                        <Link href={`/library?open=${encodeURIComponent(session.topicId)}`}>
                                            <button className="px-4 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
                                                <Play className="w-4 h-4 fill-current" />
                                                {session.type.includes('test') ? 'Hacer Test' : 'Estudiar'}
                                            </button>
                                        </Link>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT: Forecast */}
                <div className="space-y-8">
                    <div className="glass-card p-6">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <BrainCircuit className="w-5 h-5 text-purple-400" /> Próximos Repasos (SRS)
                        </h3>
                        <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                            {upcomingSessions.map((s, idx) => (
                                <div key={idx} className="flex gap-3 pb-3 border-b border-white/5 last:border-0 group hover:bg-white/5 p-2 rounded transition-colors">
                                    <div className="flex flex-col items-center justify-center min-w-[50px] bg-white/5 rounded px-2 py-1">
                                        <span className="text-xs text-white/40">{s.date.toLocaleDateString(undefined, { month: 'short' })}</span>
                                        <span className="text-lg font-bold text-white">{s.date.getDate()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                                                s.type === 'study' ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                                            )}>
                                                {s.type === 'study' ? 'NUEVO' : 'REPASO'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-white/80 truncate leading-tight" title={s.topicTitle}>{s.topicTitle}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10 text-center">
                            <p className="text-xs text-white/30">
                                El algoritmo ajusta automáticamente estas fechas según tu rendimiento en los tests simulados.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
