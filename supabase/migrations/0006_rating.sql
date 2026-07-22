-- The owner's own 1–10 score for a pin ("rate your own places").
-- Only the pin owner ever writes it; RLS already restricts pin updates to the
-- owner (0002), so no new policies are needed.

alter table public.pins
  add column if not exists rating smallint
  check (rating between 1 and 10);
