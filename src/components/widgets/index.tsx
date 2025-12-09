"use client";

import { motion } from "framer-motion";
import { Zap, Clock, Share2, Lightbulb, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// 1. MNEMONIC WIDGET
export function MnemonicWidget({ content }: { content: { rule: string, explanation: string } }) {
    return (
        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl my-4">
            <h4 className="flex items-center gap-2 text-green-400 font-bold text-xs uppercase tracking-wider mb-2">
                <Zap className="w-4 h-4" /> Regla Mnemotécnica
            </h4>
            <div className="text-2xl font-black text-white mb-1 tracking-widest">{content.rule}</div>
            <p className="text-sm text-white/60 italic">{content.explanation}</p>
        </div>
    );
}

// 2. TIMELINE WIDGET
export function TimelineWidget({ content }: { content: { steps: Array<{ time: string, action: string }> } }) {
    return (
        <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl my-4">
            <h4 className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider mb-4">
                <Clock className="w-4 h-4" /> Línea Temporal / Plazos
            </h4>
            <div className="space-y-4">
                {content.steps.map((step, i) => (
                    <div key={i} className="flex gap-4 relative">
                        {/* Line */}
                        {i !== content.steps.length - 1 && (
                            <div className="absolute left-[11px] top-6 bottom-[-16px] w-0.5 bg-purple-500/20" />
                        )}
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 z-10">
                            <div className="w-2 h-2 rounded-full bg-purple-400" />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded w-fit mb-1">
                                {step.time}
                            </div>
                            <div className="text-sm text-white/80">{step.action}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// 3. ANALOGY WIDGET
export function AnalogyWidget({ content }: { content: { story: string } }) {
    return (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl my-4 dashed-border">
            <h4 className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider mb-2">
                <Lightbulb className="w-4 h-4" /> La Analogía del Ingeniero
            </h4>
            <p className="text-white/80 leading-relaxed italic border-l-2 border-amber-500/30 pl-4">
                "{content.story}"
            </p>
        </div>
    )
}

// 4. DIAGRAM PLACEHOLDER WIDGET
export function DiagramWidget({ content }: { content: { structure: string } }) {
    return (
        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl my-4">
            <h4 className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider mb-2">
                <Share2 className="w-4 h-4" /> Estructura Jerárquica
            </h4>
            <div className="bg-black/20 rounded p-4 font-mono text-xs text-blue-200 whitespace-pre-wrap">
                {content.structure}
                {/* Implies we could render Mermaid here later */}
            </div>
            <div className="h-6 flex items-center justify-center text-[10px] text-white/20 mt-2">
                Vista Previa del Diagrama
            </div>
        </div>
    )
}
