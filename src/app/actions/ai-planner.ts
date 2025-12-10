"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_SYLLABUS } from "@/lib/default-syllabus";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function generateDeepPlan(constraints: any) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // 1. Construct Context (Syllabus Structure)
    // Separation of Concerns: "Study Content" vs "Rules/Context"
    const studyTopics: any[] = [];
    const contextDocs: any[] = [];

    DEFAULT_SYLLABUS.groups.forEach((g: any) => {
        const title = g.title.toLowerCase();
        if (title.includes("suplementario")) return;

        // "Bases" is context (Rules of the game), not study material for the calendar
        if (title.includes("bases") || title.includes("información") || title.includes("convocatoria")) {
            contextDocs.push({ group: g.title, files: g.topics.map((t: any) => t.title) });
        } else {
            studyTopics.push({ group: g.title, topics: g.topics.map((t: any) => t.title) });
        }
    });

    // 2. The Mega Prompt
    const prompt = `
        You are Cortex, an elite Study Planner AI for a high-stakes competitive exam (Oposiciones).
        
        OBJECTIVE: 
        Create a high-performance PRO study calendar (JSON) for the User.
        
        INPUT DATA:
        1. STUDY MATERIAL (Schedule these):
        ${JSON.stringify(studyTopics)}

        2. EXAM CONTEXT (Do NOT schedule these, just understand the rules):
        ${JSON.stringify(contextDocs)}

        3. CONSTRAINTS:
        - Start Date: ${constraints.startDate}
        - Goal Date: ${constraints.goalDate}
        - Daily Availability: ${JSON.stringify(constraints.availability)}
        - Intensity: ${constraints.intensity}
        - Strategy: "Spaced Repetition Sprint" 
          (Sequence: Study -> Flashcards(+1d) -> Test(+4d) -> Review(+10d)).

        INSTRUCTIONS:
        1. **Filter Non-Study Items**: Do NOT schedule sessions for "Bases" or administrative docs. Only schedule the "Study Material".
        2. **Complexity Analysis**: 
           - 'Ley' (Law) = High Complexity (Needs more time, frequent breaks).
           - 'Reglamento' = High/Medium.
           - 'Manual/Guía' = Low/Medium.
        3. **Detailed Scheduling**:
           - Break down study sessions. 
           - Suggest specific START TIMES (e.g. "09:00", "16:30").
           - Add BREAKS (e.g. "Pomodoro: 25/5" or "50/10").
        4. **Output Format**:
           Return a STRICT JSON array of objects. No markdown.
           
           Example Object:
           {
             "date": "YYYY-MM-DD",
             "topicTitle": "Ley de Carreteras",
             "topicId": "filename_guess",
             "type": "study",
             "durationMinutes": 120,
             "startTime": "09:00",
             "breaks": "10 min every 50 min",
             "complexity": "High",
             "aiReasoning": "Core legislation. Vital for exam. High density."
           }
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
