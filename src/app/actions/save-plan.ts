"use server";

import { createClient } from "@/utils/supabase/server";

export async function saveStudyPlan(schedule: any, constraints: any) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Not authenticated" };

    try {
        await supabase.from('study_plans').upsert({
            user_id: user.id,
            schedule: schedule,
            last_updated_with_ai: new Date().toISOString(),
            availability: constraints.availability,
            goal_date: constraints.goalDate
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}
