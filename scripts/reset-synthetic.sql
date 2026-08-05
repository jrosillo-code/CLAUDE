-- Safe reset for the SYNTHETIC preview environment. Wipes user data, keeps
-- schema, policies and buckets. Refuses to run if anything looks like a
-- non-synthetic account (any auth user whose email is not *@synthetic.test).
--
-- The guard runs INSIDE the same transaction as the wipe, on purpose: psql
-- does not stop on error by default, so a guard in its own statement would
-- print "REFUSING RESET" and then truncate everything anyway. Raising inside
-- the transaction aborts it, so the destructive statements below can never
-- commit against a project that holds real accounts.
--
-- Usage (preview project only):
--   psql -v ON_ERROR_STOP=1 "$SUPABASE_DB_URL" -f scripts/reset-synthetic.sql
-- or paste into the Supabase SQL editor of the DISPOSABLE project.

begin;

do $$
declare
  real_accounts int;
begin
  -- A NULL email counts as real: phone/OAuth-only accounts have no address
  -- to vouch for them, and a project made of those must never be wiped here.
  select count(*) into real_accounts
  from auth.users
  where email is null
     or email not like '%@synthetic.test';
  if real_accounts > 0 then
    raise exception
      'REFUSING RESET: % account(s) do not look synthetic (expected *@synthetic.test). This is not the disposable project.',
      real_accounts;
  end if;
end $$;

-- Order-independent thanks to cascades; truncate the roots.
truncate table
  public.reflection_answers,
  public.trip_reflections,
  public.trip_checkins,
  public.trip_members,
  public.trip_stops,
  public.trips,
  public.pin_photos,
  public.pin_activities,
  public.pin_likes,
  public.pin_saves,
  public.top_places,
  public.posts,
  public.notifications,
  public.follows,
  public.friendships,
  public.creator_applications,
  public.creator_apps,
  public.pins,
  public.users
  restart identity cascade;
-- NOTE: public.activities is a reference table (activity slugs) seeded by
-- the migrations — it is user-independent and deliberately NOT truncated.

delete from storage.objects where bucket_id in ('avatars', 'pin-media');
delete from auth.users;

commit;

-- Re-seed afterwards with tests/live/synthetic-seed.sql (adjust as needed),
-- or let testers sign up fresh through the app.
