"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronDown,
    FileText,
    Download,
    Eye,
    FolderOpen,
    Scale,
    HardHat,
    Anchor,
    Droplets,
    Leaf,
    Book,
    Truck
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
    initialOpenTopicId?: string;
}

// Icon mapping logic
const getIconForTitle = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes("bases") || t.includes("oposición")) return Scale;
    if (t.includes("prácticas") || t.includes("herramientas")) return HardHat;
    if (t.includes("carreteras")) return Truck;
    if (t.includes("costas") || t.includes("puertos")) return Anchor;
    if (t.includes("aguas")) return Droplets;
    if (t.includes("ambiente")) return Leaf;
    return Book;
};

export function LibraryStacks({ data, initialOpenTopicId }: WrapperProps) {
    // Find group to open
    const findGroupForTopic = (fileId: string) => {
        return data.groups.find(g => g.topics.some(t => t.originalFilename === fileId))?.title;
    };

    const [openCategory, setOpenCategory] = useState<string | null>(() => {
        if (initialOpenTopicId) {
            const group = findGroupForTopic(initialOpenTopicId);
            if (group) return group;
        }
        return data.groups[0]?.title || null;
    });

    const toggleCategory = (title: string) => {
        setOpenCategory(prev => prev === title ? null : title);
    };

    const handleOpenFile = (filename: string, download = false) => {
        // Construct public URL for Supabase Storage
        // Assuming bucket is 'library_documents' based on prior context/scripts
        const baseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/library_documents/`;
        // Encode only the filename part
        const url = `${baseUrl}${encodeURIComponent(filename)}`;

        if (download) {
            // Forcing download often requires proxy or specific header, but opening in new tab is usually sufficient for PDFs.
            // We can try adding ?download= to Supabase URL if supported, or just open it.
            window.open(url + "?download=", '_blank');
        } else {
            window.open(url, '_blank');
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-4 pb-20">
            {data.groups.map((group, idx) => {
                const isOpen = openCategory === group.title;
                const GroupIcon = getIconForTitle(group.title);

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
                                    <GroupIcon className="w-6 h-6" />
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
                                            {group.topics.map((topic, tIdx) => {
                                                const isHighlighted = initialOpenTopicId === topic.originalFilename;
                                                return (
                                                    <div
                                                        key={tIdx}
                                                        ref={isHighlighted ? (el) => { el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } : null}
                                                        className={cn(
                                                            "group flex items-center justify-between p-3 rounded-lg border transition-all",
                                                            isHighlighted
                                                                ? "bg-purple-500/20 border-purple-500/50 shadow-inner"
                                                                : "border-transparent hover:bg-white/5 hover:border-white/5"
                                                        )}
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
                                                                onClick={(e) => { e.stopPropagation(); handleOpenFile(topic.originalFilename); }}
                                                                className="p-2 rounded-lg bg-white/5 hover:bg-primary hover:text-black text-white/60 transition-colors"
                                                                title="Ver Documento"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleOpenFile(topic.originalFilename, true); }}
                                                                className="p-2 rounded-lg bg-white/5 hover:bg-white/20 text-white/60 transition-colors"
                                                                title="Descargar Original"
                                                            >
                                                                <Download className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}

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
