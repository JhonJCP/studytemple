"use client";

import { useTransition, useState } from "react";
import { Loader2, Headphones, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateTopicAudioAction } from "@/app/actions/generate-topic-audio";

interface Props {
    topicId: string;
    initialAudioUrl?: string;
    initialScript?: string;
    initialDuration?: number | null;
}

export function StudyPodcastPanel({ topicId, initialAudioUrl, initialScript, initialDuration }: Props) {
    const [audioUrl, setAudioUrl] = useState<string | undefined>(initialAudioUrl);
    const [script, setScript] = useState<string | undefined>(initialScript);
    const [duration, setDuration] = useState<number | null | undefined>(initialDuration);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = () => {
        setError(null);
        startTransition(async () => {
            const res = await generateTopicAudioAction(topicId);
            if (res.success) {
                setAudioUrl(res.audioUrl);
                setScript(res.script);
                setDuration(null);
            } else {
                setError(res.error || "No se pudo generar audio.");
            }
        });
    };

    return (
        <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-white/70 uppercase">Podcast</h3>
            </div>

            {audioUrl ? (
                <div className="space-y-3">
                    <audio controls className="w-full">
                        <source src={audioUrl} type="audio/mpeg" />
                    </audio>
                    {duration && (
                        <p className="text-xs text-white/40">Duración: {Math.round(duration / 60)} min</p>
                    )}
                    {script && (
                        <details className="bg-white/5 rounded p-3 text-sm text-white/70">
                            <summary className="cursor-pointer text-white/80">Transcripción</summary>
                            <p className="mt-2 whitespace-pre-wrap">{script}</p>
                        </details>
                    )}
                    <button
                        onClick={handleGenerate}
                        disabled={isPending}
                        className={cn(
                            "w-full flex items-center justify-center gap-2 text-sm font-bold px-4 py-2 rounded-lg border transition",
                            isPending ? "bg-white/10 text-white/50 cursor-wait" : "bg-white text-black hover:bg-gray-200"
                        )}
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Regenerar audio
                    </button>
                </div>
            ) : (
                <div className="space-y-3 text-sm text-white/70">
                    <p>Audio pendiente de generación.</p>
                    <button
                        onClick={handleGenerate}
                        disabled={isPending}
                        className={cn(
                            "w-full flex items-center justify-center gap-2 text-sm font-bold px-4 py-2 rounded-lg border transition",
                            isPending ? "bg-white/10 text-white/50 cursor-wait" : "bg-white text-black hover:bg-gray-200"
                        )}
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Headphones className="w-4 h-4" />}
                        Generar audio
                    </button>
                    <p className="text-xs text-white/40">
                        Se usará el contenido generado (si existe) o el título del tema para crear un guion y TTS.
                    </p>
                </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
    );
}
