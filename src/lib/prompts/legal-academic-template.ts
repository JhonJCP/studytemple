/**
 * LEGAL ACADEMIC FORMAT TEMPLATE
 *
 * Objetivo: producir un temario tipo oposiciÃ³n (ITOP) que sea:
 * - evidence-first (cero invenciones)
 * - didÃ¡ctico (explica, no solo lista)
 * - operativo (sirve para resolver supuestos)
 * - trazable (sourceMetadata + citas + micro-citas literales)
 */

export const LEGAL_ACADEMIC_FORMAT = `
REGLAS OBLIGATORIAS (NO NEGOCIABLES)
1) EVIDENCE-FIRST: no inventes artÃ­culos, nÃºmeros, plazos, umbrales ni definiciones normativas.
2) CITA REAL: solo escribas (Art. N ...) si ese artÃ­culo/epÃ­grafe aparece explÃ­citamente en la evidencia incluida.
3) TRANSCRIPCIÃ“N LITERAL: cuando cites, incluye al menos 1 micro-cita literal por secciÃ³n (1â€“3 frases) COPIADA de la evidencia.
   - Si no hay literal suficiente: declara la laguna ("No consta en las fuentes recuperadas") y NO rellenes con imaginaciÃ³n.
4) DIDÃCTICA: puedes explicar con tus palabras para dar contexto, pero:
   - Toda afirmaciÃ³n normativa relevante (competencias, procedimientos, plazos, anchos, sanciones, efectos) debe llevar cita real.
5) FORMATO: usa Markdown claro (h3, listas, TABLAS), evitando prosa larga. Evita caracteres raros/artefactos (p.ej. "Â¶", "??").
6) CITAS CONSISTENTES: usa siempre uno de estos formatos para facilitar el parseo:
   - (Art. 1 Ley X/AAAA) / (Art. 63.1.l Reglamento) / (Art. 44 Norma)
7) sourceMetadata (CRÃTICO): en el JSON final, cada secciÃ³n debe incluir sourceMetadata:
{
  "primaryDocument": "NombreDelPDF.pdf",
  "articles": ["Art. 1", "Art. 3"],
  "chunks": [
    { "chunkId": "db-123", "article": "Art. 1.2", "page": 2, "originalText": "texto literal", "confidence": 0.92 }
  ]
}
`;

export const EXPERT_TEORICO_TEMPLATE = `
ROL: Experto TeÃ³rico (marco legal CORE).
MisiÃ³n: producir un borrador didÃ¡ctico + operativo basado en evidencia (citas reales + micro-citas literales).

REQUISITOS:
- Explica el contexto en castellano llano (2â€“3 frases por bloque) antes de listar.
- 5â€“10 artÃ­culos/epÃ­grafes clave si aparecen en evidencia (no inventar).
- 5+ micro-citas literales (entre comillas) copiadas de la evidencia.
- Enfoca a supuesto: "quÃ© decisiÃ³n resuelve" y "quÃ© escribir en el informe".

SALIDA: JSON estricto (sin markdown fuera de strings), con este esquema:
{
  "content": "Markdown (h3 + bullets) con citas reales (Art. ...)",
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
ROL: Experto PrÃ¡ctico (PRACTICE).
MisiÃ³n: convertir patrones de supuestos reales en una guÃ­a de resoluciÃ³n entendible (paso a paso + mini-caso guiado).

REQUISITOS:
- 1 checklist de resoluciÃ³n (7â€“10 pasos), pero EXPLICADA: por cada paso indica:
  - quÃ© comprobar, por quÃ© importa y quÃ© cita o documento respalda (si existe).
- 1 mini-caso guiado (enunciado tÃ­pico â†’ pasos â†’ conclusiÃ³n tipo).
- Errores tÃ­picos (3â€“6) con cÃ³mo evitarlos.
- Cita normas/artÃ­culos SOLO si aparecen en evidencia; si no, escribe "(artÃ­culo no determinado en fuentes recuperadas)".

SALIDA: JSON estricto:
{
  "content": "Markdown con checklist explicada, mini-caso, errores comunes y citas cuando existan",
  "confidence": 0.0
}
`;

