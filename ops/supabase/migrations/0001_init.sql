-- Operaciones con IA para corredurías y asesorías: schema and row-level security.
--
-- Tenancy: every business row carries firm_id. A person sees a firm's rows only
-- through a membership. The activity log is append-only for everyone except
-- the service role. Approvals can be decided only by a member of the firm.
-- Server-side code uses the service role and is the only writer for most
-- tables; members read, and decide approvals.

create extension if not exists pgcrypto;

create type firm_kind as enum ('correduria', 'asesoria');
create type channel as enum ('upload', 'email', 'whatsapp');
create type document_status as enum ('received', 'extracted', 'validated', 'awaiting_approval', 'approved', 'rejected', 'failed');
create type approval_action as enum ('send_draft', 'write_system');
create type approval_status as enum ('pending', 'approved', 'rejected');
create type task_owner as enum ('firm', 'client');
create type task_status as enum ('open', 'done');
create type member_role as enum ('owner', 'staff');

create table firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind firm_kind not null,
  monthly_token_budget bigint not null default 2000000,
  created_at timestamptz not null default now()
);

create table memberships (
  firm_id uuid not null references firms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (firm_id, user_id)
);

create table inbound_messages (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  channel channel not null,
  from_address text not null,
  received_at timestamptz not null default now(),
  subject text,
  text text,
  external_id text,
  attachments jsonb not null default '[]'::jsonb,
  unique (firm_id, external_id)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  inbound_message_id uuid references inbound_messages (id) on delete set null,
  client_ref text,
  storage_path text not null,
  file_name text not null,
  media_type text not null,
  sha256 text not null,
  status document_status not null default 'received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_firm_created on documents (firm_id, created_at desc);

create table extractions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  document_id uuid not null references documents (id) on delete cascade,
  kind text not null,
  kind_confidence numeric not null,
  data jsonb not null,
  usage jsonb,
  created_at timestamptz not null default now()
);
create index extractions_document on extractions (document_id, created_at desc);

create table validations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  extraction_id uuid not null references extractions (id) on delete cascade,
  document_id uuid not null references documents (id) on delete cascade,
  ok boolean not null,
  issues jsonb not null default '[]'::jsonb,
  missing jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index validations_document on validations (document_id, created_at desc);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  document_id uuid not null references documents (id) on delete cascade,
  title text not null,
  detail text not null default '',
  owner task_owner not null,
  status task_status not null default 'open',
  created_at timestamptz not null default now()
);
create index tasks_firm_open on tasks (firm_id, status);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  document_id uuid not null references documents (id) on delete cascade,
  channel channel not null check (channel in ('email', 'whatsapp')),
  to_address text not null,
  subject text,
  body text not null,
  usage jsonb,
  created_at timestamptz not null default now()
);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  document_id uuid not null references documents (id) on delete cascade,
  action approval_action not null,
  draft_id uuid references drafts (id) on delete set null,
  status approval_status not null default 'pending',
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  -- A decision must name who decided and when; a pending row must not.
  check ((status = 'pending' and decided_by is null and decided_at is null)
      or (status <> 'pending' and decided_by is not null and decided_at is not null))
);
create index approvals_firm_pending on approvals (firm_id, status);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  at timestamptz not null default now(),
  actor jsonb not null,
  action text not null,
  entity jsonb not null,
  usage jsonb,
  detail jsonb
);
create index activity_firm_at on activity_log (firm_id, at desc);

create table monthly_usage (
  firm_id uuid not null references firms (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  tokens bigint not null default 0,
  cost_usd numeric not null default 0,
  primary key (firm_id, month)
);

create table expected_receipts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  insurer text not null,
  policy_number text not null,
  receipt_number text,
  premium numeric not null,
  expected_commission numeric not null,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  holder text,
  created_at timestamptz not null default now()
);
create index expected_receipts_lookup on expected_receipts (firm_id, insurer, period);

create table reconciliations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references firms (id) on delete cascade,
  document_id uuid not null references documents (id) on delete cascade,
  insurer text,
  period text,
  summary jsonb not null,
  unpaid_eur numeric not null default 0,
  mismatch_eur numeric not null default 0,
  usage jsonb,
  created_at timestamptz not null default now()
);

-- Atomic usage increment used by the server.
create or replace function add_monthly_usage(p_firm uuid, p_month text, p_tokens bigint, p_cost numeric)
returns void language sql security definer set search_path = public as $$
  insert into monthly_usage (firm_id, month, tokens, cost_usd)
  values (p_firm, p_month, p_tokens, p_cost)
  on conflict (firm_id, month) do update
    set tokens = monthly_usage.tokens + excluded.tokens,
        cost_usd = monthly_usage.cost_usd + excluded.cost_usd;
$$;

-- ── Row-level security ──────────────────────────────────────────────────────

create or replace function is_member(p_firm uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships m where m.firm_id = p_firm and m.user_id = auth.uid());
$$;

alter table firms enable row level security;
alter table memberships enable row level security;
alter table inbound_messages enable row level security;
alter table documents enable row level security;
alter table extractions enable row level security;
alter table validations enable row level security;
alter table tasks enable row level security;
alter table drafts enable row level security;
alter table approvals enable row level security;
alter table activity_log enable row level security;
alter table monthly_usage enable row level security;
alter table expected_receipts enable row level security;
alter table reconciliations enable row level security;

-- Members read their firm. Writes to business tables come from the server
-- (service role bypasses RLS), so no insert/update policies exist for members
-- except where a person acts: deciding approvals, closing tasks.
create policy firms_member_read on firms for select using (is_member(id));
create policy memberships_self_read on memberships for select using (user_id = auth.uid() or is_member(firm_id));
create policy inbound_member_read on inbound_messages for select using (is_member(firm_id));
create policy documents_member_read on documents for select using (is_member(firm_id));
create policy extractions_member_read on extractions for select using (is_member(firm_id));
create policy validations_member_read on validations for select using (is_member(firm_id));
create policy tasks_member_read on tasks for select using (is_member(firm_id));
create policy tasks_member_close on tasks for update using (is_member(firm_id)) with check (is_member(firm_id));
create policy drafts_member_read on drafts for select using (is_member(firm_id));
create policy approvals_member_read on approvals for select using (is_member(firm_id));
-- A member may decide a pending approval of their firm, and only as themself.
create policy approvals_member_decide on approvals for update
  using (is_member(firm_id) and status = 'pending')
  with check (is_member(firm_id) and status <> 'pending' and decided_by = auth.uid());
create policy activity_member_read on activity_log for select using (is_member(firm_id));
-- Append-only: members may add entries about their own firm; nobody updates or deletes.
create policy activity_member_append on activity_log for insert with check (is_member(firm_id));
create policy usage_member_read on monthly_usage for select using (is_member(firm_id));
create policy receipts_member_read on expected_receipts for select using (is_member(firm_id));
create policy reconciliations_member_read on reconciliations for select using (is_member(firm_id));

-- Storage bucket for originals; server-only access.
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
  on conflict (id) do nothing;
