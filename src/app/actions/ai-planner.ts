"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_SYLLABUS } from "@/lib/default-syllabus";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

// The Grandmaster Instructions (Editable by User)
const PLANNER_INSTRUCTIONS = `Eres CORTEX. Genera un “Master Plan” de estudio usando Syllabus, Timeline, minutos diarios y base de datos.

OBJETIVOS:
1) Análisis estratégico detallado (mín. 250–400 palabras; incluye riesgos, trade-offs, cómo priorizas).
2) Tiempos por tema (ajusta longitud de contenido) según complejidad y relevancia para supuestos prácticos.
3) Agenda diaria completa (estudio + repaso espaciado + tests) con ≥3–6 sesiones por día según minutos.
4) Blueprint claro de flashcards + tests.

REGLAS CLAVE:
- No programes grupos con contextOnly (bases/convocatoria). Solo son contexto.
- Fusiona Enunciado/Solución del mismo supuesto en una sola sesión.
- Si hay duplicados por versión, usa la más reciente y la otra como comparativa breve.
- Para cada tema: complexity (High/Med/Low), baseStudyMinutes, recommendedContentLength (concise/standard/extended), reviewPlan (D+1, D+3, D+7, D+14), totalPlannedMinutes.
- Estimación si faltan metadatos: leyes 120–240; técnicos 90–150; guías 60–120; supuestos 120–180.
- Plan día a día (start_date–end_date) usando EXACTAMENTE los minutos diarios (máx. 5–10 min margen justificado).
- Sábados: tests y supuestos. Domingos: repaso corto. Festivos (25/12, 01/01, 06/01): repaso ligero.
- Cada “study” crea flashcards y un micro-test. Tests: diario (8–15 + arrastre), semanal (40–80), simulacros en supuestos.
- topicId: usa ID real o slug simple. Sesiones sin tema único: ids tipo test-mixto-YYYY-MM-DD o repaso-acumulado-YYYY-MM-DD.
- Horario por defecto: 09:00 (L–V), 09:30 y 16:30 (S), 10:00 (D). Breaks: High 50/10, Medium 40/10, review 25/5, test 45/15.
- daily_schedule debe contener EXACTAMENTE expected_total_days fechas consecutivas desde start_date hasta end_date (ambos incluidos). No omitas ninguna fecha. Cada fecha debe tener ≥2 sesiones (laborales ≥3) y sumar los minutos diarios disponibles (±10 min).
- Usa estrictamente “Daily Minutes Available” para asignar la carga diaria. Si el rango laboral es 09:00–19:00 L–V, distribuye las sesiones dentro de ese rango con descansos; sábados 09:30/16:30, domingos 10:00 como referencia.
- Cobertura mínima: todos los temas no-contextOnly deben aparecer al menos una vez. Reparte minutos en función de complejidad y relevancia en supuestos (High > Medium > Low). Supuestos prácticos deben tener hueco semanal (sábados) y repasos asociados.
- Repaso espaciado obligatorio: integra D+1, D+3, D+7, D+14 y arrastre semanal en los días correspondientes.

FORMATO Y NIVEL DE DETALLE (OBLIGATORIO):
- "strategic_analysis": markdown dentro del string, 250–400 palabras; explica por qué esa estrategia, cómo cumple minutos, cómo integra repasos/tests y cómo maneja duplicados/contextOnly.
- "topic_time_estimates": lista con todos los temas no-contextOnly; cada entrada debe tener 2–3 frases en un campo "rationale" explicando el minuto asignado y el plan de contenido.
- "daily_schedule": al menos 3 entradas por día laboral, 2–3 sábados, 1–2 domingos; cada entrada con "aiReasoning" de 2–3 frases (qué se hace, por qué hoy, qué generar).
- No devuelvas texto fuera del JSON.

VALIDA ANTES DE RESPONDER:
- Todas las fechas cubiertas.
- Minutos diarios cumplidos.
- Todos los temas (no contextOnly) aparecen.
- Repasos + tests incluidos.

OUTPUT SOLO JSON:
{
 "strategic_analysis": "…",
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
     "rationale": "2–3 frases de por qué y qué foco tendrá el contenido."
   }
 ],
 "daily_schedule": [
   {
     "date": "YYYY-MM-DD",
     "topicTitle": "Name of Topic",
     "topicId": "slug-or-db-id",
     "type": "study|review_flashcards|test_practice",
     "durationMinutes": 60,
     "startTime": "09:00",
     "endTime": "10:00",
     "breaks": "Pomodoro 50/10",
     "aiReasoning": "2–3 frases: por qué hoy + qué generar + enfoque.",
     "complexity": "High|Medium|Low"
   }
 ]
}`

