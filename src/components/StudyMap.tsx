"use client";

import { motion } from "framer-motion";
import { Book, Anchor, Droplets, Wallet, Scale, HardHat, Calendar } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const ZONES = [
    { id: "A", title: "Carreteras", icon: HardHat, color: "from-orange-500/20 to-orange-900/20", border: "border-orange-500/50", href: "/syllabus/zone-a" },
    { id: "B", title: "Aguas", icon: Droplets, color: "from-blue-500/20 to-blue-900/20", border: "border-blue-500/50", href: "/syllabus/zone-b" },
    { id: "C", title: "Costas", icon: Anchor, color: "from-cyan-500/20 to-cyan-900/20", border: "border-cyan-500/50", href: "/syllabus/zone-c" },
    { id: "D", title: "Medio Ambiente", icon: Book, color: "from-green-500/20 to-green-900/20", border: "border-green-500/50", href: "/syllabus/zone-d" },
    { id: "E", title: "Administrativo", icon: Scale, color: "from-slate-500/20 to-slate-900/20", border: "border-slate-500/50", href: "/syllabus/zone-e" },
    { id: "F", title: "Taller Práctico", icon: Wallet, color: "from-purple-500/20 to-purple-900/20", border: "border-purple-500/50", href: "/practice" },
    { id: "SRS", title: "El Calendario", icon: Calendar, color: "from-green-500/20 to-green-900/20", border: "border-green-500/50", href: "/calendar" },
];

export function StudyMap() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {ZONES.map((zone, index) => (
                <Link href={zone.href} key={zone.id}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02, y: -5 }}
                        className={cn(
                            "glass-card p-6 h-48 flex flex-col justify-between cursor-pointer border-t-2",
                            zone.color,
                            zone.border
                        )}
                    >
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-white/5 rounded-full backdrop-blur-sm">
                                <zone.icon className="w-8 h-8 text-white/80" />
                            </div>
                            <span className="text-4xl font-black text-white/5 opacity-50">{zone.id}</span>
                        </div>

                        <div>
                            <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                                {zone.title}
                            </h3>
                            <p className="text-sm text-white/50 mt-1">
                                Dominio: 0%
                            </p>
                        </div>

                        <div className="w-full bg-white/10 h-1 mt-4 rounded-full overflow-hidden">
                            <div className="h-full bg-current w-[0%] transition-all duration-1000" />
                        </div>
                    </motion.div>
                </Link>
            ))}
        </div>
    );
}
