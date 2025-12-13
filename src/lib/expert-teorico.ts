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
import { LEGAL_ACADEMIC_FORMAT, EXPERT_TEORICO_TEMPLATE } from "./prompts/legal-academic-template";
import { safeParseJSON, countWords } from "./json-utils";

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
        
        const evidenceSummary = formatChunksAsEvidence(coreChunks, 18);
        
        const prompt = `
${LEGAL_ACADEMIC_FORMAT}

${EXPERT_TEORICO_TEMPLATE}

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
TU TAREA: TRANSCRIPCIÓN Y ANÁLISIS LEGAL
═══════════════════════════════════════════════════════════════

Genera "Marco Normativo Clave" (~${params.targetWords} palabras) con:

1. **Objeto y Clasificación** (con transcripciones literales):
   - Qué regula la norma
   - Clasificaciones según la ley (transcribir artículo completo)
   - Usar bullet structure jerárquica

2. **Artículos Clave Transcritos**:
   - Seleccionar 3-5 artículos FUNDAMENTALES
   - Transcribir LITERALMENTE: "Artículo X establece: '[TEXTO EXACTO DE LA LEY]'"
   - Añadir interpretación técnica breve después

3. **Competencias** (estructura clara):
   - Qué organismo tiene competencia (transcribir artículo)
   - Responsabilidades específicas (lista numerada si procede)

4. **Referencias Normativas**:
   - Normativa de desarrollo
   - Leyes relacionadas

CRÍTICO:
- Usa SOLO la evidencia (no inventes artículos).
- Incluye transcripciones literales (entre comillas) copiadas de la evidencia.
- Cita (Art. N ...) al final de afirmaciones relevantes.
- Objetivo de longitud: ~${params.targetWords} palabras.

RESPONDE usando EXACTAMENTE el JSON definido en EXPERT_TEORICO_TEMPLATE (sin campos extra).
`;
        
        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-3-pro-preview',
                generationConfig: {
                    temperature: 0.5, // Conservador para precisión legal
                    maxOutputTokens: 8192,
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
            console.log(`[EXPERT-TEORICO] Generated ${wordCount} words`);
            
            // Extraer sourceMetadata si está disponible
            const sections = json.sections || [];
            
            return {
                content: json.content || '',
                references: json.references || [],
                confidence: json.confidence || 0.85,
                gaps: json.gaps || [],
                metadata: {
                    wordCount,
                    source: 'CORE',
                    sections: sections, // Incluir secciones con metadata
                    literalArticles: json.literalArticles || [],
                    sources: json.sources || null
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
        const rawChunks = await queryByCategory(topic.title, 'CORE', 30, topic.originalFilename);
        
        return rawChunks.map((doc: any) => ({
            source_id: `db-${doc.id}`,
            filename: doc.metadata?.filename || topic.originalFilename,
            fragment: doc.content || '',
            category: 'CORE',
            chunk_index: doc.metadata?.chunk_index ?? 0,
            confidence: 0.9
        }));
    }
}
