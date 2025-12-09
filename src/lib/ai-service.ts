// Server-side only
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

// Use server-side key (removed NEXT_PUBLIC)
const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

interface GenerationConfig {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
}

export const AI_MODELS = {
    MASTER: "gemini-1.5-pro-latest", // "Gemini 3 Pro"
    VISUAL: "gemini-1.5-pro-latest", // Using Pro for diagrams as requested
    FAST: "gemini-1.5-flash-latest", // "Nano Banana"
};

const SYSTEM_PROMPT_CORE = `
Eres el Oráculo del "Templo de Estudio", un ingeniero experto en Obras Públicas.
Tu Misión: Ayudar al usuario (un ingeniero técnico) a aprobar su oposición.
Reglas de Oro:
1. IDIOMA: SIEMPRE Español de España (es-ES). No uses jerga latina ("computadora" -> "ordenador", "carro" -> "coche").
2. TONO: Profesional, técnico, pero accesible. "Ingeniero a Ingeniero".
3. ESTRUCTURA: Respuestas claras, con viñetas, negritas para conceptos clave.
4. PEDAGOGÍA: Usa metáforas de construcción. Ejemplo: "Los cimientos del derecho administrativo...".
`;

export class AiService {
    private masterModel: GenerativeModel;
    private visualModel: GenerativeModel;
    private fastModel: GenerativeModel;

    constructor() {
        if (!API_KEY) {
            // Warning but don't crash, might be build time
            console.warn("AiService: API Key missing.");
        }
        this.masterModel = genAI.getGenerativeModel({ model: AI_MODELS.MASTER, systemInstruction: SYSTEM_PROMPT_CORE });
        this.visualModel = genAI.getGenerativeModel({ model: AI_MODELS.VISUAL, systemInstruction: SYSTEM_PROMPT_CORE + "\nEspecialidad: Generación de diagramas Mermaid y descripciones visuales precisas." });
        this.fastModel = genAI.getGenerativeModel({ model: AI_MODELS.FAST, systemInstruction: SYSTEM_PROMPT_CORE });
    }

    async analyzeContent(complexText: string): Promise<any> {
        if (!API_KEY) return { explanation: "⚠️ ERROR: No has configurado la API KEY.", widgets: [] };

        const prompt = `
    TAREA: Actúa como un "Ingeniero Arquitecto del Conocimiento".
    1. ANALIZA el siguiente texto.
    2. EXPLÍCALO en lenguaje sencillo (Markdown). Prioriza la claridad.
    3. DISEÑA widgets complementarios para reforzar el aprendizaje según el tipo de contenido:
       - Si hay fechas/plazos ->Widget "timeline"
       - Si hay jerarquía/procesos -> Widget "diagram"
       - Si hay listas difíciles -> Widget "mnemonic"
       - Si es abstracto -> Widget "analogy"

    CONTENIDO:
    ${complexText}

    FORMATO SALIDA (JSON Puro):
    {
      "explanation": "Texto en markdown...",
      "widgets": [
         { "type": "mnemonic", "content": { "rule": "PPC", "explanation": "Planifica, Proyecta, Construye" } },
         { "type": "timeline", "content": { "steps": [{ "time": "1 mes", "action": "Audiencia" }] } },
         { "type": "analogy", "content": { "story": "Imagina que la carretera es como una tubería..." } },
         { "type": "diagram", "content": { "structure": "Consejero -> Director -> Servicio" } }
      ]
    }
    `;

        const model = genAI.getGenerativeModel({
            model: AI_MODELS.MASTER,
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    }

    async generateQuiz(topic: string, count: number = 5): Promise<string> {
        const prompt = `
    TAREA: Genera ${count} preguntas tipo test sobre "${topic}".
    FORMATO: JSON array de objetos { question, options[], correctIndex, explanation }.
    DIFICULTAD: Examen de oposición real.
    `;
        // Use fast model for JSON generation if simple, but user wants quality.
        // We'll use Visual/Fast model with strict JSON mode.
        const model = genAI.getGenerativeModel({
            model: AI_MODELS.FAST,
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent(prompt);
        return result.response.text();
    }

    async explainWithMermaid(concept: string): Promise<string> {
        const prompt = `
    TAREA: Crea un diagrama Mermaid.js que explique el concepto: "${concept}".
    TIPO: Graph LR o SequenceDiagram.
    SALIDA: Solo el código Mermaid dentro de bloque \`\`\`mermaid \`\`\`.
    `;
        const result = await this.visualModel.generateContent(prompt);
        return result.response.text();
    }
}

export const aiService = new AiService();
