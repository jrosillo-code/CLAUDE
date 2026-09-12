-- Harness prerequisites for the verbatim migration: Supabase's auth schema
-- (users table + auth.uid() reading the JWT claim GUC), a storage.buckets
-- shim, and the `authenticated` role PostgREST queries run under.
create schema auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean not null default false);

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;
grant usage on schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
