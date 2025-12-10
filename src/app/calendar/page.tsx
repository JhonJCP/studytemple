"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar as CalendarIcon, Play, BrainCircuit, Timer, FileQuestion, BookOpen, Layers, Info, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { generateSmartSchedule, StudyPlan, ScheduledSession } from "@/lib/planner-brain";
import { CalendarGrid } from "@/components/CalendarGrid";
import { generateDeepPlan, getPlannerPrompt } from "@/app/actions/ai-planner";
import { debugGeminiModels } from "@/app/actions/debug-models";
import { PlannerBrainConsole } from "@/components/PlannerBrainConsole";
import { saveStudyPlan, getLatestStudyPlan } from "@/app/actions/save-plan";

export default function CalendarPage() {
    // State
    const [intensity, setIntensity] = useState<StudyPlan['intensity']>('balanced');
    const [selectedDate, setSelectedDate] = useState(new Date("2025-12-15"));
    const [viewDate, setViewDate] = useState(new Date("2025-12-15"));
    const [activeTimer, setActiveTimer] = useState<string | null>(null);

    // AI State
    const [isConsoleOpen, setIsConsoleOpen] = useState(false);
    const [brainStatus, setBrainStatus] = useState<'idle' | 'thinking' | 'success' | 'error'>('idle');
    const [aiPlan, setAiPlan] = useState<ScheduledSession[] | null>(null); // This is the PREVIEW
    const [masterPlanData, setMasterPlanData] = useState<any>(null); // This is the Data waiting to be saved
    const [diagnostics, setDiagnostics] = useState<{ prompt: string, rawResponse: string, analysis?: string } | undefined>(undefined);

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

    // Load Plan from DB on Mount
    useEffect(() => {
        async function loadPlan() {
            try {
                const res = await getLatestStudyPlan();
                if (res.success && res.plan && res.plan.schedule) {
                    console.log("✅ Loaded plan from DB", res.plan);

                    // Transform dates
                    const loadedSchedule: ScheduledSession[] = (res.plan.schedule as any[]).map(s => ({
                        ...s,
                        date: new Date(s.date)
                    }));

                    setAiPlan(loadedSchedule);

                    // Restore metadata if available
                    if (res.plan.ai_metadata) {
                        setDiagnostics(prev => ({
                            ...(prev || { prompt: "", rawResponse: "" }),
                            analysis: res.plan.ai_metadata.strategic_analysis
                        }));
                    }
                }
            } catch (e) {
                console.error("Failed to load plan", e);
            }
        }
        loadPlan();
    }, []);



    const handleApplyPlan = async () => {
        if (!masterPlanData) return;

        // Save to DB
        const res = await saveStudyPlan(masterPlanData, {
            availability: planConfig.availability,
            goalDate: planConfig.goalDate
        });

        if (res.success) {
            setAiPlan(masterPlanData.daily_schedule);
            // Maybe show toast success?
            setIsConsoleOpen(false);
        } else {
            alert("Error saving plan: " + res.error);
        }
    };

    // Load Prompt on Open
    useEffect(() => {
        if (isConsoleOpen && !diagnostics?.prompt) {
            getPlannerPrompt({
                startDate: "2025-12-15",
                goalDate: "2026-01-15",
                availability: planConfig.availability,
                intensity: intensity
            }).then(prompt => {
                setDiagnostics(prev => ({
                    prompt: prompt,
                    rawResponse: prev?.rawResponse || "",
                    analysis: prev?.analysis
                }));
            });
        }
    }, [isConsoleOpen, planConfig, intensity]); // Dependency array

    const handleBrainExecution = async () => {
        setBrainStatus('thinking');
        // Keep prompt, clear other logs
        setDiagnostics(prev => prev ? { ...prev, rawResponse: "", analysis: undefined } : undefined);

        // Artificial "Feeling" Delay (so user sees the Thinking state)
        await new Promise(r => setTimeout(r, 800));

        // Call Server Action
        const result = await generateDeepPlan({
            startDate: "2025-12-15",
            goalDate: "2026-01-15",
            availability: planConfig.availability,
            intensity: intensity
        }, diagnostics?.prompt);

        if (result.success && result.schedule) {
            // Transform raw JSON (strings) to Typed Objects (Dates)
            const parsedSchedule: ScheduledSession[] = result.schedule.map((s: any, i: number) => ({
                ...s,
                id: `ai-session-${i}-${s.topicId}`,
                date: new Date(s.date), // Convert 'YYYY-MM-DD' to Date object
                status: 'pending',
                breaks: s.breaks || "Standard"
            }));

            setAiPlan(parsedSchedule); // Show preview
            setMasterPlanData(result.masterPlan); // Store for saving
            setDiagnostics(result.diagnostics);
            setBrainStatus('success');
        } else {
            console.error("Brain Error", result);

            // Run Diagnostics: Why did it fail? (Model 404?)
            const debug = await debugGeminiModels();
            const failureReason = `
ERROR: ${result.error}
RAW RESPONSE: ${result.diagnostics?.rawResponse}

--- DEBUG: AVAILABLE MODELS(API KEY CHECK)-- -
    ${debug.success ? debug.models.join('\n') : 'Could not list models: ' + debug.error}
`.trim();

            setDiagnostics({
                prompt: result.diagnostics?.prompt || "No prompt generated.",
                rawResponse: failureReason
            });
            setBrainStatus('error');
        }
    };

    const handlePromptChange = (newPrompt: string) => {
        setDiagnostics(prev => prev ? { ...prev, prompt: newPrompt } : { prompt: newPrompt, rawResponse: "" });
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
            <PlannerBrainConsole
                isOpen={isConsoleOpen}
                onClose={() => setIsConsoleOpen(false)}
                status={brainStatus}
                diagnostics={diagnostics}
                onActivate={handleBrainExecution}
                onSave={handleApplyPlan}
                onPromptChange={handlePromptChange}
            />

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
                    onClick={() => { setIsConsoleOpen(true); setBrainStatus('idle'); }}
                    className={cn(
                        "group relative px-6 py-3 rounded-xl font-bold flex items-center gap-3 overflow-hidden transition-all",
                        "bg-gradient-to-r from-purple-600 to-blue-600 hover:scale-105 shadow-lg shadow-purple-500/20 text-white"
                    )}
                >
                    <BrainCircuit className="w-5 h-5 fill-current" />
                    ACTIVAR CEREBRO CORTEZ

                    {/* Glow Effect */}
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
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
                                                    {(session as any).startTime && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                                            Inicio: {(session as any).startTime}
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
