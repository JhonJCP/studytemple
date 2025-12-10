"use server";

import fs from "fs";
import path from "path";
import { createClient } from "@/utils/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY!;
const genai = new GoogleGenerativeAI(GEMINI_KEY);

async function fetchFilesFromDatabase() {
    console.log("🔍 Fetching files from Supabase...");
    const supabase = await createClient();
    try {
        // Fetch metadata to get filename and category (assuming stored there)
        const { data, error } = await supabase
            .from("library_documents")
            .select("metadata");

        if (error) {
            console.error("❌ Supabase DB Error:", error);
            throw error;
        }

        if (!data || data.length === 0) {
            console.warn("⚠️ Database returned NO documents.");
            return [];
        }

        console.log(`✅ Found ${data.length} documents in DB.`);

        // Map to specialized object for AI
        return data.map((doc: any) => ({
            filename: doc.metadata?.filename || "Unknown.pdf",
            // Trust the database category
            currentCategory: doc.metadata?.category || "Uncategorized"
        }));
    } catch (e) {
        console.error("🔥 Critical DB Fetch Exception:", e);
        return [];
    }
}

// maxDuration configuration should be in the page.tsx or next.config.js for Server Actions
// export const maxDuration = 300; 

const STATUS_FILE = path.join("/tmp", "analysis-status.json");

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

    // 2. Perform analysis
    // In Vercel Serverless, this must complete before the function freezes.

    try {
        console.log("🚀 Starting DEEP analysis with Gemini 3 Pro...");

        // Fetch rich file list (filename + currentCategory) from DB
        const files = await fetchFilesFromDatabase();

        // Using the most capable model available
        const model = genai.getGenerativeModel({ model: "models/gemini-3-pro-preview" });

        const fullPrompt = `
        ${customPrompt}

DATASET:
        Here is the database of files to organize. 
        Each entry has "filename" and "currentCategory".
        
        STRICT RULE: Check "currentCategory" for EVERY file.
        - If "currentCategory" IS "Supplementary" (or matches supplementary), you MUST place it in "Material Suplementario".
        - NEVER place a Supplementary file in a core engineering block.

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
