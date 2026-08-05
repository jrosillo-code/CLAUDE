-- RLS assertions for trip_reflections / reflection_answers (migration 0013).
-- Runs after setup.sql + the verbatim migration. Every check records a row in
-- _results; the runner fails if any check fails or any statement errors.
--
-- Personas: alice = owner · bob = accepted friend · carol = stranger.

\set ON_ERROR_STOP on
\set alice '00000000-0000-0000-0000-00000000000a'
\set bob   '00000000-0000-0000-0000-00000000000b'
\set carol '00000000-0000-0000-0000-00000000000c'

create unlogged table _results (name text not null, pass boolean not null);
grant select, insert on _results to authenticated;

create function ok(pass boolean, name text) returns void
language sql as $$
  insert into _results (name, pass) values (name, coalesce(pass, false));
$$;
grant execute on function ok(boolean, text) to authenticated;

-- Convenience: become a user (RLS applies: authenticated is not table owner).
-- psql has no functions, so each block sets these inline.

-- ── A. Owner lifecycle ──────────────────────────────────────────────────────

set role authenticated;
select set_config('request.jwt.claim.sub', :'alice', false);

-- A1: owner creates a draft debrief.
insert into trip_reflections (id, trip_id, user_id, visibility, status)
values ('33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111', :'alice', 'friends', 'draft');
select ok(
  (select count(*) from trip_reflections where id = '33333333-3333-3333-3333-333333333333') = 1,
  'A1 owner creates draft');

-- A2: owner saves partial progress (first answer).
insert into reflection_answers (reflection_id, question_id, prompt, text, pin_id)
values ('33333333-3333-3333-3333-333333333333', 'dont_miss',
        'What would you tell a friend not to miss?',
        'The sea mist over Sintra at dawn.',
        '22222222-2222-2222-2222-222222222222');
select ok(
  (select count(*) from reflection_answers
    where reflection_id = '33333333-3333-3333-3333-333333333333') = 1,
  'A2 owner saves partial progress');

-- A3: resume "from another session" — fresh claims, draft still reachable.
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.sub', :'alice', false);
select ok(
  (select count(*) from trip_reflections
    where id = '33333333-3333-3333-3333-333333333333' and status = 'draft') = 1,
  'A3 owner resumes draft in a new session');

-- A4: owner completes the debrief.
update trip_reflections set status = 'complete'
  where id = '33333333-3333-3333-3333-333333333333';
select ok(
  (select status from trip_reflections
    where id = '33333333-3333-3333-3333-333333333333') = 'complete',
  'A4 owner completes debrief');

-- A5: owner edits a completed debrief.
update reflection_answers set text = 'The sea mist over Sintra at dawn — go before 8.'
  where reflection_id = '33333333-3333-3333-3333-333333333333';
select ok(
  (select text from reflection_answers
    where reflection_id = '33333333-3333-3333-3333-333333333333') like '%go before 8%',
  'A5 owner edits completed answer');

-- A6: owner changes visibility.
update trip_reflections set visibility = 'private'
  where id = '33333333-3333-3333-3333-333333333333';
select ok(
  (select visibility from trip_reflections
    where id = '33333333-3333-3333-3333-333333333333') = 'private',
  'A6 owner changes visibility');

-- ── B. Draft privacy (reset to draft first) ─────────────────────────────────

update trip_reflections set status = 'draft', visibility = 'public'
  where id = '33333333-3333-3333-3333-333333333333';

select set_config('request.jwt.claim.sub', :'bob', false);
select ok(
  (select count(*) from trip_reflections where id = '33333333-3333-3333-3333-333333333333') = 0,
  'B1 friend cannot see a draft, even at public visibility');
select ok(
  (select count(*) from reflection_answers
    where reflection_id = '33333333-3333-3333-3333-333333333333') = 0,
  'B2 friend cannot see draft answers');

select set_config('request.jwt.claim.sub', :'carol', false);
select ok(
  (select count(*) from trip_reflections where id = '33333333-3333-3333-3333-333333333333') = 0,
  'B3 stranger cannot see a draft');

