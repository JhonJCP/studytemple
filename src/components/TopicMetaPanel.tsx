"use client";

import { FileText } from "lucide-react";
import type { GeneratedTopicContent } from "@/lib/widget-types";

interface Props {
    content: GeneratedTopicContent;
}

export function TopicMetaPanel({ content }: Props) {
    const docs = content.metadata.sourceDocuments || [];
    const pm = content.metadata.practiceMetrics;

    return (
        <div className="glass-card p-4 space-y-4">
            <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-white/70 uppercase">Fuentes</h3>
            </div>

            {docs.length > 0 ? (
                <ul className="space-y-2 text-sm text-white/70">
                    {docs.map(doc => (
                        <li key={doc} className="truncate">
                            {doc}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-white/50">Sin documentos fuente disponibles.</p>
            )}

            {pm && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <h4 className="text-xs font-bold text-white/60 uppercase mb-3">Métricas prácticas</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        {pm.practiceReadiness !== undefined && (
                            <div>
                                <div className="text-[10px] text-white/50 uppercase">Readiness</div>
                                <div className="text-lg font-black text-emerald-300">
                                    {(pm.practiceReadiness * 100).toFixed(0)}%
                                </div>
                            </div>
                        )}
                        {pm.formulasIncluded !== undefined && (
                            <div>
                                <div className="text-[10px] text-white/50 uppercase">Fórmulas</div>
                                <div className="text-lg font-black text-white">{pm.formulasIncluded}</div>
                            </div>
                        )}
                        {pm.appearsInSupuestos && pm.appearsInSupuestos.length > 0 && (
                            <div className="col-span-2">
                                <div className="text-[10px] text-white/50 uppercase">Aparece en</div>
                                <div className="text-sm text-white/80">
                                    {pm.appearsInSupuestos.length} supuestos
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

