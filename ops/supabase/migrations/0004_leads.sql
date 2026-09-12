-- Contact requests from the website. Server-only: no member policies.
create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  firm text,
  kind text check (kind in ('correduria', 'asesoria', 'otro')),
  message text not null,
  source text not null default 'web',
  ip_hash text,
  created_at timestamptz not null default now()
);
create index leads_created on leads (created_at desc);
alter table leads enable row level security;
