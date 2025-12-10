"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_SYLLABUS } from "@/lib/default-syllabus";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

// Helper to build the prompt string (Shared logic)
function constructPlannerPrompt(constraints: any, studyTopics: any[], contextDocs: any[]) {
    return `
        You are Cortex, a World-Class Competitive Exam Strategist (Grandmaster Level).
        
        OBJECTIVE: 
        Analyze the Syllabus and Time Constraints to generate a "Victory Master Plan".
        
        INPUT DATA:
        - Syllabus: ${JSON.stringify(studyTopics, null, 2)}
        - Context High-Level Info: ${JSON.stringify(contextDocs, null, 2)}
        - Timeline: ${constraints.startDate} to ${constraints.goalDate}.
        - Daily Minutes Available: ${JSON.stringify(constraints.availability)}.
        - Intensity Level: ${constraints.intensity}.

        INSTRUCTIONS:
        1. **Deep Analysis (The "Brain")**: 
           - Evaluate the volume of material vs time.
           - Define a strategy (e.g. "Front-load heavy legislation", "Weekend testing marathons").
        2. **Detailed Scheduling**:
           - Create a precise day-by-day schedule.
           - **Deduplication**: "Enunciado" and "Respuesta" are the SAME session.
           - **Review System**: Explicitly schedule review sessions for past topics.
        
        OUTPUT FORMAT (Strict JSON Object):
        {
          "strategic_analysis": " ... Markdown text detailing your evaluation ... ",
          "daily_schedule": [
             {
               "date": "YYYY-MM-DD",
               "topicTitle": "Name of Topic",
               "topicId": "slug-id",
               "type": "study" | "review_flashcards" | "test_practice",
               "durationMinutes": 120,
               "startTime": "09:00",
               "breaks": "Pomodoro 50/10",
               "aiReasoning": "Why this topic today?",
               "complexity": "High" | "Medium" | "Low"
             }
          ]
        }
    `;
}

// 1. Action to Preview/Get the Default Prompt
export async function getPlannerPrompt(constraints: any) {
    const studyTopics: any[] = [];
    const contextDocs: any[] = [];

    const cleanTitle = (t: string) => t.toLowerCase()
        .replace("enunciado", "")
        .replace("soluciones", "")
        .replace("respuestas", "")
        .replace("respuesta", "")
        .replace("plantilla", "")
        .replace("examen", "")
        .replace(/\s+/g, ' ').trim();

    DEFAULT_SYLLABUS.groups.forEach((g: any) => {
        const title = g.title.toLowerCase();
        if (title.includes("bases") || title.includes("información") || title.includes("convocatoria") || title.includes("suplementario")) {
            contextDocs.push({ group: g.title, files: g.topics.map((t: any) => t.title) });
            return;
        }
        const seen = new Set<string>();
        const uniqueTopics: string[] = [];
        g.topics.forEach((t: any) => {
            const rawTitle = t.title;
            const coreName = cleanTitle(rawTitle);
            if (!seen.has(coreName)) {
                seen.add(coreName);
                uniqueTopics.push(t.title);
            }
        });
        if (uniqueTopics.length > 0) {
            studyTopics.push({ group: g.title, topics: uniqueTopics });
        }
    });

    return constructPlannerPrompt(constraints, studyTopics, contextDocs);
}

// 2. Main Execution Action
export async function generateDeepPlan(constraints: any, customPrompt?: string) {
    // 1. Use the "Big Brain" Model (Reasoning Capability)
    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-preview",
        generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 30000 // Huge context for Master Plan
        }
    });

    let prompt = customPrompt;

    // If no custom prompt provided, build the default one
    if (!prompt) {
        prompt = await getPlannerPrompt(constraints);
    }

    try {
        const result = await model.generateContent(prompt!); // Non-null assertion safely
        const response = await result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const masterPlan = JSON.parse(text);

        // USER REQUEST: Do NOT auto-program. 
        // We return the Master Plan to the Client (Console) for review.
        // The user will manually trigger "Apply" to save it.

        return {
            success: true,
            schedule: masterPlan.daily_schedule, // Provide schedule for preview
            masterPlan: masterPlan, // Pass full object including analysis for client-side holding
            diagnostics: {
                prompt,
                rawResponse: text,
                analysis: masterPlan.strategic_analysis
            }
        };
    } catch (error) {
        console.error("AI Planning Failed:", error);
        return { success: false, error: "Failed to generate plan.", diagnostics: { prompt: prompt || "Error building prompt", rawResponse: String(error) } };
    }
}
