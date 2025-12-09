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

import { audioService } from "@/lib/audio-service";

export async function generateSmartAudioAction(text: string, topicId: string) {
    try {
        // 1. Summarize
        const summary = await aiService.summarizeForAudio(text);

        // 2. Generate Audio from Summary
        // We append '_summary' to topicId so we don't conflict if we ever want the full text audio.
        // But for cache efficiency, maybe we just use the hash of the text managed inside audioService.
        // audioService handles caching based on text content hash anyway!
        const audioUrl = await audioService.generateAudio(summary, topicId);

        return { audioUrl, summary };
    } catch (error) {
        console.error("Smart Audio Error:", error);
        return { audioUrl: null, summary: null };
    }
}
