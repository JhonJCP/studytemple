import os
import google.generativeai as genai

# Load env safely
env_path = ".env.local"
if os.path.exists(env_path):
    try:
        with open(env_path, "r", encoding="utf-16-le") as f:
            content = f.read()
    except:
        with open(env_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

    for line in content.splitlines():
        line = line.replace('\x00', '').strip()
        if "=" in line and not line.startswith("#"):
            key, val = line.strip().split("=", 1)
            os.environ[key.strip()] = val.strip().strip('"')

genai.configure(api_key=os.getenv("NEXT_PUBLIC_GEMINI_API_KEY"))

print("🔍 Buscando modelos disponibles...")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Error listing models: {e}")
