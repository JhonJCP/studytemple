"use client";

import { useEffect, useState } from "react";
import { Clipboard, ChevronDown, ChevronRight, Brain, Sparkles, Clock, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type BrainId = "bibliotecario" | "auditor" | "planificador" | "estratega" | "orquestador";

interface Props {
    topicTitle: string;
    topicId: string;
    date: string;
    groupTitle?: string;
}

const brainLabels: Record<BrainId, string> = {
    bibliotecario: "Bibliotecario (fuentes y embeddings)",
    auditor: "Auditor (cobertura y gaps)",
    planificador: "Planificador (estrategia tiempo/widgets)",
    estratega: "Estratega (outline y tono)",
    orquestador: "Orquestador final (prompt unificado)",
};

export function AIFlowPanel({ topicTitle, topicId, date, groupTitle }: Props) {
    const [open, setOpen] = useState<BrainId | null>(null);
    const [planMeta, setPlanMeta] = useState<{ minutes?: number; importance?: string; contentLength?: string } | null>(null);

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
            const tte = (plan.topic_time_estimates || []).find((t: any) =>
                t.topicId?.toLowerCase() === slug || t.topicTitle?.toLowerCase()?.includes(topicTitle.toLowerCase())
            );
            if (matches.length || tte) {
                setPlanMeta({
                    minutes: matches[0]?.durationMinutes || tte?.totalPlannedMinutes,
                    importance: matches[0]?.importance || tte?.importance || tte?.complexity,
                    contentLength: tte?.recommendedContentLength
                });
            }
        } catch {
            setPlanMeta(null);
        }
    }, [topicId, topicTitle]);

    const prompts: Record<BrainId, string> = {
        bibliotecario: `
Eres el Bibliotecario. Recupera evidencia exacta para el tema:
- Tema: "${topicTitle}" (grupo: ${groupTitle || "Grupo"})
- ID/slug: ${topicId}
- Sesión: ${date}

Instrucciones:
- Busca en embeddings (library_documents, knowledge_chunks) top 8-12 matches.
- Devuelve JSON: [{source_id, filename, fragment (<=400 chars), law_refs, confidence 0-1, page?}]
- No inventes texto, no extrapoles. Usa fragmentos literales.
`.trim(),
        auditor: `
Eres el Auditor. Evalúa cobertura y riesgos vs outline base del tema:
- Tema: "${topicTitle}"
- Fuentes: salida del Bibliotecario.

Instrucciones:
- Lista gaps específicos por sección (intro/conceptos/desarrollo/práctica).
- Calidad: quality_score 0-100 con 3 razones.
- Widgets propuestos (3-5): tipo (mnemonic/diagram/timeline/quiz/alert) + por qué + qué debe contener.
- Señala incoherencias o duplicados.
Salida en JSON con gaps, widgets, quality_score.
`.trim(),
        planificador: `
Eres el Planificador. Ajusta profundidad y minutos usando el plan diario si existe:
- Tema: "${topicTitle}" (grupo: ${groupTitle || "n/a"})
- Minutos: ${planMeta?.minutes || "60-120 estimados"}
- Importancia/Complejidad: ${planMeta?.importance || "media"}
- content_length sugerido: ${planMeta?.contentLength || "standard"}

Instrucciones:
- Asigna minutos por sección (intro/conceptos/desarrollo/práctica) que sumen el total.
- Define widget_budget y prioridades (riesgos del Auditor primero).
- Fija tono: concise | standard | extended según importancia/minutos.
Salida JSON: { minutes_total, minutes_por_seccion, content_length, widget_budget, rationale }.
`.trim(),
        estratega: `
Eres el Estratega. Genera outline y micro-prompts de widgets:
- Tema: "${topicTitle}"
- Usa presupuesto del Planificador y gaps del Auditor.

Salida:
- outline estructurado (bullets) con foco en examen/supuestos.
- Por sección: objetivo, puntos clave, evidencias a citar (fuentes del Bibliotecario).
- widgets: [{type, prompt, objetivo, seccion}] listos para disparar manualmente.
`.trim(),
        orquestador: `
Orquestador final (solo tras confirmación del usuario):
- Tema: "${topicTitle}" (${topicId}) fecha ${date}
- Inputs: bibliotecario (fuentes), auditor (gaps/score/widgets), planificador (minutos/tono/widget_budget), estratega (outline + micro-prompts).

Genera:
- content_json con secciones (intro, conceptos, desarrollo, práctica) respetando minutos/tono.
- Inserta placeholders de widgets según el estratega (no generes todos automáticamente si se pide manual).
- Status=draft hasta confirmación; no reescribas fuentes, resume con citas.
`.trim(),
    };

    const copyText = (text: string) => {
        navigator.clipboard?.writeText(text);
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-300" />
                    <span className="text-sm font-bold text-white">Flujo IA (pre-flight)</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-white/60">
                    {planMeta && (
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {planMeta.minutes || "N/D"} min · {planMeta.importance || "N/D"} · {planMeta.contentLength || "standard"}
                        </div>
                    )}
                    <span className="text-white/40">Revisa prompts antes de generar</span>
                </div>
            </div>

            <div className="space-y-2">
                {(Object.keys(brainLabels) as BrainId[]).map((id) => {
                    const isOpen = open === id;
                    return (
                        <div key={id} className="rounded-lg border border-white/5 bg-white/5">
                            <button
                                onClick={() => setOpen(isOpen ? null : id)}
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
                                        {prompts[id]}
                                    </div>
                                    <div className="flex justify-end mt-2">
                                        <button
                                            onClick={() => copyText(prompts[id])}
                                            className="text-[10px] px-2 py-1 rounded border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition flex items-center gap-1"
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
