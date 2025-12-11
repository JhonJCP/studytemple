import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";

// Forzar runtime Node.js (más estable que Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DiagnosticResult {
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    isVercel: boolean;
    region: string | null;
  };
  apiKeys: {
    geminiKeyPresent: boolean;
    geminiKeySource: "GEMINI_API_KEY" | "NEXT_PUBLIC_GEMINI_API_KEY" | "MISSING";
    geminiKeyPrefix: string;
    supabaseUrlPresent: boolean;
    supabaseKeyPresent: boolean;
  };
  availableModels?: {
    models: string[];
    totalCount: number;
    listError: string | null;
  };
  connectivity: {
    geminiPingSuccess: boolean;
    geminiPingError: string | null;
    geminiPingDurationMs: number;
    geminiModelUsed: string;
    geminiResponseSample: string | null;
    supabasePingSuccess: boolean;
    supabasePingError: string | null;
  };
  testResults?: {
    testedModels: Array<{
      modelName: string;
      success: boolean;
      error: string | null;
      responseSample: string | null;
      durationMs: number;
    }>;
  };
}

export async function GET() {
  const startTime = Date.now();
  const result: DiagnosticResult = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      isVercel: !!process.env.VERCEL,
      region: process.env.VERCEL_REGION || null,
    },
    apiKeys: {
      geminiKeyPresent: false,
      geminiKeySource: "MISSING",
      geminiKeyPrefix: "",
      supabaseUrlPresent: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKeyPresent: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    connectivity: {
      geminiPingSuccess: false,
      geminiPingError: null,
      geminiPingDurationMs: 0,
      geminiModelUsed: "",
      geminiResponseSample: null,
      supabasePingSuccess: false,
      supabasePingError: null,
    },
  };

  // 1. Verificar API Keys
  const geminiKeyServer = process.env.GEMINI_API_KEY;
  const geminiKeyPublic = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  if (geminiKeyServer) {
    result.apiKeys.geminiKeyPresent = true;
    result.apiKeys.geminiKeySource = "GEMINI_API_KEY";
    result.apiKeys.geminiKeyPrefix = geminiKeyServer.slice(0, 8);
  } else if (geminiKeyPublic) {
    result.apiKeys.geminiKeyPresent = true;
    result.apiKeys.geminiKeySource = "NEXT_PUBLIC_GEMINI_API_KEY";
    result.apiKeys.geminiKeyPrefix = geminiKeyPublic.slice(0, 8);
  }

  const apiKey = geminiKeyServer || geminiKeyPublic || "";

  // 2. Test Gemini Connectivity (si hay key)
  if (apiKey) {
    const geminiStart = Date.now();
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Usar el modelo configurado (gemini-2.0-flash-exp - único que funciona según tests)
      const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
      result.connectivity.geminiModelUsed = modelName;
      
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: 100,  // Aumentado de 50 a 100 por si respuesta vacía era por tokens bajos
          temperature: 0.7,  // Aumentado de 0.5 a 0.7 para más creatividad
        },
      });

      const testPrompt = "Responde con la palabra 'OK' si puedes leerme.";
      const response = await model.generateContent(testPrompt);
      const text = response.response.text();
      
      result.connectivity.geminiPingSuccess = text.trim().length > 0;
      result.connectivity.geminiPingDurationMs = Date.now() - geminiStart;
      result.connectivity.geminiResponseSample = text.slice(0, 100);
      
      if (!result.connectivity.geminiPingSuccess) {
        result.connectivity.geminiPingError = "Respuesta vacía del modelo";
      }
    } catch (error) {
      result.connectivity.geminiPingSuccess = false;
      result.connectivity.geminiPingError = error instanceof Error 
        ? `${error.name}: ${error.message}` 
        : String(error);
      result.connectivity.geminiPingDurationMs = Date.now() - geminiStart;
    }
  } else {
    result.connectivity.geminiPingError = "No API Key disponible para test";
  }

  // 3. Probar múltiples modelos con configuración completa
  if (apiKey) {
    const modelsToTest = [
      { name: "gemini-3-pro-preview", config: { maxOutputTokens: 2048, temperature: 1.0 } },  // Más tokens y temperatura
      { name: "gemini-2.0-flash-exp", config: { maxOutputTokens: 100, temperature: 0.7 } },
      { name: "gemini-1.5-flash", config: { maxOutputTokens: 100, temperature: 0.7 } },
      { name: "gemini-pro", config: { maxOutputTokens: 100, temperature: 0.7 } }
    ];
    const testResults: any[] = [];
    
    for (const { name: modelName, config } of modelsToTest) {
      const testStart = Date.now();
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: config
        });

        // Prompt más detallado para gemini-3-pro-preview
        const prompt = modelName === "gemini-3-pro-preview" 
          ? "Eres un asistente útil. Responde a esta pregunta: ¿Cuál es la capital de España? Responde en una frase completa."
          : "Responde solo con la palabra OK";
        
        const response = await model.generateContent(prompt);
        
        // Inspeccionar la respuesta completa
        const text = response.response.text();
        const candidates = response.response.candidates || [];
        const finishReason = candidates[0]?.finishReason || "unknown";
        const safetyRatings = candidates[0]?.safetyRatings || [];
        
        testResults.push({
          modelName,
          success: text.trim().length > 0,
          error: text.trim().length === 0 ? `Respuesta vacía (finishReason: ${finishReason})` : null,
          responseSample: text.slice(0, 100),
          durationMs: Date.now() - testStart,
          finishReason,
          blocked: safetyRatings.some((r: any) => r.blocked === true)
        });
        
        console.log(`[DIAGNOSE] Test ${modelName}:`, { 
          success: text.length > 0, 
          sample: text.slice(0, 50),
          finishReason,
          blocked: safetyRatings.some((r: any) => r.blocked === true)
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        testResults.push({
          modelName,
          success: false,
          error: errorMsg.slice(0, 250),
          responseSample: null,
          durationMs: Date.now() - testStart,
          finishReason: "error",
          blocked: false
        });
        console.log(`[DIAGNOSE] Test ${modelName} FAILED:`, errorMsg.slice(0, 150));
      }
    }
    
    result.testResults = { testedModels: testResults };
  }

  // 4. Test Supabase Connectivity
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("library_documents")
      .select("id")
      .limit(1);
    
    if (error) {
      result.connectivity.supabasePingSuccess = false;
      result.connectivity.supabasePingError = error.message;
    } else {
      result.connectivity.supabasePingSuccess = true;
    }
  } catch (error) {
    result.connectivity.supabasePingSuccess = false;
    result.connectivity.supabasePingError = error instanceof Error 
      ? error.message 
      : String(error);
  }

  // Logging para Vercel
  console.log("[DIAGNOSE] Result:", JSON.stringify(result, null, 2));

  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}

