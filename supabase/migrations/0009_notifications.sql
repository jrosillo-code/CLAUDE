-- In-app notifications: someone liked your pin, sent you a friend request,
-- or accepted yours. Recipients read/mark-read their own rows; any signed-in
-- user can insert a notification they are the actor of.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  actor_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('like', 'friend_request', 'friend_accept')),
  pin_id uuid references public.pins (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_ix on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id);
create policy "notifications_insert_as_actor" on public.notifications
  for insert with check (auth.uid() = actor_id and user_id <> actor_id);
