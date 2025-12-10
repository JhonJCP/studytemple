"use server";

import { createClient } from "@/utils/supabase/server";
import type { GeneratedContentRecord } from "@/types/generated";

/**
 * Devuelve contenido generado cacheado para el usuario autenticado.
 */
export async function getGeneratedContent(topicId: string): Promise<{ success: boolean; data?: GeneratedContentRecord | null; error?: string }> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return { success: false, error: "Not authenticated" };

        const { data, error } = await supabase
            .from("generated_content")
            .select("id,user_id,topic_id,content_json,audio_script,audio_url,audio_duration,images,status,is_complete,created_at,updated_at")
            .eq("user_id", user.id)
            .eq("topic_id", topicId)
            .maybeSingle();

        if (error) return { success: false, error: error.message };

        return { success: true, data: data as GeneratedContentRecord | null };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}
