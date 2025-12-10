
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// --- CONFIGURATION ---
const DIRS = [
    String.raw`C:\Users\yony2\StudyBoard\Temario\Legislacion y Material fundacional`,
    String.raw`C:\Users\yony2\StudyBoard\Temario\Informes y Propuestas de Resolución`,
    String.raw`C:\Users\yony2\StudyBoard\Temario\BOE Convocatoria`,
    String.raw`C:\Users\yony2\StudyBoard\Temario\MATERIAL CONVOCATORIAS ANTERIORES`
];
const BUCKET_NAME = 'library_documents';

// --- UTILS ---
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

async function forceSync() {
    console.log(`🚀 FORCE Syncing Storage to '${BUCKET_NAME}' (Overwriting with safe names)...`);

    for (const dirPath of DIRS) {
        if (!fs.existsSync(dirPath)) continue;
        console.log(`\n📂 Scanning: ${path.basename(dirPath)}`);

        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            if (!file.toLowerCase().endsWith('.pdf')) continue;

            const filePath = path.join(dirPath, file);
            const safeName = slugify(file);

            // Log specific important files to be sure
            if (file.includes("Convocatoria")) {
                console.log(`   🎯 Target found: ${file} -> Uploading as: ${safeName}`);
            }

            try {
                const fileBuffer = fs.readFileSync(filePath);
                const { error: upErr } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(safeName, fileBuffer, {
                        upsert: true, // FORCE OVERWRITE
                        contentType: 'application/pdf'
                    });

                if (upErr) {
                    process.stdout.write("x");
                    // console.error(`   ❌ Failed ${safeName}: ${upErr.message}`);
                } else {
                    process.stdout.write(".");
                }
            } catch (e) {
                console.error(e.message);
            }
        }
    }
    console.log("\n🏁 Done.");
}

forceSync();
