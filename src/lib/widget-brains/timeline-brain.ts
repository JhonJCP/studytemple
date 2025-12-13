/**
 * TIMELINE BRAIN - Genera secuencias de pasos (tipo timeline) para procedimientos/decisiones
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface TimelineParams {
    frame: string;
    concept: string;
}

export interface TimelineResult {
    steps: Array<{ time: string; action: string }>;
}

export async function generateTimeline(params: TimelineParams): Promise<TimelineResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-preview",
        generationConfig: {
            temperature: 0.55,
            responseMimeType: "application/json",
            maxOutputTokens: 2048,
            topP: 0.9,
            topK: 40,
        },
    });

    const prompt = `
Contexto:
${params.frame}

Concepto/Procedimiento: ${params.concept}

Genera una "timeline" de 6-10 pasos:
- time: etiqueta corta (p.ej. "Paso 1", "Antes", "Durante", "Después", o un hito).
- action: acción concreta y breve.

Responde SOLO JSON:
{
  "steps": [
    { "time": "Paso 1", "action": "..." }
  ]
}
`.trim();

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsed = JSON.parse(raw);
    const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
    return { steps };
}

