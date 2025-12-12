"use server";

import { createClient } from "@/utils/supabase/server";

export async function saveStudyPlan(masterPlan: any, constraints: any) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    try {
        // ✅ Guardar en user_planning (tabla correcta)
        const { error } = await supabase
            .from('user_planning')
            .upsert({
                user_id: user.id,
                strategic_analysis: masterPlan.strategic_analysis,
                topic_time_estimates: masterPlan.topic_time_estimates,
                daily_schedule: masterPlan.daily_schedule,
                is_active: true,
                updated_at: new Date().toISOString()
            });
        
        if (error) {
            console.error('[CALENDAR] Save error:', error);
            return { success: false, error: error.message };
        }
        
        console.log('[CALENDAR] ✅ Planning saved successfully');
        return { success: true };
    } catch (error) {
        console.error('[CALENDAR] Save exception:', error);
        return { success: false, error: String(error) };
    }
}

export async function getLatestStudyPlan() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    try {
        // ✅ CORRECCIÓN: Consultar user_planning (tabla correcta)
        const { data, error } = await supabase
            .from('user_planning')  // ← Cambio crítico
            .select('strategic_analysis, topic_time_estimates, daily_schedule, is_active')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('[CALENDAR] Error loading planning:', error);
            return { success: false, error: error.message };
        }
        
        if (!data) {
            console.log('[CALENDAR] No active planning found');
            return { success: true, plan: null };
        }

        console.log(`[CALENDAR] ✅ Loaded ${data.topic_time_estimates?.length || 0} topics from user_planning`);

        // ✅ Mapear a estructura esperada por el calendario
        return { 
            success: true, 
            plan: {
                schedule: data.daily_schedule || [],  // Array de sesiones
                ai_metadata: {
                    strategic_analysis: data.strategic_analysis || '',
                    topic_time_estimates: data.topic_time_estimates || []
                }
            }
        };
    } catch (error) {
        console.error('[CALENDAR] Exception:', error);
        return { success: false, error: String(error) };
    }
}
