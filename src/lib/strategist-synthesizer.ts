/**
 * STRATEGIST SYNTHESIZER - Estratega sintetizador
 * 
 * Recibe drafts de 3 expertos + reporte de curación y genera contenido final:
 * - Sintetiza (NO reescribe desde cero)
 * - Prioriza conceptos críticos según scoring del curator
 * - Asigna widgets específicos
 * - Optimiza para parte práctica del examen
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ExpertOutput } from "./expert-practical";
import type { CurationReport } from "./expert-curator";
import type { StrategicPlan } from "./global-planner";
import type { GeneratedTopicContent, TopicSection } from "./widget-types";
import type { TopicWithGroup } from "./syllabus-hierarchy";

// ============================================
// STRATEGIST SYNTHESIZER CLASS
// ============================================

export class StrategistSynthesizer {
    private genAI: GoogleGenerativeAI;
    
    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
    }
    
    /**
     * Sintetizar contenido final
     */
    async synthesize(params: {
        topic: TopicWithGroup;
        drafts: ExpertOutput[];
        curationReport: CurationReport;
        strategicPlan: StrategicPlan;
    }): Promise<GeneratedTopicContent> {
        
        console.log('[STRATEGIST] Synthesizing final content...');
        
        const totalDraftWords = params.drafts.reduce((sum, d) => 
            sum + this.countWords(d.content), 0
        );
        
        console.log(`[STRATEGIST] Input: ${totalDraftWords} words from ${params.drafts.length} experts`);
        console.log(`[STRATEGIST] Target: ${params.strategicPlan.targetWords} words`);
        console.log(`[STRATEGIST] Practice readiness: ${(params.curationReport.practiceReadiness * 100).toFixed(0)}%`);
        
        const prompt = `
Eres el ESTRATEGA SINTETIZADOR para preparación de PARTE PRÁCTICA de oposición ITOP.

CONTEXTO ESTRATÉGICO:
- Tema: "${params.topic.title}"
- Tiempo asignado: ${params.strategicPlan.timeAllocation} minutos
- Estrategia: ${params.strategicPlan.strategy}
- Target final: ${params.strategicPlan.targetWords} palabras
- Practice readiness actual: ${(params.curationReport.practiceReadiness * 100).toFixed(0)}%

DRAFTS DE EXPERTOS (${totalDraftWords} palabras):

### DRAFT TEÓRICO (${this.countWords(params.drafts[0]?.content || '')} palabras):
${params.drafts[0]?.content || 'No disponible'}

### DRAFT PRÁCTICO (${this.countWords(params.drafts[1]?.content || '')} palabras):
${params.drafts[1]?.content || 'No disponible'}

### DRAFT TÉCNICO (${this.countWords(params.drafts[2]?.content || '')} palabras):
${params.drafts[2]?.content || 'No disponible'}

REPORTE DE CURACIÓN (CRÍTICO):
- Conceptos totales: ${params.curationReport.summary.totalConcepts}
- Críticos (KEEP_FULL): ${params.curationReport.summary.critical}
- Importantes (KEEP_SUMMARY): ${params.curationReport.summary.important}
- Prescindibles (DROP): ${params.curationReport.summary.droppable}
- Practice readiness: ${(params.curationReport.practiceReadiness * 100).toFixed(0)}%

CONCEPTOS CRÍTICOS (score >0.8):
${this.formatCriticalConcepts(params.curationReport)}

CONCEPTOS PRESCINDIBLES (score <0.2):
${this.formatDroppableConcepts(params.curationReport)}

═══════════════════════════════════════════════════════════════
INSTRUCCIONES DE SÍNTESIS
═══════════════════════════════════════════════════════════════

1. PRIORIZACIÓN ESTRICTA:
   - Conceptos con recommendation="KEEP_FULL" → INCLUIR COMPLETO
   - Conceptos con recommendation="KEEP_SUMMARY" → CONDENSAR A 2-3 FRASES
   - Conceptos con recommendation="OPTIONAL" → MENCIONAR 1 FRASE O OMITIR
   - Conceptos con recommendation="DROP" → ELIMINAR COMPLETAMENTE

2. ESTRUCTURA PARA PARTE PRÁCTICA:
   ${params.strategicPlan.targetSections} secciones enfocadas en resolución de supuestos:
   
   a) "Marco Normativo Clave" - Solo leyes citadas en supuestos
   b) "Conceptos y Definiciones Críticas" - Términos que caen en examen
   c) "Fórmulas y Cálculos" - Paso a paso con ejemplo numérico
   d) "Guía de Resolución" - Estructura tipo de solución
   ${params.strategicPlan.targetSections === 5 ? 'e) "Errores Comunes y Tips" - Qué evitar' : ''}

3. OBJETIVO DE PALABRAS:
   - Target: ${params.strategicPlan.targetWords} palabras (±50)
   - NO superar target (alumno tiene tiempo limitado)
   - Priorizar DENSIDAD: info útil por palabra

4. FORMATO "CHEAT SHEET":
   - Listas numeradas para procedimientos
   - Viñetas para características
   - Negritas en términos clave y fórmulas
   - Cajas destacadas para fórmulas críticas
   - Cero "paja" o introducciones genéricas

5. PRACTICE READINESS:
   - Objetivo: >90%
   - Cada sección debe ser aplicable a resolver supuestos
   - Incluir referencias a supuestos reales

6. WIDGETS INTELIGENTES:
   - Seleccionar 5-6 widgets más útiles
   - Tipos disponibles:
     * formula: Fórmulas matemáticas con LaTeX
     * infografia: Genera infografía visual del concepto (usa gemini-3-pro-image)
     * mnemonic_generator: Genera regla mnemotécnica inteligente
     * case_practice: Genera mini caso práctico aplicado
     * quiz: Test interactivo de autoevaluación
     * diagram: Diagrama Mermaid
     * timeline: Línea temporal
   - Prioridad: formula > infografia > mnemonic_generator > case_practice > quiz
   - IMPORTANTE: Incluir "contextFrame" (texto completo del párrafo donde aplica) y "conceptTopic" (concepto a explicar)

EJEMPLO DE SÍNTESIS ULTRA-CONCISA:

❌ MAL (paja):
"La Ley 9/1991 de Carreteras de Canarias fue promulgada con el objetivo de establecer un marco regulatorio integral para las carreteras en el ámbito territorial de la Comunidad Autónoma..."

✅ BIEN (esencial):
"**Ley 9/1991 Carreteras** (aparece en 8/15 supuestos)
- **Art. 3 - Clasificación**: Estatal, Autonómica, Insular, Comarcal, Municipal
- **Art. 7 - Zonas**: 50m (estatal), 25m (autonómica), 15m (insular)
- **Art. 5 - Competencias**: Cabildos (red insular), Aytos (red municipal)"

⚠️ CRÍTICO: 
- El campo "text" de cada sección DEBE contener el CONTENIDO REAL sintetizado
- NO usar placeholders como "[Texto aquí]" o "[Explicación]"
- Cada sección debe tener 150-200 palabras de contenido REAL
- INCLUIR el campo "sourceType" (library/mixed/augmented) en CADA sección

RESPONDE JSON EXACTO (sin comentarios, sin campos extra):
{
  "sections": [
    {
      "id": "marco-normativo",
      "title": "Marco Normativo Aplicable a Supuestos",
      "level": "h2",
      "sourceType": "library",
      "content": {
        "text": "**Ley 9/1991 Carreteras** (aparece en 8/15 supuestos)\\n- **Art. 3 - Clasificación**: Estatal, Autonómica, Insular, Comarcal, Municipal\\n- **Art. 7 - Zonas**: 50m (estatal), 25m (autonómica), 15m (insular)\\n- **Art. 5 - Competencias**: Cabildos (red insular), Aytos (red municipal)",
        "widgets": []
      }
    },
    {
      "id": "formulas-calculos",
      "title": "Fórmulas y Cálculos",
      "level": "h2",
      "sourceType": "mixed",
      "content": {
        "text": "**Cálculo de zona de protección**: zona = 50m (estatal), 25m (autonómica), 15m (insular) según Art. 7.\\n\\n**Ejemplo**: GC-500 (carretera insular) → 15m de afección a cada lado del eje.",
        "widgets": []
      }
    }
    // ... ${params.strategicPlan.targetSections - 2} secciones más con TEXTO REAL
  ],
  "widgets": [
    {
      "type": "formula",
      "title": "Cálculo Zona Protección",
      "contextFrame": "[Copiar párrafo completo donde se menciona la fórmula]",
      "conceptTopic": "Zonas de protección de carreteras",
      "content": {
        "latex": "\\text{zona} = \\begin{cases} 50\\text{m} & \\text{estatal} \\\\ 25\\text{m} & \\text{autonómica} \\\\ 15\\text{m} & \\text{insular} \\end{cases}",
        "variables": [
          {"symbol": "zona", "description": "Distancia de afección en metros"}
        ]
      }
    },
    {
      "type": "infografia",
      "title": "Clasificación de Carreteras",
      "contextFrame": "[Copiar párrafo donde se explica la clasificación]",
      "conceptTopic": "Clasificación jerárquica de carreteras",
      "content": {
        "frame": "[Mismo que contextFrame]",
        "concept": "Clasificación jerárquica de carreteras"
      }
    },
    {
      "type": "mnemonic_generator",
      "title": "Mnemotecnia: Tipos de Carreteras",
      "contextFrame": "[Copiar párrafo con los tipos]",
      "conceptTopic": "Tipos de carreteras por competencia",
      "content": {
        "frame": "[Mismo que contextFrame]",
        "termsToMemorize": ["Estatal", "Autonómica", "Insular", "Comarcal", "Municipal"]
      }
    },
    {
      "type": "case_practice",
      "title": "Caso: Afección Carretera Insular",
      "contextFrame": "[Copiar párrafo sobre zonas de afección]",
      "conceptTopic": "Cálculo de zona de afección",
      "content": {
        "frame": "[Mismo que contextFrame]",
        "concept": "Aplicación de zonas de afección en carretera insular"
      }
    }
    // ... 1-2 widgets más según necesidad
  ],
  "synthesis": {
    "originalWords": ${totalDraftWords},
    "finalWords": ${params.strategicPlan.targetWords},
    "conceptsIncluded": 18,
    "conceptsDropped": 5,
    "practiceReadiness": 0.94,
    "densityScore": 0.96
  },
  "practiceMetrics": {
    "appearsInSupuestos": ["Supuesto 1", "Supuesto 11", ...],
    "formulasIncluded": 5,
    "examplesProvided": 3,
    "resolutionGuidance": true
  },
  "readinessAssessment": "Contenido cubre 94% de conocimientos para resolver supuestos tipo. Eliminada paja teórica no aplicable."
}
`;
        
        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-3-pro-preview',
                generationConfig: {
                    temperature: 0.6,
                    maxOutputTokens: 16384, // Necesita mucho output
                    responseMimeType: "application/json",
                    topP: 0.85,
                    topK: 40
                }
            });
            
            const result = await model.generateContent(prompt);
            const raw = result.response.text();
            
            // #region debug log
            fetch('http://127.0.0.1:7242/ingest/39163fbb-29a9-4306-9e29-f6e8f98c5b6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategist.ts:beforeParse',message:'Strategist raw response',data:{rawLength:raw.length,rawPreview:raw.slice(0,200)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            
            const json = JSON.parse(raw);
            
            // #region debug log
            fetch('http://127.0.0.1:7242/ingest/39163fbb-29a9-4306-9e29-f6e8f98c5b6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategist.ts:afterParse',message:'Strategist parsed JSON',data:{hasSections:!!json.sections,sectionsCount:json.sections?.length,hasWidgets:!!json.widgets,widgetsCount:json.widgets?.length,hasSynthesis:!!json.synthesis},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            
            // #region debug log - CRITICAL: Log first section to see if has text
            if (json.sections && json.sections.length > 0) {
                const firstSection = json.sections[0];
                fetch('http://127.0.0.1:7242/ingest/39163fbb-29a9-4306-9e29-f6e8f98c5b6e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'strategist.ts:firstSection',message:'First section structure',data:{id:firstSection.id,title:firstSection.title,hasContent:!!firstSection.content,textLength:firstSection.content?.text?.length || 0,textPreview:firstSection.content?.text?.slice(0,100) || 'EMPTY',sourceType:firstSection.sourceType,level:firstSection.level},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
            }
            // #endregion
            
            const finalWords = json.synthesis?.finalWords || 0;
            const practiceReadiness = json.synthesis?.practiceReadiness || 0;
            
            console.log('[STRATEGIST] Synthesis complete:', {
                finalWords,
                practiceReadiness: (practiceReadiness * 100).toFixed(0) + '%',
                conceptsIncluded: json.synthesis?.conceptsIncluded || 0,
                conceptsDropped: json.synthesis?.conceptsDropped || 0
            });
            
            // #region debug log - Log ALL sections
            console.log('[STRATEGIST] Sections generated:', JSON.stringify(json.sections?.map((s: any) => ({
                id: s.id,
                title: s.title,
                textLength: s.content?.text?.length || 0,
                hasText: !!s.content?.text
            })), null, 2));
            // #endregion
            
            // Construir GeneratedTopicContent
            const content: GeneratedTopicContent = {
                topicId: params.topic.id,
                title: params.topic.title,
                metadata: {
                    complexity: params.strategicPlan.complexity,
                    estimatedStudyTime: params.strategicPlan.timeAllocation,
                    sourceDocuments: [params.topic.originalFilename],
                    generatedAt: new Date(),
                    health: {
                        totalWords: finalWords,
                        avgWordsPerSection: json.sections?.length 
                            ? Math.round(finalWords / json.sections.length)
                            : 0,
                        sectionsBelowThreshold: 0,
                        minWordsPerSection: 150,
                        totalSections: json.sections?.length || 0,
                        wordGoalMet: finalWords >= (params.strategicPlan.targetWords * 0.85)
                    },
                    practiceMetrics: json.practiceMetrics || {}
                },
                sections: json.sections || [],
                widgets: json.widgets || [],
                qualityStatus: practiceReadiness > 0.85 ? 'ok' : 'needs_improvement',
                warnings: practiceReadiness < 0.85 
                    ? [`Practice readiness ${(practiceReadiness * 100).toFixed(0)}% por debajo del objetivo 85%`]
                    : []
            };
            
            return content;
            
        } catch (error) {
            console.error('[STRATEGIST] Error:', error);
            throw new Error(`Strategist synthesis failed: ${error instanceof Error ? error.message : 'unknown'}`);
        }
    }
    
    /**
     * Formatear conceptos críticos para el prompt
     */
    private formatCriticalConcepts(report: CurationReport): string {
        const critical = report.concepts
            .filter(c => c.criticality.score > 0.8)
            .slice(0, 10);
        
        return critical
            .map(c => `- [${c.id}] ${c.text.slice(0, 100)}... (score: ${c.criticality.score.toFixed(2)}, supuestos: ${c.criticality.appearsInSupuestos.join(', ')})`)
            .join('\n') || '(Ninguno identificado)';
    }
    
    /**
     * Formatear conceptos prescindibles
     */
    private formatDroppableConcepts(report: CurationReport): string {
        const droppable = report.concepts
            .filter(c => c.recommendation === 'DROP')
            .slice(0, 5);
        
        return droppable
            .map(c => `- ${c.text.slice(0, 80)}... (score: ${c.criticality.score.toFixed(2)}) → ELIMINAR`)
            .join('\n') || '(Ninguno identificado)';
    }
    
    private countWords(text: string): number {
        if (!text) return 0;
        return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    }
}

