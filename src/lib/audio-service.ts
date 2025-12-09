import { supabase } from "./supabase";

const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
// Specific voice ID for "Professional Spanish Narrator" (Example: 'ErXwobaYiN019PkySvjV' - Antoni)
// User should verify this ID in their ElevenLabs dashboard or we default to a standard one.
const VOICE_ID = "ZCh4e9eZSUf41K4cmCEL"; // User specified voice

export class AudioService {

    /**
     * Generates audio from text using ElevenLabs, with caching via Supabase.
     */
    async generateAudio(text: string, topicId: string): Promise<string | null> {
        if (!ELEVENLABS_API_KEY) {
            console.error("ElevenLabs API Key missing");
            return null;
        }

        // 1. Check Cache (Optimization)
        // We hash the text or use topicId + text length as a simple signature
        const { data: cachedAudio } = await supabase
            .from('generated_audio')
            .select('url')
            .eq('topic_id', topicId)
            .eq('text_hash', text.length) // Simple collision check, ideal would be MD5
            .single();

        if (cachedAudio?.url) {
            console.log("🔊 Serving audio from Cache (Zero Cost)");
            return cachedAudio.url;
        }

        // 2. Call ElevenLabs API
        try {
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': ELEVENLABS_API_KEY,
                },
                body: JSON.stringify({
                    text: text,
                    model_id: "eleven_multilingual_v2", // Best for Spanish
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                    }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                console.error("ElevenLabs Error:", err);
                throw new Error("Failed to generate audio");
            }

            const audioBlob = await response.blob();

            // 3. Upload to Supabase Storage
            const fileName = `${topicId}-${Date.now()}.mp3`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('audio-cache')
                .upload(fileName, audioBlob, {
                    contentType: 'audio/mpeg'
                });

            if (uploadError) {
                console.error("Storage Upload Error:", uploadError);
                return null; // Return generated audio URL directly if storage fails? For now just fail safe.
            }

            // 4. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('audio-cache')
                .getPublicUrl(fileName);

            // 5. Save Metadata to DB for next time
            await supabase.from('generated_audio').insert({
                topic_id: topicId,
                text_hash: text.length,
                url: publicUrl,
                created_at: new Date().toISOString()
            });

            return publicUrl;

        } catch (error) {
            console.error("Audio Generation Flow Error:", error);
            return null;
        }
    }
}

export const audioService = new AudioService();
