-- RLS assertions for scout_notes (0018) and field_reports (0019). Runs after
-- setup.sql, the reflections suite, and the two verbatim migrations. Same
-- personas: alice = owner · bob = accepted friend · carol = stranger.
-- The reflections suite deleted alice's pin at its end, so this file makes
-- its own pin and starts a fresh _results ledger.

\set ON_ERROR_STOP on
\set alice '00000000-0000-0000-0000-00000000000a'
\set bob   '00000000-0000-0000-0000-00000000000b'
\set carol '00000000-0000-0000-0000-00000000000c'

reset role;
create unlogged table if not exists _results (name text not null, pass boolean not null);
grant select, insert on _results to authenticated;
delete from _results;
create or replace function ok(pass boolean, name text) returns void
language sql as $$
  insert into _results (name, pass) values (name, coalesce(pass, false));
$$;
grant execute on function ok(boolean, text) to authenticated;

-- The reflections suite ends by unfriending alice and bob; restore the
-- accepted friendship this suite's personas assume.
insert into friendships (user_a, user_b, status, requested_by)
  values (:'alice', :'bob', 'accepted', :'alice')
  on conflict (user_a, user_b) do update set status = 'accepted';

-- alice's pin, friends-only (the default). The harness pins table has no RLS
-- of its own; the policies under test consult it the way production does.
insert into pins (id, user_id, place_name, visibility) values
  ('44444444-4444-4444-4444-444444444444', :'alice', 'Teide', 'friends');

-- ── S. Scout notes ──────────────────────────────────────────────────────────

set role authenticated;
select set_config('request.jwt.claim.sub', :'alice', false);

-- S1: owner writes a scout note on her own pin.
insert into scout_notes (pin_id, user_id, bearing_deg, focal_mm, time_of_day, note)
values ('44444444-4444-4444-4444-444444444444', :'alice', 250, 24, 'golden_pm', 'Shoot from the caldera rim.');
select ok(
  (select count(*) from scout_notes where pin_id = '44444444-4444-4444-4444-444444444444') = 1,
  'S1 owner writes a scout note on her pin');

-- S2: an accepted friend can read it (the pin is friends-visible).
select set_config('request.jwt.claim.sub', :'bob', false);
select ok(
  (select count(*) from scout_notes where pin_id = '44444444-4444-4444-4444-444444444444') = 1,
  'S2 friend reads the note on a friends pin');

-- S3: a stranger cannot.
select set_config('request.jwt.claim.sub', :'carol', false);
select ok(
  (select count(*) from scout_notes where pin_id = '44444444-4444-4444-4444-444444444444') = 0,
  'S3 stranger cannot read the note on a friends pin');

-- S4: the note follows the pin to private — even the friend loses it.
reset role;
update pins set visibility = 'private' where id = '44444444-4444-4444-4444-444444444444';
set role authenticated;
select set_config('request.jwt.claim.sub', :'bob', false);
select ok(
  (select count(*) from scout_notes where pin_id = '44444444-4444-4444-4444-444444444444') = 0,
  'S4 private pin hides its note from friends');

-- S5: and follows it to public — the stranger can now read it.
reset role;
update pins set visibility = 'public' where id = '44444444-4444-4444-4444-444444444444';
set role authenticated;
select set_config('request.jwt.claim.sub', :'carol', false);
select ok(
  (select count(*) from scout_notes where pin_id = '44444444-4444-4444-4444-444444444444') = 1,
  'S5 public pin shows its note to a stranger');

-- S6: a friend cannot plant a note on someone else's pin, under either identity.
reset role;
update pins set visibility = 'friends' where id = '44444444-4444-4444-4444-444444444444';
insert into pins (id, user_id, place_name, visibility) values
  ('55555555-5555-5555-5555-555555555555', :'alice', 'Ohrid', 'friends');
