import { NextRequest } from "next/server";
import { TopicContentGenerator } from "@/lib/topic-content-generator";
import type { OrchestrationState, GeneratedTopicContent } from "@/lib/widget-types";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
const OVERALL_TIMEOUT_MS = parseInt(process.env.GENERATION_TIMEOUT_MS || "120000", 10);
// Siempre loguear para trazabilidad en Vercel
const ENABLE_LOGGING = true;

function sseEvent(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function log(message: string, data?: unknown) {
    if (ENABLE_LOGGING) {
        const dataStr = data ? JSON.stringify(data, null, 0).slice(0, 500) : '';
        console.log(`[SSE][${new Date().toISOString()}] ${message}`, dataStr);
    }
}

// Map para rastrear generadores activos y poder cancelarlos
const activeGenerators = new Map<string, TopicContentGenerator>();

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const topicId = searchParams.get("topicId");
    const force = searchParams.get("force") === "true";

    if (!topicId) {
        return new Response("topicId requerido", { status: 400 });
    }

    log(`Nueva petición SSE`, { topicId, force });

    // Cancelar generación previa si existe
    const existingGenerator = activeGenerators.get(topicId);
    if (existingGenerator && !existingGenerator.isCancelled()) {
        log(`Cancelando generación previa para ${topicId}`);
        existingGenerator.cancel();
        activeGenerators.delete(topicId);
    }

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            const startTime = Date.now();
            let isClosed = false;
            
            const send = (event: string, data: unknown) => {
                if (isClosed) return;
                try {
                    controller.enqueue(encoder.encode(sseEvent(event, data)));
                    log(`Evento enviado: ${event}`, { elapsed: Date.now() - startTime });
                } catch (e) {
                    log(`Error enviando evento: ${event}`, e);
                }
            };
            
            const cleanup = () => {
                if (isClosed) return;
                isClosed = true;
                activeGenerators.delete(topicId);
                try {
                    controller.close();
                } catch {
                    // ya cerrado
                }
            };
            
            const timeout = setTimeout(() => {
                log(`Timeout global alcanzado (${OVERALL_TIMEOUT_MS}ms)`);
                const generator = activeGenerators.get(topicId);
                if (generator) {
                    generator.cancel();
                }
                send("error", { 
                    message: `Tiempo de generación agotado (${OVERALL_TIMEOUT_MS}ms)`,
                    telemetry: generator?.getTelemetrySummary() || {}
                });
                cleanup();
            }, OVERALL_TIMEOUT_MS);

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
                            log(`Devolviendo contenido cacheado`);
                            const cachedContent = cached.content_json as GeneratedTopicContent;
                            send("state", { topicId, status: "completed", steps: [], currentStep: null, result: cachedContent });
                            send("done", { result: cachedContent, cached: true });
                            clearTimeout(timeout);
                            cleanup();
                            return;
                        }
                    }
                } catch (e) {
                    log(`Error consultando Supabase`, e);
                    // ignorar errores de supabase para no romper streaming
                }

                // 2) Generación con streaming de estado
                const generator = new TopicContentGenerator(topicId, (state: OrchestrationState) => {
                    send("state", { 
                        ...state, 
                        telemetryEvents: generator.getTelemetry().length 
                    });
                });
                
                activeGenerators.set(topicId, generator);
                log(`Generador creado y registrado`);

                // Estado inicial
                send("state", generator.getState());

                try {
                    const result = await generator.generate();

                    // Verificar si fue cancelado durante la generación
                    if (generator.isCancelled()) {
                        log(`Generación cancelada`);
                        send("error", { 
                            message: "Generación cancelada", 
                            cancelled: true,
                            telemetry: generator.getTelemetrySummary()
                        });
                        clearTimeout(timeout);
                        cleanup();
                        return;
                    }

                    log(`Generación completada`, { elapsed: Date.now() - startTime });

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
                            log(`Contenido guardado en Supabase`);
                        } catch (e) {
                            log(`Error guardando en Supabase`, e);
                            // si falla persistencia no romper el streaming
                        }
                    }

                    send("done", { 
                        result, 
                        telemetry: generator.getTelemetrySummary(),
                        durationMs: Date.now() - startTime
                    });
                    clearTimeout(timeout);
                    cleanup();
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
                    log(`Error en generación: ${errorMsg}`);
                    send("error", { 
                        message: errorMsg,
                        telemetry: generator.getTelemetrySummary(),
                        durationMs: Date.now() - startTime
                    });
                    clearTimeout(timeout);
                    cleanup();
                }
            })();
        },
        
        cancel() {
            log(`Stream cancelado por el cliente`);
            const generator = activeGenerators.get(topicId);
            if (generator) {
                generator.cancel();
                activeGenerators.delete(topicId);
            }
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

// Endpoint POST para cancelar una generación en curso
export async function POST(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const topicId = searchParams.get("topicId");
    const action = searchParams.get("action");

    if (!topicId) {
        return new Response(JSON.stringify({ error: "topicId requerido" }), { 
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    if (action === "cancel") {
        const generator = activeGenerators.get(topicId);
        if (generator) {
            log(`Cancelación solicitada para ${topicId}`);
            generator.cancel();
            activeGenerators.delete(topicId);
            return new Response(JSON.stringify({ success: true, message: "Generación cancelada" }), {
                headers: { "Content-Type": "application/json" }
            });
        }
        return new Response(JSON.stringify({ success: false, message: "No hay generación activa" }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    return new Response(JSON.stringify({ error: "Acción no válida" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
    });
}
