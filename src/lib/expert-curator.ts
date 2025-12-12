/**
 * EXPERT CURATOR - Experto en filtrado de contenido esencial
 * 
 * Analiza drafts de expertos y asigna scoring de criticidad basado en:
 * - Frecuencia en supuestos prácticos reales (PRACTICE)
 * - Importancia teórica del concepto
 * - Aplicabilidad práctica
 * 
 * Output: Reporte de curación con recomendaciones KEEP_FULL/DROP
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ExpertOutput } from "./expert-practical";
import type { PracticePatterns } from "./global-planner";

// ============================================
// TYPES
// ============================================

export interface ConceptCriticality {
    score: number; // 0-1
    examFrequency: number;
    theoreticalImportance: number;
    practiceRelevance: number;
    calculationRequired: boolean;
    appearsInSupuestos: string[];
}

export interface CuratedConcept {
    id: string;
    text: string;
    source: 'expert-teorico' | 'expert-practical' | 'expert-tecnico';
    criticality: ConceptCriticality;
    reasoning: string;
    recommendation: 'KEEP_FULL' | 'KEEP_SUMMARY' | 'OPTIONAL' | 'DROP';
}

export interface CurationReport {
    concepts: CuratedConcept[];
    summary: {
        totalConcepts: number;
        critical: number;
        important: number;
        optional: number;
        droppable: number;
    };
    practiceReadiness: number; // 0-1
    overallAssessment: string;
}

// ============================================
// EXPERT CURATOR CLASS
// ============================================

export class ExpertCurator {
    private genAI: GoogleGenerativeAI;
    
    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
    }
    
    /**
     * Analizar drafts y generar reporte de curación
     */
    async analyze(params: {
        drafts: ExpertOutput[];
        practicePatterns: PracticePatterns;
        topicImportance: 'HIGH' | 'MEDIUM' | 'LOW';
    }): Promise<CurationReport> {
        
        console.log('[CURATOR] Analyzing drafts for curation...');
        console.log(`[CURATOR] Topic importance: ${params.topicImportance}`);
        
        const totalWords = params.drafts.reduce((sum, d) => 
            sum + this.countWords(d.content), 0
        );
        
        console.log(`[CURATOR] Total words from experts: ${totalWords}`);
        
        // Preparar evidencia de supuestos
        const practiceEvidence = this.formatPracticePatterns(params.practicePatterns);
        
        const prompt = `
Eres un PROFESOR EXPERTO en oposiciones ITOP con 20 años preparando la PARTE PRÁCTICA.

CONTEXTO:
- Importancia del tema: ${params.topicImportance}
- Tiempo de estudio: LIMITADO (alumno necesita solo lo esencial)

DRAFTS DE EXPERTOS (${totalWords} palabras totales):

### DRAFT TEÓRICO:
${params.drafts[0]?.content || 'No disponible'}

### DRAFT PRÁCTICO:
${params.drafts[1]?.content || 'No disponible'}

### DRAFT TÉCNICO:
${params.drafts[2]?.content || 'No disponible'}

PATRONES DE SUPUESTOS REALES:
${practiceEvidence}

═══════════════════════════════════════════════════════════════
TU TAREA CRÍTICA: SCORING DE CRITICIDAD
═══════════════════════════════════════════════════════════════

Analiza CADA CONCEPTO en los drafts y clasifícalo para APROBAR LA PARTE PRÁCTICA.

CRITERIOS (orden de importancia):

1. **Frecuencia en supuestos reales** (peso: 50%):
   - Aparece en >60% supuestos → CRÍTICO (score 0.8-1.0)
   - Aparece en 30-60% → IMPORTANTE (score 0.5-0.79)
   - Aparece en <30% → OPCIONAL (score 0.2-0.49)
   - Nunca aparece → PRESCINDIBLE (score 0-0.19)
   
2. **Tipo de contenido** (peso: 30%):
   - Fórmulas de cálculo → CRÍTICO (supuestos son cuantitativos)
   - Normativa aplicable → CRÍTICO (hay que justificar)
   - Definiciones base → IMPORTANTE
   - Contexto histórico → PRESCINDIBLE

3. **Aplicabilidad práctica** (peso: 20%):
   - Requiere cálculo numérico → CRÍTICO
   - Procedimiento administrativo → IMPORTANTE
   - Concepto memorizable → IMPORTANTE
   - Dato aislado → OPCIONAL

EJEMPLO DE ANÁLISIS:

Concepto: "Art. 3 - Clasificación de carreteras (5 tipos)"
- Frecuencia: Aparece en Supuestos 1, 11, 13, 14 = 4/15 (27%) → IMPORTANTE
- Tipo: Normativa base → CRÍTICO
- Aplicabilidad: Se pregunta directamente → CRÍTICO
→ SCORE FINAL: 0.88 → KEEP_FULL

Concepto: "Historia de la legislación de carreteras en España"
- Frecuencia: 0/15 supuestos (0%) → NO RELEVANTE
- Tipo: Contexto histórico → PRESCINDIBLE
- Aplicabilidad: N/A
→ SCORE FINAL: 0.05 → DROP

INSTRUCCIONES:
1. Identifica 20-30 conceptos discretos en los drafts
2. Asigna score de criticidad (0-1) según criterios
3. Recomienda: KEEP_FULL (crítico), KEEP_SUMMARY (importante), OPTIONAL (secundario), DROP (paja)
4. Calcula practiceReadiness: % de contenido útil para supuestos

RESPONDE JSON:
{
  "concepts": [
    {
      "id": "clasificacion-carreteras",
      "text": "[Extracto 1-2 frases del draft]",
      "source": "expert-teorico",
      "criticality": {
        "score": 0.88,
        "examFrequency": 0.27,
        "theoreticalImportance": 0.9,
        "practiceRelevance": 0.95,
        "calculationRequired": false,
        "appearsInSupuestos": ["Supuesto 1", "Supuesto 11"]
      },
      "reasoning": "Clasificación es base conceptual preguntada directamente en 4 supuestos",
      "recommendation": "KEEP_FULL"
    }
    // ... 19-29 conceptos más
  ],
  "summary": {
    "totalConcepts": 25,
    "critical": 12,
    "important": 8,
    "optional": 3,
    "droppable": 2
  },
  "practiceReadiness": 0.92,
  "overallAssessment": "El contenido es 92% útil para supuestos prácticos. Se detectó 8% de paja (conceptos históricos y transitorios)."
}
`;
        
        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-3-pro-preview',
                generationConfig: {
                    temperature: 0.4, // Conservador para scoring objetivo
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json",
                    topP: 0.85,
                    topK: 40
                }
            });
            
            const result = await model.generateContent(prompt);
            const raw = result.response.text();
            const json = JSON.parse(raw);
            
            console.log('[CURATOR] Analysis complete:', {
                concepts: json.concepts?.length || 0,
                critical: json.summary?.critical || 0,
                droppable: json.summary?.droppable || 0,
                practiceReadiness: json.practiceReadiness || 0
            });
            
            return json as CurationReport;
            
        } catch (error) {
            console.error('[CURATOR] Error:', error);
            
            // Fallback: reporte por defecto
            return {
                concepts: [],
                summary: {
                    totalConcepts: 0,
                    critical: 0,
                    important: 0,
                    optional: 0,
                    droppable: 0
                },
                practiceReadiness: 0.7,
                overallAssessment: 'Error en análisis de curación, usando estimación conservadora'
            };
        }
    }
    
    /**
     * Formatear practice patterns para el prompt
     */
    private formatPracticePatterns(patterns: PracticePatterns): string {
        return `
FRECUENCIA DE TEMAS EN SUPUESTOS:
${patterns.topicFrequency.map(t => 
    `- ${t.topic}: ${t.appearances}/15 (${(t.percentage * 100).toFixed(0)}%) - Ejemplos: ${t.examples.slice(0, 3).join(', ')}`
).join('\n')}

CÁLCULOS COMUNES:
${patterns.commonCalculations.map(c => 
    `- ${c.type}: Frecuencia ${c.frequency}/15 - Fórmula: ${c.formula}`
).join('\n')}

LEYES MÁS CITADAS:
${patterns.criticalLaws.map(l => 
    `- ${l.law}: Citada en ${l.appearances}/15 supuestos - Artículos clave: ${l.articles.join(', ')}`
).join('\n')}
`;
    }
    
    private countWords(text: string): number {
        if (!text) return 0;
        return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    }
}



