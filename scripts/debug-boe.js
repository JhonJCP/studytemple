const fs = require('fs');
const pdf = require('pdf-parse');

const PDF_PATH = "C:/Users/yony2/StudyBoard/Temario/BOE Convocatoria/Temario Parte Específica y Contenidos Prácticos.pdf";

async function extractText() {
    try {
        const dataBuffer = fs.readFileSync(PDF_PATH);
        const data = await pdf(dataBuffer);
        // Print essential parts looking for "Parte Práctica" or syllabus list
        console.log(data.text.substring(0, 3000));
    } catch (err) {
        console.error("Error parsing PDF:", err);
    }
}

extractText();
