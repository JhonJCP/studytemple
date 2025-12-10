
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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = 'library_documents';

async function diagnose() {
    console.log(`🔍 Diagnosing bucket: ${BUCKET}`);

    // 1. Check Bucket contents
    const { data: files, error } = await supabase
        .storage
        .from(BUCKET)
        .list(); // Lists root files

    if (error) {
        console.error("❌ Error listing bucket:", error);
        return;
    }

    console.log(`📂 Found ${files.length} files in Storage.`);
    console.log("---------------------------------------------------");
    files.forEach(f => console.log(`   📄 ${f.name}`));
    console.log("---------------------------------------------------");

    // 2. Specific check for the problematic file
    const target = "Convocatoria_ITOP_2025.pdf";
    const found = files.find(f => f.name === target);

    if (found) {
        console.log(`✅ File '${target}' EXISTS. Size: ${found.metadata?.size} bytes.`);
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(target);
        console.log(`🔗 Public URL: ${data.publicUrl}`);
    } else {
        console.log(`❌ File '${target}' NOT FOUND in storage layer.`);
        console.log("   Potential matches:");
        files.filter(f => f.name.toLowerCase().includes("convocatoria")).forEach(f => console.log(`   -> Did you mean: ${f.name}?`));
    }
}

diagnose();
