"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Droplets,
    Anchor,
    HardHat,
    Book,
    Scale,
    Wallet,
    ChevronRight,
    FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

// Icon mapping for dynamic AI results
const ICON_MAP: Record<string, any> = {
    "Droplets": Droplets,
    "Anchor": Anchor,
    "HardHat": HardHat,
    "Book": Book,
    "Scale": Scale,
    "Wallet": Wallet,
    "FileText": FileText
};

interface SyllabusGroup {
    title: string;
    icon: string;
    description: string;
    topics: {
        title: string;
        originalFilename: string;
    }[];
}

interface WrapperProps {
    data: { groups: SyllabusGroup[] };
}

export function LibraryStacks({ data }: WrapperProps) {
    const [activeGroup, setActiveGroup] = useState<string | null>(data.groups[0]?.title || null);

    const activeGroupData = data.groups.find(g => g.title === activeGroup);

    return (
        <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-200px)]">
            {/* Left: Stack/Shelf Selector */}
            <div className="w-full lg:w-1/3 xl:w-1/4 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                {data.groups.map((group, idx) => {
                    const Icon = ICON_MAP[group.icon] || FileText;
                    const isActive = activeGroup === group.title;

                    return (
                        <motion.button
                            key={group.title}
                            onClick={() => setActiveGroup(group.title)}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className={cn(
                                "w-full text-left p-6 rounded-2xl border transition-all duration-300 group relative overflow-hidden",
                                isActive
                                    ? "bg-primary/20 border-primary/50 text-white shadow-xl shadow-primary/10"
                                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white/60"
                            )}
                        >
                            <div className="absolute top-0 right-0 p-24 bg-gradient-to-br from-white/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />

                            <div className="relative z-10 flex items-start gap-4">
                                <div className={cn(
                                    "p-3 rounded-xl transition-colors",
                                    isActive ? "bg-primary text-black" : "bg-white/10 text-white/50 group-hover:bg-white/20 group-hover:text-white"
                                )}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className={cn("font-bold text-lg mb-1", isActive ? "text-white" : "text-white/80")}>
                                        {group.title}
                                    </h3>
                                    <p className="text-xs opacity-70 leading-relaxed line-clamp-2">
                                        {group.description}
                                    </p>
                                    <div className="mt-4 flex items-center text-xs font-mono opacity-50">
                                        <Book className="w-3 h-3 mr-2" />
                                        {group.topics.length} Documentos
                                    </div>
                                </div>
                            </div>
                        </motion.button>
                    );
                })}
            </div>

            {/* Right: Book Grid */}
            <div className="flex-1 bg-black/20 rounded-3xl border border-white/5 p-6 md:p-8 overflow-y-auto custom-scrollbar backdrop-blur-sm">
                {activeGroupData ? (
                    <div className="space-y-6">
                        <header className="mb-8">
                            <h2 className="text-3xl font-black text-white mb-2">{activeGroupData.title}</h2>
                            <p className="text-white/40 max-w-2xl">{activeGroupData.description}</p>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {activeGroupData.topics.map((topic, idx) => (
                                <motion.div
                                    key={topic.originalFilename + idx}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/30 p-4 rounded-xl cursor-pointer flex flex-col justify-between h-40 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-black/50"
                                >
                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <FileText className="w-5 h-5 text-primary/50 group-hover:text-primary transition-colors" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/20 border border-white/10 px-2 py-0.5 rounded-full">
                                                PDF
                                            </span>
                                        </div>
                                        <h4 className="font-semibold text-white/90 text-sm leading-snug line-clamp-3 group-hover:text-white transition-colors">
                                            {topic.title}
                                        </h4>
                                    </div>
                                    <div className="flex items-center text-primary text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 text-right justify-end">
                                        Leer <ChevronRight className="w-3 h-3 ml-1" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-white/20">
                        <Book className="w-16 h-16 mb-4 opacity-50" />
                        <p>Selecciona una estantería para verlos libros</p>
                    </div>
                )}
            </div>
        </div>
    );
}
