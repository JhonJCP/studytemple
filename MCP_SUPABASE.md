# MCP para Supabase (acceso a embeddings y datos generados)

Guía rápida para habilitar un servidor MCP que exponga Supabase (embeddings y tablas de generación) a clientes compatibles (Cursor, Claude Desktop, etc.).

## 1) Instalar servidor MCP de Supabase

```bash
npm install -g mcp-supabase-db
```

Requiere Node 18+ y acceso de red. Usa tu clave de service role ya guardada en `.env.local` (ej.: `SUPABASE_SERVICE_ROLE_KEY`) sin pegarla en archivos de control de versiones.

## 2) Configurar el servidor

Crea `~/.config/mcp/servers.json` (o el path que use tu cliente MCP) con algo como:

```json
{
  "servers": {
    "supabase": {
      "command": "mcp-supabase-db",
      "args": [
        "--url", "https://<tu-proyecto>.supabase.co",
        "--key", "${SUPABASE_SERVICE_ROLE_KEY}",
        "--schema", "public",
        "--table-whitelist", "library_documents,knowledge_chunks,generated_content,generated_practicals,flashcards,tests,user_progress"
      ]
    }
  }
}
```

- Usa **service role** para poder leer embeddings y tablas protegidas; nunca lo expongas en frontend.
- Ajusta `table-whitelist` según las tablas que quieras consultar.
- Exporta la variable en tu shell antes de arrancar el cliente MCP (ejemplos):
  - PowerShell: `$env:SUPABASE_SERVICE_ROLE_KEY="tu-clave-service-role"`
  - Bash: `export SUPABASE_SERVICE_ROLE_KEY="tu-clave-service-role"`
- No comitees `.env.local` ni el `servers.json` de MCP.

## 3) Uso rápido

- Lanza tu cliente MCP (p.ej. Cursor/Claude) y revisa que aparezca el servidor `supabase`.
- Puedes listar recursos/tablas y lanzar consultas SQL o selects directos desde el cliente MCP.

## 4) Tablas clave ya creadas

- `library_documents`: embeddings actuales de PDFs/temario (ya poblado).
- `knowledge_chunks`: embeddings unificados (creada en migración 20241211).
- `generated_content`, `generated_practicals`, `flashcards`, `tests`, `generated_audio`: persistencia de contenido/IA.
- `user_progress`: SRS previo.

Con esto puedes inspeccionar lo que ya está almacenado en Supabase y reutilizar embeddings sin regenerar.***

## 5) Verificar en Cursor (cliente Codex)

1. Abre **Settings → Tools & MCP**.
2. En “Installed MCP Servers” confirma que aparece `supabase` (type: http, url `https://mcp.supabase.com/mcp?project_ref=cvwdrtaedfpjwhdeuhwr`).
3. Si no aparece, añade un servidor HTTP con esa URL y header `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` (cargada de tu `.env.local`).
4. Guarda y vuelve a la vista principal. Abre el panel MCP y elige `supabase`.
5. Ejecuta una acción de prueba (p. ej. `list_tables` o `list_migrations`). Deberías ver tablas como `library_documents`, `generated_content`, `knowledge_chunks`, etc.
6. Si el cliente pide aprobación manual de la llamada, acéptala.
