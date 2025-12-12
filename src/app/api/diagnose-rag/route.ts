/**
 * DIAGNOSE RAG - Verifica queries y schema real de library_documents
 *
 * Devuelve SOLO metadatos y conteos (sin contenido) para evitar exponer textos completos.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function countOnly(supabase: any, build: (q: any) => any) {
  const q = build(supabase.from("library_documents").select("id", { count: "exact", head: true }));
  const { count, error } = await q;
  return { count: count ?? 0, error: error?.message || null };
}

async function sampleFilenames(supabase: any, build: (q: any) => any, limit = 8) {
  const q = build(supabase.from("library_documents").select("id, metadata").limit(limit));
  const { data, error } = await q;
  if (error) return { filenames: [] as string[], error: error.message };
  const filenames = (data || [])
    .map((r: any) => r?.metadata?.filename)
    .filter((v: any) => typeof v === "string" && v.length > 0)
    .slice(0, limit);
  return { filenames, error: null };
}

export async function GET() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase no configurado (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY)" },
      { status: 500 }
    );
  }

  // Sample row to understand metadata keys
  const { data: sampleRows, error: sampleErr } = await supabase
    .from("library_documents")
    .select("id, metadata")
    .order("id", { ascending: true })
    .limit(1);

  const sample = sampleRows?.[0];
  const metadata = sample?.metadata && typeof sample.metadata === "object" ? sample.metadata : null;
  const metadataKeys = metadata ? Object.keys(metadata).slice(0, 40) : [];

  const tests = [
    {
      name: "filename_ilike_Ley",
      build: (q: any) => q.ilike("metadata->>filename", "%Ley%"),
    },
    {
      name: "content_ilike_carreteras",
      build: (q: any) => q.ilike("content", "%carreteras%"),
    },
    {
      name: "or_filename_or_content",
      build: (q: any) => q.or("metadata->>filename.ilike.%Ley%,content.ilike.%carreteras%"),
    },
    {
      name: "filename_ilike_9_1991",
      build: (q: any) =>
        q.or("metadata->>filename.ilike.%9-1991%,metadata->>filename.ilike.%9/1991%,metadata->>filename.ilike.%9_1991%"),
    },
  ];

  const results: Record<string, any> = {};
  for (const t of tests) {
    const count = await countOnly(supabase, t.build);
    const sampleFiles = await sampleFilenames(supabase, t.build);
    results[t.name] = { ...count, sampleFilenames: sampleFiles.filenames, sampleError: sampleFiles.error };
  }

  return NextResponse.json({
    ok: true,
    sample: {
      id: sample?.id ?? null,
      filename: metadata?.filename ?? null,
      metadataKeys,
      metadataPreview: metadata
        ? {
            filename: metadata.filename ?? null,
            category: metadata.category ?? null,
            chunk_index: metadata.chunk_index ?? null,
            page: metadata.page ?? metadata.pageNumber ?? null,
            source_id: metadata.source_id ?? null,
          }
        : null,
      error: sampleErr?.message || null,
    },
    tests: results,
  });
}

