import { getTopicsByZone } from "@/lib/syllabus-data";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
    params: Promise<{ zoneId: string }>;
}

export default async function ZonePage({ params }: PageProps) {
    const { zoneId } = await params;
    // Normalize "zone-a" -> "A"
    const normalizedZoneId = zoneId.replace(/zone-/i, "").toUpperCase();
    const topics = getTopicsByZone(normalizedZoneId);

    if (!topics.length && normalizedZoneId !== "F") {
        // Allow F for now or handle empty zones gracefully
    }

    return (
        <div className="min-h-screen p-8 bg-background">
            <Link href="/dashboard" className="flex items-center text-white/50 hover:text-white mb-8 transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver al Templo
            </Link>

            <h1 className="text-5xl font-black text-white mb-12">ZONA {normalizedZoneId}</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topics.map((topic) => (
                    <Link href={`/syllabus/topic/${topic.id}`} key={topic.id}>
                        <div className="group border border-white/10 bg-secondary/20 p-6 rounded-xl hover:bg-secondary/40 transition-all cursor-pointer">
                            <div className="flex items-start justify-between">
                                <h3 className="text-xl font-bold text-white group-hover:text-primary transition-colors">
                                    {topic.title}
                                </h3>
                                <BookOpen className="w-6 h-6 text-white/20 group-hover:text-primary transition-colors" />
                            </div>
                            <p className="text-sm text-white/40 mt-2">
                                Referencia: {topic.fileReference}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
