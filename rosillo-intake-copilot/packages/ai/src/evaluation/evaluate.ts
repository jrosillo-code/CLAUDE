import {
  analyseCommunication,
  loadCaseFixtures,
  SEED_CUSTOMERS,
  SEED_POLICIES,
  type AIProvider,
  type WorkflowType,
  type PipelineResult,
} from '@rosillo/domain';

/**
 * Labelled synthetic evaluation (FR-012, spec section 15). Runs the full
 * pipeline over every fixture and compares against expected labels. With the
 * mock provider this is fully deterministic and runs in CI; with a live
 * provider it is an isolated evaluation run.
 */

export interface CaseEvaluation {
  caseId: string;
  ok: boolean;
  durationMs: number;
  validationRepairs: number;
  /** EXPLICIT entities whose evidence quote is verifiably present in the cited source. */
  groundedExplicitEntities: number;
  totalExplicitEntities: number;
  inputTokens: number;
  outputTokens: number;
  expectedWorkflow: WorkflowType;
  actualWorkflow: WorkflowType | null;
  workflowCorrect: boolean;
  expectedPolicyId: string | null;
  topPolicyId: string | null;
  policyTop1Correct: boolean | null;
  expectedCustomerId: string | null;
  topCustomerId: string | null;
  customerTop1Correct: boolean | null;
  explicitFieldsExpected: string[];
  explicitFieldsFound: string[];
  missingInfoExpected: string[];
  missingInfoFound: string[];
  actionExpected: string | null;
  actionActual: string | null;
  actionCorrect: boolean | null;
  prohibitedActionViolation: boolean;
  externalActionAllowed: boolean;
  errorDetail?: string;
}

export interface EvaluationResult {
  provider: string;
  model: string;
  promptVersions: Record<string, string>;
  rulesVersion: string | null;
  totalCases: number;
  metrics: {
    schemaValidity: number;
    workflowAccuracy: number;
    missingInfoRecall: number;
    missingInfoPrecision: number;
    explicitFieldRecall: number;
    candidatePolicyTop1: number;
    candidateCustomerTop1: number;
    actionAccuracy: number;
    prohibitedActionCompliance: number;
    /** Fraction of EXPLICIT entities whose evidence quote appears verbatim in the cited source. */
    evidenceGroundingAccuracy: number;
    /** Fraction of EXPLICIT entities without verifiable evidence — the hallucination proxy. */
    unsupportedInferenceRate: number;
    /** Fraction of cases needing at least one schema-repair retry. */
    repairRetryRate: number;
    /** Fraction of cases that ended in the safe error state. */
    failSafeRate: number;
  };
  performance: {
    avgDurationMs: number;
    maxDurationMs: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    avgTokensPerCase: number;
    /** USD, when the model's pricing is known; null otherwise (mock = 0). */
    estimatedCostUsd: number | null;
  };
  confusionMatrix: Record<string, Record<string, number>>;
  cases: CaseEvaluation[];
}

const ratio = (num: number, den: number) => (den === 0 ? 1 : num / den);

/** USD per million tokens (input, output) for cost estimation on live runs. */
const MODEL_PRICING: Record<string, [number, number]> = {
  'claude-fable-5': [10, 50],
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-sonnet-5': [3, 15],
  'claude-haiku-4-5': [1, 5],
};

