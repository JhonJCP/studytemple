# Instrucciones de Configuración para Producción

## Variable de Entorno: PLANNING_DATA

Para que el Global Planner funcione correctamente en producción (Vercel), necesitas configurar la variable de entorno `PLANNING_DATA`.

### Paso 1: Copiar contenido del planning

El contenido ya está en `Temario/Planing.txt`. Este es el JSON completo que debes copiar.

### Paso 2: Configurar en Vercel

1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Crea una nueva variable:
   - **Name**: `PLANNING_DATA`
   - **Value**: Pega el contenido completo del archivo `Planing.txt` (es un JSON)
   - **Environment**: Production, Preview, Development (seleccionar todos)

### Paso 3: Redeploy

Después de añadir la variable, haz un nuevo deployment para que tome efecto:

```bash
git commit --allow-empty -m "Trigger redeploy for PLANNING_DATA"
git push
```

## Verificación

Una vez deployado, al generar un tema deberías ver en los logs:

```
[PLANNER] Loaded planning from env var with 11 topics
```

En lugar de:

```
[PLANNER] Planning file not found at: /var/Temario/Planing.txt
[PLANNER] Using default planning data
```

## Storage Buckets en Supabase

Para persistir imágenes y audio generados, necesitas crear los siguientes buckets en Supabase:

### Crear Buckets

1. Ve a Supabase Dashboard → tu proyecto
2. Storage → Create bucket
3. Crea estos tres buckets:
   - **generated-images** (PUBLIC)
   - **generated-audio** (PUBLIC)
   - **planning** (PRIVATE - opcional, si prefieres Storage en lugar de env var)

### Configurar Políticas de Acceso

Ejecuta este SQL en Supabase SQL Editor:

```sql
-- Política para LEER imágenes públicamente
INSERT INTO storage.policies (name, bucket_id, definition, check_clause)
VALUES (
  'Public read generated images',
  'generated-images',
  '(bucket_id = ''generated-images'')',
  NULL
) ON CONFLICT DO NOTHING;

-- Política para UPLOAD de imágenes (autenticados)
INSERT INTO storage.policies (name, bucket_id, definition, check_clause)
VALUES (
  'Authenticated upload images',
  'generated-images',
  '(bucket_id = ''generated-images'' AND auth.role() = ''authenticated'')',
  '(bucket_id = ''generated-images'' AND auth.role() = ''authenticated'')'
) ON CONFLICT DO NOTHING;

-- Política para LEER audio públicamente
INSERT INTO storage.policies (name, bucket_id, definition, check_clause)
VALUES (
  'Public read generated audio',
  'generated-audio',
  '(bucket_id = ''generated-audio'')',
  NULL
) ON CONFLICT DO NOTHING;

-- Política para UPLOAD de audio (autenticados)
INSERT INTO storage.policies (name, bucket_id, definition, check_clause)
VALUES (
  'Authenticated upload audio',
  'generated-audio',
  '(bucket_id = ''generated-audio'' AND auth.role() = ''authenticated'')',
  '(bucket_id = ''generated-audio'' AND auth.role() = ''authenticated'')'
) ON CONFLICT DO NOTHING;
```

## Troubleshooting

Si el planning no se carga:

1. Verifica que el JSON en la variable de entorno sea válido (sin errores de sintaxis)
2. Asegúrate de que la variable esté disponible en todos los entornos
3. Haz un redeploy después de cambiar variables de entorno

