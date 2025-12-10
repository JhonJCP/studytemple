-- Core entities for generated content, practicals, flashcards, tests, and embeddings cache.
create extension if not exists "vector";

-- Unified embeddings table (covers PDFs, syllabus, generated text, practicals).
create table if not exists public.knowledge_chunks (
  id bigserial primary key,
  user_id uuid references auth.users,
  topic_id text,
  source_type text, -- pdf | syllabus | generated | practical | flashcard | test
  content text not null,
  metadata jsonb,
  embedding vector(768),
  created_at timestamptz default now()
);

create index if not exists knowledge_chunks_topic_idx on public.knowledge_chunks (topic_id);
create index if not exists knowledge_chunks_source_idx on public.knowledge_chunks (source_type);
create index if not exists knowledge_chunks_embedding_idx on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.knowledge_chunks enable row level security;

create policy if not exists "Allow read knowledge_chunks" on public.knowledge_chunks
  for select using (true);

create policy if not exists "Users manage their knowledge_chunks" on public.knowledge_chunks
  for all using (coalesce(user_id, auth.uid()) = auth.uid())
  with check (coalesce(user_id, auth.uid()) = auth.uid());

-- Generated topic content (text + widgets + audio refs).
create table if not exists public.generated_content (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  topic_id text not null,
  content_json jsonb,
  audio_script text,
  audio_url text,
  audio_duration int,
  images jsonb,
  status text default 'draft',
  is_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists generated_content_user_topic_idx on public.generated_content (user_id, topic_id);

alter table public.generated_content enable row level security;

create policy if not exists "Users select their generated_content" on public.generated_content
  for select using (auth.uid() = user_id);

create policy if not exists "Users insert their generated_content" on public.generated_content
  for insert with check (auth.uid() = user_id);

create policy if not exists "Users update their generated_content" on public.generated_content
  for update using (auth.uid() = user_id);

-- Generated practical analyses.
create table if not exists public.generated_practicals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  practical_id text not null,
  summary text,
  key_issues jsonb,
  legal_references jsonb,
  resolution_steps jsonb,
  exam_tips jsonb,
  common_mistakes jsonb,
  audio_script text,
  audio_url text,
  audio_duration int,
  is_complete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists generated_practicals_user_practical_idx on public.generated_practicals (user_id, practical_id);

alter table public.generated_practicals enable row level security;

create policy if not exists "Users select their generated_practicals" on public.generated_practicals
  for select using (auth.uid() = user_id);

create policy if not exists "Users insert their generated_practicals" on public.generated_practicals
  for insert with check (auth.uid() = user_id);

create policy if not exists "Users update their generated_practicals" on public.generated_practicals
  for update using (auth.uid() = user_id);

-- Flashcards with SM-2 style SRS fields.
create table if not exists public.flashcards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  topic_id text not null,
  front text not null,
  back text not null,
  difficulty int default 0,
  ease_factor float default 2.5,
  interval int default 0,
  repetitions int default 0,
  next_review timestamptz,
  last_review timestamptz,
  status text default 'new',
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists flashcards_user_topic_idx on public.flashcards (user_id, topic_id);
create index if not exists flashcards_next_review_idx on public.flashcards (next_review);

alter table public.flashcards enable row level security;

create policy if not exists "Users select their flashcards" on public.flashcards
  for select using (auth.uid() = user_id);

create policy if not exists "Users insert their flashcards" on public.flashcards
  for insert with check (auth.uid() = user_id);

create policy if not exists "Users update their flashcards" on public.flashcards
  for update using (auth.uid() = user_id);

-- Generated tests (MCQ).
create table if not exists public.tests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  topic_id text,
  question text not null,
  options text[] not null,
  correct_index int not null,
  explanation text,
  reference text,
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tests_user_topic_idx on public.tests (user_id, topic_id);

alter table public.tests enable row level security;

create policy if not exists "Users select their tests" on public.tests
  for select using (auth.uid() = user_id);

create policy if not exists "Users insert their tests" on public.tests
  for insert with check (auth.uid() = user_id);

create policy if not exists "Users update their tests" on public.tests
  for update using (auth.uid() = user_id);

-- Audio cache used by the AudioService (non-user specific).
create table if not exists public.generated_audio (
  id uuid default gen_random_uuid() primary key,
  topic_id text not null,
  text_hash bigint not null,
  url text not null,
  created_at timestamptz default now()
);

create unique index if not exists generated_audio_topic_hash_idx on public.generated_audio (topic_id, text_hash);

alter table public.generated_audio enable row level security;

create policy if not exists "Allow read generated_audio" on public.generated_audio
  for select using (true);

create policy if not exists "Allow insert generated_audio" on public.generated_audio
  for insert with check (true);
