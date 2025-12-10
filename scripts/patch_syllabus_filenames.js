
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (!fs.existsSync(envPath)) return;
        let content = fs.readFileSync(envPath);
        let text = "";
        try { text = content.toString('utf8'); } catch { text = content.toString('utf16le'); }
        if (text.includes('\0')) text = content.toString('utf16le');
        text.split('\n').forEach(line => {
            const clean = line.trim().replace(/^\uFEFF/, '');
            if (!clean || clean.startsWith('#')) return;
            const parts = clean.split('=');
            if (parts.length >= 2) process.env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        });
    } catch (e) { }
}
loadEnv();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function slugify(text) {
    if (!text) return text;
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/º/g, 'o')
        .replace(/ª/g, 'a')
        .replace(/[^a-zA-Z0-9\.\-_]/g, '_')
        .replace(/_+/g, '_');
}

async function patchSyllabus() {
    console.log("🩹 Patching Syllabus JSON with safe filenames...");

    // 1. Get current syllabus
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'smart-syllabus')
        .single();

    if (error || !data) {
        console.error("❌ Could not fetch syllabus:", error);
        return;
    }

    const syllabus = data.value;
    let updates = 0;

    // 2. Walk and Fix
    if (syllabus.groups) {
        for (const group of syllabus.groups) {
            if (group.topics) {
                for (const topic of group.topics) {
                    const oldName = topic.originalFilename;
                    const newName = slugify(oldName);
                    if (oldName !== newName) {
                        topic.originalFilename = newName;
                        updates++;
                    }
                }
            }
        }
    }

    if (updates > 0) {
        console.log(`✅ Fixed ${updates} filenames in the JSON structure.`);
        // 3. Save back
        const { error: saveErr } = await supabase
            .from('app_settings')
            .update({ value: syllabus })
            .eq('key', 'smart-syllabus');

        if (saveErr) console.error("❌ Error saving patched syllabus:", saveErr);
        else console.log("💾 Syllabus updated in DB successfully!");
    } else {
        console.log("✨ Syllabus was already clean.");
    }
}

patchSyllabus();
