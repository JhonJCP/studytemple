import { TopicContentViewer } from "@/components/TopicContentViewer";
import { getTopicById, parseTopicId } from "@/lib/syllabus-hierarchy";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { GeneratedTopicContent } from "@/lib/widget-types";

interface PageProps {
    params: Promise<{ topicId: string }>;
}

export default async function TopicPage({ params }: PageProps) {
    const { topicId } = await params;

    // Intentar obtener el tema por ID
    let topic = getTopicById(topicId);

    // Si no se encuentra, puede ser un ID legacy (ej: "a20")
    // En ese caso, buscar en el sistema antiguo y redirigir
    if (!topic) {
        // Fallback para IDs legacy - por ahora notFound
        // TODO: Implementar mapeo de IDs legacy a nuevos
        notFound();
    }

    // Intentar cargar contenido persistido (si el usuario está autenticado)
    let initialContent: GeneratedTopicContent | undefined;
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase
                .from("generated_content")
                .select("content_json")
                .eq("user_id", user.id)
                .eq("topic_id", topic.id)
                .maybeSingle();
            initialContent = data?.content_json as GeneratedTopicContent | undefined;
        }
    } catch {
        // Ignorar errores de supabase para no bloquear la página
    }

    return <TopicContentViewer topic={topic} initialContent={initialContent} />;
}
