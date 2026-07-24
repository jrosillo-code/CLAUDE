-- Waypoint: migrations 0002 through 0011 in one paste.
-- Run this ONCE in the Supabase SQL editor (0001 must already be applied).

-- ════════ migrations/0002_rls.sql ════════
-- Row-level security. "Visibility enforced in SQL/RLS, never client-side"
-- (plan §5). A viewer sees: their own pins, friends' friends|public pins, and
-- anyone's public pins (public only surfaced in explore mode by the app layer).

alter table users        enable row level security;
alter table friendships  enable row level security;
alter table pins         enable row level security;
alter table pin_photos   enable row level security;
alter table top_places   enable row level security;

-- Helper: are auth.uid() and target accepted friends?
create or replace function are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and (
        (f.user_a = least(a, b) and f.user_b = greatest(a, b))
      )
  );
$$;

-- ── users: profiles are world-readable; you can only write your own. ──
create policy users_read_all on users
  for select using (true);
create policy users_write_own on users
  for all using (id = auth.uid()) with check (id = auth.uid());

-- ── friendships: visible to and writable by the two parties. ──
create policy friendships_read on friendships
  for select using (auth.uid() in (user_a, user_b));
create policy friendships_insert on friendships
  for insert with check (auth.uid() = requested_by and auth.uid() in (user_a, user_b));
create policy friendships_update on friendships
  for update using (auth.uid() in (user_a, user_b));
create policy friendships_delete on friendships
  for delete using (auth.uid() in (user_a, user_b));

-- ── pins: the core visibility rule. ──
create policy pins_select on pins
  for select using (
    user_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'friends' and are_friends(auth.uid(), user_id))
  );
create policy pins_write_own on pins
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── pin_photos: inherit the parent pin's visibility. ──
create policy pin_photos_select on pin_photos
  for select using (
    exists (
      select 1 from pins p
      where p.id = pin_photos.pin_id
        and (
          p.user_id = auth.uid()
          or p.visibility = 'public'
          or (p.visibility = 'friends' and are_friends(auth.uid(), p.user_id))
        )
    )
  );
create policy pin_photos_write_own on pin_photos
  for all using (
    exists (select 1 from pins p where p.id = pin_photos.pin_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from pins p where p.id = pin_photos.pin_id and p.user_id = auth.uid())
  );

-- ── top_places: readable if you can read the backing pin; owner writes. ──
create policy top_places_select on top_places
  for select using (
    exists (
      select 1 from pins p
      where p.id = top_places.pin_id
        and (
          p.user_id = auth.uid()
          or p.visibility = 'public'
          or (p.visibility = 'friends' and are_friends(auth.uid(), p.user_id))
        )
    )
  );
create policy top_places_write_own on top_places
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ════════ migrations/0003_social.sql ════════
-- Likes and saves ("favorite for later"). One row per user per pin; counts are
-- aggregates over pin_likes.

create table pin_likes (
  pin_id      uuid not null references pins (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (pin_id, user_id)
);

create table pin_saves (
  pin_id      uuid not null references pins (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (pin_id, user_id)
);

alter table pin_likes enable row level security;
alter table pin_saves enable row level security;

-- You can like/save any pin you're allowed to see; rows are readable wherever
-- the underlying pin is readable (so like counts respect pin visibility).
create policy pin_likes_select on pin_likes
  for select using (
    exists (
      select 1 from pins p
      where p.id = pin_likes.pin_id
        and (
          p.user_id = auth.uid()
          or p.visibility = 'public'
          or (p.visibility = 'friends' and are_friends(auth.uid(), p.user_id))
        )
    )
  );
create policy pin_likes_insert on pin_likes
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from pins p
      where p.id = pin_likes.pin_id
        and (
          p.user_id = auth.uid()
          or p.visibility = 'public'
          or (p.visibility = 'friends' and are_friends(auth.uid(), p.user_id))
        )
    )
  );
create policy pin_likes_delete on pin_likes
  for delete using (user_id = auth.uid());

-- Saves are private to the saver.
create policy pin_saves_select on pin_saves
  for select using (user_id = auth.uid());
create policy pin_saves_insert on pin_saves
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from pins p
      where p.id = pin_saves.pin_id
        and (
          p.user_id = auth.uid()
          or p.visibility = 'public'
          or (p.visibility = 'friends' and are_friends(auth.uid(), p.user_id))
        )
    )
  );
create policy pin_saves_delete on pin_saves
  for delete using (user_id = auth.uid());

-- ════════ migrations/0004_media.sql ════════
-- Pins can carry videos as well as photos. pin_photos becomes the general
-- media table: each row is a photo or a video clip in display order.

alter table pin_photos
  add column kind text not null default 'photo'
    check (kind in ('photo', 'video'));

comment on table pin_photos is
  'Pin media (photos and videos), ordered by sort_order. kind distinguishes clips.';

-- ════════ migrations/0005_trips.sql ════════
-- Planned trips: ordered stops stitched by a thread on the map. Trips are
-- never public — visibility is friends-or-private only.

alter table trips
  add column visibility visibility not null default 'private'
    check (visibility in ('friends', 'private'));

