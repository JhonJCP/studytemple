/**
 * RAG HELPERS - Búsquedas especializadas por categoría en Supabase
 * 
 * Permite queries específicas a las categorías:
 * - BOE: Convocatoria oficial
 * - PRACTICE: Supuestos reales
 * - CORE: Normativa base
 * - SUPPLEMENTARY: Material de apoyo
 */

import { createClient } from "@supabase/supabase-js";

// ============================================
// TYPES
// ============================================

export type DocumentCategory = 'BOE' | 'PRACTICE' | 'CORE' | 'SUPPLEMENTARY';

export interface DocumentChunk {
    source_id: string;
    filename: string;
    fragment: string;
    category: string;
    chunk_index: number;
    confidence: number;
}

export interface RAGQueryParams {
    topicTitle: string;
    categories: DocumentCategory[];
    keywords?: string[];
    limit?: number;
}

// ============================================
// SUPABASE CLIENT
// ============================================

function getSupabaseClient() {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return null;
    }
    
    return createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Query multi-categoría (principal)
 */
export async function queryRAGMultiCategory(params: RAGQueryParams): Promise<DocumentChunk[]> {
    const supabase = getSupabaseClient();
    if (!supabase) {
        console.warn('[RAG] Supabase no configurado');
        return [];
    }
    
    console.log(`[RAG] Query multi-category:`, {
        categories: params.categories,
        keywords: params.keywords?.slice(0, 3),
        limit: params.limit || 15
    });
    
    let chunks: DocumentChunk[] = [];
    const seenIds = new Set<string>();
    
    // Función helper para añadir chunks sin duplicados
    const addChunks = (docs: any[], confidence: number) => {
        for (const doc of docs) {
            const id = `db-${doc.id}`;
            if (!seenIds.has(id)) {
                seenIds.add(id);
                chunks.push({
                    source_id: id,
                    filename: doc.metadata?.filename || 'Unknown',
                    fragment: doc.content || '',
                    category: doc.metadata?.category || 'UNKNOWN',
                    chunk_index: doc.metadata?.chunk_index ?? 0,
                    confidence
                });
            }
        }
    };
    
    try {
        // Buscar en cada categoría
        for (const category of params.categories) {
            const categoryChunks = await queryByCategory(
                params.topicTitle,
                category,
                Math.ceil((params.limit || 15) / params.categories.length)
            );
            
            addChunks(categoryChunks, 0.9);
            
            if (chunks.length >= (params.limit || 15)) break;
        }
        
        console.log(`[RAG] Found ${chunks.length} chunks from ${params.categories.join(', ')}`);
        
        return chunks.slice(0, params.limit || 15);
        
    } catch (error) {
        console.error('[RAG] Error en queryRAGMultiCategory:', error);
        return [];
    }
}

/**
 * Query por categoría específica
 */
export async function queryByCategory(
    topicTitle: string,
    category: DocumentCategory,
    limit: number = 10
): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    console.log(`[RAG] Querying category=${category}, topic="${topicTitle}", limit=${limit}`);
    
    // Extraer keywords del título
    const keywords = extractKeywords(topicTitle);
    
    try {
        let query = supabase
            .from('library_documents')
            .select('id, content, metadata')
            .eq('metadata->>category', category);
        
        // Añadir filtros de keywords si hay
        if (keywords.length > 0) {
            const keywordConditions = keywords
                .slice(0, 3) // Primeras 3 keywords
                .map(k => `content.ilike.%${k}%`)
                .join(',');
            
            if (keywordConditions) {
                query = query.or(keywordConditions);
            }
        }
        
        const { data, error } = await query
            .order('metadata->chunk_index', { ascending: true })
            .limit(limit);
        
        if (error) {
            console.error(`[RAG] Error querying ${category}:`, error.message);
            return [];
        }
        
        console.log(`[RAG] Found ${data?.length || 0} docs in ${category}`);
        
        return data || [];
        
    } catch (error) {
        console.error(`[RAG] Error in queryByCategory(${category}):`, error);
        return [];
    }
}

/**
 * Query específico para BOE
 */
