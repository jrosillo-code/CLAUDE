-- Post-chain assertions: after applying every migration to an empty database,
-- does the schema actually contain what the app queries at runtime?
--
-- The list below is derived from lib/backend.ts — every table it selects from,
-- every rpc it calls, every storage bucket it uploads to — plus the realtime
-- publication membership the live subscriptions in lib/store.ts depend on.
-- A migration that silently no-ops (e.g. a `create table if not exists` that
-- ran against the wrong schema) still applies cleanly; this is what notices.

\set ON_ERROR_STOP on

create unlogged table _results (name text not null, pass boolean not null);

create function ok(pass boolean, name text) returns void
language sql as $$
  insert into _results (name, pass) values (name, coalesce(pass, false));
$$;

-- ── Tables lib/backend.ts reads or writes ───────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'users', 'pins', 'pin_photos', 'pin_likes', 'pin_saves', 'top_places',
    'follows', 'friendships', 'creator_applications', 'notifications',
    'trips', 'trip_stops', 'trip_reflections', 'reflection_answers',
    'reflection_citations'
  ] loop
    perform ok(
      exists (select 1 from pg_tables where schemaname = 'public' and tablename = t),
      format('table public.%s exists', t));
  end loop;
end $$;

-- ── RLS is the privacy boundary ─────────────────────────────────────────────
-- Checked over EVERY table in public, not a hand-kept list. Supabase grants the
-- anon and authenticated roles full DML on the public schema by default, so a
-- table that merely forgets `enable row level security` is world-readable and
-- world-writable to anyone holding the publishable key. The blast radius of an
-- omission is total, and an omission looks like nothing at all in the diff —
-- which is exactly why this asserts over the catalog instead of a list.

do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename not like '\_%'          -- this harness's own _results
      -- PostGIS installs spatial_ref_sys into public and owns it; it is static
      -- reference data (EPSG definitions), and a Supabase project cannot alter
      -- it without superuser anyway. Not ours to secure.
      and tablename <> 'spatial_ref_sys'
  loop
    perform ok(
      (select relrowsecurity from pg_class
        where oid = format('public.%I', t)::regclass),
      format('RLS enabled on public.%s', t));
  end loop;
end $$;

-- reflection_citations is write-only by design: viewers insert, nobody selects.
-- If a select policy ever appears, authors could see WHO read their debrief.
select ok(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'reflection_citations'
      and cmd in ('SELECT', 'ALL')) = 0,
  'reflection_citations has no select policy (write-only by design)');

-- ── Functions the policies and the client depend on ─────────────────────────

select ok(
  to_regprocedure('public.are_friends(uuid, uuid)') is not null,
  'are_friends(uuid, uuid) exists');
select ok(
  to_regprocedure('public.reflection_citation_counts()') is not null,
  'reflection_citation_counts() exists');
select ok(
  (select prosecdef from pg_proc
    where oid = 'public.reflection_citation_counts()'::regprocedure),
  'reflection_citation_counts() is security definer');
select ok(
  'search_path=public' = any (
    select unnest(proconfig) from pg_proc
    where oid = 'public.reflection_citation_counts()'::regprocedure),
  'reflection_citation_counts() pins its search_path');

-- ── Realtime: lib/store.ts subscribes to postgres_changes on these ──────────

do $$
declare t text;
begin
  foreach t in array array[
    'notifications', 'friendships', 'pins', 'pin_likes',
    'trips', 'trip_reflections', 'reflection_answers'
  ] loop
    perform ok(
      exists (select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t),
      format('%s is in the supabase_realtime publication', t));
  end loop;
end $$;

-- ── Storage buckets the uploads target ──────────────────────────────────────

do $$
declare b text;
begin
  foreach b in array array['avatars', 'pin-media'] loop
    perform ok(
      exists (select 1 from storage.buckets where id = b),
      format('storage bucket %s exists', b));
  end loop;
end $$;

-- ── Report ──────────────────────────────────────────────────────────────────

select case when pass then 'ok' else 'NOT OK' end || ' - ' || name as result
from _results order by name;

do $$
declare failed int;
begin
  select count(*) into failed from _results where not pass;
  if failed > 0 then
    raise exception '% migration assertion(s) failed', failed;
  end if;
end $$;
