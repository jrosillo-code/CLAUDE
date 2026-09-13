// Domain model for "operaciones con IA para corredurías y asesorías".
//
// The product is a chain: receive → extract → validate → flag what is missing →
// create the task → (after a human approves) write to the management system and
// send the reply. Two invariants run through every type here:
//   1. Nothing leaves the firm (no send, no write to the management system)
//      without an Approval whose status is "approved" by a person.
//   2. Every extracted value carries its provenance (the quoted text and page it
//      came from). A value without a quote is treated as missing, never as fact.

export type FirmKind = "correduria" | "asesoria";

export interface FirmSettings {
  /** Days after a final status before originals, extractions, drafts and corrections are deleted. 0 or null keeps everything. */
  retentionDays: number | null;
  /** Where the 80% token-budget warning is sent. */
  alertEmail: string | null;
  /** Hours per week the workflow took before the pilot, from the week-1 inventory. */
  baselineHoursPerWeek: number | null;
  /** Insurer name → settlements mailbox, used to pre-fill claims. */
  insurerEmails: Record<string, string>;
}

export const DEFAULT_SETTINGS: FirmSettings = { retentionDays: null, alertEmail: null, baselineHoursPerWeek: null, insurerEmails: {} };

export interface Firm {
  id: string;
  name: string;
  kind: FirmKind;
  /** Monthly ceiling on model tokens across all documents; alerts at 80%. */
  monthlyTokenBudget: number;
  createdAt: string;
  /** Absent on older records; read through firmSettings(). */
  settings?: Partial<FirmSettings>;
}

export function firmSettings(firm: Firm): FirmSettings {
  return { ...DEFAULT_SETTINGS, ...(firm.settings ?? {}), insurerEmails: { ...(firm.settings?.insurerEmails ?? {}) } };
}

export type Channel = "upload" | "email" | "whatsapp";

export interface InboundAttachment {
  fileName: string;
  mediaType: string;
  /** Path in the file store once persisted. */
  storagePath: string;
}

export interface InboundMessage {
  id: string;
  firmId: string;
  channel: Channel;
  /** Email address, phone number or user id, as the channel reports it. */
  fromAddress: string;
  receivedAt: string;
  subject: string | null;
  text: string | null;
  /** Provider message id, for idempotency. */
  externalId: string | null;
  attachments: InboundAttachment[];
}

export type DocumentKind =
  | "factura"
  | "recibo"
  | "parte_siniestro"
  | "poliza"
  | "identidad"
  | "otro";

export type DocumentStatus =
  | "received"
  | "extracted"
  | "validated"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "failed"
  | "purged";

export interface DocumentRecord {
  id: string;
  firmId: string;
  inboundMessageId: string | null;
  /** The firm's own client (the policyholder or the accounting client). */
  clientRef: string | null;
  storagePath: string;
  fileName: string;
  mediaType: string;
  sha256: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

/** A value with the text it was read from. `quote` is the guarantee. */
export interface Field<T = string> {
  value: T;
  quote: string;
  page: number | null;
}

export interface ModelUsage {
  model: string;
  /** sha256 of system prompt + output schema, so audits can tell prompt versions apart. */
  promptHash: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number;
}

export interface Extraction {
  id: string;
  documentId: string;
  kind: DocumentKind;
  kindConfidence: number;
  /** Shape depends on `kind`; see lib/schemas. */
  data: Record<string, unknown>;
  usage: ModelUsage | null;
  createdAt: string;
}

export type Severity = "error" | "warning";

export interface ValidationIssue {
  code: string;
  severity: Severity;
  field: string | null;
  message: string;
}

export interface Validation {
  id: string;
  extractionId: string;
  documentId: string;
  ok: boolean;
  issues: ValidationIssue[];
  /** Human-readable items to ask the sender for, in Spanish. */
  missing: string[];
  createdAt: string;
}

export interface Task {
  id: string;
  firmId: string;
  documentId: string;
  title: string;
  detail: string;
  /** Who has to act: the firm's staff, or the firm's client. */
  owner: "firm" | "client";
  status: "open" | "done";
  createdAt: string;
}

export interface Draft {
  id: string;
  firmId: string;
  documentId: string;
  channel: "email" | "whatsapp";
  to: string;
  subject: string | null;
  body: string;
  usage: ModelUsage | null;
  createdAt: string;
}

export type ApprovalAction = "send_draft" | "write_system";

export interface Approval {
  id: string;
  firmId: string;
  documentId: string;
  action: ApprovalAction;
  draftId: string | null;
  status: "pending" | "approved" | "rejected";
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  firmId: string;
  at: string;
  actor: { type: "system" | "user" | "model"; id: string | null };
  action: string;
  entity: { type: string; id: string };
  usage: ModelUsage | null;
  detail: Record<string, unknown> | null;
}

export interface MonthlyUsage {
  firmId: string;
  /** YYYY-MM */
  month: string;
  tokens: number;
  costUsd: number;
}

export interface ReconciliationRecord {
  id: string;
  firmId: string;
  documentId: string;
  insurer: string | null;
  period: string | null;
  /** Full lib/reconcile ReconcileSummary. */
  summary: Record<string, unknown>;
  unpaidEur: number;
  mismatchEur: number;
  usage: ModelUsage | null;
  createdAt: string;
}

export interface Correction {
  id: string;
  firmId: string;
  documentId: string;
  extractionId: string | null;
  /** "total" for an extracted field of the document's kind, or "draft.body". */
  field: string;
  oldValue: unknown;
  newValue: unknown;
  userId: string;
  createdAt: string;
}

export type JobKind = "process_document" | "reconcile_settlement";

export interface Job {
  id: string;
  firmId: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  status: "queued" | "running" | "done" | "failed";
  attempts: number;
  runAfter: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  firmId: string;
  userId: string;
  role: "owner" | "staff";
}
