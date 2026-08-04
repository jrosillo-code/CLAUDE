import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { MockProvider } from '@rosillo/ai';
import { analyseCommunication } from '@rosillo/domain';
import { openDatabase, type Db, type DatabaseHandle } from '../src/client';
import { seedDatabase } from '../src/seed';
import {
  listCases,
  getCaseDetail,
  getCommunicationInput,
  listCustomers,
  listPolicies,
  recordAnalysisRun,
  recordDecision,
} from '../src/repositories';

const fixturesRoot = join(__dirname, '..', '..', '..', 'fixtures');

/** Drizzle wraps driver errors ("Failed query: …") with the Postgres error in `cause`. */
async function expectDbRejection(promise: Promise<unknown>, pattern: RegExp) {
  let caught: unknown = null;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught, 'expected the statement to be rejected').not.toBeNull();
  const err = caught as Error & { cause?: Error };
  expect(`${err.message} ${err.cause?.message ?? ''}`).toMatch(pattern);
}

let handle: DatabaseHandle;
let db: Db;

beforeAll(async () => {
  handle = await openDatabase(':memory:'); // PGlite in-memory: real Postgres semantics
  db = handle.db;
  await seedDatabase(db, fixturesRoot);
}, 60_000);

afterAll(async () => {
  await handle.close();
});

async function analyseCase(caseId: string) {
  const comm = await getCommunicationInput(db, caseId);
  expect(comm).not.toBeNull();
  const result = await analyseCommunication(comm!, {
    provider: new MockProvider(),
    customers: await listCustomers(db),
    policies: await listPolicies(db),
  });
  return recordAnalysisRun(db, caseId, result, 'USER-ana');
}

describe('database layer (Postgres dialect via PGlite)', () => {
  it('seeds the minimum synthetic dataset', async () => {
    expect((await listCustomers(db)).length).toBeGreaterThanOrEqual(40);
    expect((await listPolicies(db)).length).toBeGreaterThanOrEqual(70);
    expect(await listCases(db)).toHaveLength(19);
  });

  it('persists an immutable analysis run and updates the case', async () => {
    const runId = await analyseCase('C-001');
    const detail = (await getCaseDetail(db, 'C-001'))!;
    expect(detail.caseRow.status).toBe('ANALYSED');
    expect(detail.caseRow.workflow).toBe('MOTOR_CLAIM');
    expect(detail.runs[0]!.id).toBe(runId);
    expect(detail.audit.map((a) => a.eventType)).toContain('ANALYSED');

    // Immutability: updating an analysis run must be rejected by the trigger.
    await expectDbRejection(
      db.execute(sql`UPDATE analysis_runs SET model = 'tampered' WHERE id = ${runId}`),
      /immutable/,
    );
  });

  it('creates a new version on re-analysis instead of overwriting', async () => {
    await analyseCase('C-001');
    const detail = (await getCaseDetail(db, 'C-001'))!;
    expect(detail.runs.map((r) => r.version)).toEqual([2, 1]);
  });

  it('blocks approval with unresolved REQUIRED items unless an override reason is given', async () => {
    const runId = await analyseCase('C-003');
    const blocked = await recordDecision(db, {
      caseId: 'C-003',
      analysisRunId: runId,
      userId: 'USER-ana',
      input: { decisionType: 'APPROVE', editsJson: {}, feedbackCodes: [], note: '', overrideReason: '' },
    });
    expect(blocked.ok).toBe(false);

    const overridden = await recordDecision(db, {
      caseId: 'C-003',
      analysisRunId: runId,
      userId: 'USER-carlos',
      input: {
        decisionType: 'APPROVE',
        editsJson: {},
        feedbackCodes: [],
        note: '',
        overrideReason: 'Cliente confirmó por teléfono (supervisor).',
      },
    });
    expect(overridden.ok).toBe(true);
    expect((await getCaseDetail(db, 'C-003'))!.caseRow.status).toBe('DECIDED');
  });

  it('rejects decisions that reference an analysis run from another case', async () => {
    const runId = await analyseCase('C-002');
    const wrong = await recordDecision(db, {
      caseId: 'C-004',
      analysisRunId: runId,
      userId: 'USER-ana',
      input: { decisionType: 'REJECT', editsJson: {}, feedbackCodes: [], note: '', overrideReason: '' },
    });
    expect(wrong.ok).toBe(false);
  });

  it('keeps audit events append-only', async () => {
    await expectDbRejection(db.execute(sql`DELETE FROM audit_events`), /append-only/);
    await expectDbRejection(db.execute(sql`UPDATE audit_events SET event_type = 'tampered'`), /append-only/);
  });

  it('rejects customers not marked SYNTHETIC', async () => {
    await expectDbRejection(
      db.execute(
        sql`INSERT INTO customers (id, customer_type, name, classification) VALUES ('X', 'INDIVIDUAL', 'Real Person', 'PRODUCTION')`,
      ),
      /check/i,
    );
  });
});
