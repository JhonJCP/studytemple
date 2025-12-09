import { StudyCell } from "@/components/StudyCell";
import { SYLLABUS_DATA } from "@/lib/syllabus-data";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageProps {
    params: Promise<{ topicId: string }>;
}

export default async function TopicPage({ params }: PageProps) {
    const { topicId } = await params;
    const topic = SYLLABUS_DATA.find((t) => t.id === topicId);

    if (!topic) {
        // For demo, if ID not found, just show a generic one or 404
        // return notFound();
    }

    return (
        <div className="min-h-screen p-8 bg-background flex flex-col">
            <Link href={`/syllabus/zone-${topic?.zoneId || 'a'}`} className="flex items-center text-white/50 hover:text-white mb-6 transition-colors w-fit">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver a la Zona {topic?.zoneId}
            </Link>

            <div className="flex-1">
                <StudyCell
                    topicId={topicId}
                    topicTitle={topic?.title || "Tema Desconocido (Demo)"}
                />
            </div>
        </div>
    );
}