create table trip_stops (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips (id) on delete cascade,
  geog        geography(point, 4326) not null,
  place_name  text,
  sort_order  int not null default 0
);

create index trip_stops_trip_ix on trip_stops (trip_id, sort_order);

alter table trips enable row level security;
alter table trip_stops enable row level security;

create policy trips_select on trips
  for select using (
    user_id = auth.uid()
    or (visibility = 'friends' and are_friends(auth.uid(), user_id))
  );
create policy trips_write_own on trips
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy trip_stops_select on trip_stops
  for select using (
    exists (
      select 1 from trips t
      where t.id = trip_stops.trip_id
        and (
          t.user_id = auth.uid()
          or (t.visibility = 'friends' and are_friends(auth.uid(), t.user_id))
        )
    )
  );
create policy trip_stops_write_own on trip_stops
  for all using (
    exists (select 1 from trips t where t.id = trip_stops.trip_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from trips t where t.id = trip_stops.trip_id and t.user_id = auth.uid())
  );

-- ════════ migrations/0006_rating.sql ════════
-- The owner's own 1–10 score for a pin ("rate your own places").
-- Only the pin owner ever writes it; RLS already restricts pin updates to the
-- owner (0002), so no new policies are needed.

alter table public.pins
  add column if not exists rating smallint
  check (rating between 1 and 10);

-- ════════ migrations/0007_socials_creator_applications.sql ════════
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

-- ════════ migrations/0008_backend_wiring.sql ════════
-- Everything the client integration expects that the earlier migrations
-- didn't provide: plain lng/lat columns (the JS client can't read PostGIS
-- geography directly), a few missing columns, automatic profile creation on
-- signup, and the storage buckets for avatars and pin media.

-- ── plain coordinates, kept in sync with geog ────────────────────────────
alter table public.pins
  add column if not exists lng double precision,
  add column if not exists lat double precision,
  add column if not exists activities text[] not null default '{}';
alter table public.pins alter column geog drop not null;

alter table public.trip_stops
  add column if not exists lng double precision,
  add column if not exists lat double precision;
alter table public.trip_stops alter column geog drop not null;

create or replace function public.sync_geog()
returns trigger
language plpgsql
as $$
begin
  if new.lng is not null and new.lat is not null then
    new.geog := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  end if;
  return new;
end;
$$;

drop trigger if exists pins_sync_geog on public.pins;
create trigger pins_sync_geog before insert or update on public.pins
  for each row execute function public.sync_geog();
drop trigger if exists trip_stops_sync_geog on public.trip_stops;
create trigger trip_stops_sync_geog before insert or update on public.trip_stops
  for each row execute function public.sync_geog();

-- Backfill lng/lat for any rows created before this migration.
update public.pins set lng = st_x(geog::geometry), lat = st_y(geog::geometry) where lng is null and geog is not null;
update public.trip_stops set lng = st_x(geog::geometry), lat = st_y(geog::geometry) where lng is null and geog is not null;

-- ── missing columns ──────────────────────────────────────────────────────
alter table public.users
  add column if not exists follower_count int not null default 0,
  add column if not exists activities text[] not null default '{}';
alter table public.trips
  add column if not exists created_at timestamptz not null default now();

-- ── automatic profile on signup ──────────────────────────────────────────
-- Derives a valid unique handle from the email local part.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(split_part(coalesce(new.email, 'traveler'), '@', 1), '[^a-z0-9_]', '', 'g'));
  if length(base) < 2 then base := 'traveler'; end if;
  base := left(base, 24);
  candidate := base;
  while exists (select 1 from public.users u where u.handle = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  insert into public.users (id, handle, display_name)
  values (new.id, candidate, initcap(replace(base, '_', ' ')))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── storage: avatars + pin media ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('pin-media', 'pin-media', true)
on conflict (id) do nothing;

-- Public read; each user writes only under their own folder (path "<uid>/…").
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_owner_write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_owner_update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pin_media_public_read" on storage.objects
  for select using (bucket_id = 'pin-media');
create policy "pin_media_owner_write" on storage.objects
  for insert with check (bucket_id = 'pin-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "pin_media_owner_delete" on storage.objects
  for delete using (bucket_id = 'pin-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ════════ migrations/0009_notifications.sql ════════
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

-- ════════ migrations/0010_trip_collaboration.sql ════════
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
create policy "trip_members_select" on public.trip_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.trips t where t.id = trip_members.trip_id and t.user_id = auth.uid())
  );
create policy "trip_members_owner_write" on public.trip_members
  for all using (
    exists (select 1 from public.trips t where t.id = trip_members.trip_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.trips t where t.id = trip_members.trip_id and t.user_id = auth.uid())
  );

-- Check-ins are visible wherever the trip is visible; you write your own.
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
create policy "trip_checkins_insert_own" on public.trip_checkins
  for insert with check (user_id = auth.uid());

-- ════════ migrations/0011_pin_region.sql ════════
-- Passport regions: pins remember their first-level admin area
-- (state/province/region) from reverse geocoding, so the profile passport can
-- tally regions alongside countries and cities.
alter table public.pins add column if not exists region text;

