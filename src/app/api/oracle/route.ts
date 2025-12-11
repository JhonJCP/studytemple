import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const { question } = await request.json();
    if (!question || !question.trim()) {
      return NextResponse.json({ success: false, error: "Pregunta vacía" }, { status: 400 });
    }

    const prompt = `
Eres un asistente especializado en oposiciones de Obras Públicas (ITOP Canarias).
Responde con precisión y brevedad (máx. 6 frases). Si la pregunta es ambigua o no tienes datos, pide más contexto.

Pregunta: ${question.trim()}
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      generationConfig: {
        responseMimeType: "text/plain",
        maxOutputTokens: 400,
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return NextResponse.json({ success: true, answer: text });
  } catch (error) {
    console.error("oracle api error:", error);
    return NextResponse.json({ success: false, error: "No se pudo generar respuesta." }, { status: 500 });
  }
}
