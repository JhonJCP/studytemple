"use server";

import { generateTopicContentWithTrace } from "@/lib/topic-content-generator";
import type { GeneratedTopicContent, OrchestrationState } from "@/lib/widget-types";
import { createClient } from "@/utils/supabase/server";

/**
 * Genera (o devuelve desde caché) el contenido de un tema.
 * - Si existe generated_content para el usuario y no se pide force, se devuelve.
 * - Si no hay user, genera sin persistir.
 */
export async function generateTopicContentAction(
    topicId: string,
    opts?: { force?: boolean }
): Promise<{ success: boolean; data?: GeneratedTopicContent; trace?: OrchestrationState; error?: string }> {
    const force = opts?.force === true;

    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // 1) Intentar leer de caché si hay user y no es force
        if (user && !force) {
            const { data: cached, error: cacheError } = await supabase
                .from("generated_content")
                .select("content_json")
                .eq("user_id", user.id)
                .eq("topic_id", topicId)
                .maybeSingle();

            if (cacheError) {
                console.warn("Cache lookup failed:", cacheError.message);
            }

            if (cached?.content_json) {
                return { success: true, data: cached.content_json as GeneratedTopicContent };
            }
        }

        // 2) Generar contenido
        const { result, state } = await generateTopicContentWithTrace(topicId);

        // 3) Guardar en Supabase si hay user
        if (user) {
            const { error: upsertError } = await supabase.from("generated_content").upsert({
                user_id: user.id,
                topic_id: topicId,
                content_json: result,
                is_complete: true,
                status: "complete",
                updated_at: new Date().toISOString()
            });

            if (upsertError) {
                console.warn("Failed to upsert generated_content:", upsertError.message);
            }
        }

        return { success: true, data: result, trace: state };
    } catch (error) {
        console.error("Error generating topic content:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        };
    }
}
