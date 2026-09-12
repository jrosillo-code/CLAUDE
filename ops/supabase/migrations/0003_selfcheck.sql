-- Catalog helper for the deployment self-check: which public tables lack RLS.
-- Security definer so the service role can call it through PostgREST; it
-- exposes table names only.
create or replace function tables_without_rls()
returns setof text language sql stable security definer set search_path = public as $$
  select t.tablename::text from pg_tables t
  where t.schemaname = 'public'
    and not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t.tablename and c.relrowsecurity
    );
$$;
revoke all on function tables_without_rls() from public;
grant execute on function tables_without_rls() to service_role;
