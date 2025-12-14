import { NextRequest, NextResponse } from "next/server";
import { getTopicById } from "@/lib/syllabus-hierarchy";
import { queryByCategory, formatChunksAsEvidence } from "@/lib/rag-helpers";
import { LEGAL_ACADEMIC_FORMAT, EXPERT_PRACTICAL_TEMPLATE, EXPERT_TEORICO_TEMPLATE, STRATEGIST_SYNTHESIZER_TEMPLATE } from "@/lib/prompts/legal-academic-template";

export const runtime = "nodejs";

type AgentId = "planner" | "expert-teorico" | "expert-practical" | "expert-tecnico" | "curator" | "strategist";

function getSystemPromptOverride(req: NextRequest): string {
    const raw = req.cookies.get("st_system_prompt")?.value || "";
    if (!raw) return "";
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

function systemPrefix(req: NextRequest): string {
    const s = getSystemPromptOverride(req).trim();
    if (!s) return "";
    return `INSTRUCCIONES DE SISTEMA (usuario):\n${s}\n\n`;
}

function asInt(v: string | null, fallback: number) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.floor(n);
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const topicId = searchParams.get("topicId") || "";
        const agent = (searchParams.get("agent") || "") as AgentId;
        const targetWords = asInt(searchParams.get("targetWords"), 2000);
        const sys = systemPrefix(req);

        if (!topicId) return NextResponse.json({ error: "Missing topicId" }, { status: 400 });
        if (!agent) return NextResponse.json({ error: "Missing agent" }, { status: 400 });

        const topic = getTopicById(topicId);
        if (!topic) return NextResponse.json({ error: `Topic not found: ${topicId}` }, { status: 404 });

        if (agent === "planner") {
            return NextResponse.json({
                prompt:
                    "Planner (no LLM): decide estrategia y objetivos con planning real.\n" +
                    "Salida: {timeAllocation, strategy, targetWords, targetSections, practiceExamples, criticalLaws, complexity, reasoning}",
            });
        }

        if (agent === "expert-teorico") {
            const coreDocs = await queryByCategory(topic.title, "CORE", 30, topic.originalFilename);
            const coreChunks = (coreDocs || []).map((doc: any) => ({
                source_id: `db-${doc.id}`,
                filename: doc.metadata?.filename || topic.originalFilename || "Unknown",
                fragment: doc.content || "",
                category: doc.metadata?.category || "CORE",
                chunk_index: doc.metadata?.chunk_index ?? 0,
                confidence: 0.9,
            }));

            const evidenceSummary = formatChunksAsEvidence(coreChunks as any, 18);

            const prompt = `
${sys}${LEGAL_ACADEMIC_FORMAT}

${EXPERT_TEORICO_TEMPLATE}

TEMA: "${topic.title}"
DOCUMENTO BASE: "${topic.originalFilename}"
TARGET: ${Math.round(targetWords * 0.33)} palabras

EVIDENCIA LEGAL (${coreChunks.length} fragmentos de CORE):
${evidenceSummary}

NOTA: este es el prompt real (preview) que se construye en el backend.`;

            return NextResponse.json({ prompt: prompt.trim() });
        }

        if (agent === "expert-practical") {
            const practiceDocs = await queryByCategory(topic.title, "PRACTICE", 24, topic.originalFilename);
            const practiceChunks = (practiceDocs || []).map((doc: any) => ({
                source_id: `db-${doc.id}`,
                filename: doc.metadata?.filename || "Unknown",
                fragment: doc.content || "",
                category: doc.metadata?.category || "PRACTICE",
                chunk_index: doc.metadata?.chunk_index ?? 0,
                confidence: 0.9,
            }));

            const evidenceSummary = formatChunksAsEvidence(practiceChunks as any, 18);

            const prompt = `
${sys}${LEGAL_ACADEMIC_FORMAT}

${EXPERT_PRACTICAL_TEMPLATE}

TEMA: "${topic.title}"
GRUPO: "${topic.groupTitle}"
TARGET: ${Math.round(targetWords * 0.33)} palabras

SUPUESTOS REALES RELACIONADOS (${practiceChunks.length} fragmentos):
${evidenceSummary}

NOTA: este es el prompt real (preview) que se construye en el backend.`;

            return NextResponse.json({ prompt: prompt.trim() });
        }

        if (agent === "expert-tecnico") {
            const coreDocs = await queryByCategory(topic.title, "CORE", 18, topic.originalFilename);
            const suppDocs = await queryByCategory(topic.title, "SUPPLEMENTARY", 14, topic.originalFilename);

            const allChunks = [...(coreDocs || []), ...(suppDocs || [])].map((doc: any) => ({
                source_id: `db-${doc.id}`,
                filename: doc.metadata?.filename || "Unknown",
                fragment: doc.content || "",
                category: doc.metadata?.category || "UNKNOWN",
                chunk_index: doc.metadata?.chunk_index ?? 0,
                confidence: doc.metadata?.category === "CORE" ? 0.95 : 0.8,
            }));

            const evidenceSummary = formatChunksAsEvidence(allChunks as any, 18);

            const prompt = `
${sys}${LEGAL_ACADEMIC_FORMAT}

Eres un EXPERTO TÉCNICO en ingeniería de obras públicas.

TEMA: "${topic.title}"
TARGET: ${Math.round(targetWords * 0.34)} palabras

EVIDENCIA TÉCNICA (${allChunks.length} fragmentos CORE+SUPPLEMENTARY):
${evidenceSummary}

TU TAREA:
- Definiciones técnicas precisas (con citas si aparecen).
- Fórmulas/cálculos y criterios técnicos (valores/umbrales solo si están en evidencia).
- Formato Markdown con h3, listas y tablas.

RESPONDE JSON:
{
  "content": "[Markdown técnico]",
  "definitions": ["..."],
  "formulas": [{"name":"...","formula":"...","reference":"...","parameters":["..."]}],
  "confidence": 0.9
}

NOTA: este es el prompt real (preview) que se construye en el backend.`;

            return NextResponse.json({ prompt: prompt.trim() });
        }

        if (agent === "curator") {
            const prompt =
                `${sys}Curator (LLM): evalúa los drafts de los 3 expertos + patrones PRACTICE y prioriza lo crítico.\n\n` +
                `Este prompt se construye DESPUÉS de que existan drafts (no hay preview completo sin ejecutar).\n` +
                `Código: src/lib/expert-curator.ts`;
            return NextResponse.json({ prompt });
        }

        if (agent === "strategist") {
            const prompt = `
${sys}${LEGAL_ACADEMIC_FORMAT}

 ${STRATEGIST_SYNTHESIZER_TEMPLATE}

NOTA: el strategist integra los 3 drafts + el reporte del curator. El prompt completo se construye tras ejecutar esos pasos.`;
            return NextResponse.json({ prompt: prompt.trim() });
        }

        return NextResponse.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}
