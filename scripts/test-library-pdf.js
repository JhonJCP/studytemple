const fs = require('fs');
const pdf = require('pdf-parse');

// Testing with distinct file
const PDF_PATH = "C:/Users/yony2/StudyBoard/Temario/Legislacion y Material fundacional/Ley 9-1991, de 8 de mayo, de Carreteras de Canarias.pdf";

async function extractText() {
    try {
        console.log("Reading Ley de Carreteras...");
        const dataBuffer = fs.readFileSync(PDF_PATH);
        const data = await pdf(dataBuffer);
        console.log("Success! Characters extracted:", data.text.length);
        console.log("Preview:", data.text.substring(0, 200));
    } catch (err) {
        console.error("Error parsing PDF:", err);
    }
}

extractText();
