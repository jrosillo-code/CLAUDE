-- Planned trips: ordered stops stitched by a thread on the map. Trips are
-- never public — visibility is friends-or-private only.

alter table trips
  add column visibility visibility not null default 'private'
    check (visibility in ('friends', 'private'));

create table trip_stops (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips (id) on delete cascade,
  geog        geography(point, 4326) not null,
  place_name  text,
  sort_order  int not null default 0
);

create index trip_stops_trip_ix on trip_stops (trip_id, sort_order);

alter table trips enable row level security;
alter table trip_stops enable row level security;

create policy trips_select on trips
  for select using (
    user_id = auth.uid()
    or (visibility = 'friends' and are_friends(auth.uid(), user_id))
  );
create policy trips_write_own on trips
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy trip_stops_select on trip_stops
  for select using (
    exists (
      select 1 from trips t
      where t.id = trip_stops.trip_id
        and (
          t.user_id = auth.uid()
          or (t.visibility = 'friends' and are_friends(auth.uid(), t.user_id))
        )
    )
  );
create policy trip_stops_write_own on trip_stops
  for all using (
    exists (select 1 from trips t where t.id = trip_stops.trip_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from trips t where t.id = trip_stops.trip_id and t.user_id = auth.uid())
  );
