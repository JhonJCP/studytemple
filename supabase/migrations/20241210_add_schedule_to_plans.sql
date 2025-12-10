-- Add columns to store the AI generated schedule and metadata
alter table public.study_plans 
add column if not exists schedule jsonb,
add column if not exists ai_metadata jsonb,
add column if not exists last_updated_with_ai timestamp with time zone;
