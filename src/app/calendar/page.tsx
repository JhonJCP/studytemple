"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewDate, setViewDate] = useState(new Date());
    const [activeTimer, setActiveTimer] = useState<string | null>(null);
    const [isPlanLoading, setIsPlanLoading] = useState(true);
    const [activeSchedule, setActiveSchedule] = useState<ScheduledSession[] | null>(null);
    const [planSource, setPlanSource] = useState<'remote' | 'localStorage' | 'fallback' | 'preview'>('fallback');
    const hasLoadedPlanRef = useRef(false);

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

    useEffect(() => {
        if (planSource === 'fallback') {
            setActiveSchedule(localSchedule);
        }
    }, [localSchedule, planSource]);

    // Active Schedule (Prefer AI if exists)
    const schedule = activeSchedule || [];
    const visibleSchedule = isPlanLoading ? [] : schedule;

    // Filter Missions
    const dailyMissions = visibleSchedule.filter(s => {
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

    const focusDate = (date: Date) => {
        setSelectedDate(date);
        setViewDate(date);
    };

    // Load Plan from DB on Mount (primary) and fallback to localStorage (avoid re-generar tokens)
    useEffect(() => {
        if (hasLoadedPlanRef.current) return;
        hasLoadedPlanRef.current = true;

        let isMounted = true;
        setIsPlanLoading(true);

        async function loadPlan() {
            try {
                const res = await getLatestStudyPlan();
                if (isMounted && res.success && res.plan && res.plan.schedule) {
                    console.log("✅ Loaded plan from DB", res.plan);

                    const loadedSchedule: ScheduledSession[] = (res.plan.schedule as any[]).map(s => ({
                        ...s,
                        date: new Date(s.date)
                    }));

                    setAiPlan(loadedSchedule);
                    setActiveSchedule(loadedSchedule);
                    setPlanSource('remote');
                    setMasterPlanData(res.plan.ai_metadata ? {
                        strategic_analysis: res.plan.ai_metadata?.strategic_analysis,
                        topic_time_estimates: res.plan.ai_metadata?.topic_time_estimates,
                        daily_schedule: loadedSchedule
                    } : null);

                    if (loadedSchedule.length > 0) {
                        const firstDate = loadedSchedule[0].date;
                        focusDate(firstDate);
                        console.log("📅 Calendario posicionado en:", firstDate.toLocaleDateString('es-ES'));
                    }

                    if (res.plan.ai_metadata) {
                        setDiagnostics(prev => ({
                            ...(prev || { prompt: "", rawResponse: "" }),
                            analysis: res.plan.ai_metadata.strategic_analysis
                        }));
                    }
                    setIsPlanLoading(false);
                    return; // DB plan loaded
                }
            } catch (e) {
                console.error("Failed to load plan", e);
            }

            // Fallback: localStorage
            try {
                const saved = localStorage.getItem("last_ai_plan");
                const savedDiag = localStorage.getItem("last_ai_plan_diag");
                if (isMounted && saved) {
                    const plan = JSON.parse(saved);
                    if (plan?.daily_schedule && Array.isArray(plan.daily_schedule)) {
                        const parsedSchedule: ScheduledSession[] = plan.daily_schedule.map((s: any, i: number) => ({
                            ...s,
                            id: s.id || `local-${i}-${s.topicId}`,
                            date: new Date(s.date),
                            status: s.status || 'pending',
                            breaks: s.breaks || "Standard"
                        }));
                        setAiPlan(parsedSchedule);
                        setActiveSchedule(parsedSchedule);
                        setPlanSource('localStorage');
                        setMasterPlanData(plan);
                        const diag = savedDiag ? JSON.parse(savedDiag) : undefined;
                        setDiagnostics(diag);
                        focusDate(parsedSchedule[0]?.date || new Date());
                        console.log("✅ Loaded plan from localStorage");
                        setIsPlanLoading(false);
                        return;
                    }
                }
            } catch {
                // ignore parse errors
            }

            if (!isMounted) return;

            // Último recurso: plan local
            setPlanSource('fallback');
            setActiveSchedule(localSchedule);
            if (localSchedule.length > 0) {
                focusDate(localSchedule[0].date as Date);
            } else {
                focusDate(new Date());
            }
            setIsPlanLoading(false);
        }
        loadPlan();
        return () => { isMounted = false; };
    }, [localSchedule]);



    const handleApplyPlan = async () => {
        if (!masterPlanData) return;

        // Save to study_plans (para el calendario visual)
        const res = await saveStudyPlan(masterPlanData, {
            availability: planConfig.availability,
            goalDate: planConfig.goalDate
        });

        if (res.success) {
            setAiPlan(masterPlanData.daily_schedule);
            setActiveSchedule(masterPlanData.daily_schedule);
            setPlanSource('remote');
            setIsPlanLoading(false);
            if (masterPlanData.daily_schedule?.length) {
                focusDate(new Date(masterPlanData.daily_schedule[0].date));
            }
            setIsConsoleOpen(false);
            
            // IMPORTANTE: También guardar en user_planning para el Global Planner
            try {
                await fetch('/api/planning/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ planning: masterPlanData })
                });
                console.log('✅ Planning también guardado en user_planning para Global Planner');
            } catch (err) {
                console.error('Error saving to user_planning:', err);
            }
            
            // Persist locally
            try {
                localStorage.setItem("last_ai_plan", JSON.stringify(masterPlanData));
                localStorage.setItem("last_ai_plan_diag", JSON.stringify(diagnostics));
            } catch {
                // ignore storage errors
            }
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

    // Helper to parse plans pasted as JSON (either manual tasks format or AI schedule format)
    const parseAndLoadPlan = (planData: any, sourceName: string) => {
        const rawDaily = planData.daily_schedule as any[];

        // If planData already comes with schedule entries (topicTitle, type, etc.), just normalize
        const looksLikeSchedule = rawDaily && rawDaily.length > 0 && rawDaily[0].topicTitle;
        let flatSchedule: ScheduledSession[] = [];

        if (looksLikeSchedule) {
            flatSchedule = rawDaily.map((s: any, i: number) => ({
                ...s,
                id: s.id || `manual-${i}-${s.topicId}`,
                date: new Date(s.date),
                status: s.status || 'pending',
                breaks: s.breaks || "Standard"
            }));
        } else {
            // Manual plan with tasks/time blocks (NotebookLM style)
            rawDaily.forEach((day: any) => {
                const [d, m, y] = day.date.split("-");
                const dayDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));

                (day.tasks || []).forEach((task: any, idx: number) => {
                    const [start, end] = (task.time || "09:00-10:00").split("-");
                    const [sh, sm] = start.split(":").map(Number);
                    const [eh, em] = end.split(":").map(Number);
                    const duration = ((eh * 60) + em) - ((sh * 60) + sm);

                    const slug = (task.activity || "").toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '');

                    flatSchedule.push({
                        id: `manual-${day.date}-${idx}`,
                        date: dayDate,
                        topicTitle: (task.activity || "").substring(0, 100),
                        topicId: slug || `topic-${idx}`,
                        type: day.type?.toLowerCase() === 'practice' ? 'test_practice' :
                            day.type?.toLowerCase() === 'review' ? 'review_flashcards' : 'study',
                        durationMinutes: duration,
                        startTime: start,
                        endTime: end,
                        breaks: task.breaks || "Pomodoro 50/10",
                        aiReasoning: String(task.source_ref || task.activity || ""),
                        complexity: "High",
                        status: 'pending'
                    });
                });
            });
        }

        setAiPlan(flatSchedule);
        setActiveSchedule(flatSchedule);
        setPlanSource('preview');
        setMasterPlanData({
            ...planData,
            daily_schedule: flatSchedule
        });
        setDiagnostics({
            prompt: diagnostics?.prompt || sourceName,
            rawResponse: JSON.stringify(planData, null, 2),
            analysis: planData.strategic_analysis
        });
        setBrainStatus('success');
        setIsPlanLoading(false);

        // Persist locally
        try {
            localStorage.setItem("last_ai_plan", JSON.stringify({ ...planData, daily_schedule: flatSchedule }));
            localStorage.setItem("last_ai_plan_diag", JSON.stringify({ ...diagnostics, analysis: planData.strategic_analysis, rawResponse: JSON.stringify(planData, null, 2) }));
        } catch {
            // ignore
        }

        // AUTO-NAVIGATE to the first date of the plan
        if (flatSchedule.length > 0) {
            const firstDate = flatSchedule[0].date;
            focusDate(firstDate);
            console.log("📅 Calendario posicionado en:", firstDate.toLocaleDateString('es-ES'));
        }
    };

    const handleBrainExecution = async () => {
        setBrainStatus('thinking');

        // CHECK: Is the prompt actually a JSON? (User pasted plan manually)
        const rawPrompt = diagnostics?.prompt || "";
        
        // Clean the text more aggressively
        const cleanedPrompt = rawPrompt
            .replace(/^\uFEFF/, '') // Remove BOM
            .replace(/^[\s\n\r]+/, '') // Remove leading whitespace
            .trim();
        
        // Try to extract JSON from markdown code blocks or raw text
        let jsonText = cleanedPrompt;
        const jsonMatch = cleanedPrompt.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonText = jsonMatch[1].trim();
        } else if (cleanedPrompt.includes('{') && (cleanedPrompt.includes('daily_schedule') || cleanedPrompt.includes('strategic_analysis'))) {
            // Find the first { and last }
            const firstBrace = cleanedPrompt.indexOf('{');
            const lastBrace = cleanedPrompt.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonText = cleanedPrompt.substring(firstBrace, lastBrace + 1);
            }
        }
        
        // Check if it looks like a plan JSON (bypass AI if valid)
        if (jsonText.startsWith("{") && (jsonText.includes("daily_schedule") || jsonText.includes("strategic_analysis"))) {
            try {
                const manualPlan = JSON.parse(jsonText);
                if (manualPlan.daily_schedule && Array.isArray(manualPlan.daily_schedule)) {
                    parseAndLoadPlan(manualPlan, "JSON MANUAL PEGADO EN PROMPT");
                    return; // BYPASS AI
                }
            } catch (e) {
                console.warn("Input looked like JSON but failed to parse:", e);
            }
        }

        // Keep prompt, clear other logs
        setDiagnostics(prev => prev ? { ...prev, rawResponse: "", analysis: undefined } : undefined);

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
            setActiveSchedule(parsedSchedule);
            setPlanSource('preview');
            setIsPlanLoading(false);
            setMasterPlanData(result.masterPlan); // Store for saving
            setDiagnostics(result.diagnostics);
            setBrainStatus('success');
            if (parsedSchedule.length > 0) {
                focusDate(parsedSchedule[0].date);
            }

            // Persist locally to avoid re-generar tokens si la sesión caduca
            try {
                localStorage.setItem("last_ai_plan", JSON.stringify(result.masterPlan));
                localStorage.setItem("last_ai_plan_diag", JSON.stringify(result.diagnostics));
                const prev = JSON.parse(localStorage.getItem("planner_history") || "[]");
                prev.unshift({
                    ts: new Date().toISOString(),
                    analysis: result.diagnostics?.analysis || "",
                    raw: result.diagnostics?.rawResponse || JSON.stringify(result.masterPlan, null, 2)
                });
                localStorage.setItem("planner_history", JSON.stringify(prev.slice(0, 5)));
            } catch {
                // ignore storage errors
            }
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

    // *** Data Import Logic ***
    const handleLoadBlitzkrieg = () => {
        // Dynamic Import to avoid huge bundle initially if not used
        import("@/lib/blitzkrieg-data").then(({ BLITZKRIEG_PLAN }) => {
            console.log("Loading Blitzkrieg", BLITZKRIEG_PLAN);
            parseAndLoadPlan(BLITZKRIEG_PLAN, "PLAN BLITZKRIEG IMPORTADO MANUALMENTE");
            console.log("✅ Blitzkrieg Plan Loaded into Memory. Please Save.");
        });
    };

    // *** Paste from Clipboard ***
    const handlePasteFromClipboard = async () => {
        setBrainStatus('thinking');
        
        // Show immediate feedback
        setDiagnostics(prev => ({
            prompt: prev?.prompt || "",
            rawResponse: "",
            analysis: "⏳ Leyendo portapapeles..."
        }));
        
        try {
            // Request clipboard permission explicitly
            const clipboardText = await navigator.clipboard.readText();
            
            if (!clipboardText || clipboardText.trim().length === 0) {
                throw new Error("El portapapeles está vacío. Copia el JSON del plan primero.");
            }
            
            // Clean the text: remove BOM, trim whitespace
            const cleanedText = clipboardText
                .replace(/^\uFEFF/, '') // Remove BOM
                .replace(/^[\s\n\r]+/, '') // Remove leading whitespace/newlines
                .trim();
            
            // Try to find JSON object in the text (in case there's markdown code blocks)
            let jsonText = cleanedText;
            const jsonMatch = cleanedText.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                jsonText = jsonMatch[1].trim();
            } else if (cleanedText.includes('{')) {
                // Find the first { and last }
                const firstBrace = cleanedText.indexOf('{');
                const lastBrace = cleanedText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    jsonText = cleanedText.substring(firstBrace, lastBrace + 1);
                }
            }

            // Quick validation that it's valid JSON
            const planData = JSON.parse(jsonText);
            
            if (!planData.daily_schedule || !Array.isArray(planData.daily_schedule)) {
                throw new Error("El JSON no contiene 'daily_schedule' válido. Asegúrate de copiar el JSON completo del plan.");
            }

            // Count days and tasks for preview info
            const numDays = planData.daily_schedule.length;
            const numTasks = planData.daily_schedule.reduce((acc: number, day: any) => acc + (day.tasks?.length || 0), 0);
            const firstDate = planData.daily_schedule[0]?.date || "?";
            const lastDate = planData.daily_schedule[numDays - 1]?.date || "?";

            console.log("✅ JSON válido detectado desde portapapeles", planData);
            
            // DON'T process yet - just show the JSON for review
            setBrainStatus('idle');
            setDiagnostics({
                prompt: jsonText,
                rawResponse: "",
                analysis: `✅ JSON PEGADO CORRECTAMENTE\n\n📊 RESUMEN DEL PLAN:\n• Días programados: ${numDays}\n• Tareas totales: ${numTasks}\n• Período: ${firstDate} → ${lastDate}\n• Análisis estratégico: ${planData.strategic_analysis ? "Incluido ✓" : "No incluido"}\n\n---\n\n👀 REVISA el JSON en el panel izquierdo.\n\n▶️ Si es correcto, haz clic en "EJECUTAR ANÁLISIS" para cargar el plan en el calendario.\n\n💾 Después de cargar, haz clic en "GUARDAR PLAN" para guardarlo en memoria.`
            });
            
        } catch (error: any) {
            console.error("Error al pegar desde portapapeles:", error);
            setBrainStatus('error');
            
            // Check for specific clipboard permission error
            let errorMessage = error?.message || String(error);
            if (errorMessage.includes("denied") || errorMessage.includes("permission") || errorMessage.includes("NotAllowed") || errorMessage.includes("focused")) {
                errorMessage = "⚠️ PERMISO DENEGADO\n\nEl navegador bloqueó el acceso al portapapeles.\n\nSOLUCIÓN ALTERNATIVA:\n1. Pega manualmente el JSON en el área de texto de la izquierda (Ctrl+V)\n2. Haz clic en 'Ejecutar Análisis'\n\nO permite el acceso al portapapeles en la configuración del navegador.";
            } else {
                errorMessage = `ERROR AL PROCESAR:\n\n${errorMessage}\n\n---\nAsegúrate de que:\n1. Has copiado el JSON completo del plan\n2. El JSON contiene "daily_schedule" con un array de días\n3. El formato de fechas es "DD-MM-YYYY"`;
            }
            
            // Use 'analysis' field to show error in result panel (not rawResponse)
            setDiagnostics(prev => ({
                prompt: prev?.prompt || "",
                rawResponse: "",
                analysis: errorMessage
            }));
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
                onLoadBlitzkrieg={handleLoadBlitzkrieg}
                onPasteFromClipboard={handlePasteFromClipboard}
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
                        {isPlanLoading ? (
                            <div className="p-12 text-center border border-dashed border-white/10 rounded-xl flex flex-col items-center gap-3">
                                <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
                                <p className="text-white/60">Cargando tu plan guardado...</p>
                            </div>
                        ) : dailyMissions.length === 0 ? (
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

                                            <Link
                                                href={
                                                    session.type.includes('test')
                                                        ? `/practice/simulator?topic=${encodeURIComponent(session.topicId)}`
                                                        : `/study/${formatDate(session.date)}/${encodeURIComponent(session.topicId)}`
                                                }
                                                className="flex-1 md:flex-none"
                                            >
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
                        schedule={visibleSchedule}
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
                                <span className="text-xl font-bold text-green-400">{visibleSchedule.filter(s => s.type === 'study').length}</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 p-3 rounded">
                                <span className="text-xs text-white/50">Tests Simulados</span>
                                <span className="text-xl font-bold text-purple-400">{visibleSchedule.filter(s => s.type === 'test_practice').length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatDate(date: Date | string) {
    const d = typeof date === "string" ? new Date(date) : date;
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
}
