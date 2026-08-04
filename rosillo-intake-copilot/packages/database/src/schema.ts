import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Drizzle schema (spec section 10). Kept to portable SQL types so the driver can
 * later swap to Postgres (ADR-0002). Field evidence and the suggested action are
 * stored inside analysis_runs.output_json — the analysis run is the immutable
 * unit of record, and the evidence never exists apart from its run.
 */

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').notNull(),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: text('created_at').notNull(),
});

export const insurers = sqliteTable('insurers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  customerType: text('customer_type').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  taxIdFake: text('tax_id_fake'),
  classification: text('classification').notNull().default('SYNTHETIC'),
});

export const policies = sqliteTable(
  'policies',
  {
    id: text('id').primaryKey(),
    policyNumber: text('policy_number').notNull(),
    customerId: text('customer_id').notNull().references(() => customers.id),
    insurerId: text('insurer_id').notNull().references(() => insurers.id),
    product: text('product').notNull(),
    status: text('status').notNull(),
    inceptionDate: text('inception_date').notNull(),
    renewalDate: text('renewal_date').notNull(),
    premium: real('premium').notNull(),
    riskSummary: text('risk_summary').notNull(),
  },
  (t) => [uniqueIndex('policies_number_insurer').on(t.policyNumber, t.insurerId)],
);

export const cases = sqliteTable('cases', {
  id: text('id').primaryKey(),
  workflow: text('workflow').notNull().default('UNKNOWN'),
  status: text('status').notNull().default('NEW'),
  priority: text('priority').notNull().default('MEDIUM'),
  assigneeId: text('assignee_id').references(() => users.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const communications = sqliteTable('communications', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => cases.id),
  sender: text('sender').notNull(),
  recipients: text('recipients').notNull().default('operaciones@rosillo.test'),
  subject: text('subject').notNull(),
  bodyText: text('body_text').notNull(),
  receivedAt: text('received_at').notNull(),
});

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),
  communicationId: text('communication_id').notNull().references(() => communications.id),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  storageKey: text('storage_key'),
  text: text('text').notNull().default(''),
  hash: text('hash').notNull(),
});

/** Immutable once created — enforced by SQLite triggers in the migration. */
export const analysisRuns = sqliteTable('analysis_runs', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => cases.id),
  version: integer('version').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  promptVersions: text('prompt_versions').notNull(),
  rulesVersion: text('rules_version'),
  inputHash: text('input_hash').notNull(),
  outputJson: text('output_json'),
  draftJson: text('draft_json'),
  outputHash: text('output_hash'),
  confidence: real('confidence'),
  durationMs: integer('duration_ms').notNull(),
  errorCode: text('error_code'),
  errorDetail: text('error_detail'),
  createdAt: text('created_at').notNull(),
});

export const decisions = sqliteTable('decisions', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => cases.id),
  analysisRunId: text('analysis_run_id').notNull().references(() => analysisRuns.id),
  userId: text('user_id').notNull().references(() => users.id),
  decisionType: text('decision_type').notNull(),
  editsJson: text('edits_json').notNull().default('{}'),
  feedbackCodes: text('feedback_codes').notNull().default('[]'),
  note: text('note').notNull().default(''),
  overrideReason: text('override_reason').notNull().default(''),
  createdAt: text('created_at').notNull(),
});

/** Append-only — UPDATE/DELETE blocked by triggers in the migration. */
export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  eventType: text('event_type').notNull(),
  payloadHash: text('payload_hash').notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
});

export const evaluationLabels = sqliteTable('evaluation_labels', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => cases.id),
  expectedJson: text('expected_json').notNull(),
  labelerId: text('labeler_id').notNull(),
  version: integer('version').notNull().default(1),
});
