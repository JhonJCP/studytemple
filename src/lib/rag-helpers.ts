/**
 * RAG HELPERS - Búsquedas en Supabase para alimentar a los agentes
 *
 * Objetivo: devolver fragmentos relevantes y fiables (con filename/chunkId)
 * incluso cuando los filtros por "categoría" no están normalizados en metadata.
 */

import { createClient } from "@supabase/supabase-js";

// ============================================
// TYPES
// ============================================

export type DocumentCategory = "BOE" | "PRACTICE" | "CORE" | "SUPPLEMENTARY";

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

  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

function sanitizeTerm(term: string) {
  return (term || "").replace(/[%_]/g, "").trim();
}

function uniqTerms(arr: string[]) {
  return [...new Set(arr.map((s) => sanitizeTerm(s)).filter((s) => s.length >= 3))];
}

// ============================================
// QUERY FUNCTIONS
// ============================================

export async function queryRAGMultiCategory(params: RAGQueryParams): Promise<DocumentChunk[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn("[RAG] Supabase no configurado");
    return [];
  }

  const limit = params.limit || 15;
  console.log("[RAG] Query multi-category:", {
    categories: params.categories,
    keywords: params.keywords?.slice(0, 3),
    limit,
  });

  const chunks: DocumentChunk[] = [];
  const seenIds = new Set<string>();

  const addChunks = (docs: any[], confidence: number) => {
    for (const doc of docs || []) {
      const id = `db-${doc.id}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      chunks.push({
        source_id: id,
        filename: doc.metadata?.filename || "Unknown",
        fragment: doc.content || "",
        category: doc.metadata?.category || "UNKNOWN",
        chunk_index: doc.metadata?.chunk_index ?? 0,
        confidence,
      });
    }
  };

  try {
    for (const category of params.categories) {
      const perCategory = Math.max(3, Math.ceil(limit / params.categories.length));
      const categoryChunks = await queryByCategory(params.topicTitle, category, perCategory);
      addChunks(categoryChunks, 0.9);
      if (chunks.length >= limit) break;
    }

    console.log(`[RAG] Found ${chunks.length} chunks from ${params.categories.join(", ")}`);
    return chunks.slice(0, limit);
  } catch (error) {
    console.error("[RAG] Error en queryRAGMultiCategory:", error);
    return [];
  }
}

/**
 * Query por categoría (heurística).
 * - Prioriza filename (típico: "Ley 9-1991...", "Supuesto 11...")
 * - Fallback por keywords en contenido (cuando filename no coincide)
 * - Evita `.or(...)` complejos: en prod puede devolver 0 en JSON paths.
 */
export async function queryByCategory(
  topicTitle: string,
  category: DocumentCategory,
  limit: number = 10,
  filenameHint?: string
): Promise<any[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const keywords = extractKeywords(topicTitle);
  const filenameVariants = filenameHint ? generateFilenameVariants(filenameHint).slice(0, 6) : [];
  const legalRefs = extractLegalRefs(topicTitle);
  const contextText = `${topicTitle || ""} ${filenameHint || ""}`.toLowerCase();
  const domainTerms: string[] = [];

  // Heurística: cuando el tema es viario/carreteras, empujar términos que suelen vivir en capítulos posteriores
  if (/carreter|viari|autovi|autopis|servidumbre|afecci|dominio publico|edificaci/i.test(contextText)) {
    domainTerms.push(
      "dominio público",
      "dominio publico",
      "servidumbre",
      "afección",
      "afeccion",
      "línea límite de edificación",
      "linea limite de edificacion",
      "plan regional",
      "información pública",
      "informacion publica",
      "utilidad pública",
      "utilidad publica",
      "urgente ocupación",
      "urgente ocupacion",
      "expropiación",
      "expropiacion",
      "dos meses",
      "publicidad",
      "infracciones",
      "sanciones"
    );
  }

  if (/9[-/_ ]?1991/.test(contextText)) {
    domainTerms.push(
      "artículo 25",
      "articulo 25",
      "artículo 26",
      "articulo 26",
      "artículo 27",
      "articulo 27",
      "artículo 28",
      "articulo 28"
    );
  }

  const categoryFilenameHints: Record<DocumentCategory, string[]> = {
    BOE: ["Convocatoria", "Temario", "BOE", "BOC"],
    PRACTICE: ["Supuesto", "SUPUESTO", "ENUNCIADO", "SOLUCIÓN", "Solución", "Examen", "Simulacro"],
    CORE: ["Ley", "Decreto", "Reglamento", "Real Decreto", "Texto Refundido", "Orden"],
    SUPPLEMENTARY: ["Guía", "Manual", "Resumen", "Instrucción", "Norma"],
  };

  const filenamePatterns = uniqTerms([
    ...filenameVariants,
    ...(categoryFilenameHints[category] || []),
    ...legalRefs,
  ]).slice(0, 12);

  const contentPatterns = uniqTerms([...legalRefs, ...domainTerms, ...keywords]).slice(0, 18);

  console.log("[RAG] Querying:", {
    category,
    topic: topicTitle,
    limit,
    filenameHint: filenameHint || null,
    filenamePatterns: filenamePatterns.slice(0, 5),
    contentPatterns: contentPatterns.slice(0, 5),
  });

  const seen = new Set<number>();
  const out: any[] = [];
  // Mantener por-query pequeño para diversificar (evitar solo el inicio del PDF)
  const perQueryLimit = Math.min(6, Math.max(3, Math.ceil(limit / 5)));

  const addRows = (rows: any[]) => {
    for (const row of rows || []) {
      if (!row || typeof row.id !== "number") continue;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
  };

  const base = () => supabase.from("library_documents").select("id, content, metadata");
  const primaryFilenameHint = filenameHint ? sanitizeTerm(filenameHint.replace(/\.pdf$/i, "")) : "";
  const restrictToPrimaryCore =
    Boolean(primaryFilenameHint) &&
    category === "CORE" &&
    /ley|decreto|reglamento/i.test(contextText);

  const run = async (label: string, build: () => any) => {
    const { data, error } = await build().order("id", { ascending: true }).limit(perQueryLimit);
    if (error) {
      console.error(`[RAG] Error querying ${category} (${label}):`, error.message);
      return;
    }
    addRows(data || []);
  };

  try {
    // Si tenemos filenameHint, traer una muestra del inicio + final del documento principal para cubrir distintas secciones
    if (filenameHint && filenameHint.length > 3) {
      const hint = sanitizeTerm(filenameHint.replace(/\.pdf$/i, ""));
      const primarySeed = Math.min(20, Math.max(10, Math.ceil(limit * 0.6)));
      const half = Math.ceil(primarySeed / 2);
      const patterns = uniqTerms([hint, filenameVariants[0] || ""]).slice(0, 2);
      for (const pat of patterns) {
        if (!pat) continue;
        const q = (ascending: boolean) =>
          base().ilike("metadata->>filename", `%${pat}%`).order("id", { ascending }).limit(half);

        const { data: ascData, error: ascErr } = await q(true);
        if (!ascErr) addRows(ascData || []);

        const { data: descData, error: descErr } = await q(false);
        if (!descErr) addRows(descData || []);
      }
    }

    for (const p of filenamePatterns) {
      if (out.length >= limit) break;
      await run(`filename:${p}`, () => base().ilike("metadata->>filename", `%${p}%`));
    }

    for (const k of contentPatterns) {
      if (out.length >= limit) break;
      await run(`content:${k}`, () => {
        const q = restrictToPrimaryCore ? base().ilike("metadata->>filename", `%${primaryFilenameHint}%`) : base();
        return q.ilike("content", `%${k}%`);
      });
    }

    if (out.length === 0) {
      const fallback = sanitizeTerm(legalRefs[0] || keywords[0] || "");
      if (fallback) {
        await run(`fallback_content:${fallback}`, () => base().ilike("content", `%${fallback}%`));
        await run(`fallback_filename:${fallback}`, () => base().ilike("metadata->>filename", `%${fallback}%`));
      }
    }

    console.log(`[RAG] Found ${out.length} docs in ${category}`);
    return out.slice(0, limit);
  } catch (error) {
    console.error(`[RAG] Error in queryByCategory(${category}):`, error);
    return [];
  }
}

export async function queryBOE(keywords?: string[]): Promise<any[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const terms = uniqTerms([...(keywords || []), "Convocatoria", "Temario", "BOE", "BOC"]).slice(0, 6);
  const seen = new Set<number>();
  const out: any[] = [];

  for (const t of terms) {
    const { data, error } = await supabase
      .from("library_documents")
      .select("id, content, metadata")
      .ilike("metadata->>filename", `%${t}%`)
      .limit(8);
    if (error) continue;
    for (const row of data || []) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        out.push(row);
      }
    }
  }

  return out.slice(0, 20);
}

export async function queryPractice(topicKeywords: string[], limit: number = 20): Promise<any[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const terms = uniqTerms(["Supuesto", "ENUNCIADO", "SOLUCIÓN", ...topicKeywords]).slice(0, 8);
  const seen = new Set<number>();
  const out: any[] = [];

  for (const t of terms) {
    if (out.length >= limit) break;
    const { data, error } = await supabase
      .from("library_documents")
      .select("id, content, metadata")
      .ilike("metadata->>filename", `%${t}%`)
      .limit(Math.max(5, Math.ceil(limit / 2)));
    if (error) continue;
    for (const row of data || []) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        out.push(row);
      }
    }
  }

  return out.slice(0, limit);
}

export async function queryCore(topicTitle: string, limit: number = 15): Promise<any[]> {
  return queryByCategory(topicTitle, "CORE", limit);
}

export async function querySupplementary(topicTitle: string, limit: number = 10): Promise<any[]> {
  return queryByCategory(topicTitle, "SUPPLEMENTARY", limit);
}

// ============================================
// HELPERS
// ============================================

function extractKeywords(topicTitle: string): string[] {
  const stopWords = [
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "por",
    "que",
    "para",
    "con",
    "en",
    "una",
    "uno",
    "y",
    "o",
  ];

  const words = (topicTitle || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[\s,\-_]+/)
    .filter((w) => w.length > 3 && !stopWords.includes(w));

  return [...new Set(words)];
}

function extractLegalRefs(text: string): string[] {
  const out: string[] = [];
  const refs = (text || "").match(/(?:ley|decreto|orden|real\s+decreto)\s*(\d+[-/]\d+|\d+)/gi) || [];
  for (const r of refs.slice(0, 4)) {
    const num = r.match(/(\d+[-/]\d+|\d+)/)?.[1];
    if (!num) continue;
    out.push(num, num.replace("/", "-"), num.replace("-", "/"), num.replace(/[-/]/g, "_"));
  }
  return [...new Set(out)];
}

export function generateFilenameVariants(filename: string): string[] {
  const base = (filename || "")
    .replace(/\.pdf$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const variants: string[] = [];
  variants.push(base);
  variants.push(base.replace(/[,\s]+/g, "_").replace(/_+/g, "_"));
  variants.push(base.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_"));

  const lawMatch = base.match(/ley\s*(\d+[-/]?\d*)/i);
  if (lawMatch) {
    variants.push(`Ley_${lawMatch[1].replace("/", "-")}`);
    variants.push(`ley ${lawMatch[1]}`);
  }

  const decretoMatch = base.match(/decreto\s*(\d+[-/]?\d*)/i);
  if (decretoMatch) {
    variants.push(`Decreto_${decretoMatch[1].replace("/", "-")}`);
  }

  variants.push(...extractKeywords(base));
  return [...new Set(variants)].filter((v) => v.length > 2);
}

export function formatChunksAsEvidence(chunks: DocumentChunk[], maxChunks: number = 10): string {
  const clean = (s: string) =>
    (s || "")
      // Pilcrow y artefactos OCR comunes
      .replace(/\u00b6/g, "")
      .replace(/\uFFFD/g, "")
      // Normalizar whitespace para reducir “ruido” en prompts
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .trim();

  return chunks
    .slice(0, maxChunks)
    .map(
      (chunk, idx) =>
        `[${idx + 1}] (id:${chunk.source_id}, file:${chunk.filename}, cat:${chunk.category}, chunk:${chunk.chunk_index}, conf:${chunk.confidence.toFixed(
          2
        )})\n${clean(chunk.fragment).slice(0, 700)}...`
    )
    .join("\n\n");
}
