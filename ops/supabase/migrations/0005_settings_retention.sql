-- Per-firm settings (retention, alert mailbox, pilot baseline, insurer mailboxes)
-- and the "purged" document status used by the retention job.

alter table firms add column if not exists settings jsonb not null default '{}'::jsonb;

alter type document_status add value if not exists 'purged';

comment on column firms.settings is
  'retentionDays: days after a final status before the original file, extractions, drafts and corrections are deleted (0 or null keeps everything); '
  'alertEmail: where the 80% token-budget warning goes; baselineHoursPerWeek: hours the workflow took before the pilot; '
  'insurerEmails: {insurer name: settlements mailbox}. Written only by the server; members read it through firms_member_read.';