set role authenticated;
select set_config('request.jwt.claim.sub', :'bob', false);
do $$
begin
  begin
    insert into scout_notes (pin_id, user_id, note)
    values ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-00000000000b', 'planted');
    perform ok(false, 'S6a friend cannot note a pin he does not own');
  exception when insufficient_privilege or check_violation then
    perform ok(true, 'S6a friend cannot note a pin he does not own');
  end;
  begin
    insert into scout_notes (pin_id, user_id, note)
    values ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-00000000000a', 'spoofed');
    perform ok(false, 'S6b friend cannot write as the owner');
  exception when insufficient_privilege or check_violation then
    perform ok(true, 'S6b friend cannot write as the owner');
  end;
end $$;

-- S7: unfriending revokes the read.
reset role;
delete from friendships where user_a = :'alice' and user_b = :'bob';
set role authenticated;
select set_config('request.jwt.claim.sub', :'bob', false);
select ok(
  (select count(*) from scout_notes where pin_id = '44444444-4444-4444-4444-444444444444') = 0,
  'S7 unfriending revokes the note');
reset role;
insert into friendships (user_a, user_b, status, requested_by) values (:'alice', :'bob', 'accepted', :'alice');

-- S8: deleting the pin removes its note.
delete from pins where id = '55555555-5555-5555-5555-555555555555';
delete from pins where id = '44444444-4444-4444-4444-444444444444';
select ok(
  (select count(*) from scout_notes where pin_id = '44444444-4444-4444-4444-444444444444') = 0,
  'S8 deleting the pin cascades to its note');

-- ── R. Field reports ────────────────────────────────────────────────────────

reset role;
insert into pins (id, user_id, place_name, visibility) values
  ('66666666-6666-6666-6666-666666666666', :'alice', 'Teide', 'friends');
set role authenticated;
select set_config('request.jwt.claim.sub', :'alice', false);

-- R1: owner files a friends-visible report anchored to her pin.
-- (status 'complete': after 0020 a fresh report is a draft, owner-only)
insert into field_reports (id, user_id, pin_id, country_code, flown_on, outcome, drone_class, quote, visibility, status)
values ('77777777-7777-7777-7777-777777777771', :'alice', '66666666-6666-6666-6666-666666666666',
        'ES', '2026-05-02', 'flew', 'sub-250 g', 'Rangers waved, nobody minded before 9am.', 'friends', 'complete');
