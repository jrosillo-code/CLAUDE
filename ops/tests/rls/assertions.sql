-- Runs after the verbatim migration. Two firms, two users; user A is a member
-- of firm A only. Every assertion runs as `authenticated` with A's JWT.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

insert into auth.users (id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into firms (id, name, kind) values
  ('10000000-0000-0000-0000-000000000001', 'Firm A', 'correduria'),
  ('10000000-0000-0000-0000-000000000002', 'Firm B', 'asesoria');
insert into memberships (firm_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'owner');
insert into documents (id, firm_id, storage_path, file_name, media_type, sha256) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'a/1', 'a.pdf', 'application/pdf', 'x'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'b/1', 'b.pdf', 'application/pdf', 'y');
insert into approvals (id, firm_id, document_id, action) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'write_system'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'write_system');
insert into activity_log (id, firm_id, actor, action, entity) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '{"type":"system"}', 'document.received', '{"type":"document","id":"x"}');

create or replace function assert_true(cond boolean, label text) returns void language plpgsql as $$
begin
  if not cond then raise exception 'ASSERTION FAILED: %', label; end if;
  raise notice 'ok: %', label;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

select assert_true((select count(*) from firms) = 1, 'member sees only own firm');
select assert_true((select count(*) from documents) = 1, 'member sees only own firm documents');
select assert_true((select count(*) from documents where firm_id = '10000000-0000-0000-0000-000000000002') = 0, 'other firm documents invisible');
select assert_true((select count(*) from approvals) = 1, 'member sees only own firm approvals');
select assert_true((select count(*) from activity_log) = 1, 'member sees own firm activity');

-- Cannot insert documents (server-only).
do $$ begin
  begin
    insert into documents (firm_id, storage_path, file_name, media_type, sha256)
      values ('10000000-0000-0000-0000-000000000001', 'a/2', 'c.pdf', 'application/pdf', 'z');
    raise exception 'ASSERTION FAILED: member inserted a document';
  exception when insufficient_privilege then raise notice 'ok: member cannot insert documents';
  end;
end $$;

-- Cannot decide another firm's approval (row invisible, so zero rows updated).
update approvals set status = 'approved', decided_by = '00000000-0000-0000-0000-00000000000a', decided_at = now()
  where id = '30000000-0000-0000-0000-000000000002';
select assert_true((select status from approvals where id = '30000000-0000-0000-0000-000000000002') is null, 'cannot decide other firm approval');

-- Cannot decide as someone else.
do $$ begin
  begin
    update approvals set status = 'approved', decided_by = '00000000-0000-0000-0000-00000000000b', decided_at = now()
      where id = '30000000-0000-0000-0000-000000000001';
    raise exception 'ASSERTION FAILED: member decided as another user';
  exception when insufficient_privilege then raise notice 'ok: cannot decide as another user';
  end;
end $$;

-- Can decide own firm's pending approval as self.
update approvals set status = 'approved', decided_by = '00000000-0000-0000-0000-00000000000a', decided_at = now()
  where id = '30000000-0000-0000-0000-000000000001';
select assert_true((select status::text from approvals where id = '30000000-0000-0000-0000-000000000001') = 'approved', 'member decides own firm approval');

-- Cannot re-decide (no longer pending).
update approvals set status = 'rejected', decided_by = '00000000-0000-0000-0000-00000000000a', decided_at = now()
  where id = '30000000-0000-0000-0000-000000000001';
select assert_true((select status::text from approvals where id = '30000000-0000-0000-0000-000000000001') = 'approved', 'decided approval cannot be re-decided');

