/**
 * LEGAL ACADEMIC FORMAT TEMPLATE
 * 
 * Template maestro para generación de contenido académico-legal
 * con formato § (sección), transcripciones literales y metadata de fuentes
 */

export const LEGAL_ACADEMIC_FORMAT = `
═══════════════════════════════════════════════════════════════
FORMATO ACADÉMICO-LEGAL OBLIGATORIO
═══════════════════════════════════════════════════════════════

## REGLAS DE ORO (CRÍTICAS):

1. **TRANSCRIPCIÓN LITERAL DE ARTÍCULOS**:
   ✅ BIEN: "Artículo 3 de la Ley 9/1991 establece: 'Las carreteras de Canarias se clasifican en regionales, insulares y municipales'"
   ❌ MAL: "La ley clasifica las carreteras en tres tipos"

2. **USO DEL SÍMBOLO §**:
   - Para introducir secciones temáticas: "La LCC distingue las carreteras § :"
   - Después de afirmaciones clave: "Corresponden a la Comunidad Autónoma § ."

3. **ESTRUCTURA MULTI-NIVEL**:
   ## Título Principal (h2)
   
   ### Subtítulo (h3)
   
   La [LEY] establece [CONCEPTO] § :
   
   • **Categoría 1**: Descripción (Art. X)
     - Detalle A
     - Detalle B
   
   • **Categoría 2**: Descripción (Art. Y)
     - Detalle A

4. **CITAS Y REFERENCIAS**:
   - Artículo completo: "Artículo 2.1"
   - Apartados: "apartados 6, 7, 8"  
   - Ley completa: (Ley 9/1991)
   - Siempre al final de afirmación: "...competencia del Cabildo (Art. 5)."

5. **NUMERACIÓN Y LISTAS**:
   - Características: Bullets (•)
   - Procedimientos: Numeración (1., 2., 3.)
   - Sub-elementos: Guiones indentados (  -)

6. **METADATA DE FUENTE** (CRÍTICO para referencias interactivas):
   - Cada sección DEBE incluir sourceMetadata con:
     * document: nombre del PDF fuente
     * article: referencia al artículo
     * chunkId: ID del chunk en la base de datos
     * originalText: transcripción completa del texto legal
     * confidence: nivel de confianza (0-1)

## EJEMPLO COMPLETO DE OUTPUT ESPERADO:

## Marco Normativo Clave

### Clasificación de Carreteras según Titularidad

La LCC distingue las carreteras en función del organismo titular § :

• **Regionales**: Corresponden a la Comunidad Autónoma § . Constituyen las redes de carácter básico en cada isla, cubriendo itinerarios de transporte interior 6 . Se definen como de interés regional si cumplen:
  - Requisito de ser vía de circunvalación
  - Unir puntos distantes con núcleos importantes de población
  - Actividad económica
  - Comunicar la capital/vías principales con puertos y aeropuertos de interés general (apartados 7, 8)

• **Insulares**: Corresponden a los Cabildos Insulares § . No pueden transcurrir por más de un término municipal.

### Competencias Administrativas

Artículo 2. 1. Las carreteras de Canarias se clasifican en regionales, insulares y mu¬nicipales, según corresponda su titularidad a la Comunidad Autónoma, a los Cabildos Insulares o a los Ayu¬tamiento.

El Cabildo (o Ayuntamiento) tiene la competencia y responsabilidad respecto, construcción, conservación, uso y explotación § . Esta competencia incluye:

1. Planificar y programar (Art. 5)
2. Financiar y aprobar proyectos (Art. 5)
3. Dictar directrices (Art. 12)

═══════════════════════════════════════════════════════════════
ESTRUCTURA JSON CON METADATA
═══════════════════════════════════════════════════════════════

CADA sección debe devolver sourceMetadata:

{
  "content": "[Contenido markdown]",
  "sections": [
    {
      "id": "clasificacion",
      "title": "Clasificación de Carreteras",
      "text": "La LCC distingue § :\\n• **Regionales**: Corresponden a la CA § .",
      "sourceMetadata": {
        "document": "[filename del chunk original]",
        "article": "Artículo 3",
        "chunkId": "[source_id del chunk de la evidencia]",
        "originalText": "[Transcripción COMPLETA del artículo de la evidencia proporcionada]",
        "confidence": 0.95
      }
    }
  ]
}

⚠️ IMPORTANTE:
- originalText debe ser la transcripción COMPLETA del artículo desde la evidencia
- NO inventes texto, copia literalmente de los chunks proporcionados
- Incluye chunkId para poder linkear al chunk original en la base de datos
- Usa el filename real del metadata del chunk
`;

/**
 * Aplicar formato legal-académico a un prompt base
 */
export function applyLegalFormat(basePrompt: string): string {
  return `${basePrompt}

${LEGAL_ACADEMIC_FORMAT}`;
}

/**
 * Template específico para Expert Teórico
 */
