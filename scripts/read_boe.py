import sys
from pypdf import PdfReader

# Path to the specific BOE file
pdf_path = r"C:\Users\yony2\StudyBoard\Temario\BOE Convocatoria\Temario Parte Específica y Contenidos Prácticos.pdf"

try:
    reader = PdfReader(pdf_path)
    print(f"Abriendo PDF: {pdf_path}")
    print(f"Total páginas: {len(reader.pages)}")
    
    # Extract text from first 5 pages to verify syllabus
    text_content = ""
    for i in range(min(5, len(reader.pages))):
        page = reader.pages[i]
        text_content += page.extract_text() + "\n--- PAGE BREAK ---\n"
        
    print("CONTENIDO NO PROCESADO (Primeras páginas):")
    print(text_content)
    
except Exception as e:
    print(f"Error inviendo el PDF: {e}")
