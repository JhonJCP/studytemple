/**
 * STRATEGIST SYNTHESIZER - Estratega sintetizador (V2)
 *
 * Recibe drafts de 3 expertos + reporte de curación y genera contenido final:
 * - Sintetiza (NO reescribe desde cero)
 * - Prioriza conceptos críticos según scoring del curator
 * - Fuerza formato "apuntes" con citas y fuentes
 * - Produce `sourceMetadata` para referencias interactivas
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ExpertOutput } from "./expert-practical";
import type { CurationReport } from "./expert-curator";
import type { StrategicPlan } from "./global-planner";
import type { GeneratedTopicContent, TopicSection, WidgetDefinition } from "./widget-types";
import type { TopicWithGroup } from "./syllabus-hierarchy";
import { LEGAL_ACADEMIC_FORMAT, STRATEGIST_SYNTHESIZER_TEMPLATE } from "./prompts/legal-academic-template";
import { safeParseJSON, countWords } from "./json-utils";

export class StrategistSynthesizer {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private sanitizeMarkdown(text: string): string {
    return (text || "")
      .replace(/\u00b6/g, "")
      .replace(/\uFFFD/g, "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async synthesize(params: {
    topic: TopicWithGroup;
    drafts: ExpertOutput[];
    curationReport: CurationReport;
    strategicPlan: StrategicPlan;
  }): Promise<GeneratedTopicContent> {
    console.log("[STRATEGIST] Synthesizing final content...");

    const totalDraftWords = params.drafts.reduce((sum, d) => sum + countWords(d.content), 0);
    console.log(`[STRATEGIST] Input: ${totalDraftWords} words from ${params.drafts.length} experts`);
    console.log(`[STRATEGIST] Target: ${params.strategicPlan.targetWords} words`);
    console.log(`[STRATEGIST] Practice readiness: ${(params.curationReport.practiceReadiness * 100).toFixed(0)}%`);

    const isLegalTopic =
      /ley|decreto|reglamento/i.test(params.topic.title) ||
      /ley|decreto|reglamento/i.test(params.topic.originalFilename || "");

    const desiredSections = Math.max(params.strategicPlan.targetSections, isLegalTopic ? 7 : 6);
    const targetWords = Math.max(params.strategicPlan.targetWords, isLegalTopic ? 1800 : 1200);

    const sourcePool = params.drafts
      .map((d) => d.metadata?.sources)
      .filter(Boolean)
      .slice(0, 3);

    const prompt = `
${LEGAL_ACADEMIC_FORMAT}

${STRATEGIST_SYNTHESIZER_TEMPLATE}

PARAMETROS:
- topicTitle: "${params.topic.title}"
- baseDocument: "${params.topic.originalFilename}"
- desiredSections: ${desiredSections}
- targetWords: ${targetWords}
- studyMinutes: ${params.strategicPlan.timeAllocation}
- practiceExamples: ${JSON.stringify(params.strategicPlan.practiceExamples || [])}
- curatorPracticeReadiness: ${(params.curationReport.practiceReadiness * 100).toFixed(0)}%

DRAFT TEÓRICO:
${params.drafts[0]?.content || ""}

DRAFT PRÁCTICO:
${params.drafts[1]?.content || ""}

DRAFT TÉCNICO:
${params.drafts[2]?.content || ""}

FUENTES DISPONIBLES (si existen; úsalo para construir sourceMetadata por sección):
${JSON.stringify(sourcePool, null, 2)}

CURACIÓN:
- KEEP_FULL: ${params.curationReport.summary.critical}
- KEEP_SUMMARY: ${params.curationReport.summary.important}
- DROP: ${params.curationReport.summary.droppable}

CRÍTICOS:
${this.formatCriticalConcepts(params.curationReport)}
`;

    const model = this.genAI.getGenerativeModel({
      model: "gemini-3-pro-preview",
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 16384,
        responseMimeType: "application/json",
        topP: 0.85,
        topK: 40,
      },
    });

    const attemptOnce = async (attempt: number, repairIssues?: string[]) => {
      const attemptPrompt =
        attempt === 0
          ? prompt
          : `${prompt}\n\nERRORES DETECTADOS:\n- ${repairIssues?.join("\n- ") || ""}\n\nREPARA EL JSON PARA CUMPLIR TODAS LAS REGLAS. RESPONDE SOLO JSON (empieza con { y termina con }).`;

      const result = await model.generateContent(attemptPrompt);
      const raw = result.response.text();
      const { json, error } = safeParseJSON(raw);
      if (error || !json) {
        throw new Error(`Strategist JSON parse error: ${error || "unknown"}`);
      }
      return json as any;
    };

    const validate = (candidate: any): string[] => {
      const issues: string[] = [];

      if (!candidate || typeof candidate !== "object") issues.push("JSON inválido");

      if (!Array.isArray(candidate.sections) || candidate.sections.length < desiredSections) {
        issues.push(`Debe incluir >=${desiredSections} secciones (sections)`);
      }

      const sections: any[] = Array.isArray(candidate.sections) ? candidate.sections : [];
      const wordTotal = sections.reduce((sum, s) => sum + countWords(s?.content?.text || ""), 0);

      if (wordTotal < targetWords * 0.85) {
        issues.push(`Texto demasiado corto: ${wordTotal} palabras (objetivo >= ${Math.round(targetWords * 0.85)})`);
      }

      const sectionsWithoutText = sections.filter((s) => !s?.content?.text || countWords(s.content.text) < 120).length;
      if (sectionsWithoutText > 0) issues.push(`Hay ${sectionsWithoutText} secciones con texto vacío/corto`);

      const sectionsWithSources = sections.filter((s) => s?.sourceMetadata?.chunks?.length).length;
      if (sectionsWithSources < Math.min(3, sections.length)) {
        issues.push("Faltan sourceMetadata.chunks (mínimo 3 secciones con fuentes)");
      }

      const combinedText = sections.map((s) => s?.content?.text || "").join("\n");
      const refs = (combinedText.match(/\(Art\.\s*\d+/g) || []).length;
      if (refs < 10 && isLegalTopic) issues.push("Pocas citas (Art. N) para tema legal (mínimo 10)");

      return issues;
    };

    let json = await attemptOnce(0);
    const issues = validate(json);
    if (issues.length > 0) {
      console.warn("[STRATEGIST] Quality gate failed, retrying...", issues);
      json = await attemptOnce(1, issues);
    }

    const rawSections: any[] = Array.isArray(json.sections) ? json.sections : [];
    const normalizedSections: TopicSection[] = rawSections.map((s, idx) => ({
      id: String(s?.id || `section_${idx}`),
      title: String(s?.title || `Sección ${idx + 1}`),
      level: (s?.level === "h1" || s?.level === "h2" || s?.level === "h3") ? s.level : "h2",
      sourceType: (s?.sourceType === "library" || s?.sourceType === "augmented" || s?.sourceType === "mixed")
        ? s.sourceType
        : "mixed",
      content: {
        text: this.sanitizeMarkdown(String(s?.content?.text || "")),
        widgets: Array.isArray(s?.content?.widgets) ? (s.content.widgets as WidgetDefinition[]) : [],
      },
      children: Array.isArray(s?.children) ? s.children : undefined,
      sourceMetadata: s?.sourceMetadata || undefined,
    }));

    const computedWords = normalizedSections.reduce((sum, s) => sum + countWords(s.content.text), 0);
    const rawPracticeReadiness =
      typeof json?.synthesis?.practiceReadiness === "number"
        ? json.synthesis.practiceReadiness
        : params.curationReport.practiceReadiness;
    const practiceReadinessParsed =
      typeof rawPracticeReadiness === "number" ? rawPracticeReadiness : Number(rawPracticeReadiness);
    const practiceReadiness = Number.isFinite(practiceReadinessParsed) ? practiceReadinessParsed : 0.75;

    console.log("[STRATEGIST] Synthesis complete:", {
      words: computedWords,
      practiceReadiness: (practiceReadiness * 100).toFixed(0) + "%",
      sections: normalizedSections.length,
      widgets: Array.isArray(json.widgets) ? json.widgets.length : 0,
    });

    const sourceDocuments = [
      params.topic.originalFilename,
      ...sourcePool
        .map((s: any) => s?.primaryDocument)
        .filter((v: any) => typeof v === "string" && v.length > 0),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const content: GeneratedTopicContent = {
      topicId: params.topic.id,
      title: params.topic.title,
      metadata: {
        complexity: params.strategicPlan.complexity,
        estimatedStudyTime: params.strategicPlan.timeAllocation,
        sourceDocuments,
        generatedAt: new Date(),
        health: {
          totalWords: computedWords,
          avgWordsPerSection: normalizedSections.length ? Math.round(computedWords / normalizedSections.length) : 0,
          sectionsBelowThreshold: normalizedSections.filter((s) => countWords(s.content.text) < 150).length,
          minWordsPerSection: 150,
          totalSections: normalizedSections.length,
          wordGoalMet: computedWords >= targetWords * 0.85,
        },
        practiceMetrics: json.practiceMetrics || {
          practiceReadiness,
          appearsInSupuestos: params.strategicPlan.practiceExamples || [],
        },
      },
      sections: normalizedSections,
      widgets: Array.isArray(json.widgets) ? (json.widgets as WidgetDefinition[]) : [],
      qualityStatus: practiceReadiness >= 0.9 ? "ok" : "needs_improvement",
      warnings:
        practiceReadiness < 0.9
          ? [`Practice readiness ${(practiceReadiness * 100).toFixed(0)}% por debajo del objetivo 90%`]
          : [],
    };

    return content;
  }

  private formatCriticalConcepts(report: CurationReport): string {
    const critical = report.concepts.filter((c) => c.criticality.score > 0.8).slice(0, 10);
    return (
      critical
        .map(
          (c) =>
            `- [${c.id}] ${c.text.slice(0, 120)}... (score:${c.criticality.score.toFixed(
              2
            )}, supuestos:${c.criticality.appearsInSupuestos.join(", ")})`
        )
        .join("\n") || "(Ninguno identificado)"
    );
  }
}
