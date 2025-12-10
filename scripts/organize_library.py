import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

# Load env safely
def load_env():
    env_path = ".env.local"
    if os.path.exists(env_path):
        try:
             # Try UTF-16 LE first (Confirmed format for user system)
            with open(env_path, "r", encoding="utf-16-le") as f:
                content = f.read()
        except:
             # Fallback
            with open(env_path, "r", encoding="utf-8", errors="ignore") as f:
                 content = f.read()

        for line in content.splitlines():
            line = line.replace('\x00', '').strip() # Clean null bytes
            if "=" in line and not line.startswith("#"):
                key, val = line.strip().split("=", 1)
                os.environ[key.strip()] = val.strip().strip('"')

load_env()
GEMINI_KEY = os.getenv("NEXT_PUBLIC_GEMINI_API_KEY")

if not GEMINI_KEY:
    print("❌ Error: NEXT_PUBLIC_GEMINI_API_KEY no encontrada.")
    exit(1)

genai.configure(api_key=GEMINI_KEY)

ROOT_DIR = r"C:\Users\yony2\StudyBoard\Temario"

def get_all_pdfs(root_dir):
    pdf_list = []
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.lower().endswith(".pdf"):
                # Clean up name: remove extension and weird characters
                clean_name = file.replace(".pdf", "").replace("_", " ")
                # Get category from folder name
                folder = os.path.basename(root)
                pdf_list.append(f"[{folder}] {clean_name}")
    return pdf_list

def organize_with_ai(pdf_list):
    print(f"🧠 'El Bibliotecario' está analizando {len(pdf_list)} documentos...")
    
    # Using the SOTA model as requested and verified
    model = genai.GenerativeModel('models/gemini-3-pro-preview')
    
    prompt = f"""
    You are an expert Librarian and Civil Engineer building a syllabus for 'Ingenieros Técnicos de Obras Públicas'.
    
    I have a chaotic list of {len(pdf_list)} document filenames.
    Your task is to organize them into a clean, logical, 2-level hierarchical structure.
    
    The structure should ideally follow the official exam blocks if apparent, or standard Civil Engineering domains:
    1. Water & Hydraulics (Aguas)
    2. Coasts & Ports (Costas y Puertos)
    3. Transport & Roads (Carreteras)
    4. Environment (Medio Ambiente)
    5. Administration & Law (Administrativo)
    6. Practical Cases (Práctica)

    Rules:
    - Group similar documents together.
    - Rename the 'cleanTitle' to be human-readable and nice (remove clutter).
    - 'originalFilename' MUST match the input string exactly (minus the folder prefix) so I can link files later. Note that input had '[Folder] filename'. I need just the filename.
    
    Return pure JSON with this structure:
    {{
        "groups": [
            {{
                "title": "Block Title (e.g. Hidráulica)",
                "icon": "Droplets", 
                "description": "Short description of this block",
                "topics": [
                    {{
                        "title": "Clean readable title",
                        "originalFilename": "Exact filename.pdf"
                    }}
                ]
            }}
        ]
    }}
    
    Here is the list of files:
    {json.dumps(pdf_list, indent=2)}
    """
    
    response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
    return response.text

def main():
    pdfs = get_all_pdfs(ROOT_DIR)
    if not pdfs:
        print("❌ No se encontraron PDFs en " + ROOT_DIR)
        return

    try:
        json_output = organize_with_ai(pdfs)
        
        # Save to src/lib for frontend use
        output_path = r"c:\Users\yony2\StudyBoard\studytemple\src\lib\smart-syllabus.json"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(json_output)
            
        print(f"✅ Estructura generada y guardada en {output_path}")
        
    except Exception as e:
        print(f"❌ Error en la IA: {e}")

if __name__ == "__main__":
    main()
