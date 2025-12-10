"use server";

import { createClient } from "@/utils/supabase/server";

/**
 * Guarda los metadatos de audio generados para un tema.
 */
export async function saveGeneratedAudio(params: { topicId: string; audioUrl: string; audioDuration?: number; audioScript?: string }) {
    const { topicId, audioUrl, audioDuration, audioScript } = params;

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated" };

        const { error } = await supabase
            .from("generated_content")
            .upsert({
                user_id: user.id,
                topic_id: topicId,
                audio_url: audioUrl,
                audio_duration: audioDuration ?? null,
                audio_script: audioScript ?? null,
                updated_at: new Date().toISOString()
            });

        if (error) return { success: false, error: error.message };

        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}
