
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function checkModels() {
    const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");
    try {
        // Note: listModels is on the genAI instance or model? 
        // Actually usually strictly via REST or specific SDK method. 
        // The Node SDK usually exposes it via a model manager? 
        // Let's try to just instantiate a model and run a dummy prompt, 
        // but if we want list, we might need to hit the REST endpoint if SDK doesn't expose it easily.

        // Let's try the simplest test: 'gemini-1.5-flash'
        console.log("Testing gemini-1.5-flash...");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = await model.generateContent("Hello check");
            console.log("Success gemini-1.5-flash");
        } catch (e) {
            console.log("Failed gemini-1.5-flash:", e.message);
        }

        console.log("Testing gemini-pro...");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent("Hello check");
            console.log("Success gemini-pro");
        } catch (e) {
            console.log("Failed gemini-pro:", e.message);
        }

    } catch (error) {
        console.error("Global Error:", error);
    }
}

checkModels();
