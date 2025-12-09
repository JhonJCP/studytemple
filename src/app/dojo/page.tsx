"use client";

import { useState } from "react";
import { Swords, Brain, Search, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { FlashcardGame } from "@/components/dojo/FlashcardGame";
import { SourceFinderGame } from "@/components/dojo/SourceFinderGame";

export default function DojoPage() {
    const [activeTab, setActiveTab] = useState<'flashcards' | 'finder'>('flashcards');

    return (
        <div className="min-h-screen bg-background p-8 pb-32">
            {/* Header */}
            <header className="mb-12 text-center relative z-10">
                <div className="inline-flex items-center justify-center p-4 bg-red-500/10 rounded-full mb-6 border border-red-500/20">
                    <Swords className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-5xl font-black text-white tracking-tight mb-4">
                    EL DOJO
                </h1>
                <p className="text-xl text-white/50 max-w-2xl mx-auto">
                    Zona de entrenamiento intensivo. Mejora tu memoria y agilidad mental.
                    <span className="text-red-500/80 block mt-2 text-sm font-bold uppercase tracking-widest">
                        Sin dolor no hay gloria
                    </span>
                </p>
            </header>

            {/* Mode Switcher */}
            <div className="flex justify-center mb-12">
                <div className="bg-white/5 p-1 rounded-full border border-white/10 flex gap-1">
                    <button
                        onClick={() => setActiveTab('flashcards')}
                        className={`px-8 py-3 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'flashcards'
                                ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                                : 'text-white/40 hover:text-white/60'
                            }`}
                    >
                        <Brain className="w-4 h-4" />
                        Flashcards
                    </button>
                    <button
                        onClick={() => setActiveTab('finder')}
                        className={`px-8 py-3 rounded-full text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'finder'
                                ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                                : 'text-white/40 hover:text-white/60'
                            }`}
                    >
                        <Search className="w-4 h-4" />
                        Source Finder
                    </button>
                </div>
            </div>

            {/* Game Area */}
            <div className="max-w-5xl mx-auto">
                {activeTab === 'flashcards' ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <FlashcardGame />
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <SourceFinderGame />
                    </motion.div>
                )}
            </div>
        </div>
    );
}
