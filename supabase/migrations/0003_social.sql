-- Likes and saves ("favorite for later"). One row per user per pin; counts are
-- aggregates over pin_likes.

create table if not exists pin_likes (
  pin_id      uuid not null references pins (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (pin_id, user_id)
);

create table if not exists pin_saves (
  pin_id      uuid not null references pins (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (pin_id, user_id)
);

alter table pin_likes enable row level security;
alter table pin_saves enable row level security;

-- You can like/save any pin you're allowed to see; rows are readable wherever
-- the underlying pin is readable (so like counts respect pin visibility).
drop policy if exists pin_likes_select on pin_likes;
create policy pin_likes_select on pin_likes
  for select using (
    exists (
      select 1 from pins p
      where p.id = pin_likes.pin_id
        and (
          p.user_id = auth.uid()
          or p.visibility = 'public'
          or (p.visibility = 'friends' and are_friends(auth.uid(), p.user_id))
        )
    )
  );
drop policy if exists pin_likes_insert on pin_likes;
create policy pin_likes_insert on pin_likes
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from pins p
      where p.id = pin_likes.pin_id
        and (
          p.user_id = auth.uid()
          or p.visibility = 'public'
          or (p.visibility = 'friends' and are_friends(auth.uid(), p.user_id))
        )
    )
  );
drop policy if exists pin_likes_delete on pin_likes;
create policy pin_likes_delete on pin_likes
  for delete using (user_id = auth.uid());

-- Saves are private to the saver.
drop policy if exists pin_saves_select on pin_saves;
create policy pin_saves_select on pin_saves
  for select using (user_id = auth.uid());
drop policy if exists pin_saves_insert on pin_saves;
create policy pin_saves_insert on pin_saves
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from pins p
      where p.id = pin_saves.pin_id
        and (
          p.user_id = auth.uid()
          or p.visibility = 'public'
          or (p.visibility = 'friends' and are_friends(auth.uid(), p.user_id))
        )
    )
  );
drop policy if exists pin_saves_delete on pin_saves;
create policy pin_saves_delete on pin_saves
  for delete using (user_id = auth.uid());
