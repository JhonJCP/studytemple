import { getGroupByIndex, getTopicsByGroupIndex } from "@/lib/syllabus-hierarchy";
import Link from "next/link";
import { ArrowLeft, BookOpen, FileText } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
    params: Promise<{ groupIndex: string }>;
}

export default async function GroupPage({ params }: PageProps) {
    const { groupIndex } = await params;
    const index = parseInt(groupIndex, 10);

    const group = getGroupByIndex(index);
    if (!group) {
        notFound();
    }

    const topics = getTopicsByGroupIndex(index);

    return (
        <div className="min-h-screen p-8 bg-background">
            <Link
                href="/dashboard"
                className="flex items-center text-white/50 hover:text-white mb-8 transition-colors"
            >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Volver al Templo
            </Link>

            <header className="mb-12">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-4 bg-primary/20 rounded-2xl">
                        <BookOpen className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
                            Bloque {index + 1}
                        </p>
                        <h1 className="text-4xl font-black text-white">
                            {group.title}
                        </h1>
                    </div>
                </div>
                <p className="text-white/50 max-w-2xl">
                    {group.description}
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {topics.map((topic, idx) => (
                    <Link
                        href={`/syllabus/topic/${topic.id}`}
                        key={topic.id}
                    >
                        <div className="group border border-white/10 bg-secondary/20 p-6 rounded-xl hover:bg-secondary/40 hover:border-primary/30 transition-all cursor-pointer h-full">
                            <div className="flex items-start justify-between mb-3">
                                <span className="text-xs font-bold text-white/30 bg-black/20 px-2 py-1 rounded">
                                    {idx + 1}/{topics.length}
                                </span>
                                <FileText className="w-5 h-5 text-white/20 group-hover:text-primary transition-colors" />
                            </div>
                            <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors leading-tight">
                                {topic.title}
                            </h3>
                            <p className="text-xs text-white/30 mt-3 font-mono truncate">
                                {topic.originalFilename}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
