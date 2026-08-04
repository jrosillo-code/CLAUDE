import { and, desc, eq, max, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  sha256,
  decisionInputSchema,
  type PipelineResult,
  type PipelineFailure,
  type DecisionInput,
  type CaseStatus,
} from '@rosillo/domain';
import type { Db } from './client';
import * as t from './schema';

/**
 * Typed data access. Immutability of analysis runs and audit events is enforced
 * both here (no update paths exist) and by database triggers.
 */

const now = () => new Date().toISOString();

export function appendAudit(
  db: Db,
  entry: { actorId: string; entityType: string; entityId: string; eventType: string; payload?: unknown },
) {
  const payloadJson = JSON.stringify(entry.payload ?? {});
  db.insert(t.auditEvents)
    .values({
      id: `audit-${randomUUID()}`,
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      eventType: entry.eventType,
      payloadHash: sha256(payloadJson),
      payloadJson,
      createdAt: now(),
    })
    .run();
}

export function listCases(db: Db, filter?: { status?: string; workflow?: string; assigneeId?: string }) {
  const conditions = [];
  if (filter?.status) conditions.push(eq(t.cases.status, filter.status));
  if (filter?.workflow) conditions.push(eq(t.cases.workflow, filter.workflow));
  if (filter?.assigneeId) conditions.push(eq(t.cases.assigneeId, filter.assigneeId));

  const rows = db
    .select({
      caseRow: t.cases,
      subject: t.communications.subject,
      sender: t.communications.sender,
      receivedAt: t.communications.receivedAt,
      attachmentCount: sql<number>`(SELECT COUNT(*) FROM attachments a WHERE a.communication_id = ${t.communications.id})`,
    })
    .from(t.cases)
    .innerJoin(t.communications, eq(t.communications.caseId, t.cases.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(t.communications.receivedAt))
    .all();
  return rows;
}

export function getCaseDetail(db: Db, caseId: string) {
  const caseRow = db.select().from(t.cases).where(eq(t.cases.id, caseId)).get();
  if (!caseRow) return null;
  const communication = db.select().from(t.communications).where(eq(t.communications.caseId, caseId)).get();
  const atts = communication
    ? db.select().from(t.attachments).where(eq(t.attachments.communicationId, communication.id)).all()
    : [];
  const runs = db
    .select()
    .from(t.analysisRuns)
    .where(eq(t.analysisRuns.caseId, caseId))
    .orderBy(desc(t.analysisRuns.version))
    .all();
  const caseDecisions = db
    .select()
    .from(t.decisions)
    .where(eq(t.decisions.caseId, caseId))
    .orderBy(desc(t.decisions.createdAt))
    .all();
  const audit = db
    .select()
    .from(t.auditEvents)
    .where(and(eq(t.auditEvents.entityType, 'case'), eq(t.auditEvents.entityId, caseId)))
    .orderBy(t.auditEvents.createdAt)
    .all();
  return { caseRow, communication, attachments: atts, runs, decisions: caseDecisions, audit };
}

export function getCommunicationInput(db: Db, caseId: string) {
  const communication = db.select().from(t.communications).where(eq(t.communications.caseId, caseId)).get();
  if (!communication) return null;
  const atts = db.select().from(t.attachments).where(eq(t.attachments.communicationId, communication.id)).all();
  return {
    id: communication.id,
    from: communication.sender,
    subject: communication.subject,
    bodyText: communication.bodyText,
    receivedAt: communication.receivedAt,
    attachments: atts.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      text: a.text,
      hash: a.hash,
    })),
  };
}

export function updateCaseStatus(db: Db, caseId: string, status: CaseStatus, actorId: string) {
  db.update(t.cases).set({ status, updatedAt: now() }).where(eq(t.cases.id, caseId)).run();
  appendAudit(db, { actorId, entityType: 'case', entityId: caseId, eventType: `STATUS_${status}` });
}

export function assignCase(db: Db, caseId: string, assigneeId: string | null, actorId: string) {
  db.update(t.cases).set({ assigneeId, updatedAt: now() }).where(eq(t.cases.id, caseId)).run();
  appendAudit(db, {
    actorId,
    entityType: 'case',
    entityId: caseId,
    eventType: 'ASSIGNED',
    payload: { assigneeId },
  });
}

/** Persist one immutable analysis version (success or safe failure). */
export function recordAnalysisRun(
  db: Db,
  caseId: string,
  result: PipelineResult | PipelineFailure,
  actorId: string,
): string {
  const versionRow = db
    .select({ v: max(t.analysisRuns.version) })
    .from(t.analysisRuns)
    .where(eq(t.analysisRuns.caseId, caseId))
    .get();
  const version = (versionRow?.v ?? 0) + 1;
  const id = `run-${randomUUID()}`;

  if (result.ok) {
    db.insert(t.analysisRuns)
      .values({
        id,
        caseId,
        version,
        provider: result.provider,
        model: result.model,
        promptVersions: JSON.stringify(result.promptVersions),
        rulesVersion: result.rulesVersion,
        inputHash: result.inputHash,
        outputJson: JSON.stringify(result.analysis),
        draftJson: JSON.stringify(result.draft),
        outputHash: result.outputHash,
        confidence: result.analysis.workflowConfidence,
        durationMs: result.durationMs,
        createdAt: now(),
      })
      .run();
    db.update(t.cases)
      .set({ workflow: result.analysis.workflow, status: 'ANALYSED', updatedAt: now() })
      .where(eq(t.cases.id, caseId))
      .run();
  } else {
    db.insert(t.analysisRuns)
      .values({
        id,
        caseId,
        version,
        provider: result.provider,
        model: result.model,
        promptVersions: '{}',
        rulesVersion: null,
        inputHash: result.inputHash,
        errorCode: result.errorCode,
        errorDetail: result.detail,
        durationMs: result.durationMs,
        createdAt: now(),
      })
      .run();
    db.update(t.cases).set({ status: 'ERROR', updatedAt: now() }).where(eq(t.cases.id, caseId)).run();
  }

  appendAudit(db, {
    actorId,
    entityType: 'case',
    entityId: caseId,
    eventType: result.ok ? 'ANALYSED' : 'ANALYSIS_FAILED',
    payload: { runId: id, version, provider: result.provider, inputHash: result.inputHash },
  });
  return id;
}

