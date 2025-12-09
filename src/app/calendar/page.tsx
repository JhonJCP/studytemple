"use client";

import Link from "next/link";
import { ArrowLeft, Calendar as CalendarIcon, CheckCircle, Clock, Flame, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// MOCK DATA for Demonstration
const REVIEWS_TODAY = [
    { id: "a1", title: "Ley de Carreteras de Canarias", zone: "A", due: "Hoy" },
    { id: "b1", title: "Ley de Aguas (Texto Refundido)", zone: "B", due: "Hoy" },
    { id: "f1", title: "El Informe Administrativo", zone: "F", due: "Atrasado 1 día" }
];

const UPCOMING_REVIEWS = [
    { date: "Mañana", count: 5 },
    { date: "12 Dic", count: 2 },
    { date: "13 Dic", count: 8 },
];

export default function CalendarPage() {
    return (
        <div className="min-h-screen p-8 bg-background flex flex-col">
            <Link href="/dashboard" className="flex items-center text-white/50 hover:text-white mb-8 transition-colors w-fit">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver al Templo
            </Link>

            <div className="flex items-center justify-between mb-12">
                <div>
                    <h1 className="text-5xl font-black text-green-400 mb-2">EL CALENDARIO</h1>
                    <p className="text-xl text-white/60">
                        Sistema de Repaso Espaciado (SRS)
                    </p>
                </div>
                <div className="flex items-center gap-6 bg-white/5 p-4 rounded-2xl border border-white/10">
                    <div className="text-center px-4 border-r border-white/10">
                        <div className="text-3xl font-bold text-white">12</div>
                        <div className="text-xs text-white/40 uppercase">Racha Días</div>
                    </div>
                    <div className="text-center px-4">
                        <div className="text-3xl font-bold text-amber-500">85%</div>
                        <div className="text-xs text-white/40 uppercase">Retención</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
                {/* LEFT: Today's Missions */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Flame className="text-orange-500" /> Misiones de Hoy
                        </h2>
                        <button className="px-6 py-2 bg-green-500 text-black font-bold rounded-lg hover:scale-105 transition-transform flex items-center gap-2">
                            <Play className="w-4 h-4 fill-current" />
                            Comenzar Sesión (3)
                        </button>
                    </div>

                    <div className="grid gap-4">
                        {REVIEWS_TODAY.map((review, i) => (
                            <motion.div
                                key={review.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="glass-card p-6 flex items-center justify-between group border-l-4 border-l-green-500"
                            >
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/10 text-white/60">
                                            ZONA {review.zone}
                                        </span>
                                        <span className="text-xs font-bold text-red-400">{review.due}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-white group-hover:text-green-400 transition-colors">
                                        {review.title}
                                    </h3>
                                </div>
                                <Link href={`/syllabus/topic/${review.id}`}>
                                    <button className="px-4 py-2 border border-white/10 rounded hover:bg-white/10 text-white transition-colors">
                                        Repasar
                                    </button>
                                </Link>
                            </motion.div>
                        ))}
                    </div>

                    {/* Placeholder for "Done" state */}
                    {REVIEWS_TODAY.length === 0 && (
                        <div className="p-12 text-center border border-dashed border-white/10 rounded-xl">
                            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <h3 className="text-2xl font-bold text-white">¡Todo listo por hoy!</h3>
                            <p className="text-white/50">Has completado todas tus tarjetas de repaso.</p>
                        </div>
                    )}
                </div>

                {/* RIGHT: Forecast */}
                <div className="space-y-8">
                    <div className="glass-card p-6">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-purple-400" /> Próximos Días
                        </h3>
                        <div className="space-y-4">
                            {UPCOMING_REVIEWS.map((day) => (
                                <div key={day.date} className="flex items-center justify-between p-3 rounded hover:bg-white/5 transition-colors">
                                    <span className="text-white/70">{day.date}</span>
                                    <span className="text-sm font-bold px-3 py-1 bg-white/10 rounded-full text-white">
                                        {day.count} repaso{day.count !== 1 && 's'}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <h4 className="text-sm font-bold text-white/50 mb-3 uppercase tracking-wider">Carga de Trabajo</h4>
                            {/* Simple Bar Chart Visual */}
                            <div className="flex items-end gap-2 h-24">
                                <div className="w-1/5 bg-green-500/20 h-full relative group">
                                    <div className="absolute bottom-0 w-full bg-green-500 h-[60%] rounded-t group-hover:bg-green-400 transition-colors"></div>
                                </div>
                                <div className="w-1/5 bg-green-500/20 h-full relative group">
                                    <div className="absolute bottom-0 w-full bg-green-500 h-[40%] rounded-t group-hover:bg-green-400 transition-colors"></div>
                                </div>
                                <div className="w-1/5 bg-green-500/20 h-full relative group">
                                    <div className="absolute bottom-0 w-full bg-green-500 h-[80%] rounded-t group-hover:bg-green-400 transition-colors"></div>
                                </div>
                                <div className="w-1/5 bg-green-500/20 h-full relative group">
                                    <div className="absolute bottom-0 w-full bg-green-500 h-[20%] rounded-t group-hover:bg-green-400 transition-colors"></div>
                                </div>
                                <div className="w-1/5 bg-green-500/20 h-full relative group">
                                    <div className="absolute bottom-0 w-full bg-green-500 h-[50%] rounded-t group-hover:bg-green-400 transition-colors"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
