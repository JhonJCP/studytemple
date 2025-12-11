/**
 * EXPERT TEORICO - Experto en marco legal y normativo
 * 
 * Accede a category='CORE' para generar contenido sobre:
 * - Leyes y decretos
 * - Artículos clave
 * - Competencias y procedimientos
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { queryByCategory, formatChunksAsEvidence, type DocumentChunk } from "./rag-helpers";
import type { TopicWithGroup } from "./syllabus-hierarchy";
import type { ExpertOutput } from "./expert-practical";

interface ExpertTeoricoParams {
    topic: TopicWithGroup;
    targetWords: number;
    criticalLaws?: Array<{ law: string; articles: string[] }>;
}

export class ExpertTeorico {
    private genAI: GoogleGenerativeAI;
    
    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
    }
    
    async generate(params: ExpertTeoricoParams): Promise<ExpertOutput> {
        console.log(`[EXPERT-TEORICO] Generating for: ${params.topic.title}`);
        
        // Query a CORE
        const coreChunks = await this.queryCoreDocuments(params.topic);
        
        if (coreChunks.length === 0) {
            console.warn('[EXPERT-TEORICO] No CORE chunks found');
            return {
                content: `## Marco Legal: ${params.topic.title}\n\nContenido pendiente de generación por falta de documentos CORE.`,
                confidence: 0.4,
                gaps: ['No se encontraron documentos CORE']
            };
        }
        
        console.log(`[EXPERT-TEORICO] Found ${coreChunks.length} CORE chunks`);
        
        const evidenceSummary = formatChunksAsEvidence(coreChunks, 12);
        
        const prompt = `
Eres un EXPERTO LEGAL especializado en normativa de obras públicas.

TEMA: "${params.topic.title}"
DOCUMENTO BASE: "${params.topic.originalFilename}"
TARGET: ${params.targetWords} palabras

EVIDENCIA LEGAL (${coreChunks.length} fragmentos de CORE):
${evidenceSummary}

${params.criticalLaws && params.criticalLaws.length > 0 ? `
LEYES CRÍTICAS IDENTIFICADAS:
${params.criticalLaws.map(l => `- ${l.law}: ${l.articles.join(', ')}`).join('\n')}
` : ''}

═══════════════════════════════════════════════════════════════
TU TAREA
═══════════════════════════════════════════════════════════════

Genera la sección "Marco Legal y Normativo" (~${params.targetWords} palabras) cubriendo:

1. **Objeto y Ámbito** de la norma (2 párrafos):
   - Qué regula esta normativa
   - A quién aplica y dónde
   
2. **Artículos Clave** con transcripción literal:
   - 3-4 artículos fundamentales
   - Cita EXACTA: "Art. 3 de la Ley 9/1991 establece que..."
   - Interpretación técnica

3. **Competencias** y órganos responsables:
   - Quién tiene competencia (Estado, CCAA, Cabildos, Ayuntamientos)
   - Distribución de responsabilidades
   
4. **Referencias Cruzadas**:
   - Otras leyes relacionadas
   - Normativa de desarrollo

REQUISITOS:
- USA SOLO LA EVIDENCIA proporcionada (NO inventes artículos)
- Cita artículos EXACTOS de la evidencia
- Formato Markdown limpio (h3, listas, negritas)
- ${params.targetWords} palabras ±30

RESPONDE JSON:
{
  "content": "[Markdown de ${params.targetWords} palabras]",
  "references": ["Ley 9/1991 Art. 3", "Art. 5", "Decreto 131/1995", ...],
  "confidence": 0.9,
  "gaps": ["Opcional: conceptos que no encontraste en evidencia"]
}
`;
        
        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-3-pro-preview',
                generationConfig: {
                    temperature: 0.5, // Conservador para precisión legal
                    maxOutputTokens: 4096,
                    responseMimeType: "application/json",
                    topP: 0.85,
                    topK: 40
                }
            });
            
            const result = await model.generateContent(prompt);
            const raw = result.response.text();
            const json = JSON.parse(raw);
            
            const wordCount = this.countWords(json.content || '');
            console.log(`[EXPERT-TEORICO] Generated ${wordCount} words`);
            
            return {
                content: json.content || '',
                references: json.references || [],
                confidence: json.confidence || 0.85,
                gaps: json.gaps || [],
                metadata: {
                    wordCount,
                    source: 'CORE'
                }
            };
            
        } catch (error) {
            console.error('[EXPERT-TEORICO] Error:', error);
            return {
                content: `## Marco Legal: ${params.topic.title}\n\nError generando contenido.`,
                confidence: 0.5,
                gaps: ['Error en generación']
            };
        }
    }
    
    private async queryCoreDocuments(topic: TopicWithGroup): Promise<DocumentChunk[]> {
        const rawChunks = await queryByCategory(topic.title, 'CORE', 15);
        
        return rawChunks.map((doc: any) => ({
            source_id: `db-${doc.id}`,
            filename: doc.metadata?.filename || topic.originalFilename,
            fragment: doc.content || '',
            category: 'CORE',
            chunk_index: doc.metadata?.chunk_index ?? 0,
            confidence: 0.9
        }));
    }
    
    private countWords(text: string): number {
        if (!text) return 0;
        return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    }
}

