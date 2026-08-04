-- RLS test harness prerequisites. This file recreates ONLY what migration
-- 0013_reflections.sql depends on, faithfully to the real migrations:
--   - the `visibility` enum        (0001_init.sql)
--   - users / friendships / pins / trips, minimal columns (0001, 0005)
--   - are_friends(), verbatim      (0002_rls.sql)
--   - Supabase's auth.uid() shim, matching its real GUC-based definition
-- The reflections migration itself is applied VERBATIM afterwards — the
-- policies under test are the exact SQL that ships to production.

create type visibility as enum ('public', 'friends', 'private');

create table users (
  id uuid primary key
);

create table friendships (
  user_a uuid not null references users (id) on delete cascade,
  user_b uuid not null references users (id) on delete cascade,
  status text not null default 'pending',
  requested_by uuid not null,
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  place_name text not null default '',
  visibility visibility not null default 'friends'
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  title text not null default '',
  visibility visibility not null default 'friends' check (visibility in ('friends', 'private'))
);

-- auth.uid() shim — same mechanism Supabase uses (JWT claim via GUC).
create schema auth;
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- are_friends, verbatim from 0002_rls.sql.
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

-- The `authenticated` role: not a table owner, so RLS applies to it — the
-- same posture PostgREST queries run under in Supabase.
create role authenticated nologin;
grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Fixed identities for the scenarios.
--   alice: reflection owner   bob: accepted friend   carol: stranger
insert into users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');

insert into friendships (user_a, user_b, status, requested_by) values
  ('00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-00000000000b',
   'accepted',
   '00000000-0000-0000-0000-00000000000a');

insert into trips (id, user_id, title) values
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-00000000000a',
   'Silver Coast run');

insert into pins (id, user_id, place_name) values
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-00000000000a',
   'Sintra');
