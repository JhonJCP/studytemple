/**
 * EXPERT PRACTICAL - Experto en resolución de supuestos prácticos
 * 
 * Accede a category='PRACTICE' para analizar supuestos reales y generar
 * guías de resolución paso a paso con fórmulas y referencias normativas.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { queryByCategory, formatChunksAsEvidence, type DocumentChunk } from "./rag-helpers";
import type { TopicWithGroup } from "./syllabus-hierarchy";

// ============================================
// TYPES
// ============================================

export interface ExpertOutput {
    content: string;
    references?: string[];
    confidence: number;
    gaps?: string[];
    metadata?: Record<string, any>;
}

interface ExpertPracticalParams {
    topic: TopicWithGroup;
    targetWords: number;
    practiceExamples?: string[];
    commonCalculations?: string[];
}

// ============================================
// EXPERT PRACTICAL CLASS
// ============================================

export class ExpertPractical {
    private genAI: GoogleGenerativeAI;
    
    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
    }
    
    /**
     * Generar draft práctico con guía de resolución
     */
    async generate(params: ExpertPracticalParams): Promise<ExpertOutput> {
        console.log(`[EXPERT-PRACTICAL] Generating for: ${params.topic.title}`);
        console.log(`[EXPERT-PRACTICAL] Target words: ${params.targetWords}`);
        
        // Query a PRACTICE
        const practiceChunks = await this.queryPracticeSupuestos(
            params.topic.title,
            params.practiceExamples || []
        );
        
        if (practiceChunks.length === 0) {
            console.warn('[EXPERT-PRACTICAL] No PRACTICE chunks found');
            return {
                content: this.generateFallbackContent(params.topic, params.targetWords),
                confidence: 0.5,
                gaps: ['No se encontraron supuestos prácticos relacionados'],
                metadata: { source: 'fallback' }
            };
        }
        
        console.log(`[EXPERT-PRACTICAL] Found ${practiceChunks.length} practice chunks`);
        
        // Generar contenido con LLM
        const evidenceSummary = formatChunksAsEvidence(practiceChunks, 15);
        
        const prompt = `
Eres un EXPERTO EN RESOLUCIÓN DE SUPUESTOS PRÁCTICOS de oposición ITOP.

TEMA: "${params.topic.title}"
GRUPO: "${params.topic.groupTitle}"
TARGET: ${params.targetWords} palabras

SUPUESTOS REALES RELACIONADOS (${practiceChunks.length} fragmentos):
${evidenceSummary}

${params.practiceExamples && params.practiceExamples.length > 0 ? `
SUPUESTOS ESPECÍFICOS DONDE APARECE ESTE TEMA:
${params.practiceExamples.join(', ')}
` : ''}

${params.commonCalculations && params.commonCalculations.length > 0 ? `
CÁLCULOS COMUNES EN SUPUESTOS:
${params.commonCalculations.join('\n')}
` : ''}

═══════════════════════════════════════════════════════════════
TU TAREA
═══════════════════════════════════════════════════════════════

Genera una GUÍA PRÁCTICA DE RESOLUCIÓN (~${params.targetWords} palabras) cubriendo:

1. **Estructura de Solución** (4-5 pasos concretos):
   - Cómo abordar un supuesto tipo de este tema
   - Qué normativa identificar primero
   - En qué orden hacer los cálculos
   - Cómo redactar la conclusión
   
2. **Fórmulas Clave** con referencias normativas:
   - Fórmulas que aparecen en múltiples supuestos
   - Parámetros típicos y valores estándar
   - Unidades y conversiones necesarias
   - Ejemplo numérico resuelto paso a paso
   
3. **Normativa Aplicable**:
   - Leyes y artículos que se citan en soluciones
   - Referencias específicas (Ley X/YYYY, Art. N)
   - Normativa técnica relevante (Normas IC, ROM, etc.)
   
4. **Errores Comunes** a evitar:
   - Qué olvidan típicamente los opositores
   - Trampas en enunciados
   - Cálculos que se suelen hacer mal

5. **Ejemplo Resuelto Condensado**:
   - Supuesto tipo paso a paso
   - Justificación de cada decisión
   - Resultado numérico si aplica

REQUISITOS:
- Enfoque 100% PRÁCTICO (no teoría abstracta)
- Cita supuestos reales: "En Supuesto 3 se pregunta..." o "Según solución Supuesto 9..."
- Fórmulas con referencia: "e = f(CBR) según Norma 6.1-IC"
- Formato Markdown con listas, negritas, subsecciones h3
- ${params.targetWords} palabras ±30

RESPONDE EXCLUSIVAMENTE JSON:
{
  "content": "[Guía práctica completa en Markdown]",
  "resolutionSteps": ["Paso 1: ...", "Paso 2: ...", ...],
  "keyFormulas": [
    {
      "formula": "zona_protección = distancia según tipo",
      "reference": "Art. 7 Ley 9/1991",
      "appearsIn": ["Supuesto 1", "Supuesto 11"],
      "example": "Carretera estatal → 50m"
    }
  ],
  "commonMistakes": ["Error común 1", "Error común 2"],
  "practicalTips": ["Tip 1", "Tip 2"],
  "confidence": 0.9
}
`;
        
        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-3-pro-preview',
                generationConfig: {
                    temperature: 0.7, // Más creativo para ejemplos prácticos
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json",
                    topP: 0.85,
                    topK: 40
                }
            });
            
            const result = await model.generateContent(prompt);
            const raw = result.response.text();
            
            let json: any;
            try {
                json = JSON.parse(raw);
            } catch (parseErr) {
                console.error('[EXPERT-PRACTICAL] JSON parse error:', parseErr);
                return {
                    content: this.generateFallbackContent(params.topic, params.targetWords),
                    confidence: 0.6,
                    gaps: ['Error parseando respuesta del modelo']
                };
            }
            
            const wordCount = this.countWords(json.content || '');
            
            console.log(`[EXPERT-PRACTICAL] Generated ${wordCount} words (target: ${params.targetWords})`);
            
            return {
                content: json.content || '',
                references: json.keyFormulas?.map((f: any) => f.reference) || [],
                confidence: json.confidence || 0.85,
                gaps: [],
                metadata: {
                    resolutionSteps: json.resolutionSteps || [],
                    keyFormulas: json.keyFormulas || [],
                    commonMistakes: json.commonMistakes || [],
                    practicalTips: json.practicalTips || [],
                    wordCount,
                    source: 'PRACTICE'
                }
            };
            
        } catch (error) {
            console.error('[EXPERT-PRACTICAL] LLM error:', error);
            return {
                content: this.generateFallbackContent(params.topic, params.targetWords),
                confidence: 0.5,
                gaps: ['Error generando con LLM: ' + (error instanceof Error ? error.message : 'unknown')]
            };
        }
    }
    
    /**
     * Query a PRACTICE con supuestos relacionados
     */
    private async queryPracticeSupuestos(
        topicTitle: string,
        practiceExamples: string[]
    ): Promise<DocumentChunk[]> {
        
        // Extraer keywords del título
        const keywords = this.extractTopicKeywords(topicTitle);
        
        console.log(`[EXPERT-PRACTICAL] Querying PRACTICE with keywords:`, keywords);
        
        const rawChunks = await queryByCategory(topicTitle, 'PRACTICE', 20);
        
        // Convertir a DocumentChunk
        const chunks: DocumentChunk[] = rawChunks.map((doc: any) => ({
            source_id: `db-${doc.id}`,
            filename: doc.metadata?.filename || 'Unknown',
            fragment: doc.content || '',
            category: 'PRACTICE',
            chunk_index: doc.metadata?.chunk_index ?? 0,
            confidence: 0.9
        }));
        
        // Priorizar chunks de practiceExamples si están especificados
        if (practiceExamples.length > 0) {
            chunks.sort((a, b) => {
                const aMatch = practiceExamples.some(ex => 
                    a.filename.toLowerCase().includes(ex.toLowerCase())
                );
                const bMatch = practiceExamples.some(ex => 
                    b.filename.toLowerCase().includes(ex.toLowerCase())
                );
                
                if (aMatch && !bMatch) return -1;
                if (!aMatch && bMatch) return 1;
                return 0;
            });
        }
        
        return chunks;
    }
    
    /**
     * Extraer keywords del título
     */
    private extractTopicKeywords(title: string): string[] {
        const stopWords = ['de', 'del', 'la', 'el', 'los', 'las', 'y', 'o'];
        
        return title
            .toLowerCase()
            .split(/[\s,\-]+/)
            .filter(w => w.length > 3 && !stopWords.includes(w));
    }
    
    /**
     * Contar palabras
     */
    private countWords(text: string): number {
        if (!text) return 0;
        return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    }
    
    /**
     * Generar contenido fallback si no hay PRACTICE disponible
     */
    private generateFallbackContent(topic: TopicWithGroup, targetWords: number): string {
        return `## Guía de Resolución de Supuestos: ${topic.title}

### Estructura General de Solución

Para resolver supuestos prácticos relacionados con **${topic.title}**, se recomienda seguir estos pasos:

1. **Análisis del Enunciado**:
   - Identificar el problema o situación planteada
   - Extraer datos numéricos y parámetros clave
   - Determinar qué se está preguntando exactamente

2. **Marco Normativo**:
   - Identificar leyes y reglamentos aplicables
   - Localizar artículos específicos relevantes
   - Citar normativa técnica si es necesario

3. **Desarrollo de la Solución**:
   - Aplicar procedimientos establecidos
   - Realizar cálculos justificados paso a paso
   - Verificar cumplimiento de normativa

4. **Conclusiones y Recomendaciones**:
   - Respuesta clara a lo preguntado
   - Justificación basada en normativa
   - Recomendaciones técnicas si aplican

### Notas

*Esta guía es genérica. Para contenido específico basado en supuestos reales, se requiere acceso a la categoría PRACTICE en la base de datos.*

**Revisión recomendada**: Consultar supuestos anteriores de este tema para identificar patrones específicos.
`;
    }
}

