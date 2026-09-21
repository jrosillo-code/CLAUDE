-- The person who was blocked may read that row (only that row, and only
-- read it). Without this, Supabase Realtime never delivers the block event
-- to them, so pins the blocker had already sent to their screen stayed
-- there until a reload. Now both sides hear the change and reload.
drop policy if exists blocks_own on public.blocks;
create policy blocks_write_own on public.blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
drop policy if exists blocks_read_either on public.blocks;
create policy blocks_read_either on public.blocks
  for select using (blocker_id = auth.uid() or blocked_id = auth.uid());
