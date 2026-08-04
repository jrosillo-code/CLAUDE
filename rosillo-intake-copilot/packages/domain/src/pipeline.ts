import { createHash } from 'node:crypto';
import type { AIProvider } from './provider';
import type { CommunicationInput, CustomerRecord, PolicyRecord, CandidateMatch } from './types';
import { WORKFLOW_TYPES, ALLOWED_MIME_TYPES, MAX_ATTACHMENT_BYTES } from './types';
import {
  caseAnalysisSchema,
  candidateRankingSchema,
  responseDraftSchema,
  type CaseAnalysis,
  type ResponseDraft,
} from './schemas';
import { WORKFLOW_ACTIONS, type ActionCode } from './actionCatalogue';
import { evaluateMissingInformation, MISSING_INFO_RULES_VERSION } from './rules/missingInfo';

/**
 * The analysis pipeline (spec section 11). The model interprets; code and versioned
 * rules control. Every provider output is validated, and safety invariants are
 * enforced here regardless of what the provider returned.
 */

export interface PipelineDeps {
  provider: AIProvider;
  customers: CustomerRecord[];
  policies: PolicyRecord[];
  /** Per-provider-call timeout; a slow provider ends in the safe error state. Default 45s. */
  providerTimeoutMs?: number;
}

export interface PipelineResult {
  ok: true;
  analysis: CaseAnalysis;
  draft: ResponseDraft;
  inputHash: string;
  outputHash: string;
  rulesVersion: string;
  provider: string;
  model: string;
  promptVersions: Record<string, string>;
  durationMs: number;
  validationRepairs: number;
}

export interface PipelineFailure {
  ok: false;
  errorCode: 'SCHEMA_VALIDATION_FAILED' | 'PROVIDER_ERROR' | 'PROVIDER_TIMEOUT';
  detail: string;
  inputHash: string;
  provider: string;
  model: string;
  durationMs: number;
}

export function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/** Stage 1: normalize + drop unsupported attachments; compute the input hash. */
export function preprocessCommunication(comm: CommunicationInput): {
  communication: CommunicationInput;
  rejectedAttachments: string[];
  inputHash: string;
} {
  const rejected: string[] = [];
  const attachments = comm.attachments.filter((a) => {
    const allowed =
      (ALLOWED_MIME_TYPES as readonly string[]).includes(a.mimeType) &&
      Buffer.byteLength(a.text, 'utf8') <= MAX_ATTACHMENT_BYTES;
    if (!allowed) rejected.push(a.filename);
    return allowed;
  });
  const clean: CommunicationInput = { ...comm, attachments };
  const inputHash = sha256(
    JSON.stringify({
      from: clean.from,
      subject: clean.subject,
      body: clean.bodyText,
      receivedAt: clean.receivedAt,
      attachments: clean.attachments.map((a) => a.hash),
    }),
  );
  return { communication: clean, rejectedAttachments: rejected, inputHash };
}

async function validateWithRepair<T>(
  raw: unknown,
  schema: { safeParse(v: unknown): { success: boolean; data?: T; error?: { message: string } } },
  retry: () => Promise<unknown>,
): Promise<{ value: T; repairs: number }> {
  const first = schema.safeParse(raw);
  if (first.success) return { value: first.data as T, repairs: 0 };
  const second = schema.safeParse(await retry());
  if (second.success) return { value: second.data as T, repairs: 1 };
  throw new SchemaValidationError(second.error?.message ?? 'unknown validation error');
}

