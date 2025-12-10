
-- Create a simple Key-Value store table for app settings/syllabus
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Enable RLS
alter table app_settings enable row level security;

-- Policy: Allow full access (since this is an admin tool for now, or refine later)
create policy "Allow generic access" on app_settings for all using (true) with check (true);
