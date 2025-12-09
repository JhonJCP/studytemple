import sys
from pypdf import PdfReader

PDF_PATH = r"C:\Users\yony2\StudyBoard\Temario\BOE Convocatoria\Temario Parte Específica y Contenidos Prácticos.pdf"
OUTPUT_FILE = "boe_syllabus_full.txt"

def extract_all():
    try:
        reader = PdfReader(PDF_PATH)
        full_text = ""
        for page in reader.pages:
            full_text += page.extract_text() + "\n"
            
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write(full_text)
            
        print(f"Syllabus extracted to {OUTPUT_FILE} ({len(full_text)} chars)")
        
    except Exception as e:
        print(f"Error: {e}")

extract_all()
