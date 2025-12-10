
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manual .env parser for UTF-16LE support
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (!fs.existsSync(envPath)) return;

        let content = fs.readFileSync(envPath);
        let text = "";

        // Try simple UTF-8 first
        try {
            text = content.toString('utf8');
            if (text.includes('\0')) throw new Error("Null bytes -> likely UTF-16");
        } catch {
            text = content.toString('utf16le');
        }

        // If still messy, try utf16le explicit
        if (text.includes('\0') || text.charCodeAt(0) === 0xFFFE || text.charCodeAt(0) === 0xFEFF) {
            text = content.toString('utf16le');
        }

        text.split('\n').forEach(line => {
            const clean = line.trim().replace(/^\uFEFF/, '');
            if (!clean || clean.startsWith('#')) return;
            const parts = clean.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
                process.env[key] = val;
            }
        });
    } catch (e) {
        console.error("Env load error:", e);
    }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDocs() {
    console.log("🔍 Checking DB count...");
    const { count, error } = await supabase
        .from('library_documents')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`✅ Total documents in 'library_documents': ${count}`);
    }

    // Check a sample
    const { data } = await supabase.from('library_documents').select('metadata').limit(5);
    console.log("Sample metadata:", JSON.stringify(data, null, 2));
}

checkDocs();
