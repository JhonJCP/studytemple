"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_SYLLABUS } from "@/lib/default-syllabus";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function generateDeepPlan(constraints: any) {
    // 1. Use the "Big Brain" Model (Reasoning Capability)
    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-preview",
        generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 30000 // Huge context for Master Plan
        }
    });

    // 1. Construct Context (Syllabus Structure)
    // Intelligent Filter: Context vs Content vs Duplicates
    const studyTopics: any[] = [];
    const contextDocs: any[] = [];

    // Heuristic Helper: Clean title for deduplication
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

        // "Bases" and Info are purely Context
        if (title.includes("bases") || title.includes("información") || title.includes("convocatoria") || title.includes("suplementario")) {
            contextDocs.push({ group: g.title, files: g.topics.map((t: any) => t.title) });
            return;
        }

        // Processing Study Topics with Deduplication
        // We group by "Main Topic" name. If we have "Exam A Enunciado" and "Exam A Respuestas", we just want "Exam A".
        const seen = new Set<string>();
        const uniqueTopics: string[] = [];

        g.topics.forEach((t: any) => {
            const rawTitle = t.title;
            const coreName = cleanTitle(rawTitle);

            // If the core name is too short (e.g. just numbers), keep original to be safe, 
            // but usually this works for "Supuesto 1 Enunciado" vs "Supuesto 1 Solucion".
            if (!seen.has(coreName)) {
                seen.add(coreName);
                uniqueTopics.push(t.title); // Push the first variant we find as the "Representative" title
            }
        });

        if (uniqueTopics.length > 0) {
            studyTopics.push({ group: g.title, topics: uniqueTopics });
        }
    });

    // 2. The Grandmaster Prompt
    const prompt = `
        You are Cortex, a World-Class Competitive Exam Strategist (Grandmaster Level).
        
        OBJECTIVE: 
        Analyze the Syllabus and Time Constraints to generate a "Victory Master Plan".
        You must think deeply about the complexity of each topic ('Ley' vs 'Reglamento'), the user's availability, and the optimal scientifically-proven study method (Spaced Repetition, Interleaving).

        INPUT DATA:
        - Syllabus: ${JSON.stringify(studyTopics)}
        - Context High-Level Info: ${JSON.stringify(contextDocs)}
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
          "strategic_analysis": " ... Markdown text detailing your evaluation, the chosen strategy, potential risks, and why this plan guarantees success ... ",
          "daily_schedule": [
             {
               "date": "YYYY-MM-DD",
               "topicTitle": "Name of Topic",
               "topicId": "slug-id",
               "type": "study" | "review_flashcards" | "test_practice",
               "durationMinutes": 120,
               "startTime": "09:00",
               "breaks": "Pomodoro 50/10",
               "aiReasoning": "Why this topic today? (e.g. 'High difficulty, fresh mind needed')",
               "complexity": "High" | "Medium" | "Low"
             },
             ...
          ]
        }
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const masterPlan = JSON.parse(text);

        // Store in DB (We save the schedule part, maybe we can save the analysis later or in a separate field)
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            // We'll store the schedule as usual
            await supabase.from('study_plans').upsert({
                user_id: user.id,
                schedule: masterPlan.daily_schedule,
                last_updated_with_ai: new Date().toISOString(),
                availability: constraints.availability,
                goal_date: constraints.goalDate
            });
        }

        return {
            success: true,
            schedule: masterPlan.daily_schedule, // Return schedule for Calendar Grid
            diagnostics: {
                prompt, // Keep prompt for debugging
                rawResponse: text, // Raw JSON
                analysis: masterPlan.strategic_analysis // Pass analysis to frontend
            }
        };
    } catch (error) {
        console.error("AI Planning Failed:", error);
        return { success: false, error: "Failed to generate plan.", diagnostics: { prompt, rawResponse: String(error) } };
    }
}
