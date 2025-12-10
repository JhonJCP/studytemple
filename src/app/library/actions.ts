"use server";

import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY!;
const genai = new GoogleGenerativeAI(GEMINI_KEY);

// Helper to get file list (Simplified for demo, in real app assumes pre-scanned list)
function getFileList() {
    // In a real scenario, this would scan the directory again or fetch from DB
    // For now, we read the current smart-syllabus.json to get the list of files known
    try {
        const p = path.join(process.cwd(), "src", "lib", "smart-syllabus.json");
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));

        // Flatten to just a list of filenames/paths for the AI to re-organize
        let files: string[] = [];
        data.groups.forEach((g: any) => {
            g.topics.forEach((t: any) => {
                files.push(t.originalFilename);
            });
        });
        return files;
    } catch (e) {
        return ["Error reading current file list"];
    }
}

export async function analyzeSyllabusAction(customPrompt: string) {
    if (!GEMINI_KEY) throw new Error("Missing API Key");

    console.log("🚀 Starting analysis with prompt length:", customPrompt.length);
    const files = getFileList();
    // Use Flash for speed/reliability in real-time interactive tasks
    const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });

    const fullPrompt = `
    ${customPrompt}

    Here is the list of ${files.length} filenames to organize:
    ${JSON.stringify(files)}

    RETURN ONLY JSON.
    `;

    try {
        const result = await model.generateContent(fullPrompt);
        const response = result.response;
        const text = response.text();

        // Clean markdown code blocks if present
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();

        return { success: true, data: JSON.parse(jsonStr) };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function saveSyllabusAction(newSyllabus: any) {
    try {
        const p = path.join(process.cwd(), "src", "lib", "smart-syllabus.json");
        fs.writeFileSync(p, JSON.stringify(newSyllabus, null, 2), "utf-8");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
