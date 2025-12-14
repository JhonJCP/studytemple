import { notFound, redirect } from "next/navigation";
import { getTopicById } from "@/lib/syllabus-hierarchy";
import { createClient } from "@/utils/supabase/server";
import type { GeneratedContentRecord } from "@/types/generated";
import { StudyWorkspace } from "@/components/StudyWorkspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
    params: Promise<{ date: string; topicId: string }>;
}

/**
 * Zona de estudio: muestra outline persistido + contenido generado + audio.
 */
export default async function StudyPage({ params }: PageProps) {
    const { date, topicId } = await params;
    const requestedId = decodeURIComponent(topicId);
    const topic = getTopicById(requestedId);

    if (!topic) {
        notFound();
    }

    // Canonicalizar URL: evita ver contenidos distintos por ids/slugs diferentes
    if (topic.id !== requestedId) {
        redirect(`/study/${encodeURIComponent(date)}/${encodeURIComponent(topic.id)}`);
    }

    // Cargar contenido cacheado (si el usuario está logueado)
    let cachedContent: GeneratedContentRecord | null = null;
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (user) {
            const { data } = await supabase
                .from("generated_content")
                .select(
                    "content_json,audio_url,audio_script,audio_duration,status,is_complete,topic_id,created_at,updated_at,user_id,id"
                )
                .eq("user_id", user.id)
                .eq("topic_id", topic.id)
                // IMPORTANTE: no ordenar por updated_at porque los widgets/audio pueden actualizarlo y “revivir” una versión vieja.
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) {
                cachedContent = {
                    ...(data as any),
                } as GeneratedContentRecord;
            }
        }
    } catch (e) {
        // No bloquear la página si Supabase falla
        console.warn("No se pudo leer caché de Supabase:", e);
    }

    const audioUrl = cachedContent?.audio_url || undefined;
    const audioScript = cachedContent?.audio_script || undefined;
    const audioDuration = cachedContent?.audio_duration || undefined;

    return (
        <StudyWorkspace
            date={date}
            topic={topic}
            initialRecordId={cachedContent?.id}
            initialContent={cachedContent?.content_json}
            initialAudioUrl={audioUrl}
            initialAudioScript={audioScript}
            initialAudioDuration={audioDuration}
        />
    );
}
