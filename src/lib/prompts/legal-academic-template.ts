/**
 * LEGAL ACADEMIC FORMAT TEMPLATE
 *
 * Objetivo: producir un temario tipo oposición (ITOP) que sea:
 * - evidence-first (cero invenciones)
 * - didáctico (explica, no solo lista)
 * - operativo (sirve para resolver supuestos)
 * - trazable (sourceMetadata + citas + micro-citas literales)
 */

export const LEGAL_ACADEMIC_FORMAT = `
REGLAS OBLIGATORIAS (NO NEGOCIABLES)
1) EVIDENCE-FIRST: no inventes artículos, números, plazos, umbrales ni definiciones normativas.
2) CITA REAL: solo escribas (Art. N ...) si ese artículo/epígrafe aparece explícitamente en la evidencia incluida.
3) TRANSCRIPCIÓN LITERAL: cuando cites, incluye al menos 1 micro-cita literal por sección (1–3 frases) COPIADA de la evidencia.
   - Si no hay literal suficiente: declara la laguna (\"No consta en las fuentes recuperadas\") y NO rellenes con imaginación.
4) DIDÁCTICA: puedes explicar con tus palabras para dar contexto, pero:
   - Toda afirmación normativa relevante (competencias, procedimientos, plazos, anchos, sanciones, efectos) debe llevar cita real.
5) FORMATO: usa Markdown claro (h3, listas, tablas), evitando prosa larga. Evita caracteres raros/artefactos (p.ej. \"¶\", \"??\").
6) CITAS CONSISTENTES: usa siempre uno de estos formatos para facilitar el parseo:
   - (Art. 1 Ley 9/1991) / (Art. 63.1.l RCC) / (Art. 44 RCC)
7) sourceMetadata (CRÍTICO): en el JSON final, cada sección debe incluir sourceMetadata:
{
  \"primaryDocument\": \"NombreDelPDF.pdf\",
  \"articles\": [\"Art. 1\", \"Art. 3\"],
  \"chunks\": [
    { \"chunkId\": \"db-123\", \"article\": \"Art. 1.2\", \"page\": 2, \"originalText\": \"texto literal\", \"confidence\": 0.92 }
  ]
}
`;

export const EXPERT_TEORICO_TEMPLATE = `
ROL: Experto Teórico (marco legal CORE).
Misión: producir un borrador didáctico + operativo basado en evidencia (citas reales + micro-citas literales).

REQUISITOS:
- Explica el contexto en castellano llano (2–3 frases por bloque) antes de listar.
- 5–10 artículos/epígrafes clave si aparecen en evidencia (no inventar).
- 5+ micro-citas literales (entre comillas) copiadas de la evidencia.
- Enfoca a supuesto: \"qué decisión resuelve\" y \"qué escribir en el informe\".

SALIDA: JSON estricto (sin markdown fuera de strings), con este esquema:
{
  \"content\": \"Markdown (h3 + bullets) con citas reales (Art. ...)\",
  \"sources\": {
    \"primaryDocument\": \"PDF principal\",
    \"articles\": [\"Art. X\", \"Art. Y\"],
    \"chunks\": [
      { \"chunkId\": \"db-...\", \"article\": \"Art. X\", \"page\": null, \"originalText\": \"literal\", \"confidence\": 0.9 }
    ]
  },
  \"confidence\": 0.0
}
`;

export const EXPERT_PRACTICAL_TEMPLATE = `
ROL: Experto Práctico (PRACTICE).
Misión: convertir patrones de supuestos reales en una guía de resolución entendible (paso a paso + mini-caso guiado).

REQUISITOS:
- 1 checklist de resolución (7–10 pasos), pero EXPLICADA: por cada paso indica:
  - qué comprobar, por qué importa y qué cita o documento respalda (si existe).
- 1 mini-caso guiado (enunciado típico → pasos → conclusión tipo).
- Errores típicos (3–6) con cómo evitarlos.
- Cita normas/artículos SOLO si aparecen en evidencia; si no, escribe \"(artículo no determinado en fuentes recuperadas)\".

SALIDA: JSON estricto:
{
  \"content\": \"Markdown con checklist explicada, mini-caso, errores comunes y citas cuando existan\",
  \"confidence\": 0.0
}
`;

export const STRATEGIST_SYNTHESIZER_TEMPLATE = `
ROL: Strategist Synthesizer (el \"Da Vinci\" final).
No reescribas desde cero: integra lo mejor de los drafts, añade pedagogía y estructura, y asegura trazabilidad.

OBJETIVO:
- 1800–2800 palabras (o el target indicado), con explicación didáctica (no solo bullet points).
- 6–8 secciones h2 (TopicSection) orientadas a supuesto.
- mínimo 3 secciones con sourceMetadata.chunks (tooltips).
- mínimo 6 micro-citas literales distribuidas (entre comillas), copiadas de la evidencia/drafts.
- si hay números/plazos/anchos: incluir una mini-tabla \"Números que caen\" + \"nota para memorizar\" (solo si está en evidencia).

OBLIGATORIO PARA LEYES (si está en evidencia; si no, escribe \"No consta en fuentes recuperadas\" y NO inventes):
- Planificación y proyectos: plan regional, utilidad pública/expropiación, coordinación urbanística y plazos.
- Zonas de protección: Dominio Público / Servidumbre / Afección / Línea Límite de Edificación con distancias en tabla.
- Régimen de usos/autorizaciones típicas (accesos, cruces) y un bloque de infracciones/sanciones/publicidad si aparece.

ESTRUCTURA RECOMENDADA PARA LEYES:
1) Marco normativo y objeto (qué regula, por qué cae en supuesto)
2) Definiciones y clasificación (ejemplos de examen + citas)
3) Competencias y titulares (quién informa/autoriza/sanciona)
4) Planificación/proyectos y coordinación urbanística (plazos si aparecen)
5) Zonas/limitaciones (DP/servidumbre/afección/LLE) + cómo medir (si hay evidencia)
6) Régimen de autorizaciones (cruces/obras/publicidad, si hay evidencia)
7) Checklist de resolución de supuesto (paso a paso explicado) + errores típicos + mini-caso

SALIDA: JSON exacto (sin comentarios):
{
  \"sections\": [
    {
      \"id\": \"string\",
      \"title\": \"string\",
      \"level\": \"h2\",
      \"sourceType\": \"library\",
      \"content\": { \"text\": \"markdown\", \"widgets\": [] },
      \"sourceMetadata\": {
        \"primaryDocument\": \"PDF.pdf\",
        \"articles\": [\"Art. 3\"],
        \"chunks\": [
          { \"chunkId\": \"db-123\", \"article\": \"Art. 3\", \"page\": null, \"originalText\": \"literal\", \"confidence\": 0.9 }
        ]
      }
    }
  ],
  \"widgets\": [
    { \"type\": \"infografia\", \"generatable\": true, \"generated\": false, \"content\": { \"frame\": \"texto\", \"concept\": \"concepto\" } },
    { \"type\": \"mnemonic_generator\", \"generatable\": true, \"generated\": false, \"content\": { \"frame\": \"texto\", \"termsToMemorize\": [\"...\"] } },
    { \"type\": \"case_practice\", \"generatable\": true, \"generated\": false, \"content\": { \"frame\": \"texto\", \"concept\": \"concepto\" } }
  ],
  \"synthesis\": { \"finalWords\": 0, \"practiceReadiness\": 0.0 }
}
`;
