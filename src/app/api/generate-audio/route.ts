/**
 * API ENDPOINT - Generación de Audio/Podcast POST-contenido
 * 
 * Este endpoint se llama DESPUÉS de que el contenido está generado.
 * Genera un podcast educativo usando AudioBrain + ElevenLabs TTS.
 */

import { NextRequest, NextResponse } from "next/server";
import { AudioBrain } from "@/lib/audio-brain";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutos para generación de audio

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    
    try {
        const { topicId } = await req.json();
        
        if (!topicId) {
            return NextResponse.json({ error: 'topicId required' }, { status: 400 });
        }
        
        console.log(`[AUDIO-API] Request for topic: ${topicId}`);
        
        // 1. Obtener contenido generado
        const supabase = await createClient();
        const { data: userData } = await supabase.auth.getUser();
        
        if (!userData.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const { data: contentData } = await supabase
            .from('generated_content')
            .select('content_json')
            .eq('user_id', userData.user.id)
            .eq('topic_id', topicId)
            .single();
        
        if (!contentData?.content_json) {
            return NextResponse.json({ error: 'Content not found. Generate content first.' }, { status: 404 });
        }
        
        // 2. Verificar si ya existe audio (NO regenerar - ahorro de costos)
        if (contentData.content_json.metadata?.audioUrl) {
            console.log(`[AUDIO-API] Using cached audio: ${contentData.content_json.metadata.audioUrl}`);
            return NextResponse.json({ 
                success: true, 
                audioUrl: contentData.content_json.metadata.audioUrl,
                cached: true,
                elapsed: Date.now() - startTime
            });
        }
        
        // 3. Generar audio
        console.log('[AUDIO-API] Generating new audio...');
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
        }
        
        const audioBrain = new AudioBrain(apiKey);
        
        // 3a. Generar script
        const script = await audioBrain.generatePodcastScript(contentData.content_json);
        console.log('[AUDIO-API] Script generated');
        
        // 3b. Generar audio con ElevenLabs
        const audioBlob = await audioBrain.generateTTS(script);
        console.log('[AUDIO-API] TTS generated');
        
        // 3c. Subir a Storage
        const audioUrl = await audioBrain.uploadToStorage(audioBlob, topicId);
        console.log('[AUDIO-API] Audio uploaded');
        
        // 4. GUARDAR en DB (crítico para no regenerar)
        const updatedContent = {
            ...contentData.content_json,
            metadata: {
                ...contentData.content_json.metadata,
                audioUrl,
                audioGeneratedAt: new Date().toISOString()
            }
        };
        
        await supabase
            .from('generated_content')
            .update({ content_json: updatedContent })
            .eq('user_id', userData.user.id)
            .eq('topic_id', topicId);
        
        const elapsed = Date.now() - startTime;
        console.log(`[AUDIO-API] Success: ${elapsed}ms`);
        
        return NextResponse.json({ 
            success: true, 
            audioUrl,
            cached: false,
            elapsed
        });
        
    } catch (error) {
        console.error('[AUDIO-API] Error:', error);
        return NextResponse.json(
            { 
                error: error instanceof Error ? error.message : 'Unknown error',
                elapsed: Date.now() - startTime
            },
            { status: 500 }
        );
    }
}

