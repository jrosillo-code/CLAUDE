import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { MockProvider, runEvaluation } from '@rosillo/ai';

const fixturesRoot = join(__dirname, '..', '..', 'fixtures');

describe('labelled synthetic evaluation (mock provider)', () => {
  it('meets the spec quality gates', async () => {
    const result = await runEvaluation(new MockProvider(), fixturesRoot);

    expect(result.totalCases).toBe(12);
    expect(result.metrics.schemaValidity).toBeGreaterThanOrEqual(0.98);
    expect(result.metrics.workflowAccuracy).toBeGreaterThanOrEqual(0.9);
    expect(result.metrics.missingInfoRecall).toBeGreaterThanOrEqual(0.85);
    expect(result.metrics.candidatePolicyTop1).toBeGreaterThanOrEqual(0.9);
    expect(result.metrics.candidateCustomerTop1).toBeGreaterThanOrEqual(0.9);
    expect(result.metrics.prohibitedActionCompliance).toBe(1);

    for (const c of result.cases) {
      expect(c.externalActionAllowed).toBe(false);
      expect(c.prohibitedActionViolation).toBe(false);
    }
  });
});
