import { NextRequest } from "next/server";
import { TopicContentGeneratorV2 as TopicContentGenerator } from "@/lib/topic-content-generator-v2";
import type { OrchestrationState, GeneratedTopicContent } from "@/lib/widget-types";
import { createClient } from "@/utils/supabase/server";
import type { PlanningData } from "@/lib/global-planner";

export const runtime = "nodejs";
// Vercel: permitir streams largos (capado por plan si aplica)
// OJO: en Hobby/Free el máximo puede ser menor; 300s ya es el tope típico permitido.
export const maxDuration = 300;
// Alinear el timeout con el límite real de la Function para evitar cierres abruptos (SSE "connection error").
const DEFAULT_TIMEOUT_MS = Math.max(30_000, maxDuration * 1000 - 15_000);
const OVERALL_TIMEOUT_MS = parseInt(process.env.GENERATION_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10);
// Siempre loguear para trazabilidad en Vercel
const ENABLE_LOGGING = true;
const HEARTBEAT_MS = parseInt(process.env.SSE_HEARTBEAT_MS || "15000", 10); // mantener viva la conexión (proxies/idle)

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
            let heartbeat: ReturnType<typeof setInterval> | null = null;
            
            const send = (event: string, data: unknown) => {
                if (isClosed) return;
                try {
                    controller.enqueue(encoder.encode(sseEvent(event, data)));
                    // Evitar ruido en logs por heartbeats
                    if (event !== "ping") {
                        log(`Evento enviado: ${event}`, { elapsed: Date.now() - startTime });
                    }
                } catch (e) {
                    log(`Error enviando evento: ${event}`, e);
                }
            };

            const sendComment = (comment: string) => {
                if (isClosed) return;
                try {
                    // Comentarios SSE mantienen viva la conexión sin generar eventos en el cliente
                    controller.enqueue(encoder.encode(`: ${comment}\n\n`));
                } catch {
                    // ignore
                }
            };
            
            const cleanup = () => {
                if (isClosed) return;
                isClosed = true;
                activeGenerators.delete(topicId);
                if (heartbeat) {
                    clearInterval(heartbeat);
                    heartbeat = null;
                }
                try {
                    controller.close();
                } catch {
                    // ya cerrado
                }
            };

            // Heartbeat para evitar timeouts por inactividad mientras el LLM trabaja (especialmente en strategist)
            heartbeat = setInterval(() => {
                sendComment(`ping t=${Date.now()}`);
            }, HEARTBEAT_MS);
            
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
                let planningData: PlanningData | undefined = undefined;
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
                            .order("updated_at", { ascending: false })
                            .limit(1)
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

                    // 1.1) Cargar planning activo del usuario (para planner correcto y rápido)
                    if (user) {
                        const { data: planningRow, error: planningErr } = await supabase
                            .from("user_planning")
                            .select("strategic_analysis, topic_time_estimates, daily_schedule")
                            .eq("user_id", user.id)
                            .eq("is_active", true)
                            .order("created_at", { ascending: false })
                            .limit(1)
                            .maybeSingle();

                        if (!planningErr && planningRow) {
                            planningData = {
                                strategic_analysis: (planningRow as any).strategic_analysis || "",
                                topic_time_estimates: (planningRow as any).topic_time_estimates || [],
                                daily_schedule: (planningRow as any).daily_schedule || [],
                            };
                        }
                    }
                } catch (e) {
                    log(`Error consultando Supabase`, e);
                    // ignorar errores de supabase para no romper streaming
                }

                // 2) Generación con streaming de estado
                let generator: TopicContentGenerator;
                try {
                    generator = new TopicContentGenerator(
                    topicId, 
                    new Date().toISOString().split('T')[0], // currentDate
                    (state: OrchestrationState) => {
                        send("state", { 
                            ...state, 
                            telemetryEvents: generator.getTelemetry().length 
                        });
                    },
                    supabaseUser || undefined, // userId para cargar planning desde DB
                    planningData
                    );
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : "Error desconocido";
                    log(`Error creando generador: ${errorMsg}`);
                    send("error", { message: errorMsg, phase: "init" });
                    clearTimeout(timeout);
                    cleanup();
                    return;
                }
                
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
                    let persisted = false;
                    let persistError: string | null = null;
                    if (supabaseUser) {
                        try {
                            const supabase = await createClient();
                            const { error: upsertError } = await supabase.from("generated_content").upsert({
                                user_id: supabaseUser,
                                topic_id: topicId,
                                content_json: result,
                                is_complete: true,
                                status: "complete",
                                updated_at: new Date().toISOString()
                            });
                            if (upsertError) {
                                persistError = upsertError.message;
                                log(`Error guardando en Supabase`, upsertError);
                            } else {
                                persisted = true;
                                log(`Contenido guardado en Supabase`);
                            }
                        } catch (e) {
                            persistError = e instanceof Error ? e.message : "Error guardando en Supabase";
                            log(`Error guardando en Supabase`, e);
                            // si falla persistencia no romper el streaming
                        }
                    }

                    send("done", { 
                        result, 
                        telemetry: generator.getTelemetrySummary(),
                        durationMs: Date.now() - startTime,
                        health: result.metadata.health,
                        qualityStatus: result.qualityStatus,
                        warnings: result.warnings || [],
                        persisted,
                        persistError
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
            // Hint para proxies que pueden bufferizar streams
            "X-Accel-Buffering": "no",
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
