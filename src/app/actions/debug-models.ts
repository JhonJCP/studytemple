"use server";

import { createClient } from "@/utils/supabase/server";

export async function debugGeminiModels() {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return { success: false, error: "No API Key found." };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        return {
            success: true,
            models: data.models?.map((m: any) => m.name) || []
        };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}
