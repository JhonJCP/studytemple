"use client";

import { motion } from "framer-motion";
import { Book, Anchor, Droplets, Scale, HardHat, Calendar, BookOpen, Swords, Truck, Leaf } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DEFAULT_SYLLABUS } from "@/lib/default-syllabus";

// Helper to map AI icons to Lucide icons
const getIconForTitle = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("bases") || t.includes("oposición")) return Scale;
    if (t.includes("prácticas") || t.includes("herramientas")) return HardHat;
    if (t.includes("carreteras")) return Truck;
    if (t.includes("costas") || t.includes("puertos")) return Anchor;
    if (t.includes("aguas")) return Droplets;
    if (t.includes("ambiente")) return Leaf;
    return Book; // Default
};

// Helper for card styling
const getStyleForTitle = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("bases")) return { color: "from-amber-500/20 to-amber-900/20", border: "border-amber-500/50" };
    if (t.includes("prácticas")) return { color: "from-purple-500/20 to-purple-900/20", border: "border-purple-500/50" };
    if (t.includes("carreteras")) return { color: "from-orange-500/20 to-orange-900/20", border: "border-orange-500/50" };
    if (t.includes("costas")) return { color: "from-cyan-500/20 to-cyan-900/20", border: "border-cyan-500/50" };
    if (t.includes("aguas")) return { color: "from-blue-500/20 to-blue-900/20", border: "border-blue-500/50" };
    if (t.includes("ambiente")) return { color: "from-green-500/20 to-green-900/20", border: "border-green-500/50" };
    return { color: "from-slate-500/20 to-slate-900/20", border: "border-slate-500/50" };
};

export function StudyMap() {
    // 1. Get Topic Groups (Syllabus)
    const topicCards = DEFAULT_SYLLABUS.groups
        .filter((g: any) => !g.title.toLowerCase().includes("suplementario"))
        .map((g: any, idx: number) => {
            const style = getStyleForTitle(g.title);
            return {
                id: `TEMA-${idx + 1}`,
                title: g.title,
                icon: getIconForTitle(g.title),
                color: style.color,
                border: style.border,
                href: `/syllabus/group/${idx}`, // This needs to be handled by a page. OR generic /library filter
                // For now, let's link to library with a query param or essentially just the library, 
                // OR we can create a dynamic page for the group soon.
                // Linking to Library for now as it's the "Source of Truth".
                isSystem: false
            };
        });

    // 2. Add System Tools
    const systemCards = [
        { id: "LIB", title: "Gran Biblioteca", icon: BookOpen, color: "from-amber-500/20 to-yellow-900/20", border: "border-amber-500/50", href: "/library", isSystem: true },
        { id: "DOJO", title: "El Dojo", icon: Swords, color: "from-red-500/20 to-rose-900/20", border: "border-red-500/50", href: "/dojo", isSystem: true },
        { id: "SRS", title: "El Calendario", icon: Calendar, color: "from-green-500/20 to-green-900/20", border: "border-green-500/50", href: "/calendar", isSystem: true },
    ];

    const allCards = [...topicCards, ...systemCards];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {allCards.map((card, index) => (
                <Link href={card.href} key={card.title}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02, y: -5 }}
                        className={cn(
                            "glass-card p-6 h-48 flex flex-col justify-between cursor-pointer border-t-2 relative overflow-hidden group",
                            card.color,
                            card.border
                        )}
                    >
                        {/* Background Decoration */}
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <card.icon className="w-24 h-24" />
                        </div>

                        <div className="flex justify-between items-start z-10">
                            <div className="p-3 bg-white/5 rounded-full backdrop-blur-sm border border-white/10">
                                <card.icon className="w-8 h-8 text-white/90" />
                            </div>
                            {!card.isSystem && (
                                <span className="text-xs font-bold text-white/30 tracking-widest uppercase bg-black/20 px-2 py-1 rounded">
                                    BLOQUE {index + 1}
                                </span>
                            )}
                        </div>

                        <div className="z-10">
                            <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 leading-tight">
                                {card.title}
                            </h3>
                            {!card.isSystem ? (
                                <div className="mt-2 flex items-center gap-2">
                                    <div className="h-1.5 flex-1 bg-black/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-white/50 w-[0%]" />
                                    </div>
                                    <span className="text-xs text-white/50 font-mono">0%</span>
                                </div>
                            ) : (
                                <p className="text-sm text-white/50 mt-1 font-medium">Herramienta de Sistema</p>
                            )}
                        </div>
                    </motion.div>
                </Link>
            ))}
        </div>
    );
}
