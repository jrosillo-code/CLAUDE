-- "Helped N×" — the payoff of writing a debrief, made real.
--
-- The count used to be derived from the reader's own device log, so an author
-- could never see it: you don't read your own quotes. This records a citation
-- server-side, once per (reflection, viewer, surface), when a friend's debrief
-- actually does work for someone.
--
-- Privacy shape, deliberately asymmetric:
--   · viewers write their own rows and can read nothing back
--   · authors read only an aggregate through reflection_citation_counts()
-- So an author learns THAT their words helped, never WHO was reading. Nothing
-- here stores text — the row is three ids and a surface label.

create table if not exists reflection_citations (
  reflection_id uuid not null references trip_reflections (id) on delete cascade,
  viewer_id     uuid not null references users (id) on delete cascade,
  -- Where the words did work. One count per surface, per viewer, forever:
  -- re-reading a friend's answer must not inflate their number.
  surface       text not null check (surface in ('ask', 'place', 'dontmiss', 'clone')),
  created_at    timestamptz not null default now(),
  primary key (reflection_id, viewer_id, surface)
);

create index if not exists reflection_citations_reflection_ix
  on reflection_citations (reflection_id);

alter table reflection_citations enable row level security;

-- Insert only your own citation, only for a debrief you can actually see, and
-- never for your own words. The visibility clause matters: without it this
-- table would be an oracle for probing which private reflections exist.
drop policy if exists reflection_citations_insert_own on reflection_citations;
create policy reflection_citations_insert_own on reflection_citations
  for insert
  with check (
    viewer_id = auth.uid()
    and exists (
      select 1 from trip_reflections r
      where r.id = reflection_citations.reflection_id
        and r.user_id <> auth.uid()
        and r.status = 'complete'
        and (
          r.visibility = 'public'
          or (r.visibility = 'friends' and are_friends(auth.uid(), r.user_id))
        )
    )
  );

-- No select policy on purpose: RLS denies by default, so not even the author
-- can read the rows. Counts come from the function below.

create or replace function reflection_citation_counts()
returns table (rid uuid, citations bigint)
language sql
security definer
set search_path = public
stable
as $$
  select c.reflection_id, count(*)::bigint
  from reflection_citations c
  join trip_reflections r on r.id = c.reflection_id
  where r.user_id = auth.uid()
  group by c.reflection_id
$$;

revoke all on function reflection_citation_counts() from public;
grant execute on function reflection_citation_counts() to authenticated;
