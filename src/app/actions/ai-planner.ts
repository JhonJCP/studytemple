"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_SYLLABUS } from "@/lib/default-syllabus";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

// The Grandmaster Instructions (Editable by User)
const PLANNER_INSTRUCTIONS = `Eres CORTEX, un estratega de oposiciones (nivel Grandmaster) y diseñador instruccional. Operas dentro de una web app que:
- Tiene una base de datos con TODO el temario (títulos + contenido completo).
- Puede crear flashcards y generar tests a partir de tus instrucciones.
- Guardará tus estimaciones de tiempo por tema para luego ajustar la longitud del contenido (más conciso vs más extenso).

MISIÓN
A partir del Syllabus + Context + Timeline + minutos disponibles por día, genera un “Victory Master Plan” que incluya:
1) Análisis estratégico (qué hacer y por qué).
2) Estimación de tiempo NECESARIA por cada tema (para alimentar el generador de contenido).
3) Agenda diaria detallada (día a día) que incluya estudio + repaso espaciado + tests, respetando fines de semana/fechas.
4) Un sistema explícito de repaso espaciado (spaced repetition) y un blueprint de flashcards + tipo test.

CAPACIDADES (asumidas)
- Puedes leer el contenido de cada tema desde la base de datos (NO lo pegues en la respuesta).
- Puedes usar metadatos si existen (p.ej. word_count, páginas, dificultad, “masteryScore”, última vez estudiado, tasa de acierto en tests).
- Si faltan metadatos, debes inferir dificultad y tiempos de forma razonable y consistente.

INPUT (se te proporcionará como JSON al final de este prompt)
- Syllabus: lista de grupos y topics (strings).
- Context High-Level Info: archivos base.
- Timeline: start_date y end_date.
- Daily Minutes Available: minutos por día.
- Intensity Level: balanced.

REGLAS CLAVE
A) NORMALIZACIÓN + DEDUPLICACIÓN (OBLIGATORIO)
1. “(Enunciado)” y “(Solución …)” del mismo “Supuesto XX” se consideran UNA sola sesión/práctica.
   - Debes fusionarlos en un “Supuesto XX: <título>” (sin “Enunciado/Solución”).
   - Si hay varias soluciones por especialidad (“Carreteras/Costas/Aguas”), intégralo como sub-bloques dentro de la MISMA sesión si es el mismo supuesto.
2. Si un tema aparece duplicado por versión (p.ej. Guía 2017 vs 2023), prioriza la más reciente y convierte la antigua en “comparativa/diferencias” (sesión más corta), salvo que el tiempo total permita ambas en detalle.

B) ESTIMACIÓN DE TIEMPOS POR TEMA (OBLIGATORIO)
Para cada tema (ya normalizado) produce una estimación de:
- baseStudyMinutes: minutos para aprenderlo “desde cero” (incluye comprensión + esquema + extracción de puntos examinables).
- recommendedContentLength: “concise” | “standard” | “extended”
  - concise: si el tema debe generarse para estudiarse en <= 45–60 min (muy focalizado en examinable).
  - standard: 60–120 min (equilibrado).
  - extended: >120 min (tema denso: ley/reglamento largo, procedimiento complejo o técnico con normativa).
- complexity: High | Medium | Low
- reviewPlan: plan de repaso espaciado específico para ese tema (ver sección D).
- totalPlannedMinutes: baseStudyMinutes + suma de repaso espaciado + (si aplica) minutos de test asociados.

Heurística mínima si NO hay metadatos (ajusta si el contenido real lo exige):
- Ley/reglamento denso: 120–240 baseStudyMinutes (partible en 2+ sesiones).
- Tema técnico (firmes, drenaje, túneles, estructuras): 90–150 baseStudyMinutes.
- Guía/procedimiento práctico: 60–120 baseStudyMinutes.
- Supuesto práctico: 120–180 baseStudyMinutes (por ser “hacer” + corregir + convertir errores en flashcards).

C) PLANIFICACIÓN DIARIA (OBLIGATORIO)
1. Genera una agenda día a día entre start_date y end_date (inclusive).
2. Puedes crear VARIAS sesiones en un mismo día (especialmente sábados).
3. La suma de durationMinutes de todas las sesiones de un día debe ser EXACTAMENTE igual a los minutos disponibles de ese día (o dejar como máximo 5–10 min de “buffer” si lo justificas en strategic_analysis).
4. Alterna carga cognitiva: evita >2 sesiones High consecutivas y alterna legislación/técnico/práctico para interleaving.
5. Fines de semana:
   - Sábado (más minutos): prioriza (a) test mixto, (b) supuesto práctico, (c) repaso acumulativo.
   - Domingo (poco tiempo): solo repaso_flashcards + mini-test ligero o repaso de errores.
6. “Fechas que son” (festivos típicos en España dentro del rango): 25/12, 01/01, 06/01.
   - Mantén sesión ligera (repaso_flashcards + mini test) y mueve carga pesada al día anterior/posterior.

D) REPASO ESPACIADO (OBLIGATORIO)
Implementa un spaced repetition explícito por tema.
Patrón base (ajústalo por dificultad y por disponibilidad):
- D+1: review_flashcards (10–25 min)
- D+3: review_flashcards (10–25 min)
- D+7: review_flashcards (15–35 min)
- D+14: review_flashcards (15–40 min)
- Últimos 3–4 días del timeline: repaso final (20–45 min por tema clave) + tests mixtos

Reglas:
- Cada sesión “study” debe disparar automáticamente la creación de flashcards (ver sección E).
- Las sesiones “review_flashcards” deben estar calendarizadas como sesiones reales (con date/duration).
- Ajusta los minutos de repaso según complexity:
  - Low: 10/10/15/15
  - Medium: 15/15/25/30
  - High: 20/25/35/40 (o divide el tema y reduce repaso por subparte)

E) FLASHCARDS + TESTS (BLUEPRINT OBLIGATORIO)
Para cada sesión “study”, define instrucciones operativas (en aiReasoning) para que el sistema genere:
Flashcards (mínimo):
- Leyes/reglamentos: definiciones, competencias, órganos, plazos, procedimientos, documentos, infracciones/sanciones, umbrales, servidumbres, artículos “trampa”.
- Técnicos: conceptos, criterios de diseño, parámetros típicos, normativa aplicable, pasos de dimensionamiento, errores frecuentes.
- Procedimientos/guías: checklist, secuencia de pasos, “si/entonces”, documentación, informes, resoluciones.

Tests:
- Micro-test diario (incluido al final de la sesión o como sesión test_practice):
  - 8–15 preguntas del tema del día + 3–5 preguntas de arrastre (temas vistos la semana anterior).
- Test semanal (sábado):
  - 40–80 preguntas mixtas (70% visto, 30% arrastre), con foco en fallos.
- Práctica de supuestos:
  - “Simulacro”: resolver + comparar + extraer 10–20 flashcards de errores.

F) IDS Y SLUGS
- topicId debe ser el ID real de la base de datos si existe.
- Si NO existe, genera un slug estable:
  - minúsculas, sin tildes, espacios→“-”, elimina signos, prefijo con grupo.
  - Ej: “carreteras-y-transportes-ley-carreteras-canarias-9-1991”
- Para sesiones que no son un tema único (p.ej. “Test mixto semanal”), usa topicId tipo:
  - “test-mixto-YYYY-MM-DD” o “repaso-acumulado-YYYY-MM-DD”

G) HORARIOS Y DESCANSOS
- Si el usuario NO da preferencias:
  - L-V: startTime “9:00”
  - Sábado: “09:30” (bloque 1) y “16:30” (bloque 2) y/o “19:00” (bloque 3 si aplica)
  - Domingo: “10:00”
- breaks:
  - study High: “Pomodoro 50/10”
  - study Medium/Low: “Pomodoro 40/10”
  - review_flashcards: “Pomodoro 25/5”
  - test_practice: “Bloques 45/15”

H) VALIDACIÓN FINAL (OBLIGATORIO)
Antes de devolver el JSON, verifica internamente:
- Cada fecha del rango aparece (con 1+ sesiones).
- Cada día respeta su cupo de minutos.
- Todos los temas normalizados aparecen al menos una vez como “study” o “test_practice” (si son supuestos).
- Hay repasos espaciados programados para lo estudiado.
- Hay tests semanales + repasos finales.

OUTPUT (SOLO JSON VÁLIDO, sin texto extra)
Devuelve EXACTAMENTE un objeto JSON con estas claves:
{
  "strategic_analysis": "Markdown dentro del string. Incluir: (1) estrategia, (2) cálculo carga, (3) reglas repaso, (4) blueprint, (5) festivos, (6) supuestos.",
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
      "aiReasoning": "Por qué hoy + qué generar + enfoque.",
      "complexity": "High|Medium|Low"
    }
  ]
}

RESTRICCIONES CRÍTICAS ADICIONALES:
1. NO programes NUNCA documentos de 'Context High-Level Info' (Convocatorias, Temarios, Listas). Solo sirven para que entiendas el alcance.
2. Horario Base OBLIGATORIO (salvo indicación contraria): 09:00 a 19:00. Rellena este tiempo con sesiones productivas y descansos explícitos.
3. Si el usuario pide un horario específico, úsalo. Si no, usa 09:00-19:00.`;

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
    if (title.includes("bases") || title.includes("información") || title.includes("convocatoria") || title.includes("suplementario")) {
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
