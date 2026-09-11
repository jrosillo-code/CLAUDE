-- Corrections (the accuracy signal) and the job queue.

create type job_status as enum ('queued', 'running', 'done', 'failed');

create table corrections (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  document_id uuid not null references documents (id) on delete cascade,
  extraction_id uuid references extractions (id) on delete set null,
  field text not null,
  old_value jsonb,
  new_value jsonb,
  user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create index corrections_firm_created on corrections (firm_id, created_at desc);
create index corrections_document on corrections (document_id);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status job_status not null default 'queued',
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_claim on jobs (status, run_after) where status = 'queued';

-- Atomic claim: marks up to p_limit due jobs as running and returns them.
-- SKIP LOCKED lets several workers drain the queue without double-running.
create or replace function claim_jobs(p_limit int)
returns setof jobs language sql security definer set search_path = public as $$
  with due as (
    select id from jobs
    where status = 'queued' and run_after <= now()
    order by run_after
    limit p_limit
    for update skip locked
  )
  update jobs j set status = 'running', attempts = j.attempts + 1, updated_at = now()
  from due where j.id = due.id
  returning j.*;
$$;

alter table corrections enable row level security;
alter table jobs enable row level security;

-- Members see and add corrections for their firm, as themselves; never edit or delete.
create policy corrections_member_read on corrections for select using (is_member(firm_id));
create policy corrections_member_insert on corrections for insert
  with check (is_member(firm_id) and user_id = auth.uid());
-- Jobs are server-only: no member policies at all.