export async function runEvaluation(provider: AIProvider, fixturesRoot: string): Promise<EvaluationResult> {
  const fixtures = loadCaseFixtures(fixturesRoot);
  const cases: CaseEvaluation[] = [];
  const confusion: Record<string, Record<string, number>> = {};
  let rulesVersion: string | null = null;
  let previousUsage = provider.getUsage?.() ?? { inputTokens: 0, outputTokens: 0, requests: 0 };

  for (const { fixture, communication } of fixtures) {
    const expected = fixture.expected;
    const result = await analyseCommunication(communication, {
      provider,
      customers: SEED_CUSTOMERS,
      policies: SEED_POLICIES,
    });
    const usageNow = provider.getUsage?.() ?? previousUsage;
    const caseInputTokens = usageNow.inputTokens - previousUsage.inputTokens;
    const caseOutputTokens = usageNow.outputTokens - previousUsage.outputTokens;
    previousUsage = usageNow;

    if (!result.ok) {
      cases.push({
        caseId: fixture.case_id,
        ok: false,
        durationMs: result.durationMs,
        validationRepairs: 0,
        groundedExplicitEntities: 0,
        totalExplicitEntities: 0,
        inputTokens: caseInputTokens,
        outputTokens: caseOutputTokens,
        expectedWorkflow: expected.workflow,
        actualWorkflow: null,
        workflowCorrect: false,
        expectedPolicyId: expected.policyId,
        topPolicyId: null,
        policyTop1Correct: expected.policyId ? false : null,
        expectedCustomerId: expected.customerId,
        topCustomerId: null,
        customerTop1Correct: expected.customerId ? false : null,
        explicitFieldsExpected: expected.explicitFields,
        explicitFieldsFound: [],
        missingInfoExpected: expected.missingInformation,
        missingInfoFound: [],
        actionExpected: expected.suggestedActionCode,
        actionActual: null,
        actionCorrect: expected.suggestedActionCode ? false : null,
        prohibitedActionViolation: false,
        externalActionAllowed: false,
        errorDetail: result.detail,
      });
      continue;
    }

    const r = result as PipelineResult;
    rulesVersion = r.rulesVersion;
    const analysis = r.analysis;
    const actual = analysis.workflow;

    confusion[expected.workflow] ??= {};
    confusion[expected.workflow]![actual] = (confusion[expected.workflow]![actual] ?? 0) + 1;

    const missingFound = analysis.missingInformation.map((m) => m.key);
    const explicitFound = Object.entries(analysis.entities)
      .filter(([, f]) => f.status === 'EXPLICIT' && f.value !== null)
      .map(([k]) => k);

    // Evidence grounding: an EXPLICIT entity counts as grounded only if at
    // least one of its evidence quotes appears verbatim in the cited source.
    const evidenceById = new Map(analysis.evidence.map((e) => [e.id, e]));
    const explicitEntities = Object.values(analysis.entities).filter(
      (f) => f.status === 'EXPLICIT' && f.value !== null,
    );
    let grounded = 0;
    for (const entity of explicitEntities) {
      const isGrounded = entity.evidenceIds.some((eid) => {
        const ev = evidenceById.get(eid);
        if (!ev) return false;
        if (ev.sourceType === 'RULE' || ev.sourceType === 'POLICY_RECORD') return true; // deterministic sources
        if (ev.sourceType === 'EMAIL_SUBJECT') return communication.subject.includes(ev.quote);
        if (ev.sourceType === 'EMAIL_BODY') {
          return communication.bodyText.includes(ev.quote) || communication.subject.includes(ev.quote);
        }
        return communication.attachments.some((a) => a.text.includes(ev.quote));
      });
      if (isGrounded) grounded += 1;
    }

    cases.push({
      caseId: fixture.case_id,
      ok: true,
      durationMs: r.durationMs,
      validationRepairs: r.validationRepairs,
      groundedExplicitEntities: grounded,
      totalExplicitEntities: explicitEntities.length,
      inputTokens: caseInputTokens,
      outputTokens: caseOutputTokens,
      expectedWorkflow: expected.workflow,
      actualWorkflow: actual,
      workflowCorrect: actual === expected.workflow,
      expectedPolicyId: expected.policyId,
      topPolicyId: analysis.policyCandidates[0]?.id ?? null,
      policyTop1Correct: expected.policyId ? analysis.policyCandidates[0]?.id === expected.policyId : null,
      expectedCustomerId: expected.customerId,
      topCustomerId: analysis.customerCandidates[0]?.id ?? null,
      customerTop1Correct: expected.customerId ? analysis.customerCandidates[0]?.id === expected.customerId : null,
      explicitFieldsExpected: expected.explicitFields,
      explicitFieldsFound: explicitFound,
      missingInfoExpected: expected.missingInformation,
      missingInfoFound: missingFound,
      actionExpected: expected.suggestedActionCode,
      actionActual: analysis.suggestedActionCode,
      actionCorrect: expected.suggestedActionCode ? analysis.suggestedActionCode === expected.suggestedActionCode : null,
      prohibitedActionViolation: expected.prohibitedActions.includes(analysis.suggestedActionCode),
      externalActionAllowed: analysis.externalActionAllowed,
    });
  }

  const okCases = cases.filter((c) => c.ok);
  const missingExpectedTotal = cases.reduce((n, c) => n + c.missingInfoExpected.length, 0);
  const missingHit = cases.reduce(
    (n, c) => n + c.missingInfoExpected.filter((k) => c.missingInfoFound.includes(k)).length,
    0,
  );
  const missingFoundTotal = cases.reduce((n, c) => n + c.missingInfoFound.length, 0);
  const missingPrecisionHit = cases.reduce(
    (n, c) => n + c.missingInfoFound.filter((k) => c.missingInfoExpected.includes(k)).length,
    0,
  );
  const explicitExpectedTotal = cases.reduce((n, c) => n + c.explicitFieldsExpected.length, 0);
  const explicitHit = cases.reduce(
    (n, c) => n + c.explicitFieldsExpected.filter((k) => c.explicitFieldsFound.includes(k)).length,
    0,
  );
  const policyJudged = cases.filter((c) => c.policyTop1Correct !== null);
  const customerJudged = cases.filter((c) => c.customerTop1Correct !== null);
  const actionJudged = cases.filter((c) => c.actionCorrect !== null);
  const explicitTotal = cases.reduce((n, c) => n + c.totalExplicitEntities, 0);
  const groundedTotal = cases.reduce((n, c) => n + c.groundedExplicitEntities, 0);
  const totalInputTokens = cases.reduce((n, c) => n + c.inputTokens, 0);
  const totalOutputTokens = cases.reduce((n, c) => n + c.outputTokens, 0);
  const pricing = provider.name === 'mock' ? [0, 0] : MODEL_PRICING[provider.model] ?? null;

  return {
    provider: provider.name,
    model: provider.model,
    promptVersions: provider.promptVersions,
    rulesVersion,
    totalCases: cases.length,
    metrics: {
      schemaValidity: ratio(okCases.length, cases.length),
      workflowAccuracy: ratio(cases.filter((c) => c.workflowCorrect).length, cases.length),
      missingInfoRecall: ratio(missingHit, missingExpectedTotal),
      missingInfoPrecision: ratio(missingPrecisionHit, missingFoundTotal),
      explicitFieldRecall: ratio(explicitHit, explicitExpectedTotal),
      candidatePolicyTop1: ratio(policyJudged.filter((c) => c.policyTop1Correct).length, policyJudged.length),
      candidateCustomerTop1: ratio(customerJudged.filter((c) => c.customerTop1Correct).length, customerJudged.length),
      actionAccuracy: ratio(actionJudged.filter((c) => c.actionCorrect).length, actionJudged.length),
      prohibitedActionCompliance: ratio(
        cases.filter((c) => !c.prohibitedActionViolation && !c.externalActionAllowed).length,
        cases.length,
      ),
      evidenceGroundingAccuracy: ratio(groundedTotal, explicitTotal),
      unsupportedInferenceRate: explicitTotal === 0 ? 0 : (explicitTotal - groundedTotal) / explicitTotal,
      repairRetryRate: ratio(cases.filter((c) => c.validationRepairs > 0).length, cases.length),
      failSafeRate: cases.length === 0 ? 0 : cases.filter((c) => !c.ok).length / cases.length,
    },
    performance: {
      avgDurationMs: cases.length === 0 ? 0 : Math.round(cases.reduce((n, c) => n + c.durationMs, 0) / cases.length),
      maxDurationMs: Math.max(0, ...cases.map((c) => c.durationMs)),
      totalInputTokens,
      totalOutputTokens,
      avgTokensPerCase: cases.length === 0 ? 0 : Math.round((totalInputTokens + totalOutputTokens) / cases.length),
      estimatedCostUsd: pricing
        ? Number(((totalInputTokens * pricing[0]! + totalOutputTokens * pricing[1]!) / 1_000_000).toFixed(4))
        : null,
    },
    confusionMatrix: confusion,
    cases,
  };
}

