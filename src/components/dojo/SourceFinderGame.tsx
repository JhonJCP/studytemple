"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Search, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const SCENARIOS = [
    {
        id: "s1",
        question: "Estás redactando el Pliego de un proyecto de urbanización. Necesitas especificar cómo se mide y abona el movimiento de tierras. ¿A qué norma acudes para fundamentarlo?",
        options: [
            { id: "a", title: "EHE-08 (Instrucción Hormigón)", category: "Estructuras" },
            { id: "b", title: "PG-3 (Pliego General de Carreteras)", category: "Carreteras", correct: true },
            { id: "c", title: "Ley de Aguas", category: "Hidráulica" },
            { id: "d", title: "Código Técnico de la Edificación", category: "Edificación" }
        ],
        explanation: "El PG-3 es la referencia estándar en obra civil para la ejecución y medición de unidades de obra como explanaciones, firmes y pavimentos, aunque sea una norma de carreteras."
    },
    {
        id: "s2",
        question: "Un vecino reclama que la expropiación de su finca por una obra hidráulica urgente no ha seguido el procedimiento. ¿Qué ley regula la 'Declaración de Urgente Ocupación'?",
        options: [
            { id: "a", title: "Ley de Contratos (LCSP)", category: "Administrativo" },
            { id: "b", title: "Ley de Expropiación Forzosa (1954)", category: "Administrativo", correct: true },
            { id: "c", title: "Ley del Suelo", category: "Urbanismo" },
            { id: "d", title: "Constitución Española", category: "General" }
        ],
        explanation: "La LEF de 1954, en su artículo 52, regula el procedimiento especial de urgencia, permitiendo la ocupación antes del justiprecio."
    }
];

export function SourceFinderGame() {
    const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [hasAnswered, setHasAnswered] = useState(false);

    const scenario = SCENARIOS[currentScenarioIndex];

    const handleSelect = (optionId: string) => {
        if (hasAnswered) return;
        setSelectedOption(optionId);
        setHasAnswered(true);
    };

    const handleNext = () => {
        if (currentScenarioIndex < SCENARIOS.length - 1) {
            setCurrentScenarioIndex(prev => prev + 1);
            setSelectedOption(null);
            setHasAnswered(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Scenario Card */}
            <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900/50 border border-white/10 rounded-3xl p-8 mb-8 backdrop-blur-sm relative overflow-hidden"
            >
                <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
                <div className="flex items-start gap-6">
                    <div className="p-4 bg-primary/20 rounded-2xl shrink-0">
                        <Search className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white mb-2">Escenario #{currentScenarioIndex + 1}</h3>
                        <p className="text-lg text-white/80 leading-relaxed font-serif italic">
                            &quot;{scenario.question}&quot;
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scenario.options.map((option) => {
                    const isSelected = selectedOption === option.id;
                    const isCorrect = option.correct;
                    const showResult = hasAnswered;

                    let borderClass = "border-white/10 hover:border-white/30";
                    let bgClass = "bg-white/5 hover:bg-white/10";
                    let icon = <FileText className="w-5 h-5 opacity-50" />;

                    if (showResult) {
                        if (isCorrect) {
                            borderClass = "border-green-500 bg-green-500/10";
                            icon = <CheckCircle2 className="w-5 h-5 text-green-500" />;
                        } else if (isSelected) {
                            borderClass = "border-red-500 bg-red-500/10";
                            icon = <XCircle className="w-5 h-5 text-red-500" />;
                        } else {
                            bgClass = "opacity-50 grayscale";
                        }
                    }

                    return (
                        <motion.button
                            key={option.id}
                            onClick={() => handleSelect(option.id)}
                            disabled={hasAnswered}
                            className={cn(
                                "relative p-6 rounded-xl border text-left flex items-start gap-4 transition-all w-full group",
                                borderClass,
                                bgClass
                            )}
                            whileHover={!hasAnswered ? { scale: 1.01 } : {}}
                            whileTap={!hasAnswered ? { scale: 0.99 } : {}}
                        >
                            <div className="mt-1">{icon}</div>
                            <div>
                                <span className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1 block">
                                    {option.category}
                                </span>
                                <span className={cn("font-medium text-white", showResult && isCorrect && "text-green-400")}>
                                    {option.title}
                                </span>
                            </div>
                        </motion.button>
                    );
                })}
            </div>

            {/* Explanation Reveal */}
            {hasAnswered && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-8 bg-black/40 rounded-xl border border-white/5 p-6"
                >
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-1" />
                        <div>
                            <h4 className="font-bold text-primary mb-1">Análisis del Experto</h4>
                            <p className="text-white/70 text-sm leading-relaxed">
                                {scenario.explanation}
                            </p>

                            {currentScenarioIndex < SCENARIOS.length - 1 && (
                                <button
                                    onClick={handleNext}
                                    className="mt-4 px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors"
                                >
                                    Siguiente Escenario &rarr;
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
