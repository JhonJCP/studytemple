"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, BookOpen, Scale, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data for the 15 Supuestos (We will fill this with real data later)
const SUPUESTOS = Array.from({ length: 15 }, (_, i) => ({
    id: `supuesto-${i + 1}`,
    title: `Supuesto Práctico ${i + 1}`,
    description: "Análisis técnico-jurídico sobre infracciones en zona de servidumbre.",
    difficulty: i < 5 ? "Baja" : i < 10 ? "Media" : "Alta",
    type: i % 2 === 0 ? "Informe" : "Propuesta",
    status: "pending" // pending, done
}));

export default function MuseumPage() {
    return (
        <div className="min-h-screen p-8 bg-background">
            <Link href="/practice" className="flex items-center text-white/50 hover:text-white mb-8 transition-colors w-fit">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver al Taller
            </Link>

            <div className="mb-12">
                <h1 className="text-5xl font-black text-amber-500 mb-4">EL MUSEO</h1>
                <p className="text-xl text-white/60">
                    Archivo histórico de los 15 Supuestos Sagrados. Estudia las soluciones oficiales.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {SUPUESTOS.map((supuesto, index) => (
                    <motion.div
                        key={supuesto.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="glass-card p-6 hover:border-amber-500/50 transition-all group cursor-pointer"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={cn(
                                "text-xs font-bold px-2 py-1 rounded uppercase",
                                supuesto.difficulty === "Baja" ? "bg-green-500/20 text-green-400" :
                                    supuesto.difficulty === "Media" ? "bg-yellow-500/20 text-yellow-400" :
                                        "bg-red-500/20 text-red-400"
                            )}>
                                Dificultad {supuesto.difficulty}
                            </div>
                            {supuesto.type === "Informe" ? <BookOpen className="w-5 h-5 text-blue-400" /> : <Scale className="w-5 h-5 text-purple-400" />}
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-500 transition-colors">
                            {supuesto.title}
                        </h3>
                        <p className="text-sm text-white/50 mb-4 line-clamp-2">
                            {supuesto.description}
                        </p>

                        <button className="w-full py-2 bg-white/5 hover:bg-amber-500/20 text-white/70 hover:text-amber-500 rounded font-medium transition-colors flex items-center justify-center gap-2">
                            Estudiar Caso
                            <ArrowLeft className="w-4 h-4 rotate-180" />
                        </button>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