-- ── C. Completed visibility matrix ──────────────────────────────────────────

select set_config('request.jwt.claim.sub', :'alice', false);
update trip_reflections set status = 'complete', visibility = 'private'
  where id = '33333333-3333-3333-3333-333333333333';

select set_config('request.jwt.claim.sub', :'bob', false);
select ok(
  (select count(*) from trip_reflections where id = '33333333-3333-3333-3333-333333333333') = 0,
  'C1 private: friend sees nothing');

select set_config('request.jwt.claim.sub', :'alice', false);
select ok(
  (select count(*) from trip_reflections where id = '33333333-3333-3333-3333-333333333333') = 1,
  'C2 private: owner still sees it');

update trip_reflections set visibility = 'friends'
  where id = '33333333-3333-3333-3333-333333333333';

select set_config('request.jwt.claim.sub', :'bob', false);
select ok(
  (select count(*) from trip_reflections where id = '33333333-3333-3333-3333-333333333333') = 1,
  'C3 friends: accepted friend sees it');
select ok(
  (select count(*) from reflection_answers
    where reflection_id = '33333333-3333-3333-3333-333333333333') = 1,
  'C4 friends: accepted friend sees the answers');

select set_config('request.jwt.claim.sub', :'carol', false);
select ok(
  (select count(*) from trip_reflections where id = '33333333-3333-3333-3333-333333333333') = 0,
  'C5 friends: stranger sees nothing');

select set_config('request.jwt.claim.sub', :'alice', false);
update trip_reflections set visibility = 'public'
  where id = '33333333-3333-3333-3333-333333333333';

select set_config('request.jwt.claim.sub', :'carol', false);
select ok(
  (select count(*) from trip_reflections where id = '33333333-3333-3333-3333-333333333333') = 1,
  'C6 public: stranger can read it');

-- ── D. Write protection ─────────────────────────────────────────────────────

-- D1/D2: a friend's UPDATE/DELETE silently matches zero rows (RLS using-filter).
select set_config('request.jwt.claim.sub', :'bob', false);
update trip_reflections set visibility = 'private'
  where id = '33333333-3333-3333-3333-333333333333';
delete from reflection_answers
  where reflection_id = '33333333-3333-3333-3333-333333333333';
update reflection_answers set text = 'vandalized'
  where reflection_id = '33333333-3333-3333-3333-333333333333';
delete from trip_reflections where id = '33333333-3333-3333-3333-333333333333';

reset role;
select ok(
  (select visibility from trip_reflections
    where id = '33333333-3333-3333-3333-333333333333') = 'public',
  'D1 friend cannot change another user''s visibility');
select ok(
  (select count(*) from reflection_answers
    where reflection_id = '33333333-3333-3333-3333-333333333333'
      and text not like '%vandalized%') = 1,
  'D2 friend cannot edit or delete another user''s answers');

-- D3: friend cannot INSERT a reflection as someone else (with-check violation).
set role authenticated;
select set_config('request.jwt.claim.sub', :'bob', false);
do $$
begin
  insert into trip_reflections (trip_id, user_id)
  values ('11111111-1111-1111-1111-111111111111',
          '00000000-0000-0000-0000-00000000000a');
  perform ok(false, 'D3 impersonated reflection insert is rejected');
exception when others then
  perform ok(true, 'D3 impersonated reflection insert is rejected');
end $$;

-- D4: friend cannot INSERT answers into someone else's reflection.
do $$
begin
  insert into reflection_answers (reflection_id, question_id, prompt, text)
  values ('33333333-3333-3333-3333-333333333333', 'skip', 'x', 'planted answer');
  perform ok(false, 'D4 planting answers in another debrief is rejected');
exception when others then
  perform ok(true, 'D4 planting answers in another debrief is rejected');
end $$;

-- D5: a friend cannot attach their OWN debrief to someone else's trip.
-- The reflection is honestly owned (user_id = the caller), so the owner check
-- alone passes; only the trip-ownership check in 0015 stops it. Without that,
-- the planted debrief renders as quote cards on Alice's trip, because the
-- quote surfaces select on trip_id.
do $$
begin
  insert into trip_reflections (trip_id, user_id, visibility, status)
  values ('11111111-1111-1111-1111-111111111111',
          '00000000-0000-0000-0000-00000000000b',
          'public', 'complete');
  perform ok(false, 'D5 debrief on someone else''s trip is rejected');
