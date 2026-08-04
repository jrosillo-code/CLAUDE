import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { MockProvider } from '@rosillo/ai';
import { analyseCommunication } from '@rosillo/domain';
import { openDatabase, type Db } from '../src/client';
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
import type Database from 'better-sqlite3';

const fixturesRoot = join(__dirname, '..', '..', '..', 'fixtures');

let db: Db;
let sqlite: Database.Database;

beforeAll(() => {
  ({ db, sqlite } = openDatabase(':memory:'));
  seedDatabase(db, fixturesRoot);
});

afterAll(() => sqlite.close());

async function analyseCase(caseId: string) {
  const comm = getCommunicationInput(db, caseId);
  expect(comm).not.toBeNull();
  const result = await analyseCommunication(comm!, {
    provider: new MockProvider(),
    customers: listCustomers(db),
    policies: listPolicies(db),
  });
  return recordAnalysisRun(db, caseId, result, 'USER-ana');
}

describe('database layer', () => {
  it('seeds the minimum synthetic dataset', () => {
    expect(listCustomers(db).length).toBeGreaterThanOrEqual(40);
    expect(listPolicies(db).length).toBeGreaterThanOrEqual(70);
    expect(listCases(db)).toHaveLength(12);
  });

  it('persists an immutable analysis run and updates the case', async () => {
    const runId = await analyseCase('C-001');
    const detail = getCaseDetail(db, 'C-001')!;
    expect(detail.caseRow.status).toBe('ANALYSED');
    expect(detail.caseRow.workflow).toBe('MOTOR_CLAIM');
    expect(detail.runs[0]!.id).toBe(runId);
    expect(detail.audit.map((a) => a.eventType)).toContain('ANALYSED');

    // Immutability: updating an analysis run must be rejected by the trigger.
    expect(() =>
      sqlite.prepare('UPDATE analysis_runs SET model = ? WHERE id = ?').run('tampered', runId),
    ).toThrow(/immutable/);
  });

  it('creates a new version on re-analysis instead of overwriting', async () => {
    await analyseCase('C-001');
    const detail = getCaseDetail(db, 'C-001')!;
    expect(detail.runs.map((r) => r.version)).toEqual([2, 1]);
  });

  it('blocks approval with unresolved REQUIRED items unless an override reason is given', async () => {
    const runId = await analyseCase('C-003');
    const blocked = recordDecision(db, {
      caseId: 'C-003',
      analysisRunId: runId,
      userId: 'USER-ana',
      input: { decisionType: 'APPROVE', editsJson: {}, feedbackCodes: [], note: '', overrideReason: '' },
    });
    expect(blocked.ok).toBe(false);

    const overridden = recordDecision(db, {
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
    expect(getCaseDetail(db, 'C-003')!.caseRow.status).toBe('DECIDED');
  });

  it('rejects decisions that reference an analysis run from another case', async () => {
    const runId = await analyseCase('C-002');
    const wrong = recordDecision(db, {
      caseId: 'C-004',
      analysisRunId: runId,
      userId: 'USER-ana',
      input: { decisionType: 'REJECT', editsJson: {}, feedbackCodes: [], note: '', overrideReason: '' },
    });
    expect(wrong.ok).toBe(false);
  });

  it('keeps audit events append-only', () => {
    expect(() => sqlite.prepare('DELETE FROM audit_events').run()).toThrow(/append-only/);
    expect(() =>
      sqlite.prepare("UPDATE audit_events SET event_type = 'tampered'").run(),
    ).toThrow(/append-only/);
  });

  it('rejects customers not marked SYNTHETIC', () => {
    expect(() =>
      sqlite
        .prepare("INSERT INTO customers (id, customer_type, name, classification) VALUES ('X', 'INDIVIDUAL', 'Real Person', 'PRODUCTION')")
        .run(),
    ).toThrow(/CHECK/);
  });
});
