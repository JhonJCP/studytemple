import os

def check():
    path = ".env.local"
    print(f"Leyendo {path} como UTF-16 LE...")
    
    try:
        with open(path, 'rb') as f:
            raw = f.read()
        
        # Force decode as UTF-16 Little Endian
        content = raw.decode('utf-16-le').strip()
        
        # Remove BOM if present manually (just in case decode didn't consume it perfectly)
        if content.startswith('\ufeff'):
            content = content[1:]

        lines = content.splitlines()
        print(f"Total líneas detectadas: {len(lines)}")
        
        found_keys = []
        for line in lines:
            line = line.strip()
            # Handle potential null bytes artifact
            line = line.replace('\x00', '') 
            
            if not line or line.startswith('#'): continue
            
            if '=' in line:
                key, val = line.split('=', 1)
                found_keys.append(key.strip())
                
        print("CLAVES ENCONTRADAS:")
        for k in found_keys:
            print(f"- {k}")
            
    except Exception as e:
        print(f"ERROR: {e}")

check()
