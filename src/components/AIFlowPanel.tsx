"use client";

import { useState } from "react";
import { Clipboard, ChevronDown, ChevronRight, Brain, Sparkles } from "lucide-react";
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

    const prompts: Record<BrainId, string> = {
        bibliotecario: `
Eres el Bibliotecario. Devuelve citas y fragmentos relevantes del temario para:
- Tema: "${topicTitle}" (${groupTitle || "Grupo"})
- ID: ${topicId}
- Sesión: ${date}

Instrucciones:
- Busca en embeddings (library_documents, knowledge_chunks).
- Devuelve lista: [{source_id, filename, fragment, law_refs, confidence}].
- No generes contenido nuevo, solo recupera.
`.trim(),
        auditor: `
Eres el Auditor. Evalúa si las fuentes cubren el outline base del tema:
- Tema: "${topicTitle}"
- Fuentes recuperadas: (usa salida del Bibliotecario)

Instrucciones:
- Señala gaps, incoherencias y riesgos.
- Sugiere 3-5 widgets útiles (mnemonic, diagram, timeline, quiz, alert).
- Asigna quality_score 0-100 y razones.
`.trim(),
        planificador: `
Eres el Planificador. Decide profundidad y tiempo según importancia/complejidad:
- Tema: "${topicTitle}" (grupo: ${groupTitle || "n/a"})
- Minutos disponibles aproximados: usa plan diario si existe, si no 60-120.
- Usa la evaluación del Auditor para ajustar: más detalles donde haya riesgo.

Salida:
- content_length: concise | standard | extended
- widget_budget: número/temas prioritarios
- secciones clave con minutos sugeridos
`.trim(),
        estratega: `
Eres el Estratega. Construye el outline y las instrucciones de redacción:
- Tema: "${topicTitle}"
- Outline base: intro, conceptos, desarrollo, práctica.
- Usa decisiones del Planificador y gaps del Auditor.

Salida:
- outline estructurado con bullet points y foco de examen/supuestos.
- tono: claro, técnico y resumido para opositor.
- lista de widgets a solicitar a mini-agentes con prompts breves.
`.trim(),
        orquestador: `
Orquestador final: combina todo.
- Tema: "${topicTitle}" (${topicId}) fecha ${date}
- Input: bibliotecario (fuentes), auditor (gaps/score), planificador (profundidad/minutos), estratega (outline/widgets).

Genera:
- content_json con secciones (intro, conceptos, desarrollo, práctica) y widgets solicitados.
- Marca status=draft hasta que el usuario confirme.
- No reescribas las fuentes; úsala como evidencia/resumen.
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
                <span className="text-[10px] text-white/40">Revisa prompts antes de generar</span>
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
