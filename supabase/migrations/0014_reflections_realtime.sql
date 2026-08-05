-- 0014: reflections go live.
--
-- Adds the debrief tables to the supabase_realtime publication so
-- subscribers hear about changes without a manual reload. Two properties
-- keep this safe:
--
--   1. postgres_changes events are RLS-scoped per subscriber — a user whose
--      RLS view excludes a row (a draft, a private debrief, a stranger's
--      friends-only debrief) receives no event for it. Supabase evaluates
--      the subscriber's claims against the table's RLS on every event.
--   2. The client never renders event payloads. It reacts by reloading the
--      whole world AS THE VIEWER (debounced), so what appears after an event
--      is exactly what a fresh load would show — including *disappearance*:
--      a visibility tightening or an unfriending emits an UPDATE/DELETE the
--      subscriber may not even be allowed to see the row for anymore, but
--      the reload it triggers removes the evidence everywhere at once.
--
-- The full refresh therefore remains the authority; realtime is only the
-- trigger that makes it prompt. See docs/reflections.md.
--
-- Each block is idempotent (safe to re-run).

do $$ begin
  alter publication supabase_realtime add table public.trip_reflections;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.reflection_answers;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.trips;
exception when duplicate_object then null; end $$;
