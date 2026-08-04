import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { MockProvider } from '../src';
import { loadCaseFixtures, caseAnalysisSchema, WORKFLOW_TYPES } from '@rosillo/domain';

const fixturesRoot = join(__dirname, '..', '..', '..', 'fixtures');
const fixtures = loadCaseFixtures(fixturesRoot);
const provider = new MockProvider();

describe('mock provider', () => {
  it('loads the twelve starter fixtures', () => {
    expect(fixtures).toHaveLength(12);
  });

  for (const { fixture, communication } of fixtures) {
    it(`classifies ${fixture.case_id} as ${fixture.expected.workflow}`, async () => {
      const raw = await provider.analyseCase({ communication, allowedWorkflows: WORKFLOW_TYPES });
      const analysis = caseAnalysisSchema.parse(raw);
      expect(analysis.workflow).toBe(fixture.expected.workflow);
      expect(analysis.externalActionAllowed).toBe(false);
    });
  }

  it('is deterministic across runs', async () => {
    const target = fixtures[0]!;
    const a = await provider.analyseCase({ communication: target.communication, allowedWorkflows: WORKFLOW_TYPES });
    const b = await provider.analyseCase({ communication: target.communication, allowedWorkflows: WORKFLOW_TYPES });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('links every extracted field to evidence', async () => {
    for (const { communication } of fixtures) {
      const analysis = caseAnalysisSchema.parse(
        await provider.analyseCase({ communication, allowedWorkflows: WORKFLOW_TYPES }),
      );
      const evidenceIds = new Set(analysis.evidence.map((e) => e.id));
      for (const [key, f] of Object.entries(analysis.entities)) {
        expect(f.evidenceIds.length, `entity ${key} has no evidence`).toBeGreaterThan(0);
        for (const id of f.evidenceIds) expect(evidenceIds.has(id)).toBe(true);
      }
    }
  });

  it('drafts Spanish responses without a send capability and with placeholders for gaps', async () => {
    const target = fixtures.find((f) => f.fixture.case_id === 'C-001')!;
    const analysis = caseAnalysisSchema.parse(
      await provider.analyseCase({ communication: target.communication, allowedWorkflows: WORKFLOW_TYPES }),
    );
    const missing = [
      { key: 'exact_incident_time', label: 'Hora exacta del incidente', severity: 'REQUIRED' as const, ruleId: 'MC-001' },
    ];
    const draft = (await provider.draftResponse({
      communication: target.communication,
      analysis,
      missingInformation: missing,
      tone: 'WARM',
    })) as { body: string; placeholders: string[] };
    expect(draft.body).toContain('BORRADOR INTERNO');
    expect(draft.body.toLowerCase()).toContain('hora exacta');
    expect(draft.placeholders).toContain('[EXACT_INCIDENT_TIME]');
  });
});
