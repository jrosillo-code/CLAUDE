-- Realtime, incrementally. The client now patches one pin, one like count or
-- one notification per event instead of reloading the world, so it also
-- needs to hear about photo changes (a pin edit that only swaps media never
-- touches the pins row) and blocks (which hide pins in both directions).
do $$ begin
  alter publication supabase_realtime add table public.pin_photos;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.blocks;
exception when duplicate_object then null; end $$;
