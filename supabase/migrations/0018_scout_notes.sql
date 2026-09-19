-- Scout notes: photographic scouting details on a pin, one to one. There is
-- no visibility column on purpose — a note inherits its pin's: whoever may
-- see the pin may see the note, nobody else. Enforced here, not client-side.
-- Idempotent: safe to re-run.

create table if not exists scout_notes (
  pin_id       uuid primary key references pins (id) on delete cascade,
  user_id      uuid not null references users (id) on delete cascade,
  bearing_deg  smallint check (bearing_deg is null or bearing_deg between 0 and 359),
  focal_mm     smallint check (focal_mm is null or focal_mm > 0),
  camera       text not null default '',
  drone        text not null default '',
  time_of_day  text check (time_of_day is null or time_of_day in ('dawn', 'golden_am', 'day', 'golden_pm', 'blue', 'night')),
  note         text not null default '' check (length(note) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists scout_notes_user_ix on scout_notes (user_id);

alter table scout_notes enable row level security;

-- Read: exactly the pin's own visibility rule (owner / public / friends).
drop policy if exists scout_notes_select on scout_notes;
create policy scout_notes_select on scout_notes
  for select using (
    exists (
      select 1 from pins p
      where p.id = scout_notes.pin_id
        and (
          p.user_id = auth.uid()
          or p.visibility = 'public'
          or (p.visibility = 'friends' and are_friends(auth.uid(), p.user_id))
        )
    )
  );

-- Write: your own row, on your own pin. The pin check matters: pin_id is an
-- FK and FK checks bypass RLS, so without it anyone could hang a note on a
-- stranger's pin (same fix as 0015 for reflections).
drop policy if exists scout_notes_write_own on scout_notes;
create policy scout_notes_write_own on scout_notes
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from pins p where p.id = scout_notes.pin_id and p.user_id = auth.uid())
  );
