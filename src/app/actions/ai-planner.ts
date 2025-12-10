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

    // 2. The Mega Prompt
    const prompt = `
        You are Cortex, an elite Study Planner AI for a high-stakes competitive exam (Oposiciones).
        
        OBJECTIVE: 
        Create a detailed day-by-day PRO study calendar (JSON).
        
        INPUT DATA:
        1. STUDY MATERIAL (Schedule these):
        ${JSON.stringify(studyTopics)}
        (Note: I have pre-grouped these. "Enunciado" (Question) and "Respuesta" (Answer) are the SAME study session. Do not duplicate them.)

        2. EXAM CONTEXT (Do NOT schedule these - strictly for understanding rules):
        ${JSON.stringify(contextDocs)}

        3. CONSTRAINTS:
        - Dates: ${constraints.startDate} to ${constraints.goalDate}
        - Availability: ${JSON.stringify(constraints.availability)}
        - Intensity: ${constraints.intensity}
        - Strategy: "Sprint 30 Days" (Compress material).

        INSTRUCTIONS:
        1. **Scope**: Schedule ONLY the "Study Material". Ignore "Context" docs for scheduling.
        2. **Intelligence**: 
           - If a topic is "Supuesto Práctico", schedule a PRACTICAL session (problem solving).
           - If a topic is "Ley" (Law), schedule deep study with breaks.
        3. **Logic**:
           - **Study Sessions**: Include specific Start Time and Break Strategy.
           - **Spaced Repetition**: Insert review sessions for topics studied 3-4 days prior.
        4. **Output Format**: STRICT JSON ARRAY.
           
           Example:
           [
             {
               "date": "YYYY-MM-DD",
               "topicTitle": "Supuesto Práctico 1",
               "topicId": "filename_guess",
               "type": "study", // or "test_practice"
               "durationMinutes": 90,
               "startTime": "10:00",
               "breaks": "10m after 45m",
               "complexity": "High",
               "aiReasoning": "Practical case requires active problem solving. Paired Question+Answer study."
             }
           ]
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Sanitize
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const schedule = JSON.parse(jsonStr);

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

        return { success: true, schedule, diagnostics: { prompt, rawResponse: text } };
    } catch (error) {
        console.error("AI Planning Failed:", error);
        return { success: false, error: "Failed to generate plan.", diagnostics: { prompt, rawResponse: String(error) } };
    }
}
