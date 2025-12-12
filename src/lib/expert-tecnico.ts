/**
 * EXPERT TECNICO - Experto en fórmulas, cálculos y normativa técnica
 * 
 * Accede a category='CORE' y 'SUPPLEMENTARY' para generar:
 * - Definiciones técnicas
 * - Fórmulas y cálculos
 * - Parámetros y criterios técnicos
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { queryByCategory, formatChunksAsEvidence, type DocumentChunk } from "./rag-helpers";
import type { TopicWithGroup } from "./syllabus-hierarchy";
import type { ExpertOutput } from "./expert-practical";
import { LEGAL_ACADEMIC_FORMAT } from "./prompts/legal-academic-template";
import { safeParseJSON, countWords } from "./json-utils";

interface ExpertTecnicoParams {
    topic: TopicWithGroup;
    targetWords: number;
    commonCalculations?: string[];
}

export class ExpertTecnico {
    private genAI: GoogleGenerativeAI;
    
    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
    }
    
    async generate(params: ExpertTecnicoParams): Promise<ExpertOutput> {
        console.log(`[EXPERT-TECNICO] Generating for: ${params.topic.title}`);
        
        // Query a CORE y SUPPLEMENTARY
        const coreChunks = await queryByCategory(params.topic.title, 'CORE', 12, params.topic.originalFilename);
        const suppChunks = await queryByCategory(params.topic.title, 'SUPPLEMENTARY', 10, params.topic.originalFilename);
        
        const allChunks = [...coreChunks, ...suppChunks].map((doc: any) => ({
            source_id: `db-${doc.id}`,
            filename: doc.metadata?.filename || 'Unknown',
            fragment: doc.content || '',
            category: doc.metadata?.category || 'UNKNOWN',
            chunk_index: doc.metadata?.chunk_index ?? 0,
            confidence: doc.metadata?.category === 'CORE' ? 0.95 : 0.80
        }));
        
        if (allChunks.length === 0) {
            console.warn('[EXPERT-TECNICO] No technical chunks found');
            return {
                content: `## Conceptos Técnicos: ${params.topic.title}\n\nContenido pendiente por falta de documentos.`,
                confidence: 0.4,
                gaps: ['No se encontraron documentos técnicos']
            };
        }
        
        console.log(`[EXPERT-TECNICO] Found ${coreChunks.length} CORE + ${suppChunks.length} SUPP chunks`);
        
        const evidenceSummary = formatChunksAsEvidence(allChunks, 12);
        
        const prompt = `
${LEGAL_ACADEMIC_FORMAT}

Eres un EXPERTO TÉCNICO en ingeniería de obras públicas.

TEMA: "${params.topic.title}"
TARGET: ${params.targetWords} palabras

EVIDENCIA TÉCNICA (${allChunks.length} fragmentos CORE+SUPPLEMENTARY):
${evidenceSummary}

${params.commonCalculations && params.commonCalculations.length > 0 ? `
CÁLCULOS COMUNES IDENTIFICADOS:
${params.commonCalculations.join('\n')}
` : ''}

═══════════════════════════════════════════════════════════════
TU TAREA
═══════════════════════════════════════════════════════════════

Genera la sección "Conceptos Técnicos y Cálculos" (~${params.targetWords} palabras) cubriendo:

1. **Definiciones Técnicas Precisas**:
   - Términos clave con definición exacta
   - Referencias a normativa técnica
   - Clasificaciones y taxonomías

2. **Fórmulas y Cálculos**:
   - Fórmulas fundamentales con nombre y referencia
   - Parámetros y sus rangos típicos
   - Unidades y conversiones
   - Ejemplo numérico simple

3. **Criterios Técnicos**:
   - Valores límite y umbrales
   - Condiciones de aplicación
   - Requisitos normativos (Normas IC, ROM, UNE, etc.)

4. **Características y Propiedades**:
   - Propiedades de materiales si aplica
   - Métodos de ensayo
   - Criterios de aceptación

REQUISITOS:
- Enfoque TÉCNICO y CUANTITATIVO
- Fórmulas con referencia normativa: "e = f(CBR) según Norma 6.1-IC"
- Valores numéricos concretos cuando sea posible
- Formato Markdown con subsecciones h3
- ${params.targetWords} palabras ±30

RESPONDE JSON:
{
  "content": "[Markdown técnico de ${params.targetWords} palabras]",
  "definitions": ["Término 1", "Término 2", ...],
  "formulas": [
    {
      "name": "Espesor de firme",
      "formula": "e = f(CBR)",
      "reference": "Norma 6.1-IC",
      "parameters": ["CBR", "categoría tráfico"]
    }
  ],
  "confidence": 0.9
}
`;
        
        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-3-pro-preview',
                generationConfig: {
                    temperature: 0.6,
                    maxOutputTokens: 4096,
                    responseMimeType: "application/json",
                    topP: 0.85,
                    topK: 40
                }
            });
            
            const result = await model.generateContent(prompt);
            const raw = result.response.text();
            const { json, error } = safeParseJSON(raw);
            if (error || !json) {
                throw new Error(`JSON parse error: ${error || 'unknown'}`);
            }
            
            const wordCount = countWords(json.content || '');
            console.log(`[EXPERT-TECNICO] Generated ${wordCount} words`);
            
            return {
                content: json.content || '',
                references: json.formulas?.map((f: any) => f.reference) || [],
                confidence: json.confidence || 0.85,
                gaps: [],
                metadata: {
                    definitions: json.definitions || [],
                    formulas: json.formulas || [],
                    wordCount,
                    source: 'CORE+SUPPLEMENTARY'
                }
            };
            
        } catch (error) {
            console.error('[EXPERT-TECNICO] Error:', error);
            return {
                content: `## Conceptos Técnicos: ${params.topic.title}\n\nError generando contenido.`,
                confidence: 0.5,
                gaps: ['Error en generación']
            };
        }
    }
}