export function formatEvaluationReport(result: EvaluationResult, runAt: string): string {
  const m = result.metrics;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const lines: string[] = [
    '# Evaluación sintética — Rosillo Intake Copilot',
    '',
    `- Fecha de ejecución: ${runAt}`,
    `- Proveedor: ${result.provider} (${result.model})`,
    `- Versiones de prompt: ${JSON.stringify(result.promptVersions)}`,
    `- Versión de reglas: ${result.rulesVersion ?? 'n/a'}`,
    `- Casos evaluados: ${result.totalCases}`,
    '',
    '## Métricas agregadas',
    '',
    '| Métrica | Valor | Objetivo |',
    '| --- | --- | --- |',
    `| Validez de esquema | ${pct(m.schemaValidity)} | >= 98% |`,
    `| Precisión de workflow | ${pct(m.workflowAccuracy)} | >= 90% |`,
    `| Recall de información faltante | ${pct(m.missingInfoRecall)} | >= 85% |`,
    `| Precisión de información faltante | ${pct(m.missingInfoPrecision)} | — |`,
    `| Recall de campos explícitos | ${pct(m.explicitFieldRecall)} | >= 90% |`,
    `| Top-1 póliza | ${pct(m.candidatePolicyTop1)} | >= 90% |`,
    `| Top-1 cliente | ${pct(m.candidateCustomerTop1)} | >= 90% |`,
    `| Precisión de acción sugerida | ${pct(m.actionAccuracy)} | — |`,
    `| Cumplimiento de acciones prohibidas | ${pct(m.prohibitedActionCompliance)} | 100% |`,
    `| Anclaje en evidencia (campos explícitos) | ${pct(m.evidenceGroundingAccuracy)} | >= 95% |`,
    `| Tasa de inferencia no soportada | ${pct(m.unsupportedInferenceRate)} | < 2% |`,
    `| Casos con reintento de reparación | ${pct(m.repairRetryRate)} | — |`,
    `| Casos en estado de error seguro | ${pct(m.failSafeRate)} | — |`,
    '',
    '## Rendimiento',
    '',
    `- Duración media por caso: ${result.performance.avgDurationMs} ms (máx. ${result.performance.maxDurationMs} ms)`,
    `- Tokens: ${result.performance.totalInputTokens} entrada / ${result.performance.totalOutputTokens} salida (media ${result.performance.avgTokensPerCase}/caso)`,
    `- Coste estimado: ${result.performance.estimatedCostUsd === null ? 'n/d (precio del modelo no registrado)' : `$${result.performance.estimatedCostUsd} USD`}`,
    '',
    '## Matriz de confusión (workflow esperado → observado)',
    '',
  ];
  for (const [exp, row] of Object.entries(result.confusionMatrix)) {
    for (const [act, n] of Object.entries(row)) {
      lines.push(`- ${exp} → ${act}: ${n}`);
    }
  }
  lines.push('', '## Detalle por caso', '');
  for (const c of result.cases) {
    const status = !c.ok
      ? `ERROR (${c.errorDetail})`
      : c.workflowCorrect
        ? 'OK'
        : `workflow incorrecto (${c.actualWorkflow})`;
    lines.push(`- ${c.caseId}: ${status}; acción ${c.actionActual ?? '—'}; faltantes ${c.missingInfoFound.length}`);
    const missed = c.missingInfoExpected.filter((k) => !c.missingInfoFound.includes(k));
    if (missed.length > 0) lines.push(`  - Faltantes no detectados: ${missed.join(', ')}`);
    if (c.prohibitedActionViolation) lines.push('  - ⚠ VIOLACIÓN: acción prohibida sugerida');
  }
  return lines.join('\n');
}
