
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
    return text
        .normalize('NFD') // Split accents
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/º/g, 'o') // Handle common symbol
        .replace(/ª/g, 'a')
        .replace(/[^a-zA-Z0-9\.\-_]/g, '_') // Replace weird chars with underscore
        .replace(/_+/g, '_'); // Collapse underscores
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

async function syncStorage() {
    console.log(`🚀 Starting ROBUST Storage Sync to '${BUCKET_NAME}'...`);

    // 1. Ensure Bucket
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets.find(b => b.name === BUCKET_NAME)) {
        await supabase.storage.createBucket(BUCKET_NAME, { public: true, fileSizeLimit: 52428800, allowedMimeTypes: ['application/pdf'] });
        console.log("✅ Bucket created.");
    }

    // 2. Process Files
    for (const dirPath of DIRS) {
        if (!fs.existsSync(dirPath)) continue;
        console.log(`\n📂 Scanning: ${path.basename(dirPath)}`);

        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            if (!file.toLowerCase().endsWith('.pdf')) continue;

            const filePath = path.join(dirPath, file);
            const rawName = file;
            const safeName = slugify(rawName); // "Sanitized" name for storage

            // Upload to Storage
            const fileBuffer = fs.readFileSync(filePath);
            const { error: upErr } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(safeName, fileBuffer, { upsert: true, contentType: 'application/pdf' });

            if (upErr) {
                console.error(`   ❌ Failed to upload ${safeName}: ${upErr.message}`);
                continue;
            }

            // Sync Database Metadata (If name changed, we must update the DB reference)
            if (rawName !== safeName) {
                // Find docs with the OLD name and update them to the NEW safe name
                // Note: dealing with JSONB in Supabase via JS client is tricky.
                // We fetch rows, modify, update.
                const { data: rows } = await supabase
                    .from('library_documents')
                    .select('id, metadata')
                    .contains('metadata', { filename: rawName });

                if (rows && rows.length > 0) {
                    process.stdout.write(`   🔄 Fix DB: ${rawName} -> ${safeName} (${rows.length} docs) `);
                    for (const row of rows) {
                        const newMeta = { ...row.metadata, filename: safeName, original_filename: rawName }; // Keep original just in case
                        await supabase
                            .from('library_documents')
                            .update({ metadata: newMeta })
                            .eq('id', row.id);
                    }
                    process.stdout.write("✅\n");
                } else {
                    process.stdout.write("."); // No db entry found to fix, maybe not ingested yet
                }
            } else {
                process.stdout.write(".");
            }
        }
    }
    console.log("\n🏁 Done.");
}

syncStorage();
