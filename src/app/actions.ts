"use server";

import { aiService } from "@/lib/ai-service";

export async function simplifyTextAction(text: string) {
    try {
        return await aiService.simplifyText(text);
    } catch (error) {
        console.error("AI Error:", error);
        return "Error comunicando con el Oráculo. Verifica tu API Key.";
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
