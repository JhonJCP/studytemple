"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, CheckCircle, XCircle } from "lucide-react";

interface QuizWidgetProps {
    content: {
        questions: Array<{
            question: string;
            options: string[];
            correctIndex: number;
        }>;
    };
}

export function QuizWidget({ content }: QuizWidgetProps) {
    const [answers, setAnswers] = useState<(number | null)[]>(
        content.questions.map(() => null)
    );
    const [showResults, setShowResults] = useState(false);
    
    const handleAnswer = (qIdx: number, optIdx: number) => {
        const newAnswers = [...answers];
        newAnswers[qIdx] = optIdx;
        setAnswers(newAnswers);
    };
    
    const correctCount = answers.filter((a, i) => 
        a === content.questions[i].correctIndex
    ).length;
    
    const allAnswered = answers.every(a => a !== null);
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-purple-500/10 to-transparent rounded-2xl p-6 border border-purple-500/20 backdrop-blur-sm"
        >
            <h4 className="text-xs font-black uppercase tracking-widest text-purple-700 mb-4 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" /> Test Rápido
            </h4>
            
            <div className="space-y-6">
                {content.questions.map((q, qIdx) => (
                    <div key={qIdx} className="space-y-3">
                        <p className="text-slate-900 font-semibold flex items-start gap-2">
                            <span className="text-purple-700 font-bold">{qIdx + 1}.</span>
                            <span>{q.question}</span>
                        </p>
                        <div className="space-y-2 pl-6">
                            {q.options.map((opt, optIdx) => {
                                const isSelected = answers[qIdx] === optIdx;
                                const isCorrect = optIdx === q.correctIndex;
                                const showCorrectness = showResults && isSelected;
                                
                                return (
                                    <button
                                        key={optIdx}
                                        onClick={() => !showResults && handleAnswer(qIdx, optIdx)}
                                        disabled={showResults}
                                        className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-2 ${
                                            showCorrectness
                                                ? isCorrect
                                                    ? 'bg-green-500/20 border-green-500'
                                                    : 'bg-red-500/20 border-red-500'
                                                : isSelected
                                                    ? 'bg-purple-500/20 border-purple-500'
                                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                        } ${showResults ? 'cursor-default' : 'cursor-pointer'}`}
                                    >
                                        {showResults && isSelected && (
                                            isCorrect 
                                                ? <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                                                : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                                        )}
                                        <span className={`flex-1 ${isSelected ? 'font-semibold' : ''}`}>
                                            {opt}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
            
            <AnimatePresence>
                {!showResults ? (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowResults(true)}
                        disabled={!allAnswered}
                        className={`mt-6 w-full py-3 font-bold rounded-xl transition-all ${
                            allAnswered
                                ? 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer'
                                : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        {allAnswered ? 'Comprobar Respuestas' : 'Responde todas las preguntas'}
                    </motion.button>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 p-4 bg-purple-50 rounded-xl border border-purple-200"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Resultado</p>
                                <p className="text-2xl font-bold text-slate-900">
                                    {correctCount} / {content.questions.length}
                                </p>
                            </div>
                            <div className={`text-5xl ${
                                correctCount === content.questions.length 
                                    ? 'text-green-400' 
                                    : correctCount >= content.questions.length * 0.7
                                        ? 'text-yellow-400'
                                        : 'text-orange-400'
                            }`}>
                                {correctCount === content.questions.length ? '🎉' : correctCount >= content.questions.length * 0.7 ? '👍' : '📚'}
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setAnswers(content.questions.map(() => null));
                                setShowResults(false);
                            }}
                            className="mt-4 w-full py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 text-sm font-bold rounded-lg transition-colors"
                        >
                            Reintentar
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
