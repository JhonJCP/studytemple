/**
 * SOURCE REFERENCE - Componente de referencia interactiva
 * 
 * Muestra tooltips con el texto original del documento cuando el usuario
 * hace hover sobre una referencia legal (Art. X, etc.)
 */

"use client";

import { useState } from "react";
import { FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SourceInfo {
    document: string;
    article?: string;
    page?: number;
    originalText: string;
    chunkId?: string;
}

interface SourceReferenceProps {
    text: string;
    source: SourceInfo;
    inline?: boolean;
}

export function SourceReference({ text, source, inline = true }: SourceReferenceProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <span
                className="relative inline-block"
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
            >
                <span
                    className={cn(
                        "cursor-help border-b border-dotted border-blue-500",
                        "hover:bg-blue-50 dark:hover:bg-blue-950",
                        "transition-colors duration-200"
                    )}
                >
                    {text}
                    <sup className="ml-0.5 text-blue-600 text-xs font-medium">
                        [{source.article || source.document.split('.')[0]}]
                    </sup>
                </span>

                {/* Tooltip */}
                {isOpen && (
                    <div
                        className={cn(
                            "absolute z-50 w-[600px] max-w-2xl",
                            "bottom-full left-1/2 -translate-x-1/2 mb-2",
                            "bg-white dark:bg-gray-900 shadow-2xl border rounded-lg p-4",
                            "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2",
                            "pointer-events-none"
                        )}
                        onMouseEnter={() => setIsOpen(true)}
                    >
                        <div className="space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                    <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                                    <span className="truncate">{source.document}</span>
                                    {source.page && (
                                        <span className="text-gray-500">• Pág. {source.page}</span>
                                    )}
                                </div>
                                {source.chunkId && (
                                    <button
                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 shrink-0 pointer-events-auto"
                                        onClick={() => setShowModal(true)}
                                    >
                                        Ver completo <ExternalLink className="h-3 w-3" />
                                    </button>
                                )}
                            </div>

                            {/* Article Reference */}
                            {source.article && (
                                <div className="text-xs font-medium text-blue-700 dark:text-blue-400">
                                    {source.article}
                                </div>
                            )}

                            {/* Original Text */}
                            <div className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-800 rounded border-l-4 border-blue-500 max-h-64 overflow-y-auto">
                                <p className="font-mono text-xs text-gray-500 mb-2">Texto original:</p>
                                <p className="whitespace-pre-wrap">{source.originalText}</p>
                            </div>
                        </div>

                        {/* Arrow pointer */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                            <div className="w-3 h-3 rotate-45 bg-white dark:bg-gray-900 border-r border-b"></div>
                        </div>
                    </div>
                )}
            </span>

            {/* Modal for full document view (TODO: Implement) */}
            {showModal && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold">{source.document}</h3>
                                {source.article && (
                                    <p className="text-sm text-gray-600">{source.article}</p>
                                )}
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="prose dark:prose-invert max-w-none">
                            <p className="whitespace-pre-wrap">{source.originalText}</p>
                        </div>
                        <div className="mt-4 text-xs text-gray-500">
                            ChunkID: {source.chunkId || 'N/A'}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

