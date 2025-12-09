import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

interface AgentResponse {
    role: string;
    content: string;
    missingConcepts?: string[];
}

export class MultiAgentOrchestrator {

    // AGENT 1: THE LIBRARIAN (Retrieval)
    // In a real scenario, this queries Supabase. For now, it simulates access to file list and metadata.
    private async askLibrarian(topic: string): Promise<string> {
        // TODO: Connect this to Supabase match_library_documents RPC
        console.log(`[Librarian] Buscando información sobre: ${topic}`);
        return `[SIMULATED DB RESULT] Encontrados 3 documentos relevantes en la Zona A sobre ${topic}.`;
    }

    // AGENT 2: THE AUDITOR (Gap Analysis)
    private async askAuditor(topic: string, libraryContext: string): Promise<AgentResponse> {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

        const prompt = `
        ACTÚA COMO: Auditor Oficial del BOE de Obras Públicas.
        OBJETIVO: Detectar vacíos (GAPS) en el material de estudio.
        
        TEMA SOLICITADO: "${topic}"
        MATERIAL DISPONIBLE (Reporte del Bibliotecario): "${libraryContext}"
        REQUISITOS BOE (Conocimiento Interno):
        - Debes saber si para este tema es obligatorio mencionar normativas específicas (EHE-08, Ley de Contratos, etc.)
        
        SALIDA JSON:
        {
            "status": "GAP_DETECTED" | "OK",
            "missingConcepts": ["Lista", "de", "cosas", "que", "faltan"]
        }
        `;

        try {
            const res = await model.generateContent(prompt);
            const text = res.response.text();
            // Simple parsing simulation for robustness
            if (text.includes("GAP_DETECTED")) {
                return { role: "Auditor", content: "He detectado vacíos en la documentación.", missingConcepts: ["Normativa Específica", "Ejemplos Prácticos"] };
            }
            return { role: "Auditor", content: "La documentación parece cubrir los requisitos básicos.", missingConcepts: [] };
        } catch (e) {
            return { role: "Auditor", content: "Error consultando al BOE." };
        }
    }

    // AGENT 3: THE STRATEGIST (Synthesis)
    private async askStrategist(topic: string, auditorReport: AgentResponse, libraryContext: string): Promise<any> {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-pro-latest",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
        ACTÚA COMO: Ingeniero Jefe y Profesor del Estudio.
        MISIÓN: Generar la lección final para el alumno.
        
        INPUTS:
        1. TEMA: ${topic}
        2. MATERIAL BIBLIOTECA: ${libraryContext}
        3. REPORTE AUDITOR BOE: ${JSON.stringify(auditorReport)}
        
        INSTRUCCIONES:
        - Si el Auditor dice que falta algo, GENÉRALO tú mismo usando tu conocimiento general, pero marca claramente (con un widget de "Alerta") que es contenido generado para cubrir un vacío.
        - Estructura la lección para maximizar la nota en el examen práctico.
        - Decide qué UI Widgets usar (Timeline, Diagram, etc).

        SALIDA JSON (Estructura Final para Frontend):
        {
            "explanation": "Texto final...",
            "coverageStatus": "FULL" | "AUGMENTED", 
            "widgets": [...]
        }
        `;

        const res = await model.generateContent(prompt);
        return JSON.parse(res.response.text());
    }

    // MAIN WORKFLOW (The "n8n" equivalent)
    public async orchestrateLesson(topic: string) {
        console.log("--- INICIANDO ORQUESTACIÓN DE AGENTES ---");

        // 1. Librarian Search
        const libraryContext = await this.askLibrarian(topic);

        // 2. BOE Audit
        const auditorResult = await this.askAuditor(topic, libraryContext);

        // 3. Strategic Synthesis
        const finalLesson = await this.askStrategist(topic, auditorResult, libraryContext);

        return finalLesson;
    }
}

export const multiAgent = new MultiAgentOrchestrator();
