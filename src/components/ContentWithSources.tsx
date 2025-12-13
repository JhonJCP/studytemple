"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { SourceReference, type SourceInfo } from "./SourceReference";
import type { SectionSourceMetadata } from "@/lib/widget-types";

interface ContentWithSourcesProps {
    text: string;
    sourceMetadata?: SectionSourceMetadata;
}

export function ContentWithSources({ text, sourceMetadata }: ContentWithSourcesProps) {
    const sanitizeForDisplay = (input: string) =>
        (input || "")
            // Artefactos típicos de extracción PDF/OCR
            .replace(/\u00b6/g, "")
            .replace(/\uFFFD/g, "")
            // Normalizar whitespace
            .replace(/\r/g, "")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n");

    // Si no hay metadata, renderizar markdown normal
    if (!sourceMetadata || !sourceMetadata.chunks || sourceMetadata.chunks.length === 0) {
        return (
            <div className="max-w-none text-gray-900 dark:text-gray-100 leading-relaxed">
                <ReactMarkdown>{sanitizeForDisplay(text)}</ReactMarkdown>
            </div>
        );
    }

    const normalizeArticle = (s: string) =>
        (s || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "")
            .replace(/\[/g, "")
            .replace(/\]/g, "")
            .replace(/\(/g, "")
            .replace(/\)/g, "")
            .replace(/^articulo/, "art")
            .replace(/^art\./, "art")
            .replace(/[^a-z0-9.]/g, "");

    const findBestChunk = (refText: string) => {
        const refNorm = normalizeArticle(refText);
        if (!refNorm) return null;

        let best: (typeof sourceMetadata.chunks)[number] | null = null;
        let bestScore = 0;

        for (const chunk of sourceMetadata.chunks) {
            const chunkNorm = normalizeArticle(chunk.article);
            if (!chunkNorm) continue;
            let score = 0;
            if (chunkNorm === refNorm) score = 1000;
            else if (chunkNorm.startsWith(refNorm) || refNorm.startsWith(chunkNorm)) {
                score = Math.min(chunkNorm.length, refNorm.length);
            } else if (chunkNorm.includes(refNorm) || refNorm.includes(chunkNorm)) {
                score = Math.min(chunkNorm.length, refNorm.length) - 1;
            }
            if (score > bestScore) {
                bestScore = score;
                best = chunk;
            }
        }

        return bestScore >= 4 ? best : null;
    };

    const refPattern =
        /(\(|\[)?\b(Art\.?|Art[ií]culo)\s*\d+(?:\.(?:\d+|[a-z]))*(?:\s*[a-z])?(\)|\])?/gi;

    const splitWithReferences = (input: string): React.ReactNode[] => {
        const content = sanitizeForDisplay(input);
        const out: React.ReactNode[] = [];
        let last = 0;
        let match: RegExpExecArray | null;

        while ((match = refPattern.exec(content)) !== null) {
            const start = match.index;
            const full = match[0];

            // Si la referencia va dentro de (...) o [...], ampliar hasta el cierre para no partir "Ley 9/1991", "RCC", etc.
            let fullSpan = full;
            const openChar = content[start];
            const closeChar = openChar === "(" ? ")" : openChar === "[" ? "]" : null;
            if (closeChar) {
                const maxLookahead = 80;
                const endIdx = content.indexOf(closeChar, start);
                if (endIdx !== -1 && endIdx - start <= maxLookahead) {
                    fullSpan = content.slice(start, endIdx + 1);
                }
            }

            if (start > last) out.push(content.slice(last, start));

            const articleOnlyMatch = fullSpan.match(/\b(Art\.?|Art[ií]culo)\s*\d+(?:\.(?:\d+|[a-z]))*/i);
            const articleKey = articleOnlyMatch ? articleOnlyMatch[0] : full;
            const chunk = findBestChunk(articleKey);
            if (chunk) {
                const source: SourceInfo = {
                    document: sourceMetadata.primaryDocument,
                    article: chunk.article,
                    page: chunk.page,
                    originalText: chunk.originalText,
                    chunkId: chunk.chunkId,
                };
                out.push(
                    <SourceReference
                        key={`ref-${start}-${chunk.chunkId || chunk.article}`}
                        text={fullSpan}
                        source={source}
                    />
                );
            } else {
                out.push(fullSpan);
            }

            last = start + fullSpan.length;
        }

        if (last < content.length) out.push(content.slice(last));
        return out;
    };

    const inject = (node: React.ReactNode): React.ReactNode => {
        if (typeof node === "string") return splitWithReferences(node);
        if (Array.isArray(node)) {
            return node.flatMap((n) => {
                const injected = inject(n);
                return Array.isArray(injected) ? injected : [injected];
            });
        }
        if (React.isValidElement(node)) {
            const tag = typeof node.type === "string" ? node.type : null;
            if (tag === "code" || tag === "pre") return node;
            return React.cloneElement(node, undefined, inject((node.props as any).children));
        }
        return node;
    };

    return (
        <div className="max-w-none text-gray-900 dark:text-gray-100 leading-relaxed">
            <ReactMarkdown
                components={{
                    p: ({ children }) => <p>{inject(children)}</p>,
                    li: ({ children }) => <li>{inject(children)}</li>,
                    blockquote: ({ children }) => <blockquote>{inject(children)}</blockquote>,
                    td: ({ children }) => <td>{inject(children)}</td>,
                    th: ({ children }) => <th>{inject(children)}</th>,
                    h2: ({ children }) => <h2>{inject(children)}</h2>,
                    h3: ({ children }) => <h3>{inject(children)}</h3>,
                }}
            >
                {sanitizeForDisplay(text)}
            </ReactMarkdown>
        </div>
    );
}
