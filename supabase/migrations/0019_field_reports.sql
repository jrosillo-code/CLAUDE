-- Field reports: a pilot's first-hand account of trying to fly in a country.
-- The quote is stored verbatim and always shown attributed — never averaged
-- into a verdict, never paraphrased (the debrief contract). Visibility is the
-- pin matrix (private / friends / public); public rows are what the
-- server-rendered /fly/{cc} pages read anonymously.
-- Idempotent: safe to re-run.

create table if not exists field_reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  -- Optional anchor; the report outlives the pin.
  pin_id        uuid references pins (id) on delete set null,
  country_code  text not null check (country_code ~ '^[A-Z]{2}$'),
  flown_on      date not null,
  outcome       text not null check (outcome in ('flew', 'refused', 'fined', 'did_not_try')),
  drone_class   text not null default '' check (length(drone_class) <= 80),
  quote         text not null check (length(quote) between 1 and 1000),
  visibility    visibility not null default 'friends',
  created_at    timestamptz not null default now()
);

create index if not exists field_reports_country_ix on field_reports (country_code, flown_on desc);
create index if not exists field_reports_user_ix on field_reports (user_id);

alter table field_reports enable row level security;

drop policy if exists field_reports_select on field_reports;
create policy field_reports_select on field_reports
  for select using (
    user_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'friends' and are_friends(auth.uid(), user_id))
  );

-- Write: your own row; if it anchors to a pin, the pin must be yours too
-- (FK checks bypass RLS — see 0015).
drop policy if exists field_reports_write_own on field_reports;
create policy field_reports_write_own on field_reports
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      pin_id is null
      or exists (select 1 from pins p where p.id = field_reports.pin_id and p.user_id = auth.uid())
    )
  );
