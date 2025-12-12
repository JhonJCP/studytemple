"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAllTopicsWithGroups } from "@/lib/syllabus-hierarchy";
import { safeParseJSON } from "@/lib/json-utils";

const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

const PLANNER_INSTRUCTIONS = `Eres CORTEX. Genera un Master Plan de estudio usando el Syllabus, el Timeline y los minutos diarios disponibles.

OBJETIVOS:
1) Análisis estratégico detallado (mín. 250–400 palabras; incluye riesgos, trade-offs y cómo priorizas).
2) Tiempos por tema: asigna minutos según complejidad y relevancia para supuestos prácticos.
3) Agenda diaria completa (estudio + repaso espaciado + tests) con 3–6 sesiones por día laboral y 2–3 sábado, 1–2 domingo (según minutos).
4) Blueprint claro de flashcards + tests.

REGLAS CLAVE:
- No programes temas marcados como contextOnly: solo aportan contexto.
- Fusiona Enunciado/Solución del mismo supuesto en una sola sesión (elige el topicId de la SOLUCIÓN y menciona que incluye enunciado+solución).
- Para cada tema: complexity (High/Medium/Low), baseStudyMinutes, recommendedContentLength (concise/standard/extended), reviewPlan (D+1, D+3, D+7, D+14), totalPlannedMinutes.
- Estimación si faltan metadatos: leyes 120–240; técnicos 90–150; guías 60–120; supuestos 120–180.
- Plan día a día (start_date–end_date) usando EXACTAMENTE los minutos diarios (máx. ±10 min de margen justificado).
- Sábados: tests y supuestos. Domingos: repaso corto. Festivos (25/12, 01/01, 06/01): repaso ligero.
- Cada sesión study crea flashcards y un micro-test. Tests: diario (8–15), semanal (40–80), simulacros (sábado).
- topicId: OBLIGATORIO usar exactamente uno de "validTopicIds" (incluidos en INPUT DATA). Sesiones sin tema único: ids tipo test-mixto-YYYY-MM-DD o repaso-acumulado-YYYY-MM-DD.
- daily_schedule debe contener EXACTAMENTE expected_total_days fechas consecutivas desde start_date hasta end_date (ambos incluidos). No omitas ninguna fecha.
- Cada fecha debe sumar los minutos diarios disponibles (±10 min) y tener ≥2 sesiones (laborales ≥3).

FORMATO Y NIVEL DE DETALLE (OBLIGATORIO):
- "strategic_analysis": markdown dentro del string, 250–400 palabras; explica por qué esa estrategia, cómo cumple minutos, cómo integra repasos/tests y cómo maneja duplicados/contextOnly.
- "topic_time_estimates": lista con todos los temas no-contextOnly; cada entrada debe tener 2–3 frases en "rationale".
- "daily_schedule": cada entrada con "aiReasoning" de 2–3 frases (qué se hace, por qué hoy, qué generar).
- No devuelvas texto fuera del JSON.

VALIDA ANTES DE RESPONDER:
- Todas las fechas cubiertas.
- Minutos diarios cumplidos.
- Todos los temas (no contextOnly) aparecen.
- Repasos + tests incluidos.

OUTPUT SOLO JSON:
{
  "strategic_analysis": "markdown...",
  "topic_time_estimates": [
    {
      "group": "string",
      "topicTitle": "string",
      "topicId": "string",
      "complexity": "High|Medium|Low",
      "baseStudyMinutes": 120,
      "recommendedContentLength": "concise|standard|extended",
      "reviewPlan": [ { "offsetDays": 1, "type": "review_flashcards", "minutes": 20 } ],
      "totalPlannedMinutes": 240,
      "rationale": "2–3 frases"
    }
  ],
  "daily_schedule": [
    {
      "date": "YYYY-MM-DD",
      "topicTitle": "Name of Topic",
      "topicId": "gX-tY|test-mixto-YYYY-MM-DD|repaso-acumulado-YYYY-MM-DD",
      "type": "study|review_flashcards|test_practice",
      "durationMinutes": 60,
      "startTime": "09:00",
      "endTime": "10:00",
      "breaks": "Pomodoro 50/10",
      "aiReasoning": "2–3 frases",
      "complexity": "High|Medium|Low"
    }
  ]
}`;

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function constructFullPayload(instructions: string, constraints: any, studyTopics: any[], contextDocs: any[]) {
  const expectedTotalDays = (() => {
    const start = new Date(constraints.startDate);
    const end = new Date(constraints.goalDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  })();

  const validTopicIds = studyTopics
    .flatMap((g: any) => (g.topics || []).map((t: any) => t.id))
    .filter(Boolean);

  return `${instructions}

/* ================================================================================== */
/*                            SYSTEM DATA INJECTION LAYER                             */
/* ================================================================================== */

INPUT DATA (JSON):
{
  "Syllabus": ${JSON.stringify(studyTopics, null, 2)},
  "Context High-Level Info": ${JSON.stringify(contextDocs, null, 2)},
  "validTopicIds": ${JSON.stringify(validTopicIds, null, 2)},
  "Timeline": { "start": "${constraints.startDate}", "end": "${constraints.goalDate}" },
  "Daily Minutes Available": ${JSON.stringify(constraints.availability)},
  "Intensity Level": "${constraints.intensity}",
  "expected_total_days": ${expectedTotalDays}
}
`;
}

export async function getPlannerPrompt(_constraints?: any) {
  return PLANNER_INSTRUCTIONS;
}

export async function generateDeepPlan(constraints: any, customInstructions?: string) {
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY no configurada.",
      diagnostics: { prompt: "", rawResponse: "" },
    };
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-preview",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 30000,
    },
  });

  const allTopics = getAllTopicsWithGroups();

  const cleanBundleKey = (t: string) =>
    (t || "")
      .toLowerCase()
      .replace("enunciado", "")
      .replace("solucion", "")
      .replace("solución", "")
      .replace("soluciones", "")
      .replace("respuestas", "")
      .replace("respuesta", "")
      .replace("plantilla", "")
      .replace("examen", "")
      .replace(/\s+/g, " ")
      .trim();

  const isContextOnly = (title: string) => {
    const t = (title || "").toLowerCase();
    return t.includes("convocatoria") || t.includes("temario") || t.includes("bases");
  };

  const isPractice = (title: string) => {
    const t = (title || "").toLowerCase();
    return t.includes("supuesto") || t.includes("examen") || t.includes("simulacro");
  };

  const grouped: Record<string, { group: string; topics: any[] }> = {};
  const contextDocs: any[] = [];

  for (const topic of allTopics) {
    const ctx = isContextOnly(topic.title);
    const entry = {
      id: topic.id,
      title: topic.title,
      originalFilename: topic.originalFilename,
      group: topic.groupTitle,
      contextOnly: ctx,
      practice: isPractice(topic.title),
      bundleKey: cleanBundleKey(topic.title),
    };

    if (ctx) {
      const g = contextDocs.find((x) => x.group === topic.groupTitle);
      if (g) g.topics.push(entry);
      else contextDocs.push({ group: topic.groupTitle, topics: [entry] });
      continue;
    }

    const key = `${topic.groupIndex}:${topic.groupTitle}`;
    if (!grouped[key]) grouped[key] = { group: topic.groupTitle, topics: [] };
    grouped[key].topics.push(entry);
  }

  const studyTopics = Object.values(grouped).map((g) => ({
    group: g.group,
    topics: (g.topics || []).sort((a: any, b: any) => String(a.id).localeCompare(String(b.id))),
  }));

  const validTopicIds = new Set<string>(
    studyTopics.flatMap((g: any) => (g.topics || []).map((t: any) => String(t.id)))
  );

  const findBestTopicId = (maybeTitle: string): string | null => {
    const target = slugify(maybeTitle);
    if (!target) return null;
    const targetTokens = new Set(target.split("-").filter(Boolean));
    let best: { id: string; score: number } | null = null;

    for (const g of studyTopics as any[]) {
      for (const t of g.topics || []) {
        const cand = slugify(`${t.title} ${t.originalFilename}`);
        const candTokens = cand.split("-").filter(Boolean);
        let score = 0;
        for (const tok of candTokens) if (targetTokens.has(tok)) score += 1;
        if (!best || score > best.score) best = { id: t.id, score };
      }
    }

    if (!best || best.score < 2) return null;
    return best.id;
  };

  const instructions = customInstructions || PLANNER_INSTRUCTIONS;
  const finalPrompt = constructFullPayload(instructions, constraints, studyTopics, contextDocs);

  try {
    const result = await model.generateContent(finalPrompt);
    const raw = result.response.text();
    const parsed = safeParseJSON(raw);
    if (!parsed.json) throw new Error(parsed.error || "Plan JSON parse error");

    const masterPlan = parsed.json as any;

    if (Array.isArray(masterPlan.topic_time_estimates)) {
      masterPlan.topic_time_estimates = masterPlan.topic_time_estimates.map((t: any) => {
        const currentId = String(t?.topicId || "");
        if (validTopicIds.has(currentId)) return t;
        const byTitle = findBestTopicId(String(t?.topicTitle || ""));
        return byTitle ? { ...t, topicId: byTitle } : t;
      });
    }

    if (Array.isArray(masterPlan.daily_schedule)) {
      masterPlan.daily_schedule = masterPlan.daily_schedule.map((s: any) => {
        const currentId = String(s?.topicId || "");
        const isSpecial =
          currentId.startsWith("test-") || currentId.startsWith("repaso-") || currentId.startsWith("review-");
        if (validTopicIds.has(currentId) || isSpecial) return s;
        const byTitle = findBestTopicId(String(s?.topicTitle || ""));
        return byTitle ? { ...s, topicId: byTitle } : s;
      });
    }

    return {
      success: true,
      schedule: masterPlan.daily_schedule,
      masterPlan,
      diagnostics: {
        prompt: instructions,
        rawResponse: raw,
        analysis: masterPlan.strategic_analysis,
      },
    };
  } catch (error) {
    console.error("AI Planning Failed:", error);
    return {
      success: false,
      error: "Failed to generate plan.",
      diagnostics: { prompt: finalPrompt || "Error building prompt", rawResponse: String(error) },
    };
  }
}
