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
