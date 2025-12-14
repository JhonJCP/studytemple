"use client";

import {
    MnemonicWidget,
    TimelineWidget,
    AnalogyWidget,
    DiagramWidget,
    VideoWidget
} from "./widgets/index";
import { InfografiaWidget } from "./widgets/InfografiaWidget";
import { MnemonicGeneratorWidget } from "./widgets/MnemonicGeneratorWidget";
import { CasePracticeWidget } from "./widgets/CasePracticeWidget";
import { DiagramGeneratorWidget } from "./widgets/DiagramGeneratorWidget";
import { TimelineGeneratorWidget } from "./widgets/TimelineGeneratorWidget";
import { FormulaWidget } from "./widgets/FormulaWidget";
import { QuizWidget } from "./widgets/QuizWidget";
import { QuizGeneratorWidget } from "./widgets/QuizGeneratorWidget";
import type { WidgetDefinition } from "@/lib/widget-types";
import { motion } from "framer-motion";

// ============================================
// TIPOS
// ============================================

interface WidgetFactoryProps {
    widgets: WidgetDefinition[];
    topicId?: string; // Needed for on-demand generation
    widgetIdPrefix?: string; // Stable prefix (e.g. section id)
    recordId?: string; // Persist widgets against the correct DB record
}

// ============================================
// MAPEO DE WIDGETS
// ============================================

const WIDGET_MAP: Record<string, React.ComponentType<{ content: any }>> = {
    // Widgets estáticos (ya existentes)
    mnemonic: MnemonicWidget,
    timeline: TimelineWidget,
    analogy: AnalogyWidget,
    diagram: DiagramWidget,
    video_loop: VideoWidget,
    
    // Nuevos widgets inteligentes (on-demand generation)
    infografia: InfografiaWidget,
    mnemonic_generator: MnemonicGeneratorWidget,
    case_practice: CasePracticeWidget,
    diagram_generator: DiagramGeneratorWidget,
    timeline_generator: TimelineGeneratorWidget,
    quiz_generator: QuizGeneratorWidget,
    formula: FormulaWidget,
    quiz: QuizWidget,
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function WidgetFactory({ widgets, topicId, widgetIdPrefix, recordId }: WidgetFactoryProps) {
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
                            className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center"
                        >
                            <p className="text-xs text-slate-500 font-mono">
                                Widget &quot;{widget.type}&quot; pendiente de implementación
                            </p>
                        </motion.div>
                    );
                }

                // Añadir metadata necesaria para widgets on-demand
                const stableWidgetId = widgetIdPrefix ? `${widgetIdPrefix}:${index}` : `widget_${index}`;
                const widgetContent =
                    typeof widget.content === "object" && widget.content !== null
                        ? {
                              ...(widget.content as any),
                              widgetId: (widget.content as any).widgetId || stableWidgetId,
                              topicId: topicId,
                              recordId: recordId,
                          }
                        : {
                              widgetId: stableWidgetId,
                              topicId: topicId,
                              recordId: recordId,
                          };
                
                return (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <WidgetComponent content={widgetContent} />
                    </motion.div>
                );
            })}
        </div>
    );
}
