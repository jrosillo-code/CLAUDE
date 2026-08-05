-- Four tables from 0001 never had row-level security turned on: follows,
-- posts, activities and pin_activities. 0002_rls.sql enabled it table by
-- table and simply didn't reach them.
--
-- Why that matters on Supabase specifically: the public schema grants full
-- DML to the anon and authenticated roles by default, and RLS is the ONLY
-- thing standing between those grants and the data. A table without it is
-- readable and writable by anyone holding the publishable key — no account
-- needed. For `follows` that means the follow graph could be read wholesale
-- and anyone could insert or delete anyone else's follows.
--
-- Idempotent: safe to re-run.

-- ── follows: the one the app actually uses ──────────────────────────────────
-- lib/backend.ts reads `creator_id where follower_id = me` and inserts/deletes
-- exactly those rows, so "you own the rows where you are the follower" covers
-- current usage completely. Deliberately NOT granting creators a read of their
-- own follower rows: nothing needs it today (users.follower_count is a stored
-- column, not an aggregate over this table), and if a real follower list is
-- built later it should arrive as a security-definer aggregate the way
-- reflection_citation_counts() did — count without identities.

alter table follows enable row level security;

drop policy if exists follows_select_own on follows;
create policy follows_select_own on follows
  for select using (follower_id = auth.uid());

drop policy if exists follows_insert_own on follows;
create policy follows_insert_own on follows
  for insert with check (follower_id = auth.uid());

drop policy if exists follows_delete_own on follows;
create policy follows_delete_own on follows
  for delete using (follower_id = auth.uid());

-- ── posts / activities / pin_activities: v2 schema hooks, no app code ───────
-- These were created in 0001 "schema now, feature later" and nothing reads or
-- writes them yet. Enabling RLS with no policies is default-deny: unreachable
-- from the client, still fully available to service_role and to migrations.
-- Whoever builds these features writes the policies alongside them, which is
-- the right time to decide what they should be.

alter table posts enable row level security;
alter table activities enable row level security;
alter table pin_activities enable row level security;
