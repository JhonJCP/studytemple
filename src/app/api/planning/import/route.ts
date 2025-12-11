/**
 * API ENDPOINT - Importar/Actualizar Planning del Usuario
 * 
 * POST /api/planning/import
 * Body: { planning: PlanningData }
 * 
 * Guarda o actualiza el planning activo del usuario.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const { planning } = await req.json();
        
        if (!planning || !planning.topic_time_estimates || !planning.daily_schedule) {
            return NextResponse.json(
                { error: 'Invalid planning data. Must include topic_time_estimates and daily_schedule' },
                { status: 400 }
            );
        }
        
        // Autenticar usuario
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        console.log('[PLANNING-IMPORT] Importing planning for user:', user.id);
        console.log('[PLANNING-IMPORT] Topics:', planning.topic_time_estimates.length);
        console.log('[PLANNING-IMPORT] Schedule:', planning.daily_schedule.length);
        
        // Desactivar planning anterior
        await supabase
            .from('user_planning')
            .update({ is_active: false })
            .eq('user_id', user.id)
            .eq('is_active', true);
        
        // Insertar nuevo planning
        const { data, error } = await supabase
            .from('user_planning')
            .insert({
                user_id: user.id,
                strategic_analysis: planning.strategic_analysis || '',
                topic_time_estimates: planning.topic_time_estimates,
                daily_schedule: planning.daily_schedule,
                generated_by: 'import',
                is_active: true
            })
            .select()
            .single();
        
        if (error) {
            console.error('[PLANNING-IMPORT] Error:', error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }
        
        console.log('[PLANNING-IMPORT] Success! Planning ID:', data.id);
        
        return NextResponse.json({
            success: true,
            planningId: data.id,
            topicCount: planning.topic_time_estimates.length,
            scheduleCount: planning.daily_schedule.length
        });
        
    } catch (error) {
        console.error('[PLANNING-IMPORT] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        // Autenticar usuario
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Obtener planning activo
        const { data, error } = await supabase
            .from('user_planning')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();
        
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        if (!data) {
            return NextResponse.json({ 
                hasPlanning: false,
                message: 'No active planning found for user'
            });
        }
        
        return NextResponse.json({
            hasPlanning: true,
            planning: {
                id: data.id,
                strategic_analysis: data.strategic_analysis,
                topic_time_estimates: data.topic_time_estimates,
                daily_schedule: data.daily_schedule,
                version: data.version,
                created_at: data.created_at,
                updated_at: data.updated_at
            },
            topicCount: data.topic_time_estimates?.length || 0,
            scheduleCount: data.daily_schedule?.length || 0
        });
        
    } catch (error) {
        console.error('[PLANNING-GET] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

