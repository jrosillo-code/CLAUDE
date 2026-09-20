-- Trust: leave, report, block.
--
-- 1. delete_my_account(): a person can erase themselves. Deleting the
--    auth.users row cascades into public.users and from there into pins,
--    photos, trips, reflections, notes and reports (every table hangs off
--    users(id) on delete cascade). Storage objects under their folder are
--    removed by the client before it calls this.
-- 2. content_reports: anyone signed in can report a pin they can see;
--    nobody but the operator reads the queue (no select policy at all —
--    the dashboard and the service role see it, PostgREST never does).
-- 3. blocks: one row per person you never want to see or be seen by. The
--    pins policy excludes both directions, so a block is enforced by the
--    database, not just hidden by the client.

-- ── 1. account deletion ─────────────────────────────────────────────────────
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ── 2. reports ──────────────────────────────────────────────────────────────
create table if not exists public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users (id) on delete cascade,
  pin_id      uuid references public.pins (id) on delete set null,
  user_id     uuid references public.users (id) on delete set null,
  reason      text not null check (reason in ('not_a_real_place', 'harassment', 'private_info', 'explicit', 'spam', 'other')),
  note        text not null default '' check (char_length(note) <= 500),
  created_at  timestamptz not null default now()
);
create index if not exists content_reports_created_idx on public.content_reports (created_at desc);
alter table public.content_reports enable row level security;
drop policy if exists content_reports_insert on public.content_reports;
create policy content_reports_insert on public.content_reports
  for insert with check (reporter_id = auth.uid());
-- deliberately no select/update/delete policy for app roles

-- ── 3. blocks ───────────────────────────────────────────────────────────────
create table if not exists public.blocks (
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;
drop policy if exists blocks_own on public.blocks;
create policy blocks_own on public.blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- Either direction of a block hides the pin. security definer so the check
-- reads the other person's block row, which their RLS would otherwise hide.
create or replace function public.blocked_either_way(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;
revoke all on function public.blocked_either_way(uuid, uuid) from public;
grant execute on function public.blocked_either_way(uuid, uuid) to authenticated, anon;

drop policy if exists pins_select on public.pins;
create policy pins_select on public.pins
  for select using (
    user_id = auth.uid()
    or (
      not public.blocked_either_way(auth.uid(), user_id)
      and (
        visibility = 'public'
        or (visibility = 'friends' and are_friends(auth.uid(), user_id))
      )
    )
  );

-- A block ends any friendship; done here so it cannot be forgotten by a client.
create or replace function public.on_block_unfriend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.friendships
  where user_a = least(new.blocker_id, new.blocked_id)
    and user_b = greatest(new.blocker_id, new.blocked_id);
  return new;
end;
$$;
drop trigger if exists blocks_unfriend on public.blocks;
create trigger blocks_unfriend after insert on public.blocks
  for each row execute function public.on_block_unfriend();
