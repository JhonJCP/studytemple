import os
import time
from supabase import create_client, Client
import google.generativeai as genai
from pypdf import PdfReader

# 1. SETUP & CONFIG
def manual_load_env(path):
    print(f"🔧 Cargando configuración desde {path}...")
    try:
        with open(path, 'rb') as f:
            raw = f.read()
            
        # Try UTF-16 LE first (Confirmed format)
        try:
            content = raw.decode('utf-16-le')
        except:
            # Fallback
            try:
                content = raw.decode('utf-8')
            except:
                content = raw.decode('cp1252', errors='ignore')
            
        if content.startswith('\ufeff'):
            content = content[1:]
            
        lines = content.splitlines()
        count = 0
        for line in lines:
            # Clean null bytes and whitespace
            line = line.replace('\x00', '').strip()
            
            if not line or line.startswith('#'): continue
            
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                os.environ[key] = value
                count += 1
        print(f"✅ Configuración cargada correctamente ({count} variables).")
        
    except Exception as e:
        print(f"❌ Error crítico leyendo .env.local: {e}")
        exit(1)

manual_load_env(".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # MUST be Service Role for Admin write
GEMINI_KEY = os.getenv("NEXT_PUBLIC_GEMINI_API_KEY")

if not SUPABASE_KEY:
    print("❌ ERROR: Falta SUPABASE_SERVICE_ROLE_KEY. Verifica tu .env.local")
    exit(1)

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    genai.configure(api_key=GEMINI_KEY)
except Exception as e:
    print(f"❌ Error inicializando clientes API: {e}")
    exit(1)

# Dirs to scan
DIRS = {
    "CORE": r"C:\Users\yony2\StudyBoard\Temario\Legislacion y Material fundacional",
    "PRACTICE": r"C:\Users\yony2\StudyBoard\Temario\Informes y Propuestas de Resolución",
    "BOE": r"C:\Users\yony2\StudyBoard\Temario\BOE Convocatoria",
    "SUPPLEMENTARY": r"C:\Users\yony2\StudyBoard\Temario\MATERIAL CONVOCATORIAS ANTERIORES"
}

# 2. HELPER: EMBEDDING GENERATOR
def get_embedding(text):
    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_document",
            title="Opozulo Document"
        )
        return result['embedding']
    except Exception as e:
        print(f"    ⚠️ Error generando vector AI: {e}")
        return None

# 3. HELPER: PDF TEXT EXTRACTOR
def extract_text_chunks(filepath, chunk_size=1000):
    try:
        reader = PdfReader(filepath)
        full_text = ""
        for page in reader.pages:
            try:
                text = page.extract_text()
                if text: full_text += text + "\n"
            except:
                continue 
        
        if not full_text: 
            return []

        clean_text = full_text.replace('\x00', '') # Clean null bytes from PDF text too
        
        chunks = []
        for i in range(0, len(clean_text), chunk_size):
            chunk = clean_text[i:i+chunk_size]
            if len(chunk) > 100: 
                chunks.append(chunk)
        return chunks
    except Exception as e:
        print(f"    ⚠️ Error leyendo PDF ({os.path.basename(filepath)}): {e}")
        return []

# 4. MAIN INGESTION LOOP
def ingest_all():
    print("🚀 INICIANDO INGESTA MASIVA AL CEREBRO...")
    total_docs = 0
    
    for category, path in DIRS.items():
        print(f"\n📂 Procesando Silo: {category}")
        
        if not os.path.exists(path):
            print(f"⚠️ Ruta no encontrada: {path}")
            continue

        files = [f for f in os.listdir(path) if f.endswith(".pdf")]
        print(f"   Encontrados {len(files)} archivos PDF.")
        
        for filename in files:
            filepath = os.path.join(path, filename)
            print(f"  📄 Leyendo: {filename}...", end="", flush=True)
            
            chunks = extract_text_chunks(filepath)
            
            if not chunks:
                print(" (Vacío o Error)")
                continue
                
            print(f" {len(chunks)} fragmentos.", end="", flush=True)
            
            vectors = []
            for i, chunk in enumerate(chunks):
                # Rate limit safety
                time.sleep(0.5) 
                
                vector = get_embedding(chunk)
                if vector:
                    vectors.append({
                        "content": chunk,
                        "metadata": {
                            "filename": filename,
                            "category": category,
                            "chunk_index": i
                        },
                        "embedding": vector
                    })
            
            if vectors:
                try:
                    data, count = supabase.table("library_documents").insert(vectors).execute()
                    print(f" ✅ Guardado.")
                    total_docs += 1
                except Exception as e:
                     print(f" ❌ Error Supabase: {e}")

    print(f"\n🏁 PROCESO COMPLETADO. {total_docs} Archivos procesados e indexados.")

if __name__ == "__main__":
    ingest_all()
