-- Row-level security. "Visibility enforced in SQL/RLS, never client-side"
-- (plan §5). A viewer sees: their own pins, friends' friends|public pins, and
-- anyone's public pins (public only surfaced in explore mode by the app layer).

alter table users        enable row level security;
alter table friendships  enable row level security;
alter table pins         enable row level security;
alter table pin_photos   enable row level security;
alter table top_places   enable row level security;

-- Helper: are auth.uid() and target accepted friends?
create or replace function are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and (
        (f.user_a = least(a, b) and f.user_b = greatest(a, b))
      )
  );
$$;

-- ── users: profiles are world-readable; you can only write your own. ──
create policy users_read_all on users
  for select using (true);
create policy users_write_own on users
  for all using (id = auth.uid()) with check (id = auth.uid());

-- ── friendships: visible to and writable by the two parties. ──
create policy friendships_read on friendships
  for select using (auth.uid() in (user_a, user_b));
create policy friendships_insert on friendships
  for insert with check (auth.uid() = requested_by and auth.uid() in (user_a, user_b));
create policy friendships_update on friendships
  for update using (auth.uid() in (user_a, user_b));
create policy friendships_delete on friendships
  for delete using (auth.uid() in (user_a, user_b));

-- ── pins: the core visibility rule. ──
create policy pins_select on pins
  for select using (
    user_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'friends' and are_friends(auth.uid(), user_id))
  );
create policy pins_write_own on pins
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── pin_photos: inherit the parent pin's visibility. ──
create policy pin_photos_select on pin_photos
  for select using (
    exists (
      select 1 from pins p
      where p.id = pin_photos.pin_id
        and (
          p.user_id = auth.uid()
          or p.visibility = 'public'
          or (p.visibility = 'friends' and are_friends(auth.uid(), p.user_id))
        )
    )
  );
create policy pin_photos_write_own on pin_photos
  for all using (
    exists (select 1 from pins p where p.id = pin_photos.pin_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from pins p where p.id = pin_photos.pin_id and p.user_id = auth.uid())
  );

-- ── top_places: readable if you can read the backing pin; owner writes. ──
create policy top_places_select on top_places
  for select using (
    exists (
      select 1 from pins p
      where p.id = top_places.pin_id
        and (
          p.user_id = auth.uid()
          or p.visibility = 'public'
          or (p.visibility = 'friends' and are_friends(auth.uid(), p.user_id))
        )
    )
  );
create policy top_places_write_own on top_places
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
