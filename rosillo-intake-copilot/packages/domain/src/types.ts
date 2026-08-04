/** Core domain enums and types for the Rosillo Intake Copilot (synthetic-data prototype). */

export const WORKFLOW_TYPES = [
  'MOTOR_CLAIM',
  'POLICY_CANCELLATION',
  'POLICY_AMENDMENT',
  'QUOTE_REQUEST',
  'RENEWAL_QUESTION',
  'MISSING_DOCUMENT_FOLLOWUP',
  'UNKNOWN',
] as const;
export type WorkflowType = (typeof WORKFLOW_TYPES)[number];

export const DECISION_TYPES = [
  'APPROVE',
  'APPROVE_WITH_EDITS',
  'REJECT',
  'REQUEST_REANALYSIS',
  'ESCALATE',
] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const CASE_STATUSES = ['NEW', 'ANALYSING', 'ANALYSED', 'IN_REVIEW', 'DECIDED', 'ERROR'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const FIELD_STATUSES = ['EXPLICIT', 'INFERRED', 'UNKNOWN'] as const;
export type FieldStatus = (typeof FIELD_STATUSES)[number];

export const ROLES = ['admin', 'supervisor', 'operator', 'claims_specialist', 'evaluator'] as const;
export type Role = (typeof ROLES)[number];

/** RBAC permission map (spec section 06). Checked server-side only. */
export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  admin: ['users.manage', 'prompts.manage', 'models.configure', 'cases.read_all', 'audit.read'],
  supervisor: ['cases.read_all', 'cases.assign', 'decisions.review', 'analytics.read', 'audit.read'],
  operator: ['cases.read_assigned', 'analysis.edit', 'drafts.edit', 'decisions.create'],
  claims_specialist: ['cases.read_assigned', 'analysis.edit', 'drafts.edit', 'decisions.create'],
  evaluator: ['datasets.label', 'evaluations.run', 'analytics.read'],
};

export function hasPermission(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Attachment MIME allowlist (spec section 13). */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface CommunicationInput {
  id: string;
  from: string;
  subject: string;
  bodyText: string;
  receivedAt: string; // ISO datetime
  attachments: AttachmentInput[];
}

export interface AttachmentInput {
  id: string;
  filename: string;
  mimeType: string;
  /** Extracted text (empty for images). Treated as untrusted data, never as instructions. */
  text: string;
  hash: string;
}

export interface CustomerRecord {
  id: string;
  customerType: 'INDIVIDUAL' | 'COMPANY';
  name: string;
  email: string | null;
  phone: string | null;
  taxIdFake: string | null;
}

export interface PolicyRecord {
  id: string;
  policyNumber: string;
  customerId: string;
  insurerId: string;
  product: string;
  status: 'ACTIVE' | 'PENDING_RENEWAL' | 'CANCELLED';
  inceptionDate: string;
  renewalDate: string;
  premium: number;
  /** Compact risk description used for matching, e.g. "Audi Q5 45 TFSI 1234-XYZ". */
  riskSummary: string;
}

export interface CandidateMatch {
  id: string;
  kind: 'CUSTOMER' | 'POLICY';
  label: string;
  score: number;
  signals: string[];
}
