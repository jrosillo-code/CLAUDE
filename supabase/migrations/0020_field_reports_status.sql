-- Field reports gain a draft/complete status and a private default, matching
-- the outline: drafts are owner-only whatever their visibility, and a report
-- reaches friends or the public only once its author has marked it complete
-- — the same contract as debriefs (0013). A separate migration because 0019
-- may already be applied; both are idempotent and safe in either order.

alter table field_reports
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'complete'));

alter table field_reports alter column visibility set default 'private';

-- Existing rows: there was no way to say "draft" before 0020, so every row
-- that exists at migration time was published on purpose. Mark them complete
-- exactly once, guarded by a marker so a re-run never republishes real drafts.
do $$
begin
  if not exists (select 1 from pg_description d join pg_class c on c.oid = d.objoid
                 where c.relname = 'field_reports' and d.description = 'status backfilled by 0020') then
    update field_reports set status = 'complete';
    comment on table field_reports is 'status backfilled by 0020';
  end if;
end $$;

drop policy if exists field_reports_select on field_reports;
create policy field_reports_select on field_reports
  for select using (
    user_id = auth.uid()
    or (
      status = 'complete'
      and (
        visibility = 'public'
        or (visibility = 'friends' and are_friends(auth.uid(), user_id))
      )
    )
  );

create index if not exists field_reports_country_public_ix
  on field_reports (country_code, flown_on desc)
  where status = 'complete' and visibility = 'public';
