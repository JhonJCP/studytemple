# User Environment Validation Script

import os
import google.generativeai as genai
from supabase import create_client, Client
import time

def check_env():
    print("--- Checking Environment Variables ---")
    gemini_key = os.environ.get("GEMINI_API_KEY") # Or NEXT_PUBLIC_GEMINI_API_KEY
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    print(f"GEMINI_API_KEY present: {bool(gemini_key)}")
    print(f"NEXT_PUBLIC_SUPABASE_URL present: {bool(supabase_url)}")
    print(f"NEXT_PUBLIC_SUPABASE_ANON_KEY present: {bool(supabase_key)}")

    if not gemini_key:
        print("CRITICAL: GEMINI_API_KEY missing.")
        return
    
    # Test Gemini
    print("\n--- Testing Gemini Connection ---")
    try:
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel('gemini-1.5-pro')
        response = model.generate_content("Say 'Hello' if you can hear me.")
        print(f"Gemini Response: {response.text.strip()}")
    except Exception as e:
        print(f"CRITICAL: Gemini Test Failed: {e}")

    # Test Supabase
    if supabase_url and supabase_key:
        print("\n--- Testing Supabase RAG Connection ---")
        try:
            supabase: Client = create_client(supabase_url, supabase_key)
            # Try to fetch count of documents
            res = supabase.table("library_documents").select("count", count="exact").limit(1).execute()
            print(f"Supabase Connection OK. Doc count: {res.count}")
            
            # Test specific search
            print("Searching for 'Ley 9/1991'...")
            res_search = supabase.table("library_documents").select("metadata").ilike("metadata->>filename", "%Ley%9%1991%").limit(5).execute()
            print(f"Found {len(res_search.data)} chunks for Ley 9/1991.")
        except Exception as e:
            print(f"CRITICAL: Supabase Test Failed: {e}")

if __name__ == "__main__":
    check_env()
