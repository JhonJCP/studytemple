"use client";

import { motion } from "framer-motion";
import { Variable } from "lucide-react";
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';

interface FormulaWidgetProps {
    content: {
        latex: string;
        variables?: Array<{ symbol: string; description: string }>;
    };
}

export function FormulaWidget({ content }: FormulaWidgetProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-cyan-500/10 to-transparent rounded-2xl p-6 border border-cyan-500/20 backdrop-blur-sm"
        >
            <h4 className="text-xs font-black uppercase tracking-widest text-cyan-400 mb-4 flex items-center gap-2">
                <Variable className="w-4 h-4" /> Fórmula Clave
            </h4>
            
            {/* Fórmula LaTeX */}
            <div className="bg-black/40 p-6 rounded-xl mb-4 overflow-x-auto">
                <BlockMath math={content.latex} />
            </div>
            
            {/* Variables */}
            {content.variables && content.variables.length > 0 && (
                <div className="space-y-2">
                    <h5 className="text-xs font-bold text-cyan-400 mb-2 uppercase">
                        Variables
                    </h5>
                    {content.variables.map((v, i) => (
                        <div key={i} className="flex gap-3 items-start text-sm">
                            <span className="text-cyan-300 font-mono font-bold min-w-[2rem]">
                                {v.symbol}
                            </span>
                            <span className="text-white/60">
                                {v.description}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}

