const fs = require('fs');
const pdf = require('pdf-parse');

const PDF_PATH = "C:/Users/yony2/StudyBoard/Temario/BOE Convocatoria/Temario Parte Específica y Contenidos Prácticos.pdf";
const OUTPUT_TXT = "C:/Users/yony2/StudyBoard/studytemple/boe_analysis.txt";

async function extractText() {
    try {
        console.log(`Reading PDF: ${PDF_PATH}`);
        const dataBuffer = fs.readFileSync(PDF_PATH);

        const data = await pdf(dataBuffer);

        console.log(`Extracted ${data.numpages} pages.`);
        console.log(`Saving text to ${OUTPUT_TXT}...`);

        fs.writeFileSync(OUTPUT_TXT, data.text);
        console.log("Done.");

    } catch (err) {
        console.error("Error parsing PDF:", err);
    }
}

extractText();
