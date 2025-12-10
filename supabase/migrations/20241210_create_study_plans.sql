-- Create study_plans table to store user availability and constraints
create table if not exists public.study_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  
  -- Availability in minutes per day
  availability_json jsonb default '{
    "monday": 60,
    "tuesday": 60,
    "wednesday": 60,
    "thursday": 60,
    "friday": 60,
    "saturday": 120,
    "sunday": 0
  }'::jsonb,
  
  goal_date date,
  intensity_level text default 'balanced', -- 'relaxed', 'balanced', 'intense'
  active boolean default true,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table public.study_plans enable row level security;

create policy "Users can view their own plans"
  on public.study_plans for select
  using (auth.uid() = user_id);

create policy "Users can insert their own plans"
  on public.study_plans for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own plans"
  on public.study_plans for update
  using (auth.uid() = user_id);
