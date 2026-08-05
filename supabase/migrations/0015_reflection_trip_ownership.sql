-- Close a write gap in 0013: trip_reflections_write_own checked who owns the
-- REFLECTION but never who owns the TRIP. Since trip_id is an unconstrained FK
-- (and FK validation bypasses RLS), any authenticated user could insert a row
-- pointing at someone else's trip with their own user_id and visibility
-- 'public'. The quote surfaces select purely on trip_id, so those planted
-- answers would render as evidence cards on a stranger's trip.
--
-- Rewritten here rather than edited in 0013 so projects that already applied
-- 0013 pick the fix up. Idempotent: safe to re-run.

drop policy if exists trip_reflections_write_own on trip_reflections;

create policy trip_reflections_write_own on trip_reflections
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from trips t
      where t.id = trip_reflections.trip_id
        and t.user_id = auth.uid()
    )
  );

-- Same reasoning one level down: an answer may only be written when its
-- parent reflection belongs to the caller AND sits on the caller's own trip.
drop policy if exists reflection_answers_write_own on reflection_answers;

create policy reflection_answers_write_own on reflection_answers
  for all
  using (
    exists (
      select 1 from trip_reflections r
      where r.id = reflection_answers.reflection_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from trip_reflections r
      join trips t on t.id = r.trip_id
      where r.id = reflection_answers.reflection_id
        and r.user_id = auth.uid()
        and t.user_id = auth.uid()
    )
  );
