-- 0012: turn on realtime broadcasts.
--
-- The app has subscribed to live changes since the backend shipped
-- (lib/backend.ts subscribeRealtime: notifications, friendships, pins,
-- pin_likes → debounced world reload), but Supabase only emits
-- postgres_changes for tables that are members of the supabase_realtime
-- publication — and no migration ever added them. This is why friend
-- requests / accepts / new pins only showed up after a manual reload.
--
-- Events are still RLS-scoped per subscriber, and the client reacts by
-- reloading the world as the viewer, so nothing leaks: accepting a friend
-- request makes the friend's pins appear because the reload now sees them.
--
-- Each block is idempotent (safe to re-run).

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.friendships;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.pins;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.pin_likes;
exception when duplicate_object then null; end $$;
