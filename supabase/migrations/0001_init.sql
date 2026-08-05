-- Waypoint v1 schema (with v2 hooks). Postgres + PostGIS on Supabase.
-- Mirrors lib/types.ts. Visibility is enforced here in RLS — never client-side.

create extension if not exists postgis;

-- ─────────────────────────────── enums ───────────────────────────────
-- Every statement in this chain is re-runnable: DEPLOY.md has you paste the
-- files into the dashboard SQL editor by hand, and the one thing you lose
-- track of there is which ones you already ran. Postgres has no
-- `create type if not exists`, hence the do-blocks.
do $$ begin
  create type visibility as enum ('public', 'friends', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type friendship_status as enum ('pending', 'accepted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type score_visibility as enum ('public', 'private'); -- v2
exception when duplicate_object then null; end $$;

-- ─────────────────────────────── users ───────────────────────────────
-- One row per auth user (id references auth.users).
create table if not exists users (
  id                      uuid primary key references auth.users (id) on delete cascade,
  handle                  text unique not null check (handle ~ '^[a-z0-9_]{2,30}$'),
  display_name            text not null,
  avatar_url              text,
  bio                     text default '',
  home_city               text,
  color                   text not null default '#c65d3b',
  default_pin_visibility  visibility not null default 'friends',
  is_creator              boolean not null default false, -- v2
  created_at              timestamptz not null default now()
);

-- ──────────────────────────── friendships ────────────────────────────
-- One row per pair, ids stored ordered (user_a < user_b) to dedupe.
create table if not exists friendships (
  user_a        uuid not null references users (id) on delete cascade,
  user_b        uuid not null references users (id) on delete cascade,
  status        friendship_status not null default 'pending',
  requested_by  uuid not null references users (id),
  created_at    timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

-- ─────────────────────────────── pins ────────────────────────────────
create table if not exists pins (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users (id) on delete cascade,
  geog              geography(point, 4326) not null,
  place_name        text not null,
  place_id          text,            -- geocoder reference
  country_code      text,
  title             text not null,
  note              text default '',
  started_on        date,
  ended_on          date,
  visibility        visibility not null default 'friends',
  score             smallint,                       -- v2 (nullable)
  score_visibility  score_visibility default 'private', -- v2
  trip_id           uuid,                           -- v2
  created_at        timestamptz not null default now()
);

create index if not exists pins_geog_gix    on pins using gist (geog);
create index if not exists pins_user_vis_ix on pins (user_id, visibility);

create table if not exists pin_photos (
  id            uuid primary key default gen_random_uuid(),
  pin_id        uuid not null references pins (id) on delete cascade,
  storage_path  text not null,
  width         int,
  height        int,
  sort_order    int not null default 0
);

-- ───────────────────────────── top_places ────────────────────────────
-- Must be backed by a real pin (plan §9.2). Unique rank per user.
create table if not exists top_places (
  user_id  uuid not null references users (id) on delete cascade,
  rank     smallint not null check (rank between 1 and 5),
  pin_id   uuid not null references pins (id) on delete cascade,
  blurb    text default '',
  primary key (user_id, rank),
  unique (user_id, pin_id)
);

-- ─────────────────────── v2 tables (schema now) ──────────────────────
create table if not exists trips (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  title        text not null,
  cover_photo  text,
  start_date   date,
  end_date     date
);

create table if not exists posts (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references trips (id) on delete cascade,
  type          text not null check (type in ('blog', 'daily_summary')),
  body_md       text default '',
  published_at  timestamptz
);

create table if not exists follows (
  follower_id  uuid not null references users (id) on delete cascade,
  creator_id   uuid not null references users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, creator_id)
);

create table if not exists creator_apps (
  user_id                  uuid primary key references users (id) on delete cascade,
  follower_count_at_apply  int not null,
  status                   text not null default 'pending'
                             check (status in ('pending', 'approved', 'rejected')),
  reviewed_by              uuid references users (id),
  reviewed_at              timestamptz
);

create table if not exists activities (
  id     uuid primary key default gen_random_uuid(),
  slug   text unique not null,   -- surf, mtb, ski...
  label  text not null,
  icon   text
);

create table if not exists pin_activities (
  pin_id       uuid not null references pins (id) on delete cascade,
  activity_id  uuid not null references activities (id) on delete cascade,
  primary key (pin_id, activity_id)
);
