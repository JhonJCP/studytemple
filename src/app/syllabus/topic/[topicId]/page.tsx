import { TopicContentViewer } from "@/components/TopicContentViewer";
import { getTopicById, parseTopicId } from "@/lib/syllabus-hierarchy";
import { notFound } from "next/navigation";

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

    return <TopicContentViewer topic={topic} />;
}
