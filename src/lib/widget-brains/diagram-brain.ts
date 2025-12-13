/**
 * DIAGRAM BRAIN - Genera diagramas Mermaid para entender estructuras/procedimientos
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface DiagramParams {
    frame: string;
    concept: string;
}

export interface DiagramResult {
    structure: string; // Mermaid
}

export async function generateDiagram(params: DiagramParams): Promise<DiagramResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-preview",
        generationConfig: {
            temperature: 0.5,
            responseMimeType: "application/json",
            maxOutputTokens: 2048,
            topP: 0.9,
            topK: 40,
        },
    });

    const prompt = `
Contexto:
${params.frame}

Concepto: ${params.concept}

Genera un diagrama Mermaid CLARO para visualizar el concepto.

Reglas:
- Devuelve solo Mermaid (graph LR / flowchart TD / sequenceDiagram).
- Debe ser legible y corto (máx 18 nodos).
- No incluyas backticks, solo el texto Mermaid.

Responde SOLO JSON:
{ "structure": "graph TD\\nA-->B\\n..." }
`.trim();

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsed = JSON.parse(raw);

    return { structure: String(parsed?.structure || "") };
}

