/**
 * CASE PRACTICE BRAIN - Genera mini casos prácticos
 * 
 * Basado en el contexto teórico, crea situaciones realistas
 * de oposiciones ITOP con solución paso a paso.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface CasePracticeParams {
    frame: string;
    concept: string;
}

export interface CasePracticeResult {
    scenario: string;
    solution: string;
}

export async function generateCasePractice(params: CasePracticeParams): Promise<CasePracticeResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({
        model: 'gemini-3-pro-preview',
        generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
        }
    });
    
    const prompt = `
Contexto teórico:
${params.frame}

Concepto clave: ${params.concept}

Crea un CASO PRÁCTICO MINI (200 palabras máximo total):

Requisitos:
- Situación realista de oposición ITOP (Ingeniero Técnico Obras Públicas, Canarias)
- Aplica el concepto directamente
- Solución paso a paso justificada con normativa
- Lenguaje profesional pero claro

Estructura:
- Enunciado: 2-3 frases describiendo la situación
- Solución: Paso a paso con justificación normativa

Responde JSON:
{
  "scenario": "[Enunciado del caso: situación concreta que requiere aplicar el concepto]",
  "solution": "[Solución explicada paso a paso con referencias normativas]"
}
`;
    
    try {
        console.log('[CASE-PRACTICE-BRAIN] Generating case for:', params.concept);
        
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = JSON.parse(text);
        
        console.log('[CASE-PRACTICE-BRAIN] Generated case scenario');
        
        return {
            scenario: parsed.scenario,
            solution: parsed.solution
        };
        
    } catch (error) {
        console.error('[CASE-PRACTICE-BRAIN] Error:', error);
        throw new Error(`Failed to generate case practice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
