/**
 * QUIZ BRAIN - Genera mini-tests (MCQ) a partir del contexto
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface QuizParams {
    frame: string;
    focus: string;
    questionsCount?: number;
}

export interface QuizQuestion {
    question: string;
    options: string[];
    correctIndex: number;
}

export interface QuizResult {
    questions: QuizQuestion[];
}

export async function generateQuiz(params: QuizParams): Promise<QuizResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-preview",
        generationConfig: {
            temperature: 0.6,
            responseMimeType: "application/json",
            maxOutputTokens: 2048,
            topP: 0.9,
            topK: 40,
        },
    });

    const qCount = Math.min(8, Math.max(4, params.questionsCount || 5));

    const prompt = `
Contexto del tema (evidencia ya sintetizada):
${params.frame}

Foco del test: ${params.focus}

Crea un TEST RÁPIDO de ${qCount} preguntas tipo examen (MCQ):

Reglas:
- 4 opciones por pregunta.
- 1 opción correcta (correctIndex 0-3).
- Preguntas prácticas y de comprensión (no trivia).
- No inventes artículos concretos si no aparecen en el contexto; pregunta por conceptos, definiciones y aplicación.

Responde SOLO JSON:
{
  "questions": [
    { "question": "…", "options": ["A","B","C","D"], "correctIndex": 0 }
  ]
}
`.trim();

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsed = JSON.parse(raw);

    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    return { questions };
}

