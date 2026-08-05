-- After applying 0001→0014 verbatim to an empty database: assert the schema
-- objects the app depends on actually exist — tables, enum, indexes,
-- constraints, triggers, RLS policies, and realtime publication membership.

\set ON_ERROR_STOP on

do $$
declare
  missing text := '';
  check_row record;
begin
  for check_row in
    select * from (values
      -- tables
      ('table trip_reflections',
        (select count(*) from pg_tables where schemaname = 'public' and tablename = 'trip_reflections') = 1),
      ('table reflection_answers',
        (select count(*) from pg_tables where schemaname = 'public' and tablename = 'reflection_answers') = 1),
      -- enum + column uses it
      ('visibility enum exists',
        (select count(*) from pg_type where typname = 'visibility') = 1),
      ('trip_reflections.visibility uses enum',
        (select atttypid::regtype::text from pg_attribute
          where attrelid = 'public.trip_reflections'::regclass and attname = 'visibility') = 'visibility'),
      ('trips.completed_on exists',
        (select count(*) from information_schema.columns
          where table_name = 'trips' and column_name = 'completed_on') = 1),
      -- constraints
      ('one debrief per trip+user',
        (select count(*) from pg_constraint
          where conrelid = 'public.trip_reflections'::regclass and contype = 'u') >= 1),
      ('answers unique per question',
        (select count(*) from pg_constraint
          where conrelid = 'public.reflection_answers'::regclass and contype = 'u') >= 1),
      ('answer question_id check',
        (select count(*) from pg_constraint
          where conrelid = 'public.reflection_answers'::regclass and contype = 'c'
            and pg_get_constraintdef(oid) like '%question_id%') >= 1),
      ('pin anchor is ON DELETE SET NULL',
        (select confdeltype from pg_constraint
          where conrelid = 'public.reflection_answers'::regclass and contype = 'f'
            and confrelid = 'public.pins'::regclass) = 'n'),
      ('reflection FK cascades from trips',
        (select confdeltype from pg_constraint
          where conrelid = 'public.trip_reflections'::regclass and contype = 'f'
            and confrelid = 'public.trips'::regclass) = 'c'),
      -- indexes
      ('answers index',
        (select count(*) from pg_indexes
          where tablename = 'reflection_answers' and indexname = 'reflection_answers_reflection_ix') = 1),
      ('reflections user index',
        (select count(*) from pg_indexes
          where tablename = 'trip_reflections' and indexname = 'trip_reflections_user_ix') = 1),
      -- RLS on + policies present
      ('RLS enabled on trip_reflections',
        (select relrowsecurity from pg_class where oid = 'public.trip_reflections'::regclass)),
      ('RLS enabled on reflection_answers',
        (select relrowsecurity from pg_class where oid = 'public.reflection_answers'::regclass)),
      ('reflection select policy',
        (select count(*) from pg_policies
          where tablename = 'trip_reflections' and policyname = 'trip_reflections_select') = 1),
      ('reflection write policy',
        (select count(*) from pg_policies
          where tablename = 'trip_reflections' and policyname = 'trip_reflections_write_own') = 1),
      ('answers select policy',
        (select count(*) from pg_policies
          where tablename = 'reflection_answers' and policyname = 'reflection_answers_select') = 1),
      ('answers write policy',
        (select count(*) from pg_policies
          where tablename = 'reflection_answers' and policyname = 'reflection_answers_write_own') = 1),
      -- triggers that back the client's write model
      ('signup trigger on auth.users',
        (select count(*) from pg_trigger
          where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created') = 1),
      ('geog sync trigger on pins',
        (select count(*) from pg_trigger
          where tgrelid = 'public.pins'::regclass and tgname = 'pins_sync_geog') = 1),
      -- realtime publication membership (0012 + 0014)
      ('trip_reflections in realtime publication',
        (select count(*) from pg_publication_tables
          where pubname = 'supabase_realtime' and tablename = 'trip_reflections') = 1),
      ('reflection_answers in realtime publication',
        (select count(*) from pg_publication_tables
          where pubname = 'supabase_realtime' and tablename = 'reflection_answers') = 1),
      ('trips in realtime publication',
        (select count(*) from pg_publication_tables
          where pubname = 'supabase_realtime' and tablename = 'trips') = 1)
    ) as checks(name, pass)
  loop
    if check_row.pass is distinct from true then
      missing := missing || E'\n  MISSING/WRONG: ' || check_row.name;
    else
      raise notice 'ok - %', check_row.name;
    end if;
  end loop;
  if missing <> '' then
    raise exception 'catalog assertions failed:%', missing;
  end if;
end $$;