export async function queryBOE(keywords?: string[]): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    console.log('[RAG] Querying BOE documents...');
    
    try {
        let query = supabase
            .from('library_documents')
            .select('id, content, metadata')
            .eq('metadata->>category', 'BOE');
        
        // Buscar específicamente por archivos relevantes
        const filenames = keywords && keywords.length > 0
            ? keywords.map(k => `metadata->>filename.ilike.%${k}%`).join(',')
            : `metadata->>filename.ilike.%Convocatoria%,metadata->>filename.ilike.%Temario%`;
        
        if (filenames) {
            query = query.or(filenames);
        }
        
        const { data, error } = await query.limit(20);
        
        if (error) {
            console.error('[RAG] Error querying BOE:', error.message);
            return [];
        }
        
        console.log(`[RAG] Found ${data?.length || 0} BOE documents`);
        
        return data || [];
        
    } catch (error) {
        console.error('[RAG] Error in queryBOE:', error);
        return [];
    }
}

/**
 * Query específico para PRACTICE (supuestos)
 */
export async function queryPractice(topicKeywords: string[], limit: number = 20): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    console.log('[RAG] Querying PRACTICE supuestos...', topicKeywords);
    
    try {
        let query = supabase
            .from('library_documents')
            .select('id, content, metadata')
            .eq('metadata->>category', 'PRACTICE');
        
        // Buscar por keywords en filename o content
        if (topicKeywords.length > 0) {
            const conditions = topicKeywords.flatMap(keyword => [
                `metadata->>filename.ilike.%${keyword}%`,
                `content.ilike.%${keyword}%`
            ]).join(',');
            
            if (conditions) {
                query = query.or(conditions);
            }
        }
        
        const { data, error } = await query
            .order('metadata->>filename', { ascending: true })
            .limit(limit);
        
        if (error) {
            console.error('[RAG] Error querying PRACTICE:', error.message);
            return [];
        }
        
        console.log(`[RAG] Found ${data?.length || 0} PRACTICE documents`);
        
        return data || [];
        
    } catch (error) {
        console.error('[RAG] Error in queryPractice:', error);
        return [];
    }
}

/**
 * Query específico para CORE (normativa base)
 */
export async function queryCore(topicTitle: string, limit: number = 15): Promise<any[]> {
    return queryByCategory(topicTitle, 'CORE', limit);
}

/**
 * Query específico para SUPPLEMENTARY (material apoyo)
 */
export async function querySupplementary(topicTitle: string, limit: number = 10): Promise<any[]> {
    return queryByCategory(topicTitle, 'SUPPLEMENTARY', limit);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extraer keywords del título del tema
 */
function extractKeywords(topicTitle: string): string[] {
    const stopWords = ['de', 'del', 'la', 'el', 'los', 'las', 'por', 'que', 'para', 'con', 'en', 'una', 'uno', 'y', 'o'];
    
    const words = topicTitle
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .split(/[\s,\-_]+/)
        .filter(w => w.length > 3 && !stopWords.includes(w));
    
    return [...new Set(words)]; // Eliminar duplicados
}

/**
 * Generar variantes de filename para búsqueda flexible
 */
export function generateFilenameVariants(filename: string): string[] {
    const base = filename
        .replace(/\.pdf$/i, '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Quitar acentos
    
    const variants: string[] = [];
    
    // Variante original sin extensión
    variants.push(base);
    
    // Variante con guiones bajos
    variants.push(base.replace(/[,\s]+/g, '_').replace(/_+/g, '_'));
    
    // Variante solo con guiones bajos (como está en Supabase)
    variants.push(base.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_'));
    
    // Extraer referencias de ley
    const lawMatch = base.match(/ley\s*(\d+[-/]?\d*)/i);
    if (lawMatch) {
        variants.push(`Ley_${lawMatch[1].replace('/', '-')}`);
        variants.push(`ley ${lawMatch[1]}`);
    }
    
    // Extraer decreto
    const decretoMatch = base.match(/decreto\s*(\d+[-/]?\d*)/i);
    if (decretoMatch) {
        variants.push(`Decreto_${decretoMatch[1].replace('/', '-')}`);
    }
    
    // Palabras clave importantes
    const keywords = extractKeywords(base);
    variants.push(...keywords);
    
    return [...new Set(variants)].filter(v => v.length > 2);
}

/**
 * Convertir chunks a formato de evidencia para prompts
 */
export function formatChunksAsEvidence(chunks: DocumentChunk[], maxChunks: number = 10): string {
    return chunks
        .slice(0, maxChunks)
        .map((chunk, idx) => 
            `[${idx + 1}] (${chunk.filename}, conf:${chunk.confidence.toFixed(2)})\n${chunk.fragment.slice(0, 600)}...`
        )
        .join('\n\n');
}


