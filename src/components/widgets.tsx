"use client";

import { motion } from "framer-motion";
import { Zap, Clock, Brain, Variable, Image as ImageIcon, PlayCircle, Repeat } from "lucide-react";
import { useEffect, useState } from "react";
// We will dynamically import mermaid only on client side to avoid SSR issues if complex
import mermaid from "mermaid";

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'Inter',
});


// ------------------------------------------------------------------
// WIDGET 1: MNEMONIC (Flashcard style)
// ------------------------------------------------------------------
export function MnemonicWidget({ content }: { content: { rule: string, explanation: string } }) {
    return (
        <div className="bg-gradient-to-br from-green-500/10 to-transparent rounded-2xl p-6 border border-green-500/20 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-50">
                <Zap className="w-12 h-12 text-green-500/20" />
            </div>

            <h4 className="text-xs font-black uppercase tracking-widest text-green-400 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4" /> Regla Mnemotécnica
            </h4>

            <div className="text-center py-6">
                <div className="text-5xl font-black text-white tracking-tighter mb-4 drop-shadow-2xl">
                    {content.rule}
                </div>
                <div className="text-lg text-green-100 font-medium">
                    {content.explanation.split(',').map((part, i) => (
                        <span key={i} className="block border-b border-green-500/10 py-1 last:border-0">
                            {part.trim()}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ------------------------------------------------------------------
// WIDGET 2: TIMELINE (Horizontal Scroll)
// ------------------------------------------------------------------
export function TimelineWidget({ content }: { content: { steps: { time: string, action: string }[] } }) {
    return (
        <div className="bg-gradient-to-br from-blue-500/10 to-transparent rounded-2xl p-6 border border-blue-500/20 backdrop-blur-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-6 flex items-center gap-2">
                <Clock className="w-4 h-4" /> Línea Temporal
            </h4>

            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
                {content.steps.map((step, idx) => (
                    <div key={idx} className="flex-none w-48 snap-center relative">
                        <div className="w-full h-1 bg-blue-500/20 absolute top-3 left-0 rounded-full" />
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="w-6 h-6 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] border-4 border-black mb-3 shrink-0" />
                            <span className="text-xs font-bold text-blue-300 bg-blue-900/40 px-2 py-1 rounded mb-2 block w-full">
                                {step.time}
                            </span>
                            <p className="text-sm text-white/80 leading-snug">
                                {step.action}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ------------------------------------------------------------------
// WIDGET 3: ANALOGY (Story Card)
// ------------------------------------------------------------------
export function AnalogyWidget({ content }: { content: { story: string } }) {
    return (
        <div className="bg-gradient-to-br from-amber-500/10 to-transparent rounded-2xl p-6 border border-amber-500/20 backdrop-blur-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-4 flex items-center gap-2">
                <Brain className="w-4 h-4" /> Analogía Ingenieril
            </h4>
            <div className="flex gap-4 items-start">
                <div className="text-4xl">🏗️</div>
                <p className="text-lg text-white/90 italic font-serif leading-relaxed">
                    &quot;{content.story}&quot;
                </p>
            </div>
        </div>
    );
}

// ------------------------------------------------------------------
// WIDGET 4: DIAGRAM (Mermaid)
// ------------------------------------------------------------------
export function DiagramWidget({ content }: { content: { structure: string } }) {
    const [svg, setSvg] = useState<string>("");

    useEffect(() => {
        const render = async () => {
            try {
                // Wrap in unique ID to avoid conflicts
                // Simple Graph LR format injection if not provided
                const code = content.structure.startsWith("graph") || content.structure.startsWith("sequenceDiagram")
                    ? content.structure
                    : `graph LR\n${content.structure}`;

                const { svg } = await mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, code);
                setSvg(svg);
            } catch (e) {
                console.error("Mermaid Render Fail", e);
                setSvg(""); // Fallback or error msg
            }
        };
        render();
    }, [content.structure]);

    return (
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
            <h4 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
                <Variable className="w-4 h-4" /> Estructura Lógica
            </h4>

            <div className="w-full overflow-x-auto flex justify-center py-4 bg-black/20 rounded-xl">
                {svg ? (
                    <div dangerouslySetInnerHTML={{ __html: svg }} className="mermaid-svg opacity-90 hover:opacity-100 transition-opacity" />
                ) : (
                    <div className="animate-pulse flex gap-2 text-xs text-white/20">Generando Gráfico...</div>
                )}
            </div>
        </div>
    );
}

// ------------------------------------------------------------------
// WIDGET 5: VIDEO / VISUAL LOOP (New!)
// ------------------------------------------------------------------
export function VideoWidget({ content }: { content: { concept: string, visual_prompt: string } }) {
    return (
        <div className="bg-black rounded-2xl p-1 border border-white/10 overflow-hidden relative group aspect-video flex items-center justify-center">
            {/* Placeholder for actual generated video/GIF */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 z-10" />

            <div className="text-center z-20 p-6 relative">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform cursor-pointer border border-white/20">
                    <PlayCircle className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-lg font-bold text-white mb-1">{content.concept}</h4>
                <p className="text-xs text-white/50">{content.visual_prompt}</p>
                <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2 py-1 rounded">
                    <Repeat className="w-3 h-3" /> Visual Loop
                </div>
            </div>

            {/* Simulated background effect */}
            <div className="absolute inset-0 bg-[url('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjEx.../giphy.gif')] bg-cover opacity-20 group-hover:opacity-40 transition-opacity" />
        </div>
    )
}