// Helper to build the prompt string (Injects Data into Instructions)
function constructFullPayload(instructions: string, constraints: any, studyTopics: any[], contextDocs: any[]) {
  // Compute expected days between start and end (inclusive) to force full coverage
  const expectedTotalDays = (() => {
    const start = new Date(constraints.startDate);
    const end = new Date(constraints.goalDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
  })();
  // We append the DATA to the Instructions provided (or default)
  return `${instructions}

    
/* ================================================================================== */
/*                            SYSTEM DATA INJECTION LAYER                             */
/* ================================================================================== */
    
INPUT DATA (JSON):
{
  "Syllabus": ${JSON.stringify(studyTopics, null, 2)},
  "Context High-Level Info": ${JSON.stringify(contextDocs, null, 2)},
  "Timeline": {
      "start": "${constraints.startDate}", 
      "end": "${constraints.goalDate}"
  },
  "Daily Minutes Available": ${JSON.stringify(constraints.availability)},
  "Intensity Level": "${constraints.intensity}",
  "expected_total_days": ${expectedTotalDays}
}
    `;
}

// 1. Action to Get the Default Instructions (Editable by User)
export async function getPlannerPrompt(constraints: any) {
  // We now just return the Instructions Text. 
  // The Data injection happens during execution.
  return PLANNER_INSTRUCTIONS;
}

// 2. Main Execution Action
export async function generateDeepPlan(constraints: any, customInstructions?: string) {
  // 1. Use the "Big Brain" Model (Reasoning Capability)
  const model = genAI.getGenerativeModel({
    model: "gemini-3-pro-preview",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 30000 // Huge context for Master Plan
    }
  });

  // 2. Prepare Data Context (This is ALWAYS done, user cannot delete this)
  const studyTopics: any[] = [];
  const contextDocs: any[] = [];

  // ... Copying syllabus parsing logic ...
  const cleanTitle = (t: string) => t.toLowerCase()
    .replace("enunciado", "")
    .replace("soluciones", "")
    .replace("respuestas", "")
    .replace("respuesta", "")
    .replace("plantilla", "")
    .replace("examen", "")
    .replace(/\s+/g, ' ').trim();

  DEFAULT_SYLLABUS.groups.forEach((g: any) => {
    const title = g.title.toLowerCase();
    if (g.contextOnly === true || title.includes("bases") || title.includes("informaci") || title.includes("convocatoria") || title.includes("suplementario")) {
      contextDocs.push({ group: g.title, files: g.topics.map((t: any) => t.title) });
      return;
    }
    const seen = new Set<string>();
    const uniqueTopics: string[] = [];
    g.topics.forEach((t: any) => {
      const rawTitle = t.title;
      const coreName = cleanTitle(rawTitle);
      if (!seen.has(coreName)) {
        seen.add(coreName);
        uniqueTopics.push(t.title);
      }
    });
    if (uniqueTopics.length > 0) {
      studyTopics.push({ group: g.title, topics: uniqueTopics });
    }
  });

  // 3. Construct Final Prompt (Instructions + Data)
  const instructions = customInstructions || PLANNER_INSTRUCTIONS;
  const finalPrompt = constructFullPayload(instructions, constraints, studyTopics, contextDocs);

  try {
    const result = await model.generateContent(finalPrompt); // Non-null assertion safely
    const response = await result.response;
    const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const masterPlan = JSON.parse(text);

    return {
      success: true,
      schedule: masterPlan.daily_schedule, // Provide schedule for preview
      masterPlan: masterPlan, // Pass full object including analysis for client-side holding
      diagnostics: {
        prompt: instructions, // We return just the Instructions part for the editor
        rawResponse: text,
        analysis: masterPlan.strategic_analysis
      }
    };
  } catch (error) {
    console.error("AI Planning Failed:", error);
    return { success: false, error: "Failed to generate plan.", diagnostics: { prompt: finalPrompt || "Error building prompt", rawResponse: String(error) } };
  }
}
