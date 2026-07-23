-- Linked social accounts on profiles, and creator applications.

alter table public.profiles
  add column if not exists socials jsonb not null default '{}'::jsonb;

create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  activities text[] not null default '{}',
  link text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.creator_applications enable row level security;

-- You can submit and see your own application; only service role reviews.
create policy "creator_applications_insert_own" on public.creator_applications
  for insert with check (auth.uid() = user_id);
create policy "creator_applications_select_own" on public.creator_applications
  for select using (auth.uid() = user_id);
