/**
 * MNEMONIC BRAIN - Genera reglas mnemotécnicas inteligentes
 * 
 * Basado en el contexto del tema, crea acrónimos o frases
 * memorables para ayudar a recordar conceptos clave.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface MnemonicParams {
    frame: string;
    termsToMemorize: string[];
}

export interface MnemonicResult {
    rule: string;
    explanation: string;
}

export async function generateMnemonic(params: MnemonicParams): Promise<MnemonicResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
        generationConfig: {
            temperature: 0.9, // Alta creatividad
            responseMimeType: "application/json"
        }
    });
    
    const prompt = `
Contexto del tema:
${params.frame}

Términos a memorizar: ${params.termsToMemorize.join(', ')}

Crea una REGLA MNEMOTÉCNICA memorable para oposiciones ITOP:

Requisitos:
- Acrónimo pegadizo o frase memorable
- Relacionada con el contexto del tema
- Fácil de recordar en examen bajo presión
- Que ayude específicamente con estos términos

Ejemplos de buenas mnemotecnias:
- "REARCOM": Red Estatal, Autonómica, Regional, COMarcal (para clasificación de carreteras)
- "DPMT: Donde Pega el Mar con Tierra" (para recordar Dominio Público Marítimo Terrestre)

Responde JSON:
{
  "rule": "[Acrónimo o frase corta y memorable]",
  "explanation": "[Cómo se relaciona cada letra/palabra con los términos. Máximo 3 líneas.]"
}
`;
    
    try {
        console.log('[MNEMONIC-BRAIN] Generating mnemonic for:', params.termsToMemorize.join(', '));
        
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = JSON.parse(text);
        
        console.log('[MNEMONIC-BRAIN] Generated mnemonic:', parsed.rule);
        
        return {
            rule: parsed.rule,
            explanation: parsed.explanation
        };
        
    } catch (error) {
        console.error('[MNEMONIC-BRAIN] Error:', error);
        throw new Error(`Failed to generate mnemonic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

