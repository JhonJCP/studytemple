---
description: Plan de Implementación - Dashboard de Temario con Orquestación de Agentes y Widgets Interactivos
---

# 🎯 PLAN DE IMPLEMENTACIÓN: SECCIÓN DASHBOARD / TEMARIO

## 📋 RESUMEN EJECUTIVO

Este plan detalla la implementación de un sistema de visualización y generación de temarios en el Dashboard de StudyTemple. El sistema permitirá:
- Navegar por las zonas de estudio y ver los temas correspondientes
- Visualizar la estructura jerárquica de cada tema
- Generar temario mediante orquestación de agentes IA
- Renderizar widgets interactivos (diagramas, mnemotécnicos, audio, imágenes) de forma dinámica

---

## 🏗️ ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────┐
│                    DASHBOARD (UI Layer)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  StudyMap   │  │ ZoneDetail  │  │ TopicViewer │          │
│  │ (Navegación)│→│  (Temas)    │→│ (Contenido) │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   CONTENT GENERATOR                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Topic Content Orchestrator                  │   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐     │   │
│  │  │Librarian│→│Auditor │→│Strategist│→│Widget  │     │   │
│  │  │ Agent  │  │ Agent  │  │  Agent  │  │Factory │     │   │
│  │  └────────┘  └────────┘  └────────┘  └────────┘     │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                     WIDGETS LAYER                            │
│  ┌─────────┐┌──────────┐┌───────────┐┌─────────┐┌────────┐  │
│  │Mnemonic ││ Timeline ││  Diagram  ││  Audio  ││ Image  │  │
│  │ Widget  ││  Widget  ││  Widget   ││ Widget  ││ Widget │  │
│  └─────────┘└──────────┘└───────────┘└─────────┘└────────┘  │
│  ┌─────────┐┌──────────┐┌───────────┐┌─────────┐┌────────┐  │
│  │Analogy  ││ Formula  ││  Video    ││  Quiz   ││ Alert  │  │
│  │ Widget  ││  Widget  ││  Widget   ││ Widget  ││ Widget │  │
│  └─────────┘└──────────┘└───────────┘└─────────┘└────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 ESTRUCTURA DE ARCHIVOS A CREAR/MODIFICAR

### Nuevos Archivos:
```
src/
├── app/
│   └── syllabus/
│       ├── [zoneId]/
│       │   └── page.tsx                    # ⚡ MODIFICAR - Vista de zona con temas
│       └── topic/
│           └── [topicId]/
│               └── page.tsx                # ⚡ MODIFICAR - Vista del tema
│
├── components/
│   ├── TopicContentViewer.tsx              # 🆕 CREAR - Visualizador principal del temario
│   ├── HierarchicalOutline.tsx             # 🆕 CREAR - Árbol jerárquico del tema
│   ├── ContentGeneratorStatus.tsx          # 🆕 CREAR - Indicador de generación en tiempo real
│   ├── WidgetFactory.tsx                   # 🆕 CREAR - Factoría de widgets dinámicos
│   └── widgets/
│       ├── index.tsx                       # ⚡ MODIFICAR - Exportar nuevos widgets
│       ├── ImageWidget.tsx                 # 🆕 CREAR - Widget de imagen generada
│       ├── AudioWidget.tsx                 # 🆕 CREAR - Widget de audio con player
│       ├── FormulaWidget.tsx               # 🆕 CREAR - Widget de fórmulas LaTeX
│       ├── QuizWidget.tsx                  # 🆕 CREAR - Mini-quiz inline
│       └── AlertWidget.tsx                 # 🆕 CREAR - Alerta de contenido augmentado
│
├── lib/
│   ├── topic-content-generator.ts          # 🆕 CREAR - Servicio de generación de contenido
│   ├── syllabus-hierarchy.ts               # 🆕 CREAR - Parser de estructura jerárquica
│   └── widget-types.ts                     # 🆕 CREAR - Tipos TypeScript para widgets
│
└── app/
    └── actions/
        └── generate-topic-content.ts       # 🆕 CREAR - Server Action para generación
```

---

## 🔄 FASES DE IMPLEMENTACIÓN

### **FASE 1: Estructura Base de Datos y Tipos** (20 min)
1. Definir tipos TypeScript para:
   - `TopicSection` (sección de un tema)
   - `TopicHierarchy` (estructura jerárquica)
   - `WidgetDefinition` (definición de widget)
   - `GeneratedContent` (contenido generado)

2. Crear parser de jerarquía desde `smart-syllabus.json`

### **FASE 2: Visualización del Árbol Jerárquico** (30 min)
1. Crear `HierarchicalOutline.tsx`:
   - Vista expandible/colapsable
   - Iconos según tipo de sección
   - Indicador de progreso de generación
   - Animaciones suaves

### **FASE 3: Sistema de Generación de Contenido** (45 min)
1. Crear `topic-content-generator.ts`:
   - Conectar con `MultiAgentOrchestrator`
   - Streaming de respuesta (SSE/WebSocket)
   - Cache de contenido generado
   
2. Crear Server Action `generate-topic-content.ts`:
   - Recibir topicId y sectionId
   - Llamar al orquestador
   - Devolver contenido estructurado con widgets

### **FASE 4: TopicContentViewer Principal** (40 min)
1. Crear `TopicContentViewer.tsx`:
   - Header con título y metadata del tema
   - Árbol jerárquico lateral
   - Área de contenido principal con scroll
   - Barra de progreso de generación
   - Botón "Generar Temario Completo"

### **FASE 5: Nuevos Widgets** (50 min)
1. **ImageWidget**: 
   - Botón "Generar Imagen" que llama a la API de imagen
   - Placeholder mientras genera
   - Zoom/lightbox para ver ampliado
   
