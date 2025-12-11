import { NextRequest } from "next/server";
import { TopicContentGenerator } from "@/lib/topic-content-generator";
import { generateTopicContentWithTrace } from "@/lib/topic-content-generator";
import type { OrchestrationState, GeneratedTopicContent } from "@/lib/widget-types";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function sseEvent(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const topicId = searchParams.get("topicId");
    const force = searchParams.get("force") === "true";

    if (!topicId) {
        return new Response("topicId requerido", { status: 400 });
    }

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            const send = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(sseEvent(event, data)));
            };

            (async () => {
                // 1) Intentar devolver caché si hay usuario y no es force
                let supabaseUser: string | null = null;
                try {
                    const supabase = await createClient();
                    const { data: { user } } = await supabase.auth.getUser();
                    supabaseUser = user?.id || null;

                    if (user && !force) {
                        const { data: cached } = await supabase
                            .from("generated_content")
                            .select("content_json")
                            .eq("user_id", user.id)
                            .eq("topic_id", topicId)
                            .maybeSingle();

                        if (cached?.content_json) {
                            const cachedContent = cached.content_json as GeneratedTopicContent;
                            send("state", { topicId, status: "completed", steps: [], currentStep: null, result: cachedContent });
                            send("done", { result: cachedContent });
                            controller.close();
                            return;
                        }
                    }
                } catch {
                    // ignorar errores de supabase para no romper streaming
                }

                // 2) Generación con streaming de estado
                const generator = new TopicContentGenerator(topicId, (state: OrchestrationState) => {
                    send("state", state);
                });

                // Estado inicial
                send("state", generator.getState());

                try {
                    const result = await generator.generate();

                    // 3) Guardar en Supabase si hay usuario
                    if (supabaseUser) {
                        try {
                            const supabase = await createClient();
                            await supabase.from("generated_content").upsert({
                                user_id: supabaseUser,
                                topic_id: topicId,
                                content_json: result,
                                is_complete: true,
                                status: "complete",
                                updated_at: new Date().toISOString()
                            });
                        } catch {
                            // si falla persistencia no romper el streaming
                        }
                    }

                    send("done", { result });
                    controller.close();
                } catch (error) {
                    send("error", { message: error instanceof Error ? error.message : "Error desconocido" });
                    controller.close();
                }
            })();
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        }
    });
}
