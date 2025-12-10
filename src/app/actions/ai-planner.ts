"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_SYLLABUS } from "@/lib/default-syllabus";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

// The Grandmaster Instructions (Editable by User)
const PLANNER_INSTRUCTIONS = `Eres CORTEX. Genera un Master Plan de estudio usando Syllabus, Timeline, minutos diarios y base de datos.

OBJETIVOS:
1) Analisis estrategico con tiempos por tema.
2) Tiempo necesario por tema (ajusta longitud del contenido).
3) Agenda diaria completa (estudio + repaso espaciado + tests).
4) Blueprint de flashcards + tests.

REGLAS CLAVE:
- No programes grupos marcados como contextOnly (bases/convocatoria). Solo son contexto.
- Fusiona Enunciado/Solucion del mismo supuesto en una sola sesion.
- Si hay duplicados por version, usa la mas reciente y la otra como comparativa breve.
- Para cada tema: complexity (High/Med/Low), baseStudyMinutes, contentLength (concise/standard/extended), reviewPlan (D+1, D+3, D+7, D+14), totalPlannedMinutes.
- Estimacion si faltan metadatos: leyes 120–240; tecnicos 90–150; guias 60–120; supuestos 120–180.
- Plan dia a dia (start_date–end_date) usando EXACTAMENTE los minutos diarios (max 5–10 min margen justificado).
- Sabados: tests y supuestos. Domingos: repaso corto. Festivos (25/12, 01/01, 06/01): repaso ligero.
- Cada "study" crea flashcards y un micro-test. Tests: diario (8–15 + arrastre), semanal (40–80), simulacros en supuestos.
- topicId: usa ID real o slug simple. Sesiones sin tema unico: ids tipo test-mixto-YYYY-MM-DD o repaso-acumulado-YYYY-MM-DD.
- Horario por defecto: 09:00 (L–V), 09:30 y 16:30 (S), 10:00 (D). Breaks: High 50/10, Medium 40/10, review 25/5, test 45/15.

VALIDA ANTES DE RESPONDER:
- Todas las fechas cubiertas.
- Minutos diarios cumplidos.
- Todos los temas (no contextOnly) aparecen.
- Repasos + tests incluidos.

OUTPUT SOLO JSON:
{
 "strategic_analysis": "Markdown dentro del string (estrategia, calculo carga, repaso, blueprint, festivos, supuestos).",
 "topic_time_estimates": [
   {
     "group": "string",
     "topicTitle": "string",
     "topicId": "string",
     "complexity": "High|Medium|Low",
     "baseStudyMinutes": 120,
     "recommendedContentLength": "concise|standard|extended",
     "reviewPlan": [ { "offsetDays": 1, "type": "review_flashcards", "minutes": 20 } ],
     "totalPlannedMinutes": 240
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
     "aiReasoning": "Por que hoy + que generar + enfoque.",
     "complexity": "High|Medium|Low"
   }
 ]
}`

// Helper to build the prompt string (Injects Data into Instructions)
function constructFullPayload(instructions: string, constraints: any, studyTopics: any[], contextDocs: any[]) {
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
  "Intensity Level": "${constraints.intensity}"
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