export const STRATEGIST_SYNTHESIZER_TEMPLATE = `
ROL: Strategist Synthesizer (el "Da Vinci" final).
No reescribas desde cero: integra lo mejor de los drafts, aÃ±ade pedagogÃ­a y estructura, y asegura trazabilidad.

OBJETIVO (GOLD):
- 2800â€“4500 palabras (o el target indicado), con explicaciÃ³n didÃ¡ctica (no solo bullet points).
- Markdown bien formateado: h3, listas, tablas, blockquotes, separadores (---) cuando ayude.
- Debe renderizar bien en un visor Markdown (incluye TABLAS reales cuando haya comparativas/umbrales).

SECCIONES OBLIGATORIAS (en este orden):
0) Imperdibles (chuleta de examen): 20â€“40 bullets cortos con (Art. ...) + 6+ micro-citas literales repartidas.
1) Resumen de oro: narrativa pedagÃ³gica (10â€“15 min) + "quÃ© preguntan" + "quÃ© escribir en informe".
2+) Resto de secciones h2 orientadas a supuesto (6â€“10 secciones mÃ¡s segÃºn targetWords).

TRAZABILIDAD:
- mÃ­nimo 4 secciones con sourceMetadata.chunks (tooltips).
- mÃ­nimo 12 micro-citas literales distribuidas (entre comillas), copiadas de evidencia/drafts.
- Si falta evidencia: declara la laguna con "No consta en fuentes recuperadas" y NO inventes.

WIDGETS (OBLIGATORIO):
- Inserta 10â€“18 widgets repartidos en las secciones (NO en top-level), para ayudar a entender y memorizar:
  - infografia (generable): {frame, concept}
  - mnemonic_generator (generable): {frame, termsToMemorize[]}
  - case_practice (generable): {frame, concept}
  - diagram_generator (generable): {frame, concept}
  - timeline_generator (generable): {frame, concept}
  - quiz_generator (generable): {frame, focus}
- Cada widget debe ser accionable y especÃ­fico (no "conceptos varios").

OBLIGATORIO PARA LEYES (si estÃ¡ en evidencia; si no, escribe "No consta en fuentes recuperadas"):
- PlanificaciÃ³n y proyectos: plan regional, utilidad pÃºblica/expropiaciÃ³n, coordinaciÃ³n urbanÃ­stica y plazos.
- Zonas de protecciÃ³n: Dominio PÃºblico / Servidumbre / AfecciÃ³n / LÃ­nea LÃ­mite de EdificaciÃ³n con distancias EN TABLA.
- RÃ©gimen de usos/autorizaciones tÃ­picas (accesos, cruces) y un bloque de infracciones/sanciones/publicidad si aparece.

ESTRUCTURA RECOMENDADA PARA LEYES (despuÃ©s de Imperdibles + Resumen de oro):
2) Marco normativo y objeto (quÃ© regula, por quÃ© cae en supuesto)
3) Definiciones y clasificaciÃ³n (ejemplos de examen + citas)
4) Competencias y titulares (quiÃ©n informa/autoriza/sanciona)
5) PlanificaciÃ³n/proyectos y coordinaciÃ³n urbanÃ­stica (plazos si aparecen)
6) Zonas/limitaciones (DP/servidumbre/afecciÃ³n/LLE) + cÃ³mo medir (si hay evidencia)
7) RÃ©gimen de autorizaciones (cruces/obras/publicidad, si hay evidencia)
8) Checklist de resoluciÃ³n de supuesto (paso a paso explicado) + errores tÃ­picos + mini-caso

SALIDA: JSON exacto (sin comentarios):
{
  "sections": [
    {
      "id": "string",
      "title": "string",
      "level": "h2",
      "sourceType": "library",
      "content": {
        "text": "markdown",
        "widgets": [
          { "type": "quiz_generator", "generatable": true, "generated": false, "content": { "frame": "texto", "focus": "foco", "questions": null } }
        ]
      },
      "sourceMetadata": {
        "primaryDocument": "PDF.pdf",
        "articles": ["Art. 3"],
        "chunks": [
          { "chunkId": "db-123", "article": "Art. 3", "page": null, "originalText": "literal", "confidence": 0.9 }
        ]
      }
    }
  ],
  "widgets": [],
  "synthesis": { "finalWords": 0, "practiceReadiness": 0.0 }
}
`;

