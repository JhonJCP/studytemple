import { NextRequest } from "next/server";
import { TopicContentGenerator } from "@/lib/topic-content-generator";
import type { OrchestrationState } from "@/lib/widget-types";

export const runtime = "nodejs";

function sseEvent(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const topicId = searchParams.get("topicId");

    if (!topicId) {
        return new Response("topicId requerido", { status: 400 });
    }

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            const send = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(sseEvent(event, data)));
            };

            const generator = new TopicContentGenerator(topicId, (state: OrchestrationState) => {
                send("state", state);
            });

            // Estado inicial
            send("state", generator.getState());

            generator.generate()
                .then((result) => {
                    send("done", { result });
                    controller.close();
                })
                .catch((error) => {
                    send("error", { message: error instanceof Error ? error.message : "Error desconocido" });
                    controller.close();
                });
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
