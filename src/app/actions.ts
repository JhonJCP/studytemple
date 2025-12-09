"use server";

import { aiService } from "@/lib/ai-service";

export async function analyzeContentAction(text: string) {
    try {
        return await aiService.analyzeContent(text);
    } catch (error) {
        console.error("AI Error:", error);
        return { explanation: "Error comunicando con el Oráculo. Verifica tu API Key.", widgets: [] };
    }
}

export async function generateQuizAction(topic: string) {
    try {
        return await aiService.generateQuiz(topic);
    } catch (error) {
        console.error("AI Error:", error);
        return "[]";
    }
}