-- Activity log: append yes, update/delete no.
insert into activity_log (firm_id, actor, action, entity) values ('10000000-0000-0000-0000-000000000001', '{"type":"user"}', 'note', '{"type":"x","id":"y"}');
select assert_true((select count(*) from activity_log) = 2, 'member appends to activity log');
do $$ begin
  begin
    update activity_log set action = 'tampered' where id = '40000000-0000-0000-0000-000000000001';
    if (select action from activity_log where id = '40000000-0000-0000-0000-000000000001') = 'tampered' then
      raise exception 'ASSERTION FAILED: activity log was updated';
    end if;
    raise notice 'ok: activity log update has no effect';
  exception when insufficient_privilege then raise notice 'ok: activity log update denied';
  end;
end $$;
delete from activity_log where id = '40000000-0000-0000-0000-000000000001';
select assert_true((select count(*) from activity_log where id = '40000000-0000-0000-0000-000000000001') = 1, 'activity log delete has no effect');
-- Cannot append to another firm's log.
do $$ begin
  begin
    insert into activity_log (firm_id, actor, action, entity) values ('10000000-0000-0000-0000-000000000002', '{"type":"user"}', 'note', '{"type":"x","id":"y"}');
    raise exception 'ASSERTION FAILED: appended to other firm log';
  exception when insufficient_privilege then raise notice 'ok: cannot append to other firm log';
  end;
end $$;

-- Anonymous (no JWT) sees nothing.
select set_config('request.jwt.claim.sub', '', false);
select assert_true((select count(*) from documents) = 0, 'anonymous sees no documents');
select assert_true((select count(*) from approvals) = 0, 'anonymous sees no approvals');
reset role;

-- Every public table has RLS enabled (catalog check, not a hand-kept list).
select assert_true(
  (select count(*) from pg_tables t where t.schemaname = 'public'
     and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname = 'public' and c.relname = t.tablename and c.relrowsecurity)) = 0,
  'every public table has RLS enabled');

-- ── Migration 0002: corrections and jobs ─────────────────────────────────────
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
insert into extractions (id, firm_id, document_id, kind, kind_confidence, data) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'factura', 0.9, '{}');
insert into jobs (firm_id, kind) values ('10000000-0000-0000-0000-000000000001', 'process_document');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

insert into corrections (firm_id, document_id, extraction_id, field, old_value, new_value, user_id)
  values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'total', '1', '2', '00000000-0000-0000-0000-00000000000a');
select assert_true((select count(*) from corrections) = 1, 'member inserts and reads own firm correction');
do $$ begin
  begin
    insert into corrections (firm_id, document_id, field, user_id)
      values ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'total', '00000000-0000-0000-0000-00000000000a');
    raise exception 'ASSERTION FAILED: correction for other firm';
  exception when insufficient_privilege then raise notice 'ok: cannot correct other firm document';
  end;
end $$;
do $$ begin
  begin
    insert into corrections (firm_id, document_id, field, user_id)
      values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'total', '00000000-0000-0000-0000-00000000000b');
    raise exception 'ASSERTION FAILED: correction as another user';
  exception when insufficient_privilege then raise notice 'ok: cannot correct as another user';
  end;
end $$;
delete from corrections;
select assert_true((select count(*) from corrections) = 1, 'corrections cannot be deleted by members');
select assert_true((select count(*) from jobs) = 0, 'members cannot see jobs');
do $$ begin
  begin
    insert into jobs (firm_id, kind) values ('10000000-0000-0000-0000-000000000001', 'x');
    raise exception 'ASSERTION FAILED: member inserted a job';
  exception when insufficient_privilege then raise notice 'ok: members cannot insert jobs';
  end;
end $$;
reset role;
select assert_true((select count(*) from claim_jobs(5)) = 1, 'claim_jobs returns due jobs once');
select assert_true((select count(*) from claim_jobs(5)) = 0, 'claimed jobs are not returned again');
select assert_true(
  (select count(*) from pg_tables t where t.schemaname = 'public'
     and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname = 'public' and c.relname = t.tablename and c.relrowsecurity)) = 0,
  'every public table still has RLS enabled');

-- ── Migration 0003: self-check helper ────────────────────────────────────────
select assert_true((select count(*) from tables_without_rls()) = 0, 'tables_without_rls() finds none');
