"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronDown,
    FileText,
    Download,
    Eye,
    FolderOpen,
    BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    // Accordion state: which category is open? Default: first one
    const [openCategory, setOpenCategory] = useState<string | null>(data.groups[0]?.title || null);

    const toggleCategory = (title: string) => {
        setOpenCategory(prev => prev === title ? null : title);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-4 pb-20">
            {data.groups.map((group, idx) => {
                const isOpen = openCategory === group.title;

                return (
                    <motion.div
                        key={group.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={cn(
                            "rounded-2xl border transition-all duration-300 overflow-hidden",
                            isOpen
                                ? "bg-black/40 border-primary/50 shadow-2xl shadow-primary/5"
                                : "bg-white/5 border-white/10 hover:bg-white/10"
                        )}
                    >
                        {/* Header / Trigger */}
                        <button
                            onClick={() => toggleCategory(group.title)}
                            className="w-full flex items-center justify-between p-6 text-left"
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "p-3 rounded-xl transition-colors",
                                    isOpen ? "bg-primary text-black" : "bg-white/10 text-white/50"
                                )}>
                                    <FolderOpen className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className={cn("text-xl font-bold", isOpen ? "text-white" : "text-white/80")}>
                                        {group.title}
                                    </h3>
                                    <p className="text-sm text-white/40 mt-1">
                                        {group.description} • {group.topics.length} Archivos
                                    </p>
                                </div>
                            </div>
                            <ChevronDown className={cn(
                                "w-6 h-6 text-white/30 transition-transform duration-300",
                                isOpen && "rotate-180 text-primary"
                            )} />
                        </button>

                        {/* Content / Body */}
                        <AnimatePresence>
                            {isOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="px-6 pb-6 pt-0">
                                        <div className="h-px w-full bg-white/10 mb-4" />

                                        <div className="flex flex-col gap-2">
                                            {group.topics.map((topic, tIdx) => (
                                                <div
                                                    key={tIdx}
                                                    className="group flex items-center justify-between p-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5 transition-all"
                                                >
                                                    <div className="flex items-center gap-4 overflow-hidden">
                                                        <FileText className="w-5 h-5 text-primary/40 group-hover:text-primary min-w-[20px]" />
                                                        <div className="truncate">
                                                            <span className="text-white/80 text-sm font-medium group-hover:text-white transition-colors block truncate">
                                                                {topic.title}
                                                            </span>
                                                            <span className="text-xs text-white/30 truncate block max-w-md">
                                                                {topic.originalFilename}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            className="p-2 rounded-lg bg-white/5 hover:bg-primary hover:text-black text-white/60 transition-colors"
                                                            title="Ver Documento"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            className="p-2 rounded-lg bg-white/5 hover:bg-white/20 text-white/60 transition-colors"
                                                            title="Descargar Original"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            {group.topics.length === 0 && (
                                                <div className="text-center py-8 text-white/20 text-sm italic">
                                                    Esta carpeta está vacía.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                );
            })}
        </div>
    );
}
