-- Dispatches: a pin dropped while its author is actually there carries a
-- "here now" flag. Visibility is unchanged (the pin's own), so RLS needs no
-- change; the strip in the app shows a flagged pin for 72 hours after its
-- creation and the pin itself stays forever. Idempotent.

alter table pins add column if not exists here_now boolean not null default false;
