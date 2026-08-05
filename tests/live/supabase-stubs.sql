-- Stubs for the schemas a hosted Supabase project provides out of the box,
-- so the FULL migration chain (0001 → 0017) can be applied VERBATIM to an
-- empty local PostgreSQL — the same order `supabase db push` would use.
-- Everything here mirrors real Supabase objects the migrations touch:
--   auth.users, auth.uid(), storage.buckets/objects + storage.foldername(),
--   the anon/authenticated/service_role roles, and the supabase_realtime
--   publication. Nothing else is stubbed; the migrations must provide the
--   rest themselves or fail — that's the point of the test.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ── roles (Supabase creates these on every project) ─────────────────────────
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

-- ── auth schema ─────────────────────────────────────────────────────────────
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Supabase's auth.uid(): the JWT `sub` claim. PostgREST ≥9 exposes claims
-- under request.jwt.claims (JSON); older/manual sessions use the flat GUC.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- ── storage schema ──────────────────────────────────────────────────────────
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable
as $$ select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1] $$;

-- ── realtime publication (Supabase creates this) ────────────────────────────
do $$ begin
  create publication supabase_realtime;
exception when duplicate_object then null; end $$;

-- ── grants matching Supabase defaults ───────────────────────────────────────
grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
