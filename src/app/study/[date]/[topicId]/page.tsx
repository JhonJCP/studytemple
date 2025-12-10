import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Headphones } from "lucide-react";
import { getTopicById } from "@/lib/syllabus-hierarchy";
import { TopicContentViewer } from "@/components/TopicContentViewer";
import { createClient } from "@/utils/supabase/server";
import type { GeneratedContentRecord } from "@/types/generated";
import { StudyPodcastPanel } from "@/components/StudyPodcastPanel";

interface PageProps {
    params: Promise<{ date: string; topicId: string }>;
}

/**
 * Zona de estudio: muestra outline persistido + contenido generado + audio.
 */
export default async function StudyPage({ params }: PageProps) {
    const { date, topicId } = await params;
    const topic = getTopicById(decodeURIComponent(topicId));

    if (!topic) {
        notFound();
    }

    // Cargar contenido cacheado (si el usuario está logueado)
    let cachedContent: GeneratedContentRecord | null = null;
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const { data } = await supabase
                .from("generated_content")
                .select("content_json,audio_url,audio_script,audio_duration,status,is_complete,topic_id,created_at,updated_at,user_id,id")
                .eq("user_id", user.id)
                .eq("topic_id", topic.id)
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
        <div className="min-h-screen bg-background">
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 backdrop-blur-xl z-20">
                <div className="flex items-center gap-4">
                    <Link href="/calendar" className="p-2 rounded-lg hover:bg-white/10 text-white/70">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <p className="text-xs font-bold text-primary uppercase tracking-widest">Sesión {date}</p>
                        <h1 className="text-2xl font-black text-white leading-tight">{topic.title}</h1>
                        <p className="text-white/40 text-sm">{topic.groupTitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl">
                        <Headphones className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-white/70">
                            {audioUrl ? "Podcast disponible" : "Podcast pendiente"}
                        </span>
                    </div>
                </div>
            </header>

            <main className="grid lg:grid-cols-[2fr_1fr] gap-6 p-6">
                <section className="rounded-2xl border border-white/5 bg-black/30 overflow-hidden">
                    <TopicContentViewer topic={topic} initialContent={cachedContent?.content_json} />
                </section>

                <aside className="space-y-4">
                    <StudyPodcastPanel
                        topicId={topic.id}
                        initialAudioUrl={audioUrl}
                        initialScript={audioScript}
                        initialDuration={audioDuration}
                    />

                    <div className="glass-card p-4">
                        <h3 className="text-sm font-bold text-white/60 uppercase mb-2">Acciones rápidas</h3>
                        <div className="space-y-2 text-sm text-white/70">
                            <p>- Generar / Regenerar contenido desde el panel principal.</p>
                            <p>- Ver proceso IA con el toggle dentro del visor.</p>
                            <p>- Próximo: guardar progreso y marcar secciones completadas.</p>
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
}
