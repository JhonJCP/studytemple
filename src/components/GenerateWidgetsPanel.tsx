"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles, CheckCircle, AlertTriangle } from "lucide-react";
import type { GeneratedTopicContent, TopicSection, WidgetDefinition } from "@/lib/widget-types";
import { cn } from "@/lib/utils";

type ApiWidgetType = "infografia" | "mnemonic" | "case_practice" | "diagram" | "timeline" | "quiz";

function getApiType(widgetType: string): ApiWidgetType | null {
    if (widgetType === "infografia") return "infografia";
    if (widgetType === "mnemonic_generator") return "mnemonic";
    if (widgetType === "case_practice") return "case_practice";
    if (widgetType === "diagram_generator") return "diagram";
    if (widgetType === "timeline_generator") return "timeline";
    if (widgetType === "quiz_generator") return "quiz";
    return null;
}

function isGenerated(widgetType: string, widget: any): boolean {
    if (widget?.generated === true) return true;
    const c = widget?.content && typeof widget.content === "object" ? widget.content : {};
    if (widgetType === "infografia") return Boolean((c as any).imageUrl);
    if (widgetType === "mnemonic_generator") return Boolean((c as any).generatedRule && (c as any).explanation);
    if (widgetType === "case_practice") return Boolean((c as any).scenario && (c as any).solution);
    if (widgetType === "diagram_generator") return Boolean((c as any).structure);
    if (widgetType === "timeline_generator") return Array.isArray((c as any).steps) && (c as any).steps.length > 0;
    if (widgetType === "quiz_generator") return Array.isArray((c as any).questions) && (c as any).questions.length > 0;
    return false;
}

function collectWidgets(sections: TopicSection[]) {
    const items: Array<{
        sectionId: string;
        widgetIndex: number;
        widgetId: string;
        widgetType: string;
        apiType: ApiWidgetType;
        widgetData: any;
    }> = [];

    const visit = (section: TopicSection) => {
        const widgets = section.content?.widgets || [];
        widgets.forEach((w: WidgetDefinition | any, idx: number) => {
            const apiType = getApiType(w?.type);
            if (!apiType) return;
            if (isGenerated(w.type, w)) return;

            const content = w?.content && typeof w.content === "object" ? w.content : {};
            const widgetId = (content as any).widgetId || `${section.id}:${idx}`;
            items.push({
                sectionId: section.id,
                widgetIndex: idx,
                widgetId,
                widgetType: w.type,
                apiType,
                widgetData: { ...(content as any), widgetId },
            });
        });

        (section.children || []).forEach(visit);
    };

    sections.forEach(visit);
    return items;
}

function updateWidgetInContent(
    content: GeneratedTopicContent,
    widgetId: string,
    patch: (widget: any) => any
): GeneratedTopicContent {
    const next = JSON.parse(JSON.stringify(content)) as GeneratedTopicContent;

    const visit = (section: any) => {
        const widgets = section?.content?.widgets;
        if (Array.isArray(widgets)) {
            for (let idx = 0; idx < widgets.length; idx++) {
                const w = widgets[idx];
                const c = w?.content && typeof w.content === "object" ? w.content : {};
                const id = c.widgetId || `${section.id}:${idx}`;
                if (id === widgetId) {
                    widgets[idx] = patch(w);
                    return true;
                }
            }
        }
        if (Array.isArray(section.children)) {
            for (const child of section.children) {
                if (visit(child)) return true;
            }
        }
        return false;
    };

    (next.sections || []).some(visit);
    return next;
}

interface Props {
    topicId: string;
    recordId?: string;
    content: GeneratedTopicContent;
    onContentChange: (next: GeneratedTopicContent) => void;
    maxWidgets?: number;
}

export function GenerateWidgetsPanel({ topicId, recordId, content, onContentChange, maxWidgets = 10 }: Props) {
    const pending = useMemo(() => collectWidgets(content.sections || []).slice(0, maxWidgets), [content, maxWidgets]);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState<{ done: number; total: number; current?: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        setIsRunning(true);
        setError(null);
        setProgress({ done: 0, total: pending.length });

        try {
            let nextContent = content;
            for (let i = 0; i < pending.length; i++) {
                const item = pending[i];
                setProgress({ done: i, total: pending.length, current: item.widgetType });

                const res = await fetch("/api/widgets/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        widgetType: item.apiType,
                        widgetData: item.widgetData,
                        topicId,
                        recordId,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Error generando widgets");

                nextContent = updateWidgetInContent(nextContent, item.widgetId, (w) => {
                    const wContent = w?.content && typeof w.content === "object" ? { ...w.content } : {};
                    if (item.apiType === "infografia") wContent.imageUrl = data.result;
                    if (item.apiType === "mnemonic") {
                        wContent.generatedRule = data.result?.rule;
                        wContent.explanation = data.result?.explanation;
                    }
                    if (item.apiType === "case_practice") {
                        wContent.scenario = data.result?.scenario;
                        wContent.solution = data.result?.solution;
                    }
                    if (item.apiType === "diagram") wContent.structure = data.result?.structure;
                    if (item.apiType === "timeline") wContent.steps = data.result?.steps;
                    if (item.apiType === "quiz") wContent.questions = data.result?.questions;

                    return { ...w, generated: true, content: wContent };
                });

                onContentChange(nextContent);
            }

            setProgress({ done: pending.length, total: pending.length });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error desconocido");
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white/70 uppercase">Widgets</h3>
                <span className="text-[10px] text-white/50">{pending.length} pendientes</span>
            </div>

            <button
                onClick={run}
                disabled={isRunning || pending.length === 0}
                className={cn(
                    "w-full flex items-center justify-center gap-2 text-sm font-bold px-4 py-2 rounded-lg border transition",
                    isRunning || pending.length === 0
                        ? "bg-white/10 text-white/50 cursor-not-allowed"
                        : "bg-white text-black hover:bg-gray-200"
                )}
            >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generar widgets clave
            </button>

            {progress && (
                <div className="text-xs text-white/60">
                    <div className="flex items-center justify-between">
                        <span>
                            {progress.done}/{progress.total}
                            {progress.current ? ` · ${progress.current}` : ""}
                        </span>
                        {progress.done === progress.total ? (
                            <span className="inline-flex items-center gap-1 text-emerald-300">
                                <CheckCircle className="w-3 h-3" /> OK
                            </span>
                        ) : null}
                    </div>
                    <div className="mt-2 h-2 rounded bg-white/10 overflow-hidden">
                        <div
                            className="h-2 bg-purple-400/80"
                            style={{
                                width: progress.total ? `${Math.round((progress.done / progress.total) * 100)}%` : "0%",
                            }}
                        />
                    </div>
                </div>
            )}

            {error && (
                <div className="text-xs text-red-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