/** Record an employee decision against the exact analysis run reviewed (FR-010). */
export function recordDecision(
  db: Db,
  args: { caseId: string; analysisRunId: string; userId: string; input: DecisionInput },
): { ok: true; id: string } | { ok: false; error: string } {
  const input = decisionInputSchema.parse(args.input);
  const run = db.select().from(t.analysisRuns).where(eq(t.analysisRuns.id, args.analysisRunId)).get();
  if (!run || run.caseId !== args.caseId) {
    return { ok: false, error: 'La decisión debe referenciar un análisis existente de este caso.' };
  }
  // Guard: unresolved REQUIRED items block approval unless an override reason is recorded.
  if (input.decisionType === 'APPROVE' || input.decisionType === 'APPROVE_WITH_EDITS') {
    const analysis = run.outputJson ? JSON.parse(run.outputJson) : null;
    const required = (analysis?.missingInformation ?? []).filter(
      (m: { severity: string }) => m.severity === 'REQUIRED',
    );
    const resolved = new Set(Object.keys(input.editsJson));
    const unresolved = required.filter((m: { key: string }) => !resolved.has(m.key));
    if (unresolved.length > 0 && !input.overrideReason) {
      return {
        ok: false,
        error: `Hay ${unresolved.length} elemento(s) obligatorio(s) sin resolver. Un supervisor debe registrar un motivo de excepción.`,
      };
    }
  }

  const id = `dec-${randomUUID()}`;
  db.insert(t.decisions)
    .values({
      id,
      caseId: args.caseId,
      analysisRunId: args.analysisRunId,
      userId: args.userId,
      decisionType: input.decisionType,
      editsJson: JSON.stringify(input.editsJson),
      feedbackCodes: JSON.stringify(input.feedbackCodes),
      note: input.note,
      overrideReason: input.overrideReason,
      createdAt: now(),
    })
    .run();

  const newStatus: CaseStatus = input.decisionType === 'REQUEST_REANALYSIS' ? 'ANALYSING' : 'DECIDED';
  db.update(t.cases).set({ status: newStatus, updatedAt: now() }).where(eq(t.cases.id, args.caseId)).run();

  appendAudit(db, {
    actorId: args.userId,
    entityType: 'case',
    entityId: args.caseId,
    eventType: `DECISION_${input.decisionType}`,
    payload: { decisionId: id, analysisRunId: args.analysisRunId, feedbackCodes: input.feedbackCodes },
  });
  return { ok: true, id };
}

export function getUserByEmail(db: Db, email: string) {
  return db.select().from(t.users).where(eq(t.users.email, email)).get() ?? null;
}

export function getUserById(db: Db, id: string) {
  return db.select().from(t.users).where(eq(t.users.id, id)).get() ?? null;
}

export function listUsers(db: Db) {
  return db.select().from(t.users).all();
}

export function listCustomers(db: Db) {
  return db
    .select()
    .from(t.customers)
    .all()
    .map((c) => ({
      id: c.id,
      customerType: c.customerType as 'INDIVIDUAL' | 'COMPANY',
      name: c.name,
      email: c.email,
      phone: c.phone,
      taxIdFake: c.taxIdFake,
    }));
}

export function listPolicies(db: Db) {
  return db
    .select()
    .from(t.policies)
    .all()
    .map((p) => ({
      id: p.id,
      policyNumber: p.policyNumber,
      customerId: p.customerId,
      insurerId: p.insurerId,
      product: p.product,
      status: p.status as 'ACTIVE' | 'PENDING_RENEWAL' | 'CANCELLED',
      inceptionDate: p.inceptionDate,
      renewalDate: p.renewalDate,
      premium: p.premium,
      riskSummary: p.riskSummary,
    }));
}

export function analyticsOverview(db: Db) {
  const byStatus = db
    .select({ status: t.cases.status, count: sql<number>`COUNT(*)` })
    .from(t.cases)
    .groupBy(t.cases.status)
    .all();
  const byWorkflow = db
    .select({ workflow: t.cases.workflow, count: sql<number>`COUNT(*)` })
    .from(t.cases)
    .groupBy(t.cases.workflow)
    .all();
  const decisionsByType = db
    .select({ decisionType: t.decisions.decisionType, count: sql<number>`COUNT(*)` })
    .from(t.decisions)
    .groupBy(t.decisions.decisionType)
    .all();
  return { byStatus, byWorkflow, decisionsByType };
}
