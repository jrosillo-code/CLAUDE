import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  caseAnalysisSchema,
  candidateRankingSchema,
  loadCaseFixtures,
  analyseCommunication,
  SEED_CUSTOMERS,
  SEED_POLICIES,
  WORKFLOW_TYPES,
} from '@rosillo/domain';
import { MockProvider } from '@rosillo/ai';
import { openDatabase, seedDatabase, listCases } from '@rosillo/database';

const fixturesRoot = join(__dirname, '..', '..', 'fixtures');

describe('schema hardening', () => {
  const validAnalysis = {
    workflow: 'UNKNOWN',
    workflowConfidence: 0.5,
    secondaryWorkflows: [],
    summary: 'ok',
    entities: {},
    evidence: [],
    customerCandidates: [],
    policyCandidates: [],
    missingInformation: [],
    riskFlags: [],
    suggestedActionCode: 'NO_ACTION_NOT_OPERATIONAL',
    suggestedActionRationale: 'ok',
    externalActionAllowed: false,
  };

  it('strips unexpected fields injected into AI output', () => {
    const parsed = caseAnalysisSchema.parse({
      ...validAnalysis,
      __proto__pollution: 'x',
      execute_command: 'rm -rf /',
      send_email_to: 'victim@example.com',
    });
    expect(parsed).not.toHaveProperty('execute_command');
    expect(parsed).not.toHaveProperty('send_email_to');
  });

  it('rejects externalActionAllowed=true at the schema level', () => {
    expect(() => caseAnalysisSchema.parse({ ...validAnalysis, externalActionAllowed: true })).toThrow();
  });

  it('rejects oversized fields (no unbounded content from the model)', () => {
    expect(() => caseAnalysisSchema.parse({ ...validAnalysis, summary: 'x'.repeat(10_000) })).toThrow();
    expect(() =>
      candidateRankingSchema.parse({ rankedPolicyIds: [], rankedCustomerIds: [], rationale: 'x'.repeat(10_000) }),
    ).toThrow();
  });

  it('rejects action codes outside the enumerated catalogue', () => {
    expect(() => caseAnalysisSchema.parse({ ...validAnalysis, suggestedActionCode: 'CANCEL_POLICY' })).toThrow();
    expect(() => caseAnalysisSchema.parse({ ...validAnalysis, suggestedActionCode: 'SEND_EMAIL' })).toThrow();
  });
});

