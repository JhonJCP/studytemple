import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

// Forzar runtime Node.js (más estable que Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lazy loading + verificación explícita de API Key
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurada en el servidor");
  }
  return new GoogleGenerativeAI(apiKey);
}

// Supabase para RAG
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Buscar contexto relevante en la biblioteca
async function searchRelevantContext(question: string, maxChunks: number = 5): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log("[ORACLE RAG] Supabase not configured");
    return "";
  }

  try {
    // Extraer keywords de la pregunta
    const keywords = question
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !['cual', 'como', 'donde', 'cuando', 'quien', 'dice', 'sobre', 'para', 'esta'].includes(w))
      .slice(0, 5);

    console.log("[ORACLE RAG] Searching with keywords:", keywords);

    if (keywords.length === 0) {
      console.log("[ORACLE RAG] No keywords extracted");
      return "";
    }

    // Buscar en contenido
    const { data, error } = await supabase
      .from('library_documents')
      .select('content, metadata')
      .or(keywords.map(k => `content.ilike.%${k}%`).join(','))
      .limit(maxChunks);

    console.log("[ORACLE RAG] Search result:", { 
      found: data?.length || 0, 
      error: error?.message,
      sources: data?.map(d => d.metadata?.filename).slice(0, 3)
    });

    if (error || !data || data.length === 0) return "";

    // Formatear evidencia
    const evidence = data.map((doc, idx) => 
      `[Fragmento ${idx + 1}] (${doc.metadata?.filename || 'Documento'})\n${doc.content.slice(0, 800)}`
    ).join('\n\n---\n\n');

    console.log("[ORACLE RAG] Evidence prepared:", evidence.length, "chars");
    return evidence;
  } catch (error) {
    console.error("[ORACLE RAG] Search error:", error);
    return "";
  }
}

export async function POST(request: Request) {
  try {
    const { question } = await request.json();
    if (!question || !question.trim()) {
      return NextResponse.json({ success: false, error: "Pregunta vacía" }, { status: 400 });
    }

    // Buscar contexto relevante en la biblioteca (RAG)
    const evidence = await searchRelevantContext(question, 5);
    const hasEvidence = evidence.length > 100;

    const prompt = `
Eres un asistente especializado en oposiciones de Obras Públicas (ITOP Canarias).

${hasEvidence ? `
=== EVIDENCIA DE LA BIBLIOTECA (USA ESTA INFORMACIÓN OBLIGATORIAMENTE) ===
${evidence}
=== FIN EVIDENCIA ===
` : ''}

INSTRUCCIONES CRÍTICAS:
${hasEvidence 
  ? '- USA SOLO LA EVIDENCIA ARRIBA para responder. Cita artículos y números exactos que aparecen en los fragmentos.'
  : '- No tienes acceso a documentos específicos. Responde con conocimiento general o recomienda consultar la biblioteca.'
}
- Si NO tienes información verificada, di claramente "No tengo información verificada sobre esto. Te recomiendo consultar la biblioteca del temario."
- NUNCA inventes artículos de ley, números o datos técnicos que no estén en la evidencia.
- Máximo 6 frases concisas.

Pregunta: ${question.trim()}

${hasEvidence ? 'IMPORTANTE: Basa tu respuesta SOLO en los fragmentos proporcionados arriba.' : ''}
`;

    // Obtener instancia lazy
    const genAI = getGenAI();
    const modelName = process.env.GEMINI_MODEL || "gemini-3-pro-preview";
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "text/plain",
        maxOutputTokens: 2048,
        temperature: 0.5,  // Bajo para precisión factual (evita alucinaciones)
        topP: 0.85,
        topK: 40
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return NextResponse.json({ success: true, answer: text });
  } catch (error) {
    console.error("oracle api error:", error);
    return NextResponse.json({ success: false, error: "No se pudo generar respuesta." }, { status: 500 });
  }
}
