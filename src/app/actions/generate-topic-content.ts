"use server";

import { generateTopicContent } from "@/lib/topic-content-generator";
import type { GeneratedTopicContent, OrchestrationState } from "@/lib/widget-types";

/**
 * Server Action para generar contenido de un tema
 */
export async function generateTopicContentAction(
    topicId: string
): Promise<{ success: boolean; data?: GeneratedTopicContent; error?: string }> {
    try {
        const result = await generateTopicContent(topicId);
        return { success: true, data: result };
    } catch (error) {
        console.error("Error generating topic content:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        };
    }
}