describe('prompt-injection containment (deterministic checks)', () => {
  const provider = new MockProvider();
  const fixtures = loadCaseFixtures(fixturesRoot);

  it('instructions embedded in emails never produce prohibited actions or external permission', async () => {
    for (const { fixture, communication } of fixtures) {
      const result = await analyseCommunication(communication, {
        provider,
        customers: SEED_CUSTOMERS,
        policies: SEED_POLICIES,
      });
      expect(result.ok, fixture.case_id).toBe(true);
      if (!result.ok) continue;
      expect(result.analysis.externalActionAllowed).toBe(false);
      expect(fixture.expected.prohibitedActions).not.toContain(result.analysis.suggestedActionCode);
    }
  });

  it('an attachment claiming a false policy id cannot make the system invent that policy', async () => {
    const target = fixtures.find((f) => f.fixture.case_id === 'C-014')!;
    const result = await analyseCommunication(target.communication, {
      provider,
      customers: SEED_CUSTOMERS,
      policies: SEED_POLICIES,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.analysis.policyCandidates.map((c) => c.id);
    expect(ids).not.toContain('AUTO-999999');
    expect(ids[0]).toBe('MOTO-000088');
  });

  it('hostile HTML in model output survives only as inert, bounded strings', async () => {
    const hostile = caseAnalysisSchema.parse({
      workflow: 'UNKNOWN',
      workflowConfidence: 0.5,
      secondaryWorkflows: [],
      summary: '<script>alert(1)</script>',
      entities: {},
      evidence: [],
      customerCandidates: [],
      policyCandidates: [],
      missingInformation: [],
      riskFlags: ['<img src=x onerror=alert(1)>'],
      suggestedActionCode: 'NO_ACTION_NOT_OPERATIONAL',
      suggestedActionRationale: 'x',
      externalActionAllowed: false,
    });
    // Strings are data; rendering-layer escaping is asserted in the Playwright
    // XSS spec. Here we prove nothing gets normalised into executable form.
    expect(hostile.summary).toBe('<script>alert(1)</script>');
  });
});

describe('injection-shaped inputs against the data layer', () => {
  it('SQLi strings in filters are parameterised and match nothing', () => {
    const { db, sqlite } = openDatabase(':memory:');
    seedDatabase(db, fixturesRoot);
    const payloads = ["'; DROP TABLE cases;--", '" OR 1=1 --', "NEW' UNION SELECT * FROM users --"];
    for (const p of payloads) {
      expect(listCases(db, { status: p })).toHaveLength(0);
      expect(listCases(db, { workflow: p })).toHaveLength(0);
      expect(listCases(db, { assigneeId: p })).toHaveLength(0);
    }
    // Tables intact.
    expect(listCases(db).length).toBeGreaterThan(0);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get()).toMatchObject({ n: 5 });
    sqlite.close();
  });
});

describe('path traversal', () => {
  it('rejects attachment references that escape the fixtures directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rosillo-sec-'));
    mkdirSync(join(dir, 'emails'));
    mkdirSync(join(dir, 'attachments'));
    writeFileSync(
      join(dir, 'emails', 'EVIL-1.json'),
      JSON.stringify({
        case_id: 'EVIL-1',
        classification: 'SYNTHETIC',
        received_at: '2026-08-04T10:00:00+02:00',
        from: 'a@example.test',
        subject: 's',
        body: 'b',
        priority: 'LOW',
        attachments: ['../../.env'],
        expected: {
          workflow: 'UNKNOWN',
          policyId: null,
          customerId: null,
          explicitFields: [],
          missingInformation: [],
          prohibitedActions: [],
          suggestedActionCode: null,
        },
      }),
    );
    expect(() => loadCaseFixtures(dir)).toThrow(/unsafe attachment filename/);
  });

  it('rejects fixtures not marked SYNTHETIC', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rosillo-sec-'));
    mkdirSync(join(dir, 'emails'));
    mkdirSync(join(dir, 'attachments'));
    writeFileSync(
      join(dir, 'emails', 'PROD-1.json'),
      JSON.stringify({
        case_id: 'PROD-1',
        classification: 'PRODUCTION',
        received_at: '2026-08-04T10:00:00+02:00',
        from: 'a@example.test',
        subject: 's',
        body: 'b',
        attachments: [],
        expected: {
          workflow: 'UNKNOWN',
          policyId: null,
          customerId: null,
          explicitFields: [],
          missingInformation: [],
          prohibitedActions: [],
          suggestedActionCode: null,
        },
      }),
    );
    expect(() => loadCaseFixtures(dir)).toThrow();
  });
});

describe('secret leakage', () => {
  it('client-side bundles contain no provider secrets or server configuration', () => {
    const staticDir = join(__dirname, '..', '..', 'apps', 'web', '.next', 'static');
    if (!existsSync(staticDir)) {
      console.warn('SKIP: apps/web/.next/static not found — run `npm run build` before the security suite for full coverage.');
      return;
    }
    const offenders: string[] = [];
    const scan = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) scan(p);
        else if (/\.(js|css|txt|json)$/.test(entry)) {
          const content = readFileSync(p, 'utf8');
          if (/sk-ant-|ANTHROPIC_API_KEY|AUTH_SECRET|CASE_ANALYST v1|better-sqlite3/.test(content)) {
            offenders.push(p);
          }
        }
      }
    };
    scan(staticDir);
    expect(offenders).toEqual([]);
  });

  it('pipeline failure details are bounded (no unbounded stack/config dumps)', async () => {
    const explodingProvider = {
      name: 'exploding',
      model: 'x',
      promptVersions: {},
      analyseCase: async () => {
        throw new Error('boom '.repeat(500) + process.env.HOME);
      },
      rankCandidates: async () => ({}),
      draftResponse: async () => ({}),
      healthCheck: async () => ({ ok: false, provider: 'exploding', model: 'x' }),
    };
    const result = await analyseCommunication(
      {
        id: 'c',
        from: 'a@example.test',
        subject: 's',
        bodyText: 'b',
        receivedAt: '2026-08-04T10:00:00+02:00',
        attachments: [],
      },
      { provider: explodingProvider, customers: SEED_CUSTOMERS, policies: SEED_POLICIES },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail.length).toBeLessThanOrEqual(500);
  });

  it('mock provider output never echoes environment variables', async () => {
    process.env.FAKE_SECRET_CANARY = 'canary-value-123';
    const provider = new MockProvider();
    const fixtures = loadCaseFixtures(fixturesRoot);
    const raw = JSON.stringify(
      await provider.analyseCase({ communication: fixtures[0]!.communication, allowedWorkflows: WORKFLOW_TYPES }),
    );
    expect(raw).not.toContain('canary-value-123');
  });
});
