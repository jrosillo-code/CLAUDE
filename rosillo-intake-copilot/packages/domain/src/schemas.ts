import { z } from 'zod';
import { WORKFLOW_TYPES, FIELD_STATUSES, DECISION_TYPES, CASE_STATUSES, CASE_PRIORITIES } from './types';
import { ACTION_CODES } from './actionCatalogue';

/** Zod schemas — the structured-output contract every AI provider must satisfy (spec section 11). */

export const workflowTypeSchema = z.enum(WORKFLOW_TYPES);
export const fieldStatusSchema = z.enum(FIELD_STATUSES);
export const decisionTypeSchema = z.enum(DECISION_TYPES);
export const caseStatusSchema = z.enum(CASE_STATUSES);
export const casePrioritySchema = z.enum(CASE_PRIORITIES);
export const actionCodeSchema = z.enum(ACTION_CODES as [string, ...string[]]);

export const evidenceSchema = z.object({
  id: z.string().min(1),
  sourceType: z.enum(['EMAIL_SUBJECT', 'EMAIL_BODY', 'ATTACHMENT', 'POLICY_RECORD', 'RULE']),
  sourceId: z.string().min(1),
  quote: z.string().max(500),
  /** Character offsets into the source text, when applicable. */
  offsets: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).nullable(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const extractedFieldSchema = z.object({
  value: z.string().max(1000).nullable(),
  status: fieldStatusSchema,
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(z.string()).max(10),
  /** Short operational note, e.g. why a value was inferred. Never chain-of-thought. */
  note: z.string().max(300).nullable().default(null),
});
export type ExtractedField = z.infer<typeof extractedFieldSchema>;

export const candidateRefSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['CUSTOMER', 'POLICY']),
  label: z.string().max(200),
  score: z.number().min(0).max(1),
  signals: z.array(z.string().max(200)).max(10),
});
export type CandidateRef = z.infer<typeof candidateRefSchema>;

export const missingInformationItemSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().max(300),
  severity: z.enum(['REQUIRED', 'RECOMMENDED']),
  ruleId: z.string().max(100),
});
export type MissingInformationItem = z.infer<typeof missingInformationItemSchema>;

export const caseAnalysisSchema = z.object({
  workflow: workflowTypeSchema,
  workflowConfidence: z.number().min(0).max(1),
  secondaryWorkflows: z.array(workflowTypeSchema).max(2),
  summary: z.string().min(1).max(600),
  entities: z.record(z.string(), extractedFieldSchema),
  evidence: z.array(evidenceSchema).max(50),
  customerCandidates: z.array(candidateRefSchema).max(5),
  policyCandidates: z.array(candidateRefSchema).max(5),
  missingInformation: z.array(missingInformationItemSchema).max(20),
  riskFlags: z.array(z.string().max(200)).max(10),
  suggestedActionCode: actionCodeSchema,
  suggestedActionRationale: z.string().max(400),
  /** Hard safety invariant: always false in this prototype. */
  externalActionAllowed: z.literal(false),
});
export type CaseAnalysis = z.infer<typeof caseAnalysisSchema>;

export const responseDraftSchema = z.object({
  language: z.enum(['es', 'en']).default('es'),
  tone: z.enum(['FORMAL', 'WARM']).default('WARM'),
  body: z.string().min(1).max(4000),
  /** Placeholder tokens like [HORA EXACTA] that the employee must resolve before use. */
  placeholders: z.array(z.string().max(100)).max(20),
});
export type ResponseDraft = z.infer<typeof responseDraftSchema>;

export const candidateRankingSchema = z.object({
  /** Ranked ids — must be a subset of the supplied candidates; enforced by the pipeline (unknown ids are discarded, not errors). */
  rankedPolicyIds: z.array(z.string()).max(20),
  rankedCustomerIds: z.array(z.string()).max(20),
  rationale: z.string().max(400),
});
export type CandidateRanking = z.infer<typeof candidateRankingSchema>;

/** Employee decision payload (FR-010). */
export const decisionInputSchema = z.object({
  decisionType: decisionTypeSchema,
  editsJson: z.record(z.string(), z.unknown()).default({}),
  feedbackCodes: z.array(z.string().max(50)).max(10).default([]),
  note: z.string().max(2000).default(''),
  overrideReason: z.string().max(500).default(''),
});
export type DecisionInput = z.infer<typeof decisionInputSchema>;

/** Expected-label schema for evaluation fixtures (spec section 14). */
export const expectedLabelSchema = z.object({
  workflow: workflowTypeSchema,
  policyId: z.string().nullable(),
  customerId: z.string().nullable(),
  explicitFields: z.array(z.string()),
  missingInformation: z.array(z.string()),
  prohibitedActions: z.array(z.string()),
  suggestedActionCode: actionCodeSchema.nullable().default(null),
});
export type ExpectedLabel = z.infer<typeof expectedLabelSchema>;

export const caseFixtureSchema = z.object({
  case_id: z.string(),
  classification: z.literal('SYNTHETIC'),
  received_at: z.string(),
  from: z.string(),
  subject: z.string(),
  body: z.string(),
  priority: casePrioritySchema.default('MEDIUM'),
  attachments: z.array(z.string()).default([]),
  expected: expectedLabelSchema,
});
export type CaseFixture = z.infer<typeof caseFixtureSchema>;
