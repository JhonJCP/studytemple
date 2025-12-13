"use client";

import { useEffect, useMemo, useState } from "react";
import { Clipboard, ChevronDown, ChevronRight, Brain, Sparkles, Clock } from "lucide-react";

type BrainId = "planner" | "expert-teorico" | "expert-practical" | "expert-tecnico" | "curator" | "strategist";

interface Props {
    topicTitle: string;
    topicId: string;
    date: string;
    groupTitle?: string;
}

const brainLabels: Record<BrainId, string> = {
    planner: "Planner (tiempo, estrategia y objetivos)",
    "expert-teorico": "Experto Teórico (CORE: marco legal)",
    "expert-practical": "Experto Práctico (PRACTICE: supuestos)",
    "expert-tecnico": "Experto Técnico (CORE/SUPP: cálculos y criterios)",
    curator: "Curator (prioriza lo crítico)",
    strategist: "Strategist (síntesis final + widgets)",
};

export function AIFlowPanel({ topicTitle, topicId, date, groupTitle }: Props) {
    const [open, setOpen] = useState<BrainId | null>(null);
    const [planMeta, setPlanMeta] = useState<{ minutes?: number; importance?: string; contentLength?: string } | null>(null);

    const [promptByBrain, setPromptByBrain] = useState<Partial<Record<BrainId, string>>>({});
    const [loadingBrain, setLoadingBrain] = useState<BrainId | null>(null);
    const [errorByBrain, setErrorByBrain] = useState<Partial<Record<BrainId, string>>>({});

    // Cargar datos de plan guardado en localStorage (si existe) para mostrar minutos/importance
    useEffect(() => {
        try {
            const saved = localStorage.getItem("last_ai_plan");
            if (!saved) return;
            const plan = JSON.parse(saved);
            const matches: any[] = [];
            const slug = topicId.toLowerCase();
            (plan.daily_schedule || []).forEach((d: any) => {
                if (d.topicId?.toLowerCase() === slug || d.topicTitle?.toLowerCase()?.includes(topicTitle.toLowerCase())) {
                    matches.push(d);
                }
            });
            const tte = (plan.topic_time_estimates || []).find(
                (t: any) => t.topicId?.toLowerCase() === slug || t.topicTitle?.toLowerCase()?.includes(topicTitle.toLowerCase())
            );
            if (matches.length || tte) {
                setPlanMeta({
                    minutes: matches[0]?.durationMinutes || tte?.totalPlannedMinutes,
                    importance: matches[0]?.importance || tte?.importance || tte?.complexity,
                    contentLength: tte?.recommendedContentLength,
                });
            }
        } catch {
            setPlanMeta(null);
        }
    }, [topicId, topicTitle]);

    const targetWords = useMemo(() => {
        if (planMeta?.contentLength === "extended") return 2600;
        if (planMeta?.contentLength === "concise") return 1400;
        return 2000;
    }, [planMeta?.contentLength]);

    const copyText = (text: string) => {
        navigator.clipboard?.writeText(text);
    };

    const fetchPrompt = async (brain: BrainId) => {
        if (promptByBrain[brain]) return;
        setLoadingBrain(brain);
        setErrorByBrain((prev) => ({ ...prev, [brain]: undefined }));

        try {
            if (brain === "planner") {
                const minutes = planMeta?.minutes || "N/D";
                const importance = planMeta?.importance || "N/D";
                const contentLength = planMeta?.contentLength || "standard";
                setPromptByBrain((prev) => ({
                    ...prev,
                    planner: `Planner (no LLM): usa el planning real para decidir\n- Minutos: ${minutes}\n- Importancia/Complejidad: ${importance}\n- Longitud recomendada: ${contentLength}\n\nSalida esperada: {timeAllocation, strategy, targetWords, targetSections, practiceExamples, criticalLaws, ...}`,
                }));
                return;
            }

            const res = await fetch(
                `/api/prompt-preview?topicId=${encodeURIComponent(topicId)}&agent=${encodeURIComponent(brain)}&targetWords=${encodeURIComponent(
                    String(targetWords)
                )}`
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "No se pudo cargar el prompt.");
            setPromptByBrain((prev) => ({ ...prev, [brain]: data.prompt }));
        } catch (e) {
            setErrorByBrain((prev) => ({ ...prev, [brain]: e instanceof Error ? e.message : "Error desconocido" }));
        } finally {
            setLoadingBrain(null);
        }
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-300" />
                    <span className="text-sm font-bold text-white">Flujo IA (V2)</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-white/60">
                    {planMeta && (
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {planMeta.minutes || "N/D"} min · {planMeta.importance || "N/D"} ·{" "}
                            {planMeta.contentLength || "standard"}
                        </div>
                    )}
                    <span className="text-white/40">Prompts reales (preview)</span>
                </div>
            </div>

            <div className="space-y-2">
                {(Object.keys(brainLabels) as BrainId[]).map((id) => {
                    const isOpen = open === id;
                    return (
                        <div key={id} className="rounded-lg border border-white/5 bg-white/5">
                            <button
                                onClick={() => {
                                    const next = isOpen ? null : id;
                                    setOpen(next);
                                    if (next) fetchPrompt(next);
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 transition"
                            >
                                <div className="flex items-center gap-2">
                                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    <span className="font-semibold">{brainLabels[id]}</span>
                                </div>
                                <Sparkles className="w-4 h-4 text-purple-300" />
                            </button>

                            {isOpen && (
                                <div className="px-3 pb-3">
                                    <div className="bg-black/40 border border-white/10 rounded-lg p-3 text-xs text-white/80 whitespace-pre-wrap">
                                        {loadingBrain === id ? "Cargando prompt..." : promptByBrain[id] || "—"}
                                    </div>
                                    {errorByBrain[id] && <p className="mt-2 text-xs text-red-300">{errorByBrain[id]}</p>}
                                    <div className="flex justify-end mt-2">
                                        <button
                                            onClick={() => copyText(promptByBrain[id] || "")}
                                            disabled={!promptByBrain[id]}
                                            className="text-[10px] px-2 py-1 rounded border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Clipboard className="w-3 h-3" /> Copiar prompt
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

