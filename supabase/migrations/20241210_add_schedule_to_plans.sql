
alter table study_plans 
add column if not exists schedule jsonb,
add column if not exists last_updated_with_ai timestamp with time zone;