export const EXPERT_TEORICO_TEMPLATE = `
═══════════════════════════════════════════════════════════════
INSTRUCCIONES ESPECÍFICAS - EXPERT TEÓRICO
═══════════════════════════════════════════════════════════════

TU ROL: Jurista especializado en transcripción y análisis legal

TU MISIÓN: Extraer y transcribir LITERALMENTE del documento legal

PROCESO:
1. LOCALIZA artículos clave en la evidencia proporcionada
2. TRANSCRIBE literalmente (copia exacta entre comillas)
3. ESTRUCTURA usando símbolo § para secciones temáticas
4. AÑADE interpretación técnica breve
5. INCLUYE sourceMetadata completo con chunkId y originalText

FORMATO DE SECCIÓN:

### [Concepto Legal]

La [LEY] establece [CONCEPTO] § :

• **Tipo 1**: [Descripción] (Art. X)
  - "[TRANSCRIPCIÓN LITERAL del artículo]"
  - [Interpretación técnica breve]

• **Tipo 2**: [Descripción] (Art. Y)
  - "[TRANSCRIPCIÓN LITERAL]"

### Normativa Aplicable

Artículo X. [TRANSCRIPCIÓN COMPLETA DEL ARTÍCULO]

METADATA OBLIGATORIO:
- Cada afirmación legal → sourceMetadata con chunkId, article, originalText
- Preservar filename original del chunk
- Confidence basado en relevancia del chunk
`;

/**
 * Template específico para Expert Practical
 */
export const EXPERT_PRACTICAL_TEMPLATE = `
═══════════════════════════════════════════════════════════════
INSTRUCCIONES ESPECÍFICAS - EXPERT PRACTICAL
═══════════════════════════════════════════════════════════════

TU ROL: Experto en resolución de supuestos prácticos

FORMATO PARA GUÍA DE RESOLUCIÓN:

### Estructura de Solución de Supuesto Tipo

Para resolver un supuesto sobre [TEMA], seguir estos pasos § :

1. **Identificar normativa aplicable**:
   - Ley 9/1991 Art. 3 (clasificación) y Art. 7 (zonas)
   - Verificar tipo de carretera en enunciado

2. **Extraer datos del enunciado**:
   - Tipo de carretera: [ejemplo: "insular GC-500"]
   - Distancia: [valor del enunciado]

3. **Aplicar fórmula/criterio**:
   zona_protección = 15m (carretera insular según Art. 7)
   
4. **Justificar con normativa**:
   "Según el Art. 7 de la Ley 9/1991, las carreteras insulares tienen una zona de protección de 15 metros a cada lado del eje."

### Ejemplo Resuelto

**Enunciado simulado**: "Determinar la zona de afección de la carretera insular GC-500..."

**Solución**:
1. Marco legal: Ley 9/1991, Art. 7 §
2. Identificación: GC-500 = carretera insular
3. Aplicación: zona = 15m (Art. 7) §
4. Respuesta: "La zona de afección es de 15 metros a cada lado, totalizando 30m de ancho protegido."

METADATA: Incluir referencias a supuestos reales donde aparece este procedimiento
`;

/**
 * Template específico para Strategist Synthesizer
 */
export const STRATEGIST_SYNTHESIZER_TEMPLATE = `
═══════════════════════════════════════════════════════════════
INSTRUCCIONES ESPECÍFICAS - STRATEGIST SYNTHESIZER
═══════════════════════════════════════════════════════════════

TU ROL: Sintetizador final que preserva formato académico-legal

CRÍTICO: 
- Preserva TODOS los sourceMetadata de los drafts de expertos
- Mantén el formato § en secciones temáticas
- NO pierdas las transcripciones literales
- Cada sección del output DEBE incluir sus referencias

FORMATO ACADÉMICO-LEGAL OBLIGATORIO:

1. **Usar símbolo § para secciones temáticas**
2. **Transcribir artículos literalmente** de los drafts
3. **Estructura multi-nivel**:
   - h2 principales
   - h3 subsecciones
   - Bullets (-) para características
   - Sub-bullets (indentados) para detalles
4. **Citas exactas**: (Art. X Ley Y/ZZZZ) después de cada afirmación legal

EJEMPLO DE SÍNTESIS ESPERADA:

## Marco Normativo Clave

### Clasificación de Carreteras

La LCC distingue las carreteras en función del organismo titular § :

• **Regionales**: Corresponden a la Comunidad Autónoma § . Constituyen las redes de carácter básico en cada isla...
  - Artículo 3 establece: "Las carreteras regionales son aquellas cuya titularidad..."
  - Competencias: Planificación, programación, financiación (Art. 5)

• **Insulares**: Corresponden a los Cabildos Insulares § .
  - No pueden transcurrir por más de un término municipal (Art. 8)

### Competencias Administrativas

El Cabildo tiene la competencia respecto de las carreteras insulares § , incluyendo:
1. Proyecto y construcción (Art. 5)
2. Conservación y explotación (Art. 5)
3. Uso (Art. 5)

METADATA: Consolidar sourceMetadata de todos los expertos, preservando chunkIds y originalText
`;

