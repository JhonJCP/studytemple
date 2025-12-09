# Guía de Configuración de Supabase para "Study Temple"

Esta guía detalla paso a paso cómo configurar tu proyecto de Supabase para habilitar las funcionalidades de Inteligencia Artificial (Vectores), Base de Datos de PDFs y Sistema de Revisión Espaciada (SRS).

## 1. Crear el Proyecto
1.  Ve a [supabase.com](https://supabase.com) e inicia sesión.
2.  Crea un nuevo proyecto llamado `StudyTemple`.
3.  Establece una contraseña segura para tu base de datos (guárdala bien).
4.  Copia la `Project URL` y la `anon public key` en tu archivo `.env.local` (si no lo has hecho ya).

## 2. Acceder al Editor SQL
1.  En el menú lateral izquierdo de Supabase, haz clic en el icono **SQL Editor** (parece una hoja con terminal).
2.  Haz clic en **New query** (arriba a la izquierda).
3.  Copia y pega el código de cada sección siguiente y ejecútalo pulsando **Run** (botón verde).

---

## 3. Bloque 1: Sistema de Vectores (Para el "Bibliotecario" y RAG)
Este bloque habilita la inteligencia artificial para buscar texto dentro de tus PDFs.

```sql
-- Habilitar extensión pgvector para guardar "significados" matemáticos de textos
create extension if not exists vector;

-- Tabla para guardar los trozos de texto de tus PDFs
create table public.library_documents (
  id bigserial primary key,
  content text,                    -- El párrafo de texto real
  metadata jsonb,                  -- Datos extra: { filename: "Ley de Costas.pdf", page: 12, topic: "Zone A" }
  embedding vector(768)            -- El vector numérico (768 dimensiones para Gemini Pro)
);

-- Función de búsqueda por similitud (El cerebro del buscador)
create or replace function match_library_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    library_documents.id,
    library_documents.content,
    library_documents.metadata,
    1 - (library_documents.embedding <=> query_embedding) as similarity
  from library_documents
  where 1 - (library_documents.embedding <=> query_embedding) > match_threshold
  order by library_documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

---

## 4. Bloque 2: Sistema de Repaso Espaciado (SRS) con RLS
Este bloque crea la tabla para guardar tu progreso en cada tema y habilita la seguridad.

```sql
-- Tabla para rastrear tu progreso en cada tema (Algoritmo SM-2)
create table public.user_progress (
  id uuid default gen_random_uuid() primary key,
  topic_id text not null,          -- ID del tema (ej: 'a1', 'b3')
  user_id uuid default auth.uid(), -- Tu usuario (si usamos autenticación)
  
  -- Datos Matemáticos del Algoritmo Anki
  interval int default 0,          -- Días hasta el próximo repaso
  repetition int default 0,        -- Veces repasado con éxito consecutivas
  ef_factor float default 2.5,     -- "Easiness Factor" (Factor de Facilidad)
  
  next_review_date timestamp with time zone default now(),
  last_review_date timestamp with time zone,
  
  status text default 'new',       -- Estados: 'new' (nuevo), 'learning' (aprendiendo), 'graduated' (memorizado)
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indice único para que no haya duplicados por tema/usuario
alter table public.user_progress add constraint unique_topic_user unique (topic_id, user_id);

-- POLÍTICAS DE SEGURIDAD (Row Level Security)
-- Esto asegura que, cuando haya login, cada usuario solo toque sus datos.
alter table public.user_progress enable row level security;

-- Política: "Ver mis datos"
create policy "Users can view their own progress" 
on public.user_progress for select 
using (auth.uid() = user_id);

-- Política: "Insertar mis datos"
create policy "Users can insert their own progress" 
on public.user_progress for insert 
with check (auth.uid() = user_id);

-- Política: "Actualizar mis datos"
create policy "Users can update their own progress" 
on public.user_progress for update 
using (auth.uid() = user_id);
```

---

## 5. Bloque 3: Almacenamiento de Archivos (Storage)
1.  Ve a el menú lateral **Storage** (icono de cubo).
2.  Haz clic en **New Bucket**.
3.  Llama al bucket: `pdfs`.
4.  Activa la opción: **Public bucket** (para que la web pueda leerlos sin token complejo por ahora).
5.  Haz clic en **Save**.

## 6. Siguientes Pasos (Ingesta de Datos)
Una vez ejecutados estos comandos, tu base de datos está lista.
El siguiente paso será ejecutar el script de "Ingesta" que leerá tus 41 archivos locales y los subirá a esta nueva estructura.
