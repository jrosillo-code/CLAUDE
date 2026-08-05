-- Synthetic accounts and data for the live-stack test. NEVER real user data.
-- alice owns a completed trip with pins; bob is her accepted friend; carol is
-- a stranger. auth.users rows exercise the 0008 handle_new_user trigger —
-- public.users profiles must appear the same way a hosted signup creates
-- them. Pins/stops write lng/lat and rely on the 0008 trigger to derive
-- geog, exactly like the JS client does.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@synthetic.test'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@synthetic.test'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@synthetic.test');

-- friendships stores the pair ordered (user_a < user_b).
insert into friendships (user_a, user_b, status, requested_by) values
  ('00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-00000000000b',
   'accepted',
   '00000000-0000-0000-0000-00000000000a');

insert into pins (id, user_id, lng, lat, place_name, country_code, title, note, visibility, rating)
values
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-00000000000a',
   -9.3902, 38.7979, 'Sintra', 'PT', 'Sintra day', 'Palaces in the fog.', 'friends', 7),
  ('22222222-2222-2222-2222-222222222223',
   '00000000-0000-0000-0000-00000000000a',
   -9.4175, 38.9636, 'Ericeira', 'PT', 'Ericeira surf', 'Clean lines.', 'friends', 9);

insert into trips (id, user_id, title, visibility, completed_on) values
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-00000000000a',
   'Silver Coast run', 'friends', now());

insert into trip_stops (id, trip_id, lng, lat, place_name, sort_order) values
  ('11111111-1111-1111-1111-11111111a001',
   '11111111-1111-1111-1111-111111111111',
   -9.4175, 38.9636, 'Ericeira', 0),
  ('11111111-1111-1111-1111-11111111a002',
   '11111111-1111-1111-1111-111111111111',
   -9.3812, 39.3558, 'Peniche', 1);
