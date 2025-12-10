"use server";

import { createClient } from "@/utils/supabase/server";
import { audioService } from "@/lib/audio-service";
import { getTopicById } from "@/lib/syllabus-hierarchy";
import type { GeneratedTopicContent } from "@/lib/widget-types";

/**
 * Genera (script + TTS) para un tema y persiste en Supabase.
 * Usa contenido previo si existe; si no, genera un guion básico a partir del título.
 */
export async function generateTopicAudioAction(topicId: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated" };

        const topic = getTopicById(topicId);
        const fallbackTitle = topic?.title || topicId;

        // 1) Leer contenido generado (si existe)
        const { data: cached } = await supabase
            .from("generated_content")
            .select("content_json")
            .eq("user_id", user.id)
            .eq("topic_id", topicId)
            .maybeSingle();

        const content = cached?.content_json as GeneratedTopicContent | undefined;

        // 2) Construir script
        const script = buildScriptFromContent(fallbackTitle, content);

        // 3) Generar audio (usa ElevenLabs + Storage con cache)
        const audioUrl = await audioService.generateAudio(script, topicId);

        // 4) Persistir metadatos en generated_content
        const { error: upsertError } = await supabase
            .from("generated_content")
            .upsert({
                user_id: user.id,
                topic_id: topicId,
                audio_url: audioUrl,
                audio_script: script,
                audio_duration: null,
                updated_at: new Date().toISOString()
            });

        if (upsertError) {
            return { success: false, error: upsertError.message };
        }

        return { success: true, audioUrl: audioUrl ?? undefined, script };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

function buildScriptFromContent(title: string, content?: GeneratedTopicContent): string {
    if (!content?.sections?.length) {
        return `Podcast express sobre ${title}. Introducción breve, puntos clave del temario y un cierre con recordatorio de repaso espaciado.`;
    }

    const sections = content.sections.slice(0, 4).map(sec => `- ${sec.title}: ${truncate(sec.content.text, 220)}`);
    return [
        `Podcast de estudio: ${content.title || title}.`,
        "Intro: objetivo del tema y cómo aparece en el examen.",
        "Desarrollo:",
        ...sections,
        "Cierre: resume 3 ideas clave y agenda el siguiente repaso."
    ].join("\n");
}

function truncate(text: string, max: number) {
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max)}...` : text;
}
