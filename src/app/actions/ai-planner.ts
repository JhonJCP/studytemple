"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_SYLLABUS } from "@/lib/default-syllabus";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function generateDeepPlan(constraints: any) {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // 1. Construct Context (Syllabus Structure)
    const syllabusContext = DEFAULT_SYLLABUS.groups
        .filter((g: any) => !g.title.toLowerCase().includes("suplementario"))
        .map((g: any) => ({
            group: g.title,
            topics: g.topics.map((t: any) => t.title)
        }));

    // 2. The Mega Prompt
    const prompt = `
        You are Cortex, an elite Study Planner AI. 
        Your goal is to organize a HIGH PERFORMANCE study schedule for the user based on the following syllabus and constraints.
        
        SYLLABUS:
        ${JSON.stringify(syllabusContext)}

        CONSTRAINTS:
        - Start Date: ${constraints.startDate}
        - Goal Date: ${constraints.goalDate}
        - Daily Availability (minutes): ${JSON.stringify(constraints.availability)}
        - Intensity: ${constraints.intensity}
        - Strategy: "Spaced Repetition Sprint" (Study -> Flashcards +1d -> Test +3d -> Review +7d).
        
        INSTRUCTIONS:
        1. Analyze the complexity of each topic based on its name (e.g. "Ley" is hard, "Guía" is easy).
        2. Estimate page count (Low=10, Medium=20, Hard=40).
        3. Distribute sessions across the dates. RESPECT WEEKENDS/HOLIDAYS (give lighter load if 'relaxed' or 'balanced').
        4. Provide specific "AI Reasoning" for each major decision.
        5. Return a STRICT JSON array of session objects.
        
        OUTPUT FORMAT (JSON Only):
        [
            {
                "date": "YYYY-MM-DD",
                "topicTitle": "Topic Name",
                "topicId": "filename (guess best match)",
                "type": "study" | "review_flashcards" | "test_practice",
                "durationMinutes": 60,
                "startTime": "09:00", // Suggest a start time
                "breaks": "10 min break after 25 min",
                "complexity": "High",
                "aiReasoning": "Explanation..."
            },
            ...
        ]
        
        Do not output markdown code blocks, just the raw JSON.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Sanitize
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const schedule = JSON.parse(jsonStr);

        // Store in DB
        const supabase = createClient();
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

        return { success: true, schedule };
    } catch (error) {
        console.error("AI Planning Failed:", error);
        return { success: false, error: "Failed to generate plan." };
    }
}
