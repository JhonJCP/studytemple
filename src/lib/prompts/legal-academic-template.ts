/**
 * LEGAL ACADEMIC FORMAT TEMPLATE
 *
 * Objetivo: forzar un temario "tipo opositor" (académico-legal) con:
 * - citas explícitas a artículos (Art. X) basadas en evidencia
 * - transcripciones literales (entre comillas) cuando el texto esté en evidencia
 * - `sourceMetadata` por sección para tooltips (ContentWithSources + SourceReference)
 *
 * Nota: este archivo debe ser texto limpio (sin caracteres de control).
 */

export const LEGAL_ACADEMIC_FORMAT = `
REGLAS OBLIGATORIAS (NO NEGOCIABLES)
1) NO INVENTES: si un artículo o dato numérico no aparece en la evidencia, no lo afirmes como cierto.
2) CITA SIEMPRE: toda afirmación jurídica relevante debe terminar con una cita del tipo:
   - (Art. N Ley 9/1991) o (Art. N RCC) o (Norma 6.1-IC) según corresponda.
3) TRANSCRIPCIÓN LITERAL: cuando cites un artículo, incluye al menos una vez por sección un extracto literal entre comillas,
   copiándolo de la evidencia proporcionada. Si no hay literal en evidencia, NO inventes; cita sin literal.
4) FORMATO DE APUNTES: evita prosa larga. Prioriza estructura h2/h3, bullets, tablas y pasos numerados.
5) MARCADOR ¶: usa el símbolo "¶" al inicio de cada sección temática (en el texto, no en el título):
   - Ejemplo: "¶ Clasificación por titularidad: ..."
6) sourceMetadata (CRÍTICO): cada sección debe incluir sourceMetadata con estructura:
   {
     "primaryDocument": "NombreDelPDF.pdf",
     "articles": ["Art. 3", "Art. 5"],
     "chunks": [
       { "chunkId": "db-123", "article": "Art. 3", "page": 2, "originalText": "texto literal", "confidence": 0.92 }
     ]
   }
   - originalText debe ser una transcripción literal extraída de la evidencia.
`;

export const EXPERT_TEORICO_TEMPLATE = `
ROL: Experto Teórico (marco legal CORE). Tu misión es producir un borrador con citas y transcripciones útiles para supuestos.

REQUISITOS:
- 3 a 6 artículos clave (siempre que aparezcan en evidencia).
- al menos 3 transcripciones literales (entre comillas) copiadas de la evidencia.
- foco práctico: qué artículo sirve para qué decisión en un supuesto.

SALIDA: JSON estricto (sin markdown fuera de strings), con este esquema:
{
  "content": "Markdown de apuntes (h2/h3 + bullets) con citas (Art. ...)",
  "sources": {
    "primaryDocument": "PDF principal",
    "articles": ["Art. X", "Art. Y"],
    "chunks": [
      { "chunkId": "db-...", "article": "Art. X", "page": null, "originalText": "literal", "confidence": 0.9 }
    ]
  },
  "confidence": 0.0
}
`;

export const EXPERT_PRACTICAL_TEMPLATE = `
ROL: Experto Práctico (PRACTICE). Tu misión es convertir patrones de supuestos reales en una guía operativa.

REQUISITOS:
- 1 checklist de resolución (5-8 pasos) para un supuesto típico del tema.
- 1 ejemplo condensado (enunciado -> pasos -> decisión final).
- menciona supuestos reales (por nombre/archivo si aparece en evidencia) y qué se pedía.
- cita artículos/normas si aparecen en los supuestos; si no, marca como "revisar en Ley/Reglamento" (sin inventar).

SALIDA: JSON estricto:
{
  "content": "Markdown con pasos, errores comunes, mini-ejemplo y citas cuando existan",
  "confidence": 0.0
}
`;

export const STRATEGIST_SYNTHESIZER_TEMPLATE = `
ROL: Strategist Synthesizer. NO reescribas desde cero; sintetiza y mejora densidad. Tu salida es el temario final.

OBJETIVO:
- 900-1100 palabras (o el target indicado).
- 5-6 secciones h2 (TopicSection) enfocadas a resolver supuestos.
- al menos 3 secciones con sourceMetadata.chunks (para tooltips).
- mínimo 3 transcripciones literales, copiadas de los drafts/evidencia ya incluida.

ESTRUCTURA RECOMENDADA PARA LEYES (si el tema es una Ley/Decreto):
1) ¶ Marco normativo y objeto
2) ¶ Clasificación / definiciones operativas
3) ¶ Competencias y planificación / coordinación urbanística
4) ¶ Zonas, límites y restricciones (si aplica) + ejemplo de autorización
5) ¶ Uso/defensa/régimen económico-sancionador (si aplica)
6) ¶ Checklist de supuesto + errores típicos + mnemotecnia

SALIDA: JSON exacto con este esquema (sin comentarios):
{
  "sections": [
    {
      "id": "string",
      "title": "string",
      "level": "h2",
      "sourceType": "library",
      "content": { "text": "markdown", "widgets": [] },
      "sourceMetadata": {
        "primaryDocument": "PDF.pdf",
        "articles": ["Art. 3"],
        "chunks": [
          { "chunkId": "db-123", "article": "Art. 3", "page": null, "originalText": "literal", "confidence": 0.9 }
        ]
      }
    }
  ],
  "widgets": [
    { "type": "infografia", "generatable": true, "generated": false, "content": { "frame": "texto", "concept": "concepto" } },
    { "type": "mnemonic_generator", "generatable": true, "generated": false, "content": { "frame": "texto", "termsToMemorize": ["..."] } },
    { "type": "case_practice", "generatable": true, "generated": false, "content": { "frame": "texto", "concept": "concepto" } },
    { "type": "formula", "generatable": false, "generated": true, "content": { "latex": "…", "variables": [] } }
  ],
  "synthesis": { "finalWords": 0, "practiceReadiness": 0.0 }
}
`;
