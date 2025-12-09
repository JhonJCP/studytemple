import os
from pypdf import PdfReader

BASE_DIR = r"C:\Users\yony2\StudyBoard\Temario\BOE Convocatoria"
FILES = [
    "Convocatoria ITOP 2025.pdf",
    "Temario Parte Específica y Contenidos Prácticos.pdf",
    "Temario Parte General.pdf"
]

def extract_text_from_pdf(filename):
    path = os.path.join(BASE_DIR, filename)
    print(f"\n--- ANALIZANDO: {filename} ---")
    try:
        reader = PdfReader(path)
        text = ""
        # Read all pages
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
    except Exception as e:
        print(f"Error leyendo {filename}: {e}")
        return ""

full_report = ""

with open("boe_summary.md", "w", encoding="utf-8") as f:
    f.write("# ANÁLISIS BOE\n\n")
    for filename in FILES:
        text = extract_text_from_pdf(filename)
        f.write(f"## {filename}\n")
        
        if filename == "Convocatoria ITOP 2025.pdf":
            idx = text.lower().find("segundo ejercicio")
            if idx != -1:
                f.write("### SEGUNDO EJERCICIO\n")
                f.write(text[idx:idx+2000] + "\n\n")
        
        if "Temario Parte Específica" in filename:
            f.write("### TEMARIO ESPECÍFICO (Inicio)\n")
            f.write(text[:3000] + "\n\n")
