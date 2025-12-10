"use server";

import { createClient } from "@/utils/supabase/server";

export async function saveStudyPlan(masterPlan: any, constraints: any) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    try {
        await supabase.from('study_plans').upsert({
            user_id: user.id,
            // Map to correct DB columns
            schedule: masterPlan.daily_schedule,
            ai_metadata: {
                strategic_analysis: masterPlan.strategic_analysis,
                topic_time_estimates: masterPlan.topic_time_estimates
            },
            availability_json: constraints.availability,
            goal_date: constraints.goalDate,
            last_updated_with_ai: new Date().toISOString()
        });
        return { success: true };
    } catch (error) {
        console.error("Save Plan Error:", error);
        return { success: false, error: String(error) };
    }
}

export async function getLatestStudyPlan() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    try {
        const { data, error } = await supabase
            .from('study_plans')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') return { success: false, error: String(error.message) }; // PGs error 116 is no rows found
        if (!data) return { success: true, plan: null }; // No plan found

        return { success: true, plan: data };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}
