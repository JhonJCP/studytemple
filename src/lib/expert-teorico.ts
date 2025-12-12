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

1. **Objeto y Clasificación** (usar § y transcripciones literales):
   - Qué regula la norma
   - Clasificaciones según la ley (transcribir artículo completo)
   - Usar bullet structure jerárquica

2. **Artículos Clave Transcritos**:
   - Seleccionar 3-5 artículos FUNDAMENTALES
   - Transcribir LITERALMENTE: "Artículo X establece: '[TEXTO EXACTO DE LA LEY]'"
   - Añadir interpretación técnica breve después

3. **Competencias** (estructura § clara):
   - Qué organismo tiene competencia (transcribir artículo)
   - Responsabilidades específicas (lista numerada si procede)

4. **Referencias Normativas**:
   - Normativa de desarrollo
   - Leyes relacionadas

⚠️ CRÍTICO: 
- USA SOLO LA EVIDENCIA (no inventes artículos)
- TRANSCRIBE literalmente (entre comillas)
- Cita número de artículo DESPUÉS de cada afirmación
- Usa § para estructura temática
- ${params.targetWords} palabras ±30
- INCLUYE sourceMetadata con chunkId y originalText para CADA sección

RESPONDE JSON con sourceMetadata:
{
  "content": "[Markdown con formato académico-legal]",
  "sections": [
    {
      "id": "clasificacion",
      "title": "Clasificación según la Ley",
      "text": "La LCC distingue § :\\n• **Regionales**: Corresponden a la CA § .",
      "sourceMetadata": {
        "document": "[filename del chunk]",
        "article": "Artículo 3",
        "chunkId": "[source_id del chunk]",
        "originalText": "[Transcripción COMPLETA del artículo]",
        "confidence": 0.95
      }
    }
  ],
  "literalArticles": [
    {
      "article": "Artículo 3",
      "text": "[Transcripción literal completa]",
      "interpretation": "[Breve explicación técnica]"
    }
  ],
  "references": ["Art. 3 Ley 9/1991", "Art. 5", ...],
  "confidence": 0.95
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
                    literalArticles: json.literalArticles || []
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


