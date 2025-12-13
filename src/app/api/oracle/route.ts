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

// Buscar contexto relevante en la biblioteca (estrategia multi-nivel como el Bibliotecario)
async function searchRelevantContext(question: string, maxChunks: number = 8): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log("[ORACLE RAG] Supabase not configured");
    return "";
  }

  const chunks: Array<{ content: string; filename: string; confidence: number }> = [];
  const seenIds = new Set<string>();

  try {
    // ESTRATEGIA 1: Buscar referencias legales específicas (Ley X/YYYY, Art. N, Decreto Z)
    const legalRefs = question.match(/(?:ley|decreto|orden|art(?:ículo|iculo)?|real decreto)\s*(\d+[-/]\d+|\d+)/gi) || [];
    
    if (legalRefs.length > 0) {
      console.log("[ORACLE RAG] Searching by legal refs:", legalRefs);
      
      for (const ref of legalRefs.slice(0, 3)) {
        const { data } = await supabase
          .from('library_documents')
          .select('id, content, metadata')
          .or(`metadata->>filename.ilike.%${ref}%,content.ilike.%${ref}%`)
          .limit(5);

        if (data) {
          for (const doc of data) {
            if (!seenIds.has(doc.id)) {
              seenIds.add(doc.id);
              chunks.push({
                content: doc.content,
                filename: doc.metadata?.filename || 'Documento',
                confidence: 0.95
              });
            }
          }
        }
      }
    }

    // ESTRATEGIA 2: Buscar por keywords de la pregunta (si no hay suficientes chunks)
    if (chunks.length < 3) {
      const keywords = question
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/\s+/)
        .filter(w => w.length > 3 && !['cual', 'como', 'donde', 'cuando', 'quien', 'dice', 'sobre', 'para', 'esta', 'articulo'].includes(w))
        .slice(0, 4);

      console.log("[ORACLE RAG] Searching by keywords:", keywords);

      for (const keyword of keywords) {
        if (chunks.length >= maxChunks) break;

        // Buscar en filename primero
        const { data: byFilename } = await supabase
          .from('library_documents')
          .select('id, content, metadata')
          .ilike('metadata->>filename', `%${keyword}%`)
          .limit(3);

        if (byFilename) {
          for (const doc of byFilename) {
            if (!seenIds.has(doc.id)) {
              seenIds.add(doc.id);
              chunks.push({
                content: doc.content,
                filename: doc.metadata?.filename || 'Documento',
                confidence: 0.85
              });
            }
          }
        }

        // Buscar en contenido
        if (chunks.length < maxChunks) {
          const { data: byContent } = await supabase
            .from('library_documents')
            .select('id, content, metadata')
            .ilike('content', `%${keyword}%`)
            .limit(3);

          if (byContent) {
            for (const doc of byContent) {
              if (!seenIds.has(doc.id)) {
                seenIds.add(doc.id);
                chunks.push({
                  content: doc.content,
                  filename: doc.metadata?.filename || 'Documento',
                  confidence: 0.70
                });
              }
            }
          }
        }
      }
    }

    // Ordenar por confidence
    chunks.sort((a, b) => b.confidence - a.confidence);
    const finalChunks = chunks.slice(0, maxChunks);

    console.log("[ORACLE RAG] Final result:", { 
      totalChunks: finalChunks.length,
      sources: [...new Set(finalChunks.map(c => c.filename))],
      avgConfidence: finalChunks.reduce((sum, c) => sum + c.confidence, 0) / (finalChunks.length || 1)
    });

    if (finalChunks.length === 0) return "";

    // Formatear evidencia con mejor contexto
    const evidence = finalChunks.map((chunk, idx) => 
      `[Fragmento ${idx + 1}] ${chunk.filename} (confianza: ${(chunk.confidence * 100).toFixed(0)}%)\n${chunk.content.slice(0, 1000)}`
    ).join('\n\n---\n\n');

    console.log("[ORACLE RAG] Evidence prepared:", evidence.length, "chars from", finalChunks.length, "chunks");
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
    const modelName = "gemini-3-pro-preview";
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
