const fs = require('fs');
const path = require('path');

// Configuration
const SOURCE_DIR = "C:/Users/yony2/StudyBoard/Temario/Legislacion y Material fundacional";
const OUTPUT_FILE = "C:/Users/yony2/StudyBoard/studytemple/src/lib/syllabus-data.ts";

// Helper to determine Zone based on keywords
function classifyFile(filename) {
    const lower = filename.toLowerCase();

    if (lower.includes('carretera') || lower.includes('trazado') || lower.includes('firmes') || lower.includes('drenaje') || lower.includes('túnel') || lower.includes('señalización') || lower.includes('nudos')) {
        return 'A'; // Carreteras
    }
    if (lower.includes('agua') || lower.includes('hidráulic') || lower.includes('vertido')) {
        return 'B'; // Aguas
    }
    if (lower.includes('costas') || lower.includes('litoral') || lower.includes('puerto') || lower.includes('marítim')) {
        return 'C'; // Costas y Puertos
    }
    if (lower.includes('ambiente') || lower.includes('suelo') || lower.includes('espacios naturales') || lower.includes('evaluación')) {
        return 'D'; // Medio Ambiente
    }
    if (lower.includes('expropiación') || lower.includes('accesibilidad') || lower.includes('obra') || lower.includes('construcción') || lower.includes('proyecto')) {
        return 'E'; // Gestión / Transversal (Note: 'construcción' could be A, but if generic project mgmt, keeping here for now, or refine logic)
    }

    return 'G'; // General / Otros
}

// Helper to extract a clean title from filename
function cleanTitle(filename) {
    return filename
        .replace(/\.pdf$/i, '')
        .replace(/^\d+[-_]/, '') // Remove starting numbers
        .trim();
}

function generateSyllabus() {
    console.log(`Scanning ${SOURCE_DIR}...`);

    try {
        const files = fs.readdirSync(SOURCE_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
        const topics = [];

        files.forEach((file, index) => {
            const zone = classifyFile(file);
            // Some specific overrides or refinements could go here
            let finalZone = zone;

            // Fix overlap: 'Obras de paso' is definitely Carreteras (Zone A) usually, but key word logic might put it in E.
            if (file.toLowerCase().includes('obras de paso') || file.toLowerCase().includes('movimientos de tierras')) {
                finalZone = 'A';
            }
            // 'Proyecto de construcción de una carretera' -> A
            if (file.toLowerCase().includes('construcción de una carretera')) {
                finalZone = 'A';
            }

            topics.push({
                id: `${finalZone.toLowerCase()}${index + 1}`,
                zoneId: finalZone,
                title: cleanTitle(file),
                fileReference: file
            });
        });

        // Grouping for console output check
        // const grouped = topics.reduce((acc, t) => {
        //     acc[t.zoneId] = acc[t.zoneId] || [];
        //     acc[t.zoneId].push(t.title);
        //     return acc;
        // }, {});
        // console.log("Classification Result:", JSON.stringify(grouped, null, 2));

        // Generate TypeScript Content
        const tsContent = `export interface Topic {
    id: string;
    title: string;
    zoneId: string;
    fileReference?: string;
    description?: string;
}

export const SYLLABUS_DATA: Topic[] = ${JSON.stringify(topics, null, 4)};

export function getTopicsByZone(zoneId: string) {
    return SYLLABUS_DATA.filter(t => t.zoneId === zoneId);
}
`;

        fs.writeFileSync(OUTPUT_FILE, tsContent);
        console.log(`Successfully generated syllabus-data.ts with ${topics.length} topics.`);

    } catch (err) {
        console.error("Error generating syllabus:", err);
    }
}

generateSyllabus();
