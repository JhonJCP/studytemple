
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manual .env parser
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (!fs.existsSync(envPath)) return;
        let content = fs.readFileSync(envPath);
        let text = "";
        try { text = content.toString('utf8'); if (text.includes('\0')) throw new Error(); } catch { text = content.toString('utf16le'); }
        if (text.includes('\0') || text.charCodeAt(0) === 0xFFFE) text = content.toString('utf16le');

        text.split('\n').forEach(line => {
            const clean = line.trim().replace(/^\uFEFF/, '');
            if (!clean || clean.startsWith('#')) return;
            const parts = clean.split('=');
            if (parts.length >= 2) process.env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        });
    } catch (e) { }
}
loadEnv();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectData() {
    console.log("🔍 Inspecting 'category' field in DB...");

    // Get ALL files (chunk 0)
    const { data, error } = await supabase
        .from("library_documents")
        .select("metadata")
        .contains("metadata", { chunk_index: 0 });

    if (error) { console.error(error); return; }

    console.log(`Found ${data.length} files.`);

    // Count categories
    const counts = {};
    const supplementaryFiles = [];

    data.forEach(d => {
        const cat = d.metadata.category || "Uncategorized";
        counts[cat] = (counts[cat] || 0) + 1;
        if (cat.toLowerCase().includes('supplementary')) {
            supplementaryFiles.push(d.metadata.filename);
        }
    });

    console.log("📊 Category Distribution:", counts);
    console.log("📂 Supplementary Files Found:", supplementaryFiles.length);
    if (supplementaryFiles.length > 0) {
        console.log("Sample Supplementary:", supplementaryFiles.slice(0, 3));
    } else {
        console.warn("⚠️ WARNING: No files found with 'Supplementary' category!");
    }
}

inspectData();
