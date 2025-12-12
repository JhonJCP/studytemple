/**
 * CONTENT WITH SOURCES - Parser de contenido con referencias interactivas
 * 
 * Detecta referencias legales (Art. X, Artículo Y) en el texto y las convierte
 * en componentes interactivos con tooltips al documento original
 */

"use client";

import ReactMarkdown from 'react-markdown';
import { SourceReference, type SourceInfo } from './SourceReference';
import type { SectionSourceMetadata } from '@/lib/widget-types';

interface ContentWithSourcesProps {
    text: string;
    sourceMetadata?: SectionSourceMetadata;
}

export function ContentWithSources({ text, sourceMetadata }: ContentWithSourcesProps) {
    // Si no hay metadata, renderizar markdown normal
    if (!sourceMetadata || !sourceMetadata.chunks || sourceMetadata.chunks.length === 0) {
        return (
            <div className="prose prose-lg dark:prose-invert max-w-none">
                <ReactMarkdown>{text}</ReactMarkdown>
            </div>
        );
    }

    // Parser: detectar fragmentos con referencias (Art. X) o (Artículo Y)
    const parseWithReferences = (content: string) => {
        // Regex para detectar referencias legales
        // Captura: "texto (Art. 3)" o "texto [Art. 3]" o "según Art. 5"
        const pattern = /([^(\[]*?)([\(\[]?)(Art\.\s*\d+[\.\d]*|Artículo\s+\d+[\.\d]*)([\)\]]?)/g;

        const parts: Array<{ type: 'text' | 'reference'; content?: string; text?: string; source?: SourceInfo }> = [];
        let lastIndex = 0;
        let match;

        while ((match = pattern.exec(content)) !== null) {
            const textBefore = match[1];
            const openBracket = match[2];
            const articleRef = match[3];
            const closeBracket = match[4];

            // Agregar texto antes de la referencia
            if (match.index > lastIndex) {
                const priorText = content.slice(lastIndex, match.index);
                if (priorText.trim()) {
                    parts.push({
                        type: 'text',
                        content: priorText
                    });
                }
            }

            // Buscar chunk correspondiente en metadata
            const chunk = sourceMetadata.chunks.find(c =>
                c.article.toLowerCase().includes(articleRef.toLowerCase()) ||
                articleRef.toLowerCase().includes(c.article.toLowerCase())
            );

            if (chunk && textBefore.trim()) {
                // Agregar texto con referencia interactiva
                parts.push({
                    type: 'text',
                    content: textBefore
                });
                parts.push({
                    type: 'reference',
                    text: `${openBracket}${articleRef}${closeBracket}`,
                    source: {
                        document: sourceMetadata.primaryDocument,
                        article: chunk.article,
                        page: chunk.page,
                        originalText: chunk.originalText,
                        chunkId: chunk.chunkId
                    }
                });
            } else {
                // No hay chunk o no hay texto, agregar como texto plano
                parts.push({
                    type: 'text',
                    content: textBefore + openBracket + articleRef + closeBracket
                });
            }

            lastIndex = pattern.lastIndex;
        }

        // Resto del texto
        if (lastIndex < content.length) {
            const remaining = content.slice(lastIndex);
            if (remaining.trim()) {
                parts.push({ type: 'text', content: remaining });
            }
        }

        // Si no se detectaron referencias, devolver el texto completo
        if (parts.length === 0) {
            parts.push({ type: 'text', content: content });
        }

        return parts;
    };

    const parts = parseWithReferences(text);

    return (
        <div className="prose prose-lg dark:prose-invert max-w-none">
            {parts.map((part, i) =>
                part.type === 'reference' && part.source ? (
                    <SourceReference key={i} text={part.text || ''} source={part.source} />
                ) : (
                    <ReactMarkdown key={i}>{part.content || ''}</ReactMarkdown>
                )
            )}
        </div>
    );
}


