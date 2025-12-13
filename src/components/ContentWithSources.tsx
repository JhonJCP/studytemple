"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

    const baseComponents: any = {
        h1: (props: any) => (
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-6 mb-3">{props.children}</h1>
        ),
        h2: (props: any) => (
            <h2 className="text-xl font-black text-gray-900 dark:text-white mt-6 mb-3">{props.children}</h2>
        ),
        h3: (props: any) => (
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-5 mb-2">{props.children}</h3>
        ),
        p: (props: any) => <p className="my-3 leading-relaxed text-gray-900 dark:text-gray-100">{props.children}</p>,
        ul: (props: any) => (
            <ul className="my-3 pl-6 list-disc space-y-1 text-gray-900 dark:text-gray-100">{props.children}</ul>
        ),
        ol: (props: any) => (
            <ol className="my-3 pl-6 list-decimal space-y-1 text-gray-900 dark:text-gray-100">{props.children}</ol>
        ),
        blockquote: (props: any) => (
            <blockquote className="my-4 border-l-4 border-primary/40 pl-4 text-gray-800 dark:text-gray-200">
                {props.children}
            </blockquote>
        ),
        a: (props: any) => (
            <a
                href={props.href}
                className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:opacity-90"
                target={props.href?.startsWith("http") ? "_blank" : undefined}
                rel={props.href?.startsWith("http") ? "noreferrer" : undefined}
            >
                {props.children}
            </a>
        ),
        code: (props: any) => {
            if (props.inline) {
                return (
                    <code className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[0.9em]">
                        {props.children}
                    </code>
                );
            }
            return <code className={props.className ? props.className : "font-mono text-sm"}>{props.children}</code>;
        },
        pre: (props: any) => (
            <pre className="my-4 overflow-x-auto rounded-xl border border-white/10 bg-black/80 text-white p-4 text-sm">
                {props.children}
            </pre>
        ),
        table: (props: any) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full border-collapse text-sm">{props.children}</table>
            </div>
        ),
        thead: (props: any) => <thead className="bg-black/5 dark:bg-white/10">{props.children}</thead>,
        th: (props: any) => (
            <th className="border-b border-white/10 px-3 py-2 text-left font-bold text-gray-900 dark:text-white">
                {props.children}
            </th>
        ),
        td: (props: any) => (
            <td className="border-b border-white/5 px-3 py-2 align-top text-gray-900 dark:text-gray-100">{props.children}</td>
        ),
        hr: () => <hr className="my-6 border-white/10" />,
    };

    // Si no hay metadata, renderizar markdown con soporte GFM (tablas, task lists, etc.)
    if (!sourceMetadata || !sourceMetadata.chunks || sourceMetadata.chunks.length === 0) {
        return (
            <div className="max-w-none leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={baseComponents}>
                    {sanitizeForDisplay(text)}
                </ReactMarkdown>
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
        /(\(|\[)?\b(Art\.?|Art[ií]culo)\s*\d+(?:\.(?:\d+|[a-z]))*(?:\s*[a-z](?=$|[)\],.;:\s]))?(\)|\])?/gi;

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
        <div className="max-w-none leading-relaxed">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    ...baseComponents,
                    p: ({ children }) => baseComponents.p({ children: inject(children) }),
                    li: ({ children }) => <li className="leading-relaxed">{inject(children)}</li>,
                    blockquote: ({ children }) => baseComponents.blockquote({ children: inject(children) }),
                    td: ({ children }) => baseComponents.td({ children: inject(children) }),
                    th: ({ children }) => baseComponents.th({ children: inject(children) }),
                    h2: ({ children }) => baseComponents.h2({ children: inject(children) }),
                    h3: ({ children }) => baseComponents.h3({ children: inject(children) }),
                }}
            >
                {sanitizeForDisplay(text)}
            </ReactMarkdown>
        </div>
    );
}
