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
        // Fetch metadata ONLY for the first chunk of each file to avoid duplicates (20k chunks -> ~200 files)
        const { data, error } = await supabase
            .from("library_documents")
            .select("metadata, content") // Get content too
            .contains("metadata", { chunk_index: 0 }); // Filter JSONB

        if (error) {
            console.error("❌ Supabase DB Error:", error);
            throw error;
        }

        if (!data || data.length === 0) {
            console.warn("⚠️ Database returned NO documents.");
            return [];
        }

        console.log(`✅ Found ${data.length} documents in DB.`);

        // Map to specialized object for AI with content excerpt
        return data.map((doc: any) => ({
            filename: doc.metadata?.filename || "Unknown.pdf",
            // Trust the database category
            currentCategory: doc.metadata?.category || "Uncategorized",
            // Give context for better understanding
            excerpt: doc.content ? doc.content.substring(0, 1000) : "No text available"
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

        // Fetch rich file list (filename + currentCategory + excerpt) from DB
        const files = await fetchFilesFromDatabase();

        // Using the most capable model available
        const model = genai.getGenerativeModel({ model: "models/gemini-3-pro-preview" });

        // Initialize classification containers
        const boeFiles: any[] = [];
        const practiceFiles: any[] = [];
        const coreFiles: any[] = [];
        const supplementaryFiles: any[] = [];

        // Pre-classify based on DB truth (Strict Buckets)
        files.forEach(f => {
            const cat = f.currentCategory?.toUpperCase() || "";
            if (cat.includes("SUPPLEMENTARY")) {
                supplementaryFiles.push(f);
            } else if (cat.includes("BOE") || cat.includes("BASES")) {
                boeFiles.push(f);
            } else if (cat.includes("PRACTICE") || cat.includes("PRÁCTICA")) {
                practiceFiles.push(f);
            } else {
                coreFiles.push(f);
            }
        });

        console.log(`🤖 Buckets: ${boeFiles.length} BOE, ${practiceFiles.length} Practice, ${coreFiles.length} Core, ${supplementaryFiles.length} Supp`);

        const fullPrompt = `
        ${customPrompt}

        I have pre-sorted the files into 4 LISTS for you. Follow these specific rules for each list:

        === LIST 1: BASES & NORMATIVA (BOE) ===
        ${JSON.stringify(boeFiles)}
        -> INSTRUCTION: Create a group called "Bases de la Oposición". Put these files there. Use them to understand the context of the exam.

        === LIST 2: PRACTICE & METHODOLOGY ===
        ${JSON.stringify(practiceFiles)}
        -> INSTRUCTION: Create a group called "Herramientas Prácticas". Put these files there.

        === LIST 3: CORE ENGINEERING STUDY MATERIAL (THE MAIN CONTENT) ===
        ${JSON.stringify(coreFiles)}
        -> INSTRUCTION: This is the most important part. You must intelligently group these into the official Engineering Domains:
           - Aguas y Obras Hidráulicas
           - Costas y Puertos
           - Carreteras y Transportes
           - Medio Ambiente
           (You may create sub-groups or rename these slightly if the content demands it, but keep the structure logical).

        === LIST 4: SUPPLEMENTARY MATERIAL ===
        ${JSON.stringify(supplementaryFiles)}
        -> INSTRUCTION: Simply put ALL these files into a single group called "Material Suplementario". Do not mix them with the Core material.

        RETURN ONLY JSON structure.
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

// NEW: Save to Supabase for persistence across deployments
export async function saveSyllabusAction(newSyllabus: any) {
    const supabase = await createClient();
    try {
        console.log("💾 Saving syllabus to Supabase...");

        // 1. Save to DB
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'smart-syllabus',
                value: newSyllabus,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;

        // 2. Also try to update local file for dev/preview (optional, might fail in Vercel but that's ok)
        try {
            const p = path.join(process.cwd(), "src", "lib", "smart-syllabus.json");
            fs.writeFileSync(p, JSON.stringify(newSyllabus, null, 2), "utf-8");
        } catch (e) {
            console.warn("⚠️ Could not write to local filesystem (expected in Vercel). DB save was successful.");
        }

        // 3. Reset status after applying
        if (fs.existsSync(STATUS_FILE)) fs.unlinkSync(STATUS_FILE);

        return { success: true };
    } catch (error: any) {
        console.error("❌ Save Failed:", error);
        return { success: false, error: error.message };
    }
}