select ok((select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777771') = 1,
  'R1 owner files a report');

-- R2: friend reads a friends report; R3: stranger cannot.
select set_config('request.jwt.claim.sub', :'bob', false);
select ok((select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777771') = 1,
  'R2 friend reads a friends report');
select set_config('request.jwt.claim.sub', :'carol', false);
select ok((select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777771') = 0,
  'R3 stranger cannot read a friends report');

-- R4: a public report is readable by a stranger — and by nobody at all (anon).
select set_config('request.jwt.claim.sub', :'alice', false);
insert into field_reports (id, user_id, country_code, flown_on, outcome, quote, visibility, status)
values ('77777777-7777-7777-7777-777777777772', :'alice', 'ES', '2026-05-03', 'refused', 'Park office said no without a permit.', 'public', 'complete');
select set_config('request.jwt.claim.sub', :'carol', false);
select ok((select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777772') = 1,
  'R4a stranger reads a public report');
select set_config('request.jwt.claim.sub', '', false);
select ok((select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777772') = 1,
  'R4b anonymous reads a public report (the /fly pages)');
select ok((select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777771') = 0,
  'R4c anonymous cannot read a friends report');

-- R5: a private report is owner-only.
select set_config('request.jwt.claim.sub', :'alice', false);
insert into field_reports (id, user_id, country_code, flown_on, outcome, quote, visibility)
values ('77777777-7777-7777-7777-777777777773', :'alice', 'ES', '2026-05-04', 'did_not_try', 'Too windy, never unpacked.', 'private');
select set_config('request.jwt.claim.sub', :'bob', false);
select ok((select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777773') = 0,
  'R5 private report hidden from friends');

-- R6: no impersonation; R7: no anchoring to someone else's pin.
do $$
begin
  begin
    insert into field_reports (user_id, country_code, flown_on, outcome, quote)
    values ('00000000-0000-0000-0000-00000000000a', 'ES', '2026-05-05', 'flew', 'forged');
    perform ok(false, 'R6 friend cannot file a report as the owner');
  exception when insufficient_privilege or check_violation then
    perform ok(true, 'R6 friend cannot file a report as the owner');
  end;
  begin
    insert into field_reports (user_id, pin_id, country_code, flown_on, outcome, quote)
    values ('00000000-0000-0000-0000-00000000000b', '66666666-6666-6666-6666-666666666666', 'ES', '2026-05-05', 'flew', 'hijacked anchor');
    perform ok(false, 'R7 friend cannot anchor a report to a pin he does not own');
  exception when insufficient_privilege or check_violation then
    perform ok(true, 'R7 friend cannot anchor a report to a pin he does not own');
  end;
end $$;

-- R8: unfriending revokes friends reports.
reset role;
delete from friendships where user_a = :'alice' and user_b = :'bob';
set role authenticated;
select set_config('request.jwt.claim.sub', :'bob', false);
select ok((select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777771') = 0,
  'R8 unfriending revokes a friends report');
reset role;
insert into friendships (user_a, user_b, status, requested_by) values (:'alice', :'bob', 'accepted', :'alice');

-- R9: deleting the anchored pin keeps the report and clears the anchor.
delete from pins where id = '66666666-6666-6666-6666-666666666666';
select ok(
  (select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777771' and pin_id is null) = 1,
  'R9 deleting a pin detaches its report (kept, anchor nulled)');

-- R11: drafts are owner-only whatever their visibility; publishing opens them.
set role authenticated;
select set_config('request.jwt.claim.sub', :'alice', false);
insert into field_reports (id, user_id, country_code, flown_on, outcome, quote, visibility, status)
values ('77777777-7777-7777-7777-777777777774', :'alice', 'ES', '2026-05-06', 'flew', 'Draft words, not yet public.', 'public', 'draft');
select set_config('request.jwt.claim.sub', :'bob', false);
select ok((select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777774') = 0,
  'R11a a public-visibility draft is invisible to a friend');
select set_config('request.jwt.claim.sub', '', false);
select ok((select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777774') = 0,
  'R11b a public-visibility draft is invisible to anonymous readers');
select set_config('request.jwt.claim.sub', :'alice', false);
select ok((select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777774') = 1,
  'R11c the owner sees her own draft');
update field_reports set status = 'complete' where id = '77777777-7777-7777-7777-777777777774';
select set_config('request.jwt.claim.sub', '', false);
select ok((select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777774') = 1,
  'R11d publishing makes it readable');

-- R12: the default visibility is private, the default status is draft.
select set_config('request.jwt.claim.sub', :'alice', false);
insert into field_reports (id, user_id, country_code, flown_on, outcome, quote)
values ('77777777-7777-7777-7777-777777777775', :'alice', 'ES', '2026-05-07', 'flew', 'Defaults only.');
select ok(
  (select visibility::text || '/' || status from field_reports where id = '77777777-7777-7777-7777-777777777775') = 'private/draft',
  'R12 a report defaults to private and draft');

-- R10: only the owner can delete a report.
set role authenticated;
select set_config('request.jwt.claim.sub', :'bob', false);
delete from field_reports where id = '77777777-7777-7777-7777-777777777772';
reset role;
select ok((select count(*) from field_reports where id = '77777777-7777-7777-7777-777777777772') = 1,
  'R10 a friend cannot delete the owner''s report');

-- ── Report ──────────────────────────────────────────────────────────────────

select case when pass then 'ok' else 'NOT OK' end || ' - ' || name as result
from _results order by name;

do $$
declare failed int;
begin
  select count(*) into failed from _results where not pass;
  if failed > 0 then
    raise exception '% field-brief RLS assertion(s) failed', failed;
  end if;
end $$;
