'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { analyseCommunication, DECISION_TYPES, RateLimiter, type DecisionType } from '@rosillo/domain';
import { createProvider } from '@rosillo/ai';
import { log } from '@/lib/logger';
import {
  getDb,
  getCaseDetail,
  getCommunicationInput,
  listCustomers,
  listPolicies,
  recordAnalysisRun,
  recordDecision,
  assignCase,
  updateCaseStatus,
} from '@rosillo/database';
import { requireUser, can, canViewCase } from '@/lib/auth';

/** Server actions for the case workspace. Every action re-checks authorization. */

// Abuse protection for the expensive analysis path: 6 analyses per user per
// minute (per process — see THREAT_MODEL.md). Survives HMR via globalThis.
const limiterRef = globalThis as unknown as { __rosilloAnalyseLimiter?: RateLimiter };
const analyseLimiter = () =>
  (limiterRef.__rosilloAnalyseLimiter ??= new RateLimiter({ limit: 6, windowMs: 60_000 }));

function fail(caseId: string, message: string): never {
  redirect(`/cases/${caseId}?error=${encodeURIComponent(message)}`);
}

async function authorizeCaseAccess(caseId: string) {
  const user = await requireUser();
  const detail = getCaseDetail(getDb(), caseId);
  if (!detail) fail(caseId, 'Caso no encontrado.');
  if (!canViewCase(user, detail.caseRow.assigneeId)) fail(caseId, 'No tienes acceso a este caso.');
  return { user, detail };
}

async function runAnalysis(caseId: string, userId: string): Promise<void> {
  const db = getDb();
  const comm = getCommunicationInput(db, caseId);
  if (!comm) fail(caseId, 'El caso no tiene comunicación asociada.');

  updateCaseStatus(db, caseId, 'ANALYSING', userId);
  const started = Date.now();
  try {
    const provider = createProvider(); // throws if anthropic is configured without a key
    const result = await analyseCommunication(comm, {
      provider,
      customers: listCustomers(db),
      policies: listPolicies(db),
    });
    const runId = recordAnalysisRun(db, caseId, result, userId);
    log.info('analysis.completed', {
      caseId,
      runId,
      userId,
      ok: result.ok,
      errorCode: result.ok ? undefined : result.errorCode,
      durationMs: result.durationMs,
    });
  } catch (err) {
    // Degraded mode: provider unavailable → record a safe failed run, never a crash.
    const detail = err instanceof Error ? err.message.slice(0, 300) : 'unknown provider error';
    recordAnalysisRun(
      db,
      caseId,
      {
        ok: false,
        errorCode: 'PROVIDER_ERROR',
        detail,
        inputHash: 'unavailable',
        provider: process.env.AI_PROVIDER ?? 'mock',
        model: 'unavailable',
        durationMs: Date.now() - started,
      },
      userId,
    );
    log.error('analysis.provider_unavailable', { caseId, userId, detail });
  }
}

export async function analyseCaseAction(caseId: string) {
  const { user } = await authorizeCaseAccess(caseId);
  if (!can(user, 'analysis.edit') && !can(user, 'cases.read_all')) {
    fail(caseId, 'Tu rol no permite lanzar análisis.');
  }
  if (!analyseLimiter().tryAcquire(`analyse:${user.id}`)) {
    const wait = analyseLimiter().retryAfterSeconds(`analyse:${user.id}`);
    log.warn('analysis.rate_limited', { caseId, userId: user.id, retryAfterSeconds: wait });
    fail(caseId, `Límite de análisis alcanzado. Inténtalo de nuevo en ${wait} s.`);
  }
  await runAnalysis(caseId, user.id);
  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/');
}

export async function claimCaseAction(caseId: string) {
  const { user, detail } = await authorizeCaseAccess(caseId);
  if (detail.caseRow.assigneeId && detail.caseRow.assigneeId !== user.id && !can(user, 'cases.assign')) {
    fail(caseId, 'El caso ya está asignado.');
  }
  assignCase(getDb(), caseId, user.id, user.id);
  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/');
}

export async function reassignCaseAction(caseId: string, formData: FormData) {
  const { user } = await authorizeCaseAccess(caseId);
  if (!can(user, 'cases.assign')) fail(caseId, 'Solo supervisión puede reasignar casos.');
  const assignee = String(formData.get('assignee') ?? '');
  assignCase(getDb(), caseId, assignee || null, user.id);
  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/');
}

export async function decideAction(caseId: string, formData: FormData) {
  const { user, detail } = await authorizeCaseAccess(caseId);
  if (!can(user, 'decisions.create') && !can(user, 'decisions.review')) {
    fail(caseId, 'Tu rol no permite registrar decisiones.');
  }

  const decisionType = String(formData.get('decisionType') ?? '');
  if (!(DECISION_TYPES as readonly string[]).includes(decisionType)) fail(caseId, 'Tipo de decisión no válido.');

  const analysisRunId = String(formData.get('analysisRunId') ?? '');
  const latestRun = detail.runs[0];
  if (!latestRun || latestRun.id !== analysisRunId) {
    fail(caseId, 'La decisión debe referirse a la última versión del análisis. Recarga la página.');
  }

  // Collect field edits (edit_<key>) and the edited draft.
  const editsJson: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('edit_') && String(value).trim() !== '') {
      editsJson[key.slice(5)] = String(value).trim();
    }
  }
  const draftBody = String(formData.get('draftBody') ?? '').trim();
  if (draftBody) editsJson['draft_body'] = draftBody;

  const feedbackCodes = formData.getAll('feedback').map(String).filter(Boolean);
  const note = String(formData.get('note') ?? '').slice(0, 2000);

  // Only supervision may record an override reason for unresolved required items.
  let overrideReason = '';
  if (can(user, 'decisions.review')) {
    overrideReason = String(formData.get('overrideReason') ?? '').slice(0, 500);
  }

  const withEdits = Object.keys(editsJson).length > 0;
  const finalType: DecisionType =
    decisionType === 'APPROVE' && withEdits ? 'APPROVE_WITH_EDITS' : (decisionType as DecisionType);

  const result = recordDecision(getDb(), {
    caseId,
    analysisRunId,
    userId: user.id,
    input: { decisionType: finalType, editsJson, feedbackCodes, note, overrideReason },
  });
  if (!result.ok) {
    log.warn('decision.blocked', { caseId, userId: user.id, decisionType: finalType });
    fail(caseId, result.error);
  }
  log.info('decision.recorded', {
    caseId,
    userId: user.id,
    decisionType: finalType,
    decisionId: result.id,
    overrideUsed: overrideReason !== '',
  });

  if (finalType === 'REQUEST_REANALYSIS') {
    // A re-analysis decision immediately produces a new immutable version —
    // subject to the same rate limit as first analysis.
    if (!analyseLimiter().tryAcquire(`analyse:${user.id}`)) {
      const wait = analyseLimiter().retryAfterSeconds(`analyse:${user.id}`);
      fail(caseId, `Decisión registrada, pero el límite de análisis está alcanzado. Re-analiza en ${wait} s.`);
    }
    await runAnalysis(caseId, user.id);
  }

  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/');
  redirect(`/cases/${caseId}?ok=1`);
}
