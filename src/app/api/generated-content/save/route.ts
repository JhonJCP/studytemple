import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const topicId = body?.topicId as string | undefined;
        const contentJson = body?.contentJson as any;

        if (!topicId || !contentJson) {
            return NextResponse.json({ error: "Missing topicId/contentJson" }, { status: 400 });
        }

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: existing, error: fetchError } = await supabase
            .from("generated_content")
            .select("id,created_at")
            .eq("user_id", user.id)
            .eq("topic_id", topicId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (fetchError) {
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        const payload = {
            user_id: user.id,
            topic_id: topicId,
            content_json: contentJson,
            is_complete: true,
            status: "complete",
            updated_at: new Date().toISOString(),
        };

        if (existing?.id) {
            const { error: updateError } = await supabase.from("generated_content").update(payload).eq("id", existing.id);
            if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
            return NextResponse.json({ success: true, id: existing.id, updated: true });
        }

        const { data: inserted, error: insertError } = await supabase.from("generated_content").insert(payload).select("id").maybeSingle();
        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

        return NextResponse.json({ success: true, id: inserted?.id || null, updated: false });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    }
}

