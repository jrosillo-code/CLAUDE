-- Linked social accounts on profiles, and creator applications.
-- (The profile table in this schema is `users` — see 0001.)

alter table public.users
  add column if not exists socials jsonb not null default '{}'::jsonb;

-- Replaces the unused v2 stub from 0001.
drop table if exists public.creator_apps;

create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  activities text[] not null default '{}',
  link text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.creator_applications enable row level security;

-- You can submit, update, and see your own application; service role reviews.
create policy "creator_applications_insert_own" on public.creator_applications
  for insert with check (auth.uid() = user_id);
create policy "creator_applications_update_own" on public.creator_applications
  for update using (auth.uid() = user_id);
create policy "creator_applications_select_own" on public.creator_applications
  for select using (auth.uid() = user_id);
