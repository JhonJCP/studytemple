"use client";
/* eslint-disable react-hooks/static-components */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronRight,
    FileText,
    BookOpen,
    Lightbulb,
    Code,
    Loader2,
    CheckCircle,
    AlertCircle,
    Brain
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TopicSection, SourceType, SectionLevel } from "@/lib/widget-types";

// ============================================
// TIPOS
// ============================================

interface HierarchicalOutlineProps {
    sections: TopicSection[];
    activeSectionId?: string;
    onSectionClick?: (sectionId: string) => void;
    generatingIds?: string[]; // IDs de secciones siendo generadas
}

// ============================================
// ICONOS POR NIVEL Y TIPO
// ============================================

function getSectionIcon(level: SectionLevel, sourceType: SourceType) {
    if (sourceType === 'augmented') return Brain;

    switch (level) {
        case 'h1': return BookOpen;
        case 'h2': return FileText;
        case 'h3': return Lightbulb;
        default: return FileText;
    }
}

function getSourceBadge(sourceType: SourceType) {
    switch (sourceType) {
        case 'library':
            return { label: 'BOE', color: 'text-blue-400 bg-blue-500/10' };
        case 'augmented':
            return { label: 'IA', color: 'text-purple-400 bg-purple-500/10' };
        case 'mixed':
            return { label: 'MIX', color: 'text-amber-400 bg-amber-500/10' };
    }
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function HierarchicalOutline({
    sections,
    activeSectionId,
    onSectionClick,
    generatingIds = [],
}: HierarchicalOutlineProps) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const expandAll = () => {
        const allIds = new Set<string>();
        const collectIds = (secs: TopicSection[]) => {
            secs.forEach(s => {
                if (s.children?.length) {
                    allIds.add(s.id);
                    collectIds(s.children);
                }
            });
        };
        collectIds(sections);
        setExpandedIds(allIds);
    };

    const collapseAll = () => {
        setExpandedIds(new Set());
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header Controls */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">
                    Estructura
                </h3>
                <div className="flex gap-2 text-[10px] font-medium">
                    <button
                        onClick={expandAll}
                        className="text-white/30 hover:text-white transition-colors"
                    >
                        Expandir
                    </button>
                    <span className="text-white/10">|</span>
                    <button
                        onClick={collapseAll}
                        className="text-white/30 hover:text-white transition-colors"
                    >
                        Colapsar
                    </button>
                </div>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                {sections.map(section => (
                    <SectionNode
                        key={section.id}
                        section={section}
                        depth={0}
                        expandedIds={expandedIds}
                        activeSectionId={activeSectionId}
                        generatingIds={generatingIds}
                        onToggle={toggleExpand}
                        onClick={onSectionClick}
                    />
                ))}
            </div>
        </div>
    );
}

// ============================================
// NODO DE SECCIÓN (RECURSIVO)
// ============================================

interface SectionNodeProps {
    section: TopicSection;
    depth: number;
    expandedIds: Set<string>;
    activeSectionId?: string;
    generatingIds: string[];
    onToggle: (id: string) => void;
    onClick?: (id: string) => void;
}

function SectionNode({
    section,
    depth,
    expandedIds,
    activeSectionId,
    generatingIds,
    onToggle,
    onClick,
}: SectionNodeProps) {
    const hasChildren = section.children && section.children.length > 0;
    const isExpanded = expandedIds.has(section.id);
    const isActive = section.id === activeSectionId;
    const isGenerating = generatingIds.includes(section.id);
    const hasContent = section.content.text.length > 0;

    const Icon = getSectionIcon(section.level, section.sourceType);
    const badge = getSourceBadge(section.sourceType);

    const handleClick = () => {
        if (hasChildren) {
            onToggle(section.id);
        }
        onClick?.(section.id);
    };

    return (
        <div className="select-none">
            {/* Node Row */}
            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={handleClick}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                className={cn(
                    "flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-all group",
                    isActive
                        ? "bg-primary/20 border-l-2 border-primary"
                        : "hover:bg-white/5",
                    !hasContent && !isGenerating && "opacity-50"
                )}
            >
                {/* Expand Arrow */}
                {hasChildren ? (
                    <ChevronRight
                        className={cn(
                            "w-4 h-4 text-white/30 transition-transform shrink-0",
                            isExpanded && "rotate-90"
                        )}
                    />
                ) : (
                    <div className="w-4 h-4 shrink-0" />
                )}

                {/* Icon */}
                <div className={cn(
                    "p-1.5 rounded-md transition-colors shrink-0",
                    isActive ? "bg-primary/30 text-primary" : "bg-white/5 text-white/40 group-hover:text-white/70"
                )}>
                    {isGenerating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : hasContent ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                        <Icon className="w-3.5 h-3.5" />
                    )}
                </div>

                {/* Title */}
                <span className={cn(
                    "text-sm font-medium truncate flex-1 transition-colors",
                    isActive ? "text-white" : "text-white/70 group-hover:text-white"
                )}>
                    {section.title}
                </span>

                {/* Source Badge */}
                <span className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0",
                    badge.color
                )}>
                    {badge.label}
                </span>
            </motion.div>

            {/* Children */}
            <AnimatePresence>
                {hasChildren && isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        {section.children!.map(child => (
                            <SectionNode
                                key={child.id}
                                section={child}
                                depth={depth + 1}
                                expandedIds={expandedIds}
                                activeSectionId={activeSectionId}
                                generatingIds={generatingIds}
                                onToggle={onToggle}
                                onClick={onClick}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
