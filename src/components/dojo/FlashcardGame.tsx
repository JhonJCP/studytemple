"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCw, Check, X, ChevronRight, ChevronLeft, Layers, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data for MVP
const MOCK_CARDS = [
    {
        id: "1",
        front: "Ley de Carreteras (Estatal)",
        back: "Ley 37/2015, de 29 de septiembre",
        difficulty: "easy"
    },
    {
        id: "2",
        front: "¿Plazo de Garantía mínimo en obras?",
        back: "No podrá ser inferior a 1 año (LCSP)",
        difficulty: "medium"
    },
    {
        id: "3",
        front: "EHE-08",
        back: "Instrucción de Hormigón Estructural (Derogada por Código Estructural)",
        difficulty: "hard"
    },
    {
        id: "4",
        front: "Dominio Público Hidráulico",
        back: "Cauce, lecho, aguas subterráneas y aguas renovables",
        difficulty: "medium"
    },
    {
        id: "5",
        front: "Z.S.P. en Costas (Anchura)",
        back: "100 metros (ampliable a 200m en casos específicos)",
        difficulty: "hard"
    }
];

export function FlashcardGame() {
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [direction, setDirection] = useState(0); // -1 left, 1 right
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });

    const currentCard = MOCK_CARDS[currentCardIndex];

    // Reset state on card change
    useEffect(() => {
        setIsFlipped(false);
    }, [currentCardIndex]);

    const handleNext = () => {
        if (currentCardIndex < MOCK_CARDS.length - 1) {
            setDirection(1);
            setCurrentCardIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentCardIndex > 0) {
            setDirection(-1);
            setCurrentCardIndex(prev => prev - 1);
        }
    };

    const handleRating = (correct: boolean) => {
        setScore(prev => ({
            ...prev,
            [correct ? 'correct' : 'incorrect']: prev[correct ? 'correct' : 'incorrect'] + 1
        }));
        handleNext(); // Auto advance on rate
    };

    return (
        <div className="w-full max-w-2xl mx-auto perspective-1000">
            {/* Progress Bar */}
            <div className="mb-8 flex items-center justify-between text-white/50 text-sm font-mono">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    <span>Card {currentCardIndex + 1} / {MOCK_CARDS.length}</span>
                </div>
                <div className="flex gap-4">
                    <span className="text-green-400">Correct: {score.correct}</span>
                    <span className="text-red-400">Review: {score.incorrect}</span>
                </div>
            </div>

            {/* The 3D Card Area */}
            <div className="relative h-[400px] w-full cursor-pointer group" onClick={() => setIsFlipped(!isFlipped)}>
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={currentCard.id}
                        initial={{ opacity: 0, x: direction * 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction * -50 }}
                        transition={{ duration: 0.3 }}
                        className="w-full h-full relative preserve-3d transition-transform duration-700"
                        style={{
                            transformStyle: "preserve-3d",
                            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
                        }}
                    >
                        {/* FRONT FACE */}
                        <div className="absolute inset-0 backface-hidden">
                            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                                <span className="absolute top-8 left-8 text-xs font-bold text-primary uppercase tracking-widest border border-primary/20 px-2 py-1 rounded">
                                    Pregunta
                                </span>

                                <h3 className="text-3xl md:text-4xl font-black text-white leading-tight relative z-10">
                                    {currentCard.front}
                                </h3>

                                <div className="absolute bottom-8 text-white/30 text-xs flex items-center gap-2 animate-pulse">
                                    <RotateCw className="w-4 h-4" />
                                    Click para voltear
                                </div>
                            </div>
                        </div>

                        {/* BACK FACE */}
                        <div
                            className="absolute inset-0 backface-hidden"
                            style={{ transform: "rotateY(180deg)" }}
                        >
                            <div className="w-full h-full bg-gradient-to-br from-primary/10 to-purple-900/20 border border-primary/20 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden backdrop-blur-md">
                                <span className="absolute top-8 left-8 text-xs font-bold text-white uppercase tracking-widest border border-white/20 px-2 py-1 rounded">
                                    Respuesta
                                </span>

                                <p className="text-2xl font-medium text-white/90 leading-relaxed">
                                    {currentCard.back}
                                </p>

                                {/* Rating Actions (Only visible on back) */}
                                <div className="absolute bottom-8 flex gap-4 w-full px-12 justify-center" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleRating(false)}
                                        className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 p-3 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-105"
                                    >
                                        <X className="w-5 h-5" /> Repasar
                                    </button>
                                    <button
                                        onClick={() => handleRating(true)}
                                        className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 p-3 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-105"
                                    >
                                        <Check className="w-5 h-5" /> Sabida
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Controls */}
            <div className="mt-8 flex items-center justify-center gap-6">
                <button
                    onClick={handlePrev}
                    disabled={currentCardIndex === 0}
                    className="p-4 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronLeft className="w-6 h-6 text-white" />
                </button>

                <div className="h-2 w-32 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${((currentCardIndex + 1) / MOCK_CARDS.length) * 100}%` }}
                    />
                </div>

                <button
                    onClick={handleNext}
                    disabled={currentCardIndex === MOCK_CARDS.length - 1}
                    className="p-4 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronRight className="w-6 h-6 text-white" />
                </button>
            </div>

            <p className="text-center text-white/20 text-xs mt-6">
                Consejo: Usa Espacio para voltear y Flechas para navegar
            </p>
        </div>
    );
}