exception when others then
  perform ok(true, 'D5 debrief on someone else''s trip is rejected');
end $$;

-- ── D6-D9. Citations: authors learn THAT they helped, never WHO ─────────────
-- Bob is Alice's friend here and Alice's debrief 3333… is friends-visible.
do $$
begin
  insert into reflection_citations (reflection_id, viewer_id, surface)
  values ('33333333-3333-3333-3333-333333333333',
          '00000000-0000-0000-0000-00000000000b', 'ask');
  perform ok(true, 'D6 friend can cite a visible debrief');
exception when others then
  perform ok(false, 'D6 friend can cite a visible debrief');
end $$;

-- A citation must be attributable to the caller, not planted as someone else.
do $$
begin
  insert into reflection_citations (reflection_id, viewer_id, surface)
  values ('33333333-3333-3333-3333-333333333333',
          '00000000-0000-0000-0000-00000000000a', 'place');
  perform ok(false, 'D7 citing as another viewer is rejected');
exception when others then
  perform ok(true, 'D7 citing as another viewer is rejected');
end $$;

-- Nobody reads the rows — not even the author. Counts come from the function.
select ok(
  (select count(*) from reflection_citations) = 0,
  'D8 citation rows are unreadable, even to a friend who wrote one'
);

select set_config('request.jwt.claim.sub', :'alice', false);
select ok(
  (select count(*) from reflection_citations) = 0,
  'D9 the author cannot read who cited them'
);
select ok(
  (select citations from reflection_citation_counts()
    where rid = '33333333-3333-3333-3333-333333333333') = 1,
  'D10 the author does see the aggregate count'
);
select set_config('request.jwt.claim.sub', :'bob', false);

-- ── E. Unfriending revokes friends-only access ──────────────────────────────

select set_config('request.jwt.claim.sub', :'alice', false);
update trip_reflections set visibility = 'friends'
  where id = '33333333-3333-3333-3333-333333333333';

reset role;
delete from friendships
  where user_a = '00000000-0000-0000-0000-00000000000a'
    and user_b = '00000000-0000-0000-0000-00000000000b';

set role authenticated;
select set_config('request.jwt.claim.sub', :'bob', false);
select ok(
  (select count(*) from trip_reflections where id = '33333333-3333-3333-3333-333333333333') = 0,
  'E1 removed friend loses friends-only access');
select ok(
  (select count(*) from reflection_answers
    where reflection_id = '33333333-3333-3333-3333-333333333333') = 0,
  'E2 removed friend loses answer access too');

-- ── F. Cascade / cleanup ────────────────────────────────────────────────────

reset role;

-- F1: deleting the anchored pin keeps the answer, clears the anchor.
delete from pins where id = '22222222-2222-2222-2222-222222222222';
select ok(
  (select count(*) from reflection_answers
    where reflection_id = '33333333-3333-3333-3333-333333333333' and pin_id is null) = 1,
  'F1 deleting a pin detaches answers (kept, anchor nulled)');

-- F2: deleting the trip removes the debrief and its answers.
delete from trips where id = '11111111-1111-1111-1111-111111111111';
select ok(
  (select count(*) from trip_reflections where id = '33333333-3333-3333-3333-333333333333') = 0,
  'F2 deleting a trip removes its debrief');
select ok(
  (select count(*) from reflection_answers
    where reflection_id = '33333333-3333-3333-3333-333333333333') = 0,
  'F3 deleting a trip removes the debrief answers');

-- ── Report ──────────────────────────────────────────────────────────────────

select case when pass then 'ok' else 'NOT OK' end || ' - ' || name as result
from _results order by name;

do $$
declare failed int;
begin
  select count(*) into failed from _results where not pass;
  if failed > 0 then
    raise exception '% RLS assertion(s) failed', failed;
  end if;
end $$;
