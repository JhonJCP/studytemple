"use client";

import {
    MnemonicWidget,
    TimelineWidget,
    AnalogyWidget,
    DiagramWidget,
    VideoWidget
} from "./widgets/index";
import type { WidgetDefinition } from "@/lib/widget-types";
import { motion } from "framer-motion";

// ============================================
// TIPOS
// ============================================

interface WidgetFactoryProps {
    widgets: WidgetDefinition[];
}

// ============================================
// MAPEO DE WIDGETS
// ============================================

const WIDGET_MAP: Record<string, React.ComponentType<{ content: any }>> = {
    mnemonic: MnemonicWidget,
    timeline: TimelineWidget,
    analogy: AnalogyWidget,
    diagram: DiagramWidget,
    video_loop: VideoWidget,
    // Los siguientes serán implementados en la Fase 5:
    // image: ImageWidget,
    // audio: AudioWidget,
    // formula: FormulaWidget,
    // quiz: QuizWidget,
    // alert: AlertWidget,
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function WidgetFactory({ widgets }: WidgetFactoryProps) {
    if (!widgets || widgets.length === 0) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 gap-4">
            {widgets.map((widget, index) => {
                const WidgetComponent = WIDGET_MAP[widget.type];

                if (!WidgetComponent) {
                    // Widget no implementado aún
                    return (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-4 bg-white/5 rounded-xl border border-dashed border-white/20 text-center"
                        >
                            <p className="text-xs text-white/40 font-mono">
                                Widget &quot;{widget.type}&quot; pendiente de implementación
                            </p>
                        </motion.div>
                    );
                }

                return (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <WidgetComponent content={widget.content} />
                    </motion.div>
                );
            })}
        </div>
    );
}
