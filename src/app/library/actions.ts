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

// maxDuration configuration should be in the page.tsx or next.config.js for Server Actions
// export const maxDuration = 300; 

const STATUS_FILE = path.join(process.cwd(), "src", "lib", "analysis-status.json");

export async function getAnalysisStatus() {
    try {
        if (!fs.existsSync(STATUS_FILE)) return { state: "idle" };
        const data = fs.readFileSync(STATUS_FILE, "utf-8");
        return JSON.parse(data);
    } catch {
        return { state: "idle" };
    }
}

export async function triggerAnalysis(customPrompt: string) {
    if (!GEMINI_KEY) throw new Error("Missing API Key");

    // 1. Set status to processing immediately
    const initialState = {
        state: "processing",
        startedAt: Date.now(),
        prompt: customPrompt
    };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(initialState));

    // 2. Perform analysis (This blocks the action, but client can poll status if they disconnect)
    // In Vercel Serverless, this must complete before the function freezes, so we await it here.
    // The client will get the "processing" state from the *previous* polling or optimism, 
    // but effectively this function waits. 
    // To truly decouple, we'd need Inngest/Queues. 
    // For now, increasing maxDuration allows the request to assume "background" behavior from user PoV.

    try {
        console.log("🚀 Starting DEEP analysis with Gemini 3 Pro...");
        const files = getFileList();

        // Using the most capable model available
        const model = genai.getGenerativeModel({ model: "models/gemini-3-pro-preview" });

        const fullPrompt = `
        ${customPrompt}

        Here is the list of ${files.length} filenames:
        ${JSON.stringify(files)}

        RETURN ONLY JSON.
        `;

        const result = await model.generateContent(fullPrompt);
        const response = result.response;
        const text = response.text();
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(jsonStr);

        // Save success state
        fs.writeFileSync(STATUS_FILE, JSON.stringify({
            state: "completed",
            completedAt: Date.now(),
            result: data
        }));

        return { success: true };

    } catch (error: any) {
        // Save error state
        console.error("Analysis Failed:", error);
        fs.writeFileSync(STATUS_FILE, JSON.stringify({
            state: "error",
            error: error.message
        }));
        return { success: false, error: error.message };
    }
}

export async function saveSyllabusAction(newSyllabus: any) {
    try {
        const p = path.join(process.cwd(), "src", "lib", "smart-syllabus.json");
        fs.writeFileSync(p, JSON.stringify(newSyllabus, null, 2), "utf-8");

        // Reset status after applying
        if (fs.existsSync(STATUS_FILE)) fs.unlinkSync(STATUS_FILE);

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
