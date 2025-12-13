/**
 * API ENDPOINT - Generación de Widgets On-Demand
 *
 * Flujo: click → generar → render → persistir (Supabase) → recarga OK.
 * Persistimos el resultado dentro de `generated_content.content_json.sections[*].content.widgets[*].content`.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { generateInfografia } from "@/lib/widget-brains/infografia-brain";
import { generateMnemonic } from "@/lib/widget-brains/mnemonic-brain";
import { generateCasePractice } from "@/lib/widget-brains/case-practice-brain";

export const runtime = "nodejs";

type FoundWidget = { widget: any };

function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

function ensureWidgetIds(contentJson: any) {
    if (!contentJson || typeof contentJson !== "object") return contentJson;

    const cloned = deepClone(contentJson);

    const visitSection = (section: any) => {
        if (!section || typeof section !== "object") return;

        const sectionId = section.id || "section";
        const widgets = section?.content?.widgets;

        if (Array.isArray(widgets)) {
            section.content.widgets = widgets.map((w: any, idx: number) => {
                const next = w && typeof w === "object" ? { ...w } : { type: w?.type, content: w?.content };
                const nextContent = next.content && typeof next.content === "object" ? { ...next.content } : {};
                const computedId = `${sectionId}:${idx}`;
                nextContent.widgetId = nextContent.widgetId || computedId;
                next.content = nextContent;
                return next;
            });
        }

        if (Array.isArray(section.children)) {
            section.children.forEach(visitSection);
        }
    };

    if (Array.isArray(cloned.sections)) {
        cloned.sections.forEach(visitSection);
    }

    return cloned;
}

function findWidgetById(contentJson: any, widgetId: string): FoundWidget | null {
    if (!contentJson || typeof contentJson !== "object") return null;
    if (!widgetId) return null;

    let found: FoundWidget | null = null;

    const visitSection = (section: any) => {
        if (found) return;
        if (!section || typeof section !== "object") return;

        const sectionId = section.id || "section";
        const widgets = section?.content?.widgets;
        if (Array.isArray(widgets)) {
            for (let idx = 0; idx < widgets.length; idx++) {
                const w = widgets[idx];
                const wId = w?.content?.widgetId || `${sectionId}:${idx}`;
                if (wId === widgetId) {
                    found = { widget: w };
                    return;
                }
            }
        }

        if (Array.isArray(section.children)) {
            section.children.forEach(visitSection);
        }
    };

    if (Array.isArray(contentJson.sections)) {
        contentJson.sections.forEach(visitSection);
    }

    return found;
}

function getCachedResult(widgetType: string, widget: any) {
    const c = widget?.content && typeof widget.content === "object" ? widget.content : {};

    if (widgetType === "infografia") {
        return c.imageUrl || null;
    }

    if (widgetType === "mnemonic") {
        if (c.generatedRule && c.explanation) return { rule: c.generatedRule, explanation: c.explanation };
        return null;
    }

    if (widgetType === "case_practice") {
        if (c.scenario && c.solution) return { scenario: c.scenario, solution: c.solution };
        return null;
    }

    return null;
}

export async function POST(req: NextRequest) {
    const startTime = Date.now();

    try {
        const body = await req.json();
        const widgetType = body?.widgetType as string | undefined;
        const widgetData = body?.widgetData as any;
        const topicId = body?.topicId as string | undefined;
        const widgetId = widgetData?.widgetId as string | undefined;

        if (!topicId || !widgetType || !widgetId) {
            return NextResponse.json({ error: "Missing topicId/widgetType/widgetId" }, { status: 400 });
        }

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: record, error: fetchError } = await supabase
            .from("generated_content")
            .select("id,content_json,updated_at")
            .eq("user_id", user.id)
            .eq("topic_id", topicId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchError) {
            console.error("[WIDGET-API] Error reading generated_content:", fetchError);
            return NextResponse.json({ error: "Failed to read generated content" }, { status: 500 });
        }

        if (!record?.content_json) {
            return NextResponse.json({ error: "No generated content found for this topic" }, { status: 404 });
        }

        const contentJson = ensureWidgetIds(record.content_json);
        const found = findWidgetById(contentJson, widgetId);
        if (!found) {
            return NextResponse.json(
                { error: `Widget placeholder not found (${widgetId}). Regenera el tema si cambió la estructura.` },
                { status: 404 }
            );
        }

        const cached = getCachedResult(widgetType, found.widget);
        if (cached) {
            return NextResponse.json({
                success: true,
                result: cached,
                cached: true,
                elapsed: Date.now() - startTime,
            });
        }

        let result: any;
        if (widgetType === "infografia") {
            result = await generateInfografia({
                frame: widgetData.frame,
                concept: widgetData.concept,
                topicId,
                widgetId,
            });
        } else if (widgetType === "mnemonic") {
            result = await generateMnemonic({
                frame: widgetData.frame,
                termsToMemorize: widgetData.termsToMemorize || [],
            });
        } else if (widgetType === "case_practice") {
            result = await generateCasePractice({
                frame: widgetData.frame,
                concept: widgetData.concept,
            });
        } else {
            return NextResponse.json({ error: `Unknown widget type: ${widgetType}` }, { status: 400 });
        }

        const widgetRef = findWidgetById(contentJson, widgetId);
        if (!widgetRef) {
            return NextResponse.json({ error: "Widget not found after generation" }, { status: 500 });
        }

        const nextWidget = widgetRef.widget;
        const nextContent = nextWidget?.content && typeof nextWidget.content === "object" ? nextWidget.content : {};
        nextContent.widgetId = nextContent.widgetId || widgetId;

        if (widgetType === "infografia") {
            nextContent.imageUrl = result;
        } else if (widgetType === "mnemonic") {
            nextContent.generatedRule = result.rule;
            nextContent.explanation = result.explanation;
        } else if (widgetType === "case_practice") {
            nextContent.scenario = result.scenario;
            nextContent.solution = result.solution;
        }

        nextWidget.content = nextContent;
        nextWidget.generated = true;

        await supabase.from("generated_content").update({ content_json: contentJson }).eq("id", record.id);

        return NextResponse.json({
            success: true,
            result,
            cached: false,
            elapsed: Date.now() - startTime,
        });
    } catch (error) {
        console.error("[WIDGET-API] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error", elapsed: Date.now() - startTime },
            { status: 500 }
        );
    }
}
