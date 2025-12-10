"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_SYLLABUS } from "@/lib/default-syllabus";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function generateDeepPlan(constraints: any) {
    // Use "gemini-2.0-flash" as confirmed available by user diagnostics
    // We enable Native JSON Mode and High Output Tokens to prevent truncation
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 16000, // Ensure long schedules fit
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

    // 2. The Mega Prompt (Optimized for Token Efficiency)
    // We request an ARRAY of ARRAYS to save tokens on repeated Keys.
    const prompt = `
        You are Cortex, an elite Study Planner AI.
        
        OBJECTIVE: 
        Create a detailed day-by-day PRO study calendar.
        
        INPUT DATA:
        - Syllabus: ${JSON.stringify(studyTopics)}
        - Context (Ignored for scheduling): ${JSON.stringify(contextDocs)}
        - Constraints: ${constraints.startDate} to ${constraints.goalDate}, ${constraints.intensity}.
        - Strategy: "Sprint 30 Days" (Study -> Review intervals).

        INSTRUCTIONS:
        1. **Scope**: Schedule ONLY "Study Material".
        2. **Deduplication**: Treat "Enunciado" and "Respuesta" as ONE session.
        3. **Format**: Return a single JSON Object with a "plan" property.
           "plan" must be an Array of Arrays.
           Each inner array represents a session: 
           [Date (YYYY-MM-DD), TopicTitle, Type, Duration(mins), AI_Reasoning, Complexity(High/Med/Low)]
           
           Types: 'study', 'review_flashcards', 'test_practice'.
           
           Example:
           {
             "plan": [
               ["2025-12-15", "Ley Carreteras", "study", 90, "Deep dive law.", "High"],
               ["2025-12-16", "Ley Carreteras", "review_flashcards", 15, "SRS Interval 1", "High"]
             ]
           }
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        // Text might be "```json { ... } ```" or just "{ ... }"
        const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        const rawJson = JSON.parse(text);

        // Map Array-of-Arrays back to Object Structure
        const schedule = rawJson.plan.map((item: any[]) => ({
            date: item[0], // Date string, will be hydrated on client
            topicTitle: item[1],
            topicId: (item[1] || "").toLowerCase().replace(/\s+/g, '-'), // Simple ID gen
            type: item[2],
            durationMinutes: item[3],
            startTime: "09:00", // Default, could ask AI but saving tokens
            breaks: "5m/25m",
            aiReasoning: item[4],
            complexity: item[5]
        }));

        // Store in DB
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            await supabase.from('study_plans').upsert({
                user_id: user.id,
                schedule: schedule,
                last_updated_with_ai: new Date().toISOString(),
                availability: constraints.availability,
                goal_date: constraints.goalDate
            });
        }

        return { success: true, schedule, diagnostics: { prompt, rawResponse: text.substring(0, 1000) + "... [truncated]" } };
    } catch (error) {
        console.error("AI Planning Failed:", error);
        return { success: false, error: "Failed to generate plan.", diagnostics: { prompt, rawResponse: String(error) } };
    }
}
