-- Post-trip debriefs (the 60-second interview). A trip gains a completed_on
-- date; a completed trip can carry one reflection per user, holding up to
-- five verbatim answers. Answers are quoted as evidence in Ask-your-friends
-- and Don't-miss — visibility mirrors pin rules (private / friends / public)
-- and is enforced here, never client-side.

alter table trips add column completed_on timestamptz;

create table trip_reflections (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  visibility  visibility not null default 'friends',
  status      text not null default 'draft' check (status in ('draft', 'complete')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (trip_id, user_id)
);

create table reflection_answers (
  id             uuid primary key default gen_random_uuid(),
  reflection_id  uuid not null references trip_reflections (id) on delete cascade,
  question_id    text not null
    check (question_id in ('favorite', 'dont_miss', 'skip', 'surprise', 'return')),
  -- The question as it was asked and the answer in the user's own words.
  -- Verbatim is the contract: downstream features quote, never paraphrase.
  prompt         text not null,
  text           text not null default '',
  pin_id         uuid references pins (id) on delete set null,
  scale          text check (scale in ('yes', 'maybe', 'no')),
  source         text not null default 'text' check (source in ('text', 'voice')),
  sort_order     int not null default 0,
  unique (reflection_id, question_id)
);

create index reflection_answers_reflection_ix on reflection_answers (reflection_id, sort_order);
create index trip_reflections_user_ix on trip_reflections (user_id);

alter table trip_reflections enable row level security;
alter table reflection_answers enable row level security;

-- Drafts are always owner-only; completed debriefs follow their visibility.
create policy trip_reflections_select on trip_reflections
  for select using (
    user_id = auth.uid()
    or (
      status = 'complete'
      and (
        visibility = 'public'
        or (visibility = 'friends' and are_friends(auth.uid(), user_id))
      )
    )
  );
create policy trip_reflections_write_own on trip_reflections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reflection_answers_select on reflection_answers
  for select using (
    exists (
      select 1 from trip_reflections r
      where r.id = reflection_answers.reflection_id
        and (
          r.user_id = auth.uid()
          or (
            r.status = 'complete'
            and (
              r.visibility = 'public'
              or (r.visibility = 'friends' and are_friends(auth.uid(), r.user_id))
            )
          )
        )
    )
  );
create policy reflection_answers_write_own on reflection_answers
  for all using (
    exists (select 1 from trip_reflections r where r.id = reflection_answers.reflection_id and r.user_id = auth.uid())
  ) with check (
    exists (select 1 from trip_reflections r where r.id = reflection_answers.reflection_id and r.user_id = auth.uid())
  );
