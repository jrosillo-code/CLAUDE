-- Schema groundwork for collaborative and live trips (UI lands later):
-- trip_members lets a trip owner invite co-editors; trip_checkins power
-- "live trip mode" — advancing your needle along the thread while traveling.

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  invited_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.trip_checkins (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  stop_id uuid references public.trip_stops (id) on delete set null,
  lng double precision,
  lat double precision,
  note text default '',
  created_at timestamptz not null default now()
);

alter table public.trip_members enable row level security;
alter table public.trip_checkins enable row level security;

-- Members are visible to the trip owner and the members themselves; only the
-- owner manages membership.
drop policy if exists "trip_members_select" on public.trip_members;
create policy "trip_members_select" on public.trip_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.trips t where t.id = trip_members.trip_id and t.user_id = auth.uid())
  );
drop policy if exists "trip_members_owner_write" on public.trip_members;
create policy "trip_members_owner_write" on public.trip_members
  for all using (
    exists (select 1 from public.trips t where t.id = trip_members.trip_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips t where t.id = trip_members.trip_id and t.user_id = auth.uid())
  );

-- Check-ins are visible wherever the trip is visible; you write your own.
drop policy if exists "trip_checkins_select" on public.trip_checkins;
create policy "trip_checkins_select" on public.trip_checkins
  for select using (
    exists (
      select 1 from public.trips t
      where t.id = trip_checkins.trip_id
        and (
          t.user_id = auth.uid()
          or (t.visibility = 'friends' and are_friends(auth.uid(), t.user_id))
          or exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid())
        )
    )
  );
drop policy if exists "trip_checkins_insert_own" on public.trip_checkins;
create policy "trip_checkins_insert_own" on public.trip_checkins
  for insert with check (user_id = auth.uid());
