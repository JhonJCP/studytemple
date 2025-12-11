/**
 * AUDIO BRAIN - Generador de Podcasts Educativos
 * 
 * Este módulo:
 * 1. Genera script de podcast usando Gemini (15 min aprox)
 * 2. Convierte el script a audio usando ElevenLabs TTS
 * 3. Sube el audio a Supabase Storage
 * 4. Retorna URL pública
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/utils/supabase/server";
import type { GeneratedTopicContent } from "./widget-types";

// ============================================
// TYPES
// ============================================

export interface PodcastScript {
    intro: string;
    sections: Array<{ title: string; content: string }>;
    mnemonics: string;
    summary: string;
    totalDuration: number; // minutos estimados
}

// ============================================
// AUDIO BRAIN CLASS
// ============================================

export class AudioBrain {
    private genAI: GoogleGenerativeAI;
    
    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
    }
    
    /**
     * Generar script de podcast
     */
    async generatePodcastScript(content: GeneratedTopicContent): Promise<PodcastScript> {
        console.log('[AUDIO-BRAIN] Generating podcast script for:', content.title);
        
        const prompt = `
Eres un profesor de oposiciones ITOP (Ingeniero Técnico Obras Públicas, Canarias) grabando un podcast educativo.

TEMA: ${content.title}

CONTENIDO COMPLETO:
${content.sections.map(s => `## ${s.title}\n${s.content.text}`).join('\n\n')}

GENERA UN SCRIPT DE PODCAST (15 minutos aproximadamente):

**Estructura:**
1. INTRO (1-2 min): Saludo + importancia del tema + qué aprenderás
2. DESARROLLO (10 min): Explica cada sección con ejemplos prácticos
3. MNEMOTECNIAS (2 min): Trucos para memorizar puntos clave
4. RESUMEN (2 min): Recap de lo esencial + motivación final

**FORMATO PARA TTS:**
- Conversacional, como si hablaras con un amigo
- Sin jerga innecesaria
- Usa pausas narrativas: escribe "[PAUSA]" donde convenga una pausa corta
- Ejemplos prácticos del día a día
- Menciona artículos de leyes cuando sea relevante

**IMPORTANTE:**
- El texto será leído por TTS (Text-to-Speech), así que escribe tal como se debe pronunciar
- No uses símbolos matemáticos complejos, descríbelos en palabras
- Las siglas deben escribirse separadas por puntos para pronunciación correcta (ej: "D.P.M.T." en lugar de "DPMT")

Responde JSON:
{
  "intro": "[Saludo y presentación del tema]",
  "sections": [
    {"title": "[Título sección 1]", "content": "[Explicación conversacional]"},
    {"title": "[Título sección 2]", "content": "[Explicación conversacional]"}
  ],
  "mnemonics": "[Mnemotecnias y trucos de memorización]",
  "summary": "[Resumen final y motivación]",
  "totalDuration": 15
}
`;
        
        try {
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-2.0-flash-exp',
                generationConfig: {
                    temperature: 0.8,
                    responseMimeType: "application/json"
                }
            });
            
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const parsed = JSON.parse(text);
            
            console.log('[AUDIO-BRAIN] Script generated:', {
                sections: parsed.sections?.length || 0,
                estimatedDuration: parsed.totalDuration
            });
            
            return {
                intro: parsed.intro,
                sections: parsed.sections || [],
                mnemonics: parsed.mnemonics,
                summary: parsed.summary,
                totalDuration: parsed.totalDuration || 15
            };
            
        } catch (error) {
            console.error('[AUDIO-BRAIN] Error generating script:', error);
            throw new Error(`Failed to generate podcast script: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Generar audio con ElevenLabs TTS
     */
    async generateTTS(script: PodcastScript): Promise<Blob> {
        console.log('[AUDIO-BRAIN] Generating TTS with ElevenLabs');
        
        const apiKey = process.env.ELEVENLABS_API_KEY;
        const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Voice default
        
        if (!apiKey) {
            throw new Error('ELEVENLABS_API_KEY not configured');
        }
        
        // Combinar todo el script en un texto continuo
        const fullText = [
            script.intro,
            ...script.sections.map(s => s.content),
            script.mnemonics,
            script.summary
        ].join('\n\n');
        
        try {
            const response = await fetch(
                `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'Content-Type': 'application/json',
                        'xi-api-key': apiKey
                    },
                    body: JSON.stringify({
                        text: fullText,
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                            style: 0.0,
                            use_speaker_boost: true
                        }
                    })
                }
            );
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[AUDIO-BRAIN] ElevenLabs API error:', errorText);
                throw new Error(`ElevenLabs TTS failed: ${response.statusText}`);
            }
            
            const audioBlob = await response.blob();
            console.log('[AUDIO-BRAIN] TTS generated, size:', audioBlob.size, 'bytes');
            
            return audioBlob;
            
        } catch (error) {
            console.error('[AUDIO-BRAIN] Error generating TTS:', error);
            throw new Error(`Failed to generate TTS: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Subir audio a Supabase Storage
     */
    async uploadToStorage(audioBlob: Blob, topicId: string): Promise<string> {
        console.log('[AUDIO-BRAIN] Uploading audio to Storage');
        
        try {
            const supabase = await createClient();
            const filename = `${topicId}/podcast_${Date.now()}.mp3`;
            
            const { error: uploadError } = await supabase.storage
                .from('generated-audio')
                .upload(filename, audioBlob, {
                    contentType: 'audio/mpeg',
                    upsert: true
                });
            
            if (uploadError) {
                console.error('[AUDIO-BRAIN] Upload error:', uploadError);
                throw uploadError;
            }
            
            const { data: { publicUrl } } = supabase.storage
                .from('generated-audio')
                .getPublicUrl(filename);
            
            console.log('[AUDIO-BRAIN] Audio uploaded successfully:', publicUrl);
            
            return publicUrl;
            
        } catch (error) {
            console.error('[AUDIO-BRAIN] Error uploading audio:', error);
            throw new Error(`Failed to upload audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