2. **AudioWidget**:
   - Player compacto con play/pause
   - Barra de progreso
   - Velocidad ajustable
   - Botón de descarga
   
3. **FormulaWidget**:
   - Renderizado LaTeX
   - Explicación de variables
   - Copiar fórmula
   
4. **QuizWidget**:
   - Mini-test de 3 preguntas
   - Feedback instantáneo
   - Marca como revisado en SRS
   
5. **AlertWidget**:
   - Indicador de contenido augmentado por IA
   - Muestra gap detectado
   - Estilo diferenciado

### **FASE 6: Integración Streaming Real-Time** (30 min)
1. Implementar rendering incremental:
   - Texto aparece caracter por caracter
   - Widgets aparecen con animación cuando se parsean
   - Indicador de "escribiendo..." durante generación

### **FASE 7: Testing con Tema de Prueba** (20 min)
1. Seleccionar tema: "Ley de Carreteras de Canarias"
2. Generar contenido completo
3. Verificar todos los widgets
4. Depurar problemas
5. Optimizar UX

---

## 🎨 ESPECIFICACIONES DE UI/UX

### Paleta de Colores por Widget:
- **Mnemonic**: `green-500` (memorización)
- **Timeline**: `blue-500` (cronología)
- **Diagram**: `white/purple` (estructura)
- **Analogy**: `amber-500` (comprensión)
- **Image**: `cyan-500` (visual)
- **Audio**: `orange-500` (auditivo)
- **Formula**: `pink-500` (matemático)
- **Quiz**: `yellow-500` (evaluación)
- **Alert**: `red-500` (atención)

### Estados de Generación:
```typescript
type GenerationState = 
  | 'idle'           // Sin generar
  | 'queued'         // En cola
  | 'fetching'       // Obteniendo de biblioteca
  | 'analyzing'      // Analizando gaps
  | 'generating'     // Generando contenido
  | 'completed'      // Completado
  | 'error';         // Error
```

### Animaciones:
- Fade-in suave para contenido nuevo
- Skeleton loading durante carga
- Pulse en indicador de generación
- Scale-up en hover de widgets

---

## 📝 ESTRUCTURA JSON DE CONTENIDO GENERADO

```typescript
interface GeneratedTopicContent {
  topicId: string;
  title: string;
  metadata: {
    complexity: 'High' | 'Medium' | 'Low';
    estimatedStudyTime: number; // minutos
    sourceDocuments: string[];
    generatedAt: Date;
  };
  sections: TopicSection[];
}

interface TopicSection {
  id: string;
  title: string;
  level: 'h1' | 'h2' | 'h3';
  sourceType: 'library' | 'augmented' | 'mixed';
  content: {
    text: string;
    widgets: WidgetDefinition[];
  };
  children?: TopicSection[];
}

interface WidgetDefinition {
  type: 'mnemonic' | 'timeline' | 'diagram' | 'analogy' | 'image' | 'audio' | 'formula' | 'quiz' | 'alert' | 'video_loop';
  content: any; // Específico por tipo
  generatable: boolean; // Si el widget necesita generación adicional
}
```

---

## 🧪 TEMA DE PRUEBA: Ley de Carreteras de Canarias

### Estructura Jerárquica Esperada:
```
📘 Ley 9/1991 de Carreteras de Canarias
├── 📌 Introducción y Objeto de la Ley
│   ├── 📄 Artículo 1: Objeto
│   │   ├── 💡 Widget: Explicación simplificada
│   │   └── 🧠 Widget: Mnemotécnico "PPC-CEF"
│   └── 📄 Artículo 2: Ámbito de aplicación
│       └── 🗺️ Widget: Diagrama de tipos de carreteras
├── 📌 Competencias Administrativas
│   ├── 📄 Artículo 3: Competencias del Estado
│   ├── 📄 Artículo 4: Competencias de la CAC
│   │   └── ⏰ Widget: Timeline traspaso competencias
│   └── 📄 Artículo 5: Competencias Insulares
│       └── 🔊 Widget: Audio resumen
├── 📌 Clasificación de la Red Viaria
│   └── ...
└── 📌 Zona de Dominio Público y Servidumbre
    ├── ⚠️ Widget: Alerta (contenido augmentado)
    └── 🖼️ Widget: Imagen ilustrativa (generable)
```

---

## 🚀 COMANDOS DE EJECUCIÓN

```bash
# Iniciar servidor de desarrollo
npm run dev

# Navegar a tema de prueba
http://localhost:3000/syllabus/topic/a20
```

---

## ✅ CRITERIOS DE ÉXITO (Definition of Done)

1. [ ] Navegar desde Dashboard → Zona → Tema funciona fluidamente
2. [ ] Estructura jerárquica del tema se muestra correctamente
3. [ ] Botón "Generar Temario" inicia el proceso
4. [ ] Texto se genera en streaming visible al usuario
5. [ ] Widgets aparecen automáticamente según el contenido
6. [ ] Widget de Imagen: Botón genera imagen real
7. [ ] Widget de Audio: Player funcional con TTS
8. [ ] Widget de Diagrama: Mermaid renderiza correctamente
9. [ ] Estados de carga claros y atractivos
10. [ ] Sin errores en consola
11. [ ] Performance aceptable (<3s tiempo inicial)

---

## 🔮 PRÓXIMOS PASOS POST-IMPLEMENTACIÓN

1. **Persistencia**: Guardar contenido generado en Supabase
2. **SRS Integration**: Marcar secciones como estudiadas
3. **Calendar Sync**: Vincular con el Cerebro de Calendario
4. **Export**: Exportar tema a PDF/Markdown
5. **Flashcards**: Generar tarjetas desde widgets de mnemotécnicos

---

// turbo-all
