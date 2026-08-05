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
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');
drop policy if exists "avatars_owner_write" on storage.objects;
create policy "avatars_owner_write" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "pin_media_public_read" on storage.objects;
create policy "pin_media_public_read" on storage.objects
  for select using (bucket_id = 'pin-media');
drop policy if exists "pin_media_owner_write" on storage.objects;
create policy "pin_media_owner_write" on storage.objects
  for insert with check (bucket_id = 'pin-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "pin_media_owner_delete" on storage.objects;
create policy "pin_media_owner_delete" on storage.objects
  for delete using (bucket_id = 'pin-media' and (storage.foldername(name))[1] = auth.uid()::text);
