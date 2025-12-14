"use server";

import { createClient } from "@/utils/supabase/server";
import type { GeneratedContentRecord } from "@/types/generated";

export async function listGeneratedContent() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated" };

        const { data, error } = await supabase
            .from("generated_content")
            .select("id,topic_id,updated_at,is_complete,status")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) return { success: false, error: error.message };

        return { success: true, data: data as GeneratedContentRecord[] };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}