export class SchemaValidationError extends Error {}
export class ProviderTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number, stage: string): Promise<T> {
  return new Promise<T>((resolvePromise, reject) => {
    const timer = setTimeout(
      () => reject(new ProviderTimeoutError(`AI provider timed out after ${ms}ms during ${stage}`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolvePromise(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function analyseCommunication(
  comm: CommunicationInput,
  deps: PipelineDeps,
): Promise<PipelineResult | PipelineFailure> {
  const started = Date.now();
  const { provider } = deps;
  const timeoutMs = deps.providerTimeoutMs ?? 45_000;
  const { communication, inputHash } = preprocessCommunication(comm);
  let repairs = 0;

  try {
    // Stage 2: classification + extraction, schema-validated with one repair retry.
    const analyseInput = { communication, allowedWorkflows: WORKFLOW_TYPES };
    const analysed = await validateWithRepair<CaseAnalysis>(
      await withTimeout(provider.analyseCase(analyseInput), timeoutMs, 'analyseCase'),
      caseAnalysisSchema,
      () => withTimeout(provider.analyseCase(analyseInput), timeoutMs, 'analyseCase (repair)'),
    );
    repairs += analysed.repairs;
    let analysis = analysed.value;

    // Stage 3: deterministic candidate search. The provider never sees the database.
    const { findCustomerCandidates, findPolicyCandidates } = await import('./matching/candidateSearch');
    const customerCandidates = findCustomerCandidates(communication, deps.customers);
    const policyCandidates = findPolicyCandidates(communication, deps.policies, customerCandidates);

    // Stage 4: provider ranks ONLY the supplied candidates; unknown ids are discarded.
    let rankedCustomers = customerCandidates;
    let rankedPolicies = policyCandidates;
    if (customerCandidates.length + policyCandidates.length > 0) {
      const rankInput = { communication, analysis, customerCandidates, policyCandidates };
      const ranking = await validateWithRepair(
        await withTimeout(provider.rankCandidates(rankInput), timeoutMs, 'rankCandidates'),
        candidateRankingSchema,
        () => withTimeout(provider.rankCandidates(rankInput), timeoutMs, 'rankCandidates (repair)'),
      );
      repairs += ranking.repairs;
      rankedCustomers = reorderBySubset(customerCandidates, ranking.value.rankedCustomerIds);
      rankedPolicies = reorderBySubset(policyCandidates, ranking.value.rankedPolicyIds);
    }

    // Stage 5: deterministic missing-info rules overwrite the model's proposal.
    const missingInformation = evaluateMissingInformation({
      workflow: analysis.workflow,
      entities: analysis.entities,
      attachmentFilenames: communication.attachments.map((a) => a.filename),
      bodyText: `${communication.subject}\n${communication.bodyText}`,
    });

    // Stage 6: the suggested action must belong to the catalogue for this workflow.
    const allowedActions = WORKFLOW_ACTIONS[analysis.workflow];
    let suggestedActionCode = analysis.suggestedActionCode as ActionCode;
    let actionRationale = analysis.suggestedActionRationale;
    if (!allowedActions.includes(suggestedActionCode)) {
      suggestedActionCode = fallbackAction(analysis, missingInformation.length > 0);
      actionRationale = `Acción propuesta fuera de catálogo; sustituida por regla determinista (${MISSING_INFO_RULES_VERSION}).`;
    }

    analysis = {
      ...analysis,
      customerCandidates: rankedCustomers.map(toCandidateRef),
      policyCandidates: rankedPolicies.map(toCandidateRef),
      missingInformation,
      suggestedActionCode,
      suggestedActionRationale: actionRationale,
      externalActionAllowed: false, // hard invariant, regardless of provider output
    };

    // Stage 7: response draft using confirmed facts and marked uncertainties.
    const draftInput = { communication, analysis, missingInformation, tone: 'WARM' as const };
    const drafted = await validateWithRepair<ResponseDraft>(
      await withTimeout(provider.draftResponse(draftInput), timeoutMs, 'draftResponse'),
      responseDraftSchema,
      () => withTimeout(provider.draftResponse(draftInput), timeoutMs, 'draftResponse (repair)'),
    );
    repairs += drafted.repairs;

    // Stage 8: final whole-object validation (defence in depth).
    const finalAnalysis = caseAnalysisSchema.parse(analysis);
    const outputHash = sha256(JSON.stringify({ analysis: finalAnalysis, draft: drafted.value }));

    return {
      ok: true,
      analysis: finalAnalysis,
      draft: drafted.value,
      inputHash,
      outputHash,
      rulesVersion: MISSING_INFO_RULES_VERSION,
      provider: provider.name,
      model: provider.model,
      promptVersions: provider.promptVersions,
      durationMs: Date.now() - started,
      validationRepairs: repairs,
    };
  } catch (err) {
    return {
      ok: false,
      errorCode:
        err instanceof SchemaValidationError
          ? 'SCHEMA_VALIDATION_FAILED'
          : err instanceof ProviderTimeoutError
            ? 'PROVIDER_TIMEOUT'
            : 'PROVIDER_ERROR',
      detail: err instanceof Error ? err.message.slice(0, 500) : 'unknown error',
      inputHash,
      provider: provider.name,
      model: provider.model,
      durationMs: Date.now() - started,
    };
  }
}

function reorderBySubset(candidates: CandidateMatch[], rankedIds: string[]): CandidateMatch[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const ranked = rankedIds.map((id) => byId.get(id)).filter((c): c is CandidateMatch => !!c);
  const rest = candidates.filter((c) => !rankedIds.includes(c.id));
  return [...ranked, ...rest];
}

function toCandidateRef(c: CandidateMatch) {
  return { id: c.id, kind: c.kind, label: c.label, score: c.score, signals: c.signals };
}

function fallbackAction(analysis: CaseAnalysis, hasMissing: boolean): ActionCode {
  const map: Record<string, [ActionCode, ActionCode]> = {
    MOTOR_CLAIM: ['REQUEST_CLAIM_DETAILS', 'PREPARE_CLAIM_OPENING'],
    POLICY_CANCELLATION: ['REQUEST_CANCELLATION_CONFIRMATION', 'PREPARE_CANCELLATION_SUMMARY'],
    POLICY_AMENDMENT: ['REQUEST_AMENDMENT_DETAILS', 'PREPARE_AMENDMENT_SUMMARY'],
    QUOTE_REQUEST: ['REQUEST_QUOTE_DETAILS', 'ROUTE_TO_QUOTATION'],
    RENEWAL_QUESTION: ['PREPARE_RENEWAL_CONTEXT', 'PREPARE_RENEWAL_CONTEXT'],
    MISSING_DOCUMENT_FOLLOWUP: ['REQUEST_MISSING_DOCUMENTS', 'REQUEST_MISSING_DOCUMENTS'],
    UNKNOWN: ['NO_ACTION_NOT_OPERATIONAL', 'NO_ACTION_NOT_OPERATIONAL'],
  };
  const pair = map[analysis.workflow] ?? ['ESCALATE_TO_SUPERVISOR', 'ESCALATE_TO_SUPERVISOR'];
  return hasMissing ? pair[0] : pair[1];
}
