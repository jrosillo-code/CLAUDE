import { describe, it, expect } from 'vitest';
import {
  analyseCommunication,
  preprocessCommunication,
  type AIProvider,
  type CommunicationInput,
  SEED_CUSTOMERS,
  SEED_POLICIES,
} from '../src';

const comm: CommunicationInput = {
  id: 'c1',
  from: 'laura.martin@example.test',
  subject: 'Golpe en parking',
  bodyText: 'Ayer encontré el coche golpeado en el parking de Serrano. Adjunto fotos.',
  receivedAt: '2026-08-04T10:00:00+02:00',
  attachments: [
    { id: 'a1', filename: 'foto.jpg', mimeType: 'image/jpeg', text: '', hash: 'h1' },
    { id: 'a2', filename: 'malware.exe', mimeType: 'application/x-msdownload', text: '', hash: 'h2' },
  ],
};

/** A hostile/buggy provider used to prove the pipeline enforces safety invariants. */
function makeProvider(overrides: Record<string, unknown>): AIProvider {
  const base = {
    workflow: 'MOTOR_CLAIM',
    workflowConfidence: 0.9,
    secondaryWorkflows: [],
    summary: 'Resumen de prueba.',
    entities: {},
    evidence: [],
    customerCandidates: [],
    policyCandidates: [],
    missingInformation: [],
    riskFlags: [],
    suggestedActionCode: 'REQUEST_CLAIM_DETAILS',
    suggestedActionRationale: 'test',
    externalActionAllowed: false,
  };
  return {
    name: 'test',
    model: 'test-model',
    promptVersions: {},
    async analyseCase() {
      return { ...base, ...overrides };
    },
    async rankCandidates(input) {
      return {
        rankedCustomerIds: [...input.customerCandidates.map((c) => c.id), 'INVENTED-999'],
        rankedPolicyIds: ['INVENTED-POLICY', ...input.policyCandidates.map((c) => c.id)],
        rationale: 'test',
      };
    },
    async draftResponse() {
      return { language: 'es', tone: 'WARM', body: 'Borrador de prueba.', placeholders: [] };
    },
    async healthCheck() {
      return { ok: true, provider: 'test', model: 'test-model' };
    },
  };
}

const deps = (provider: AIProvider) => ({ provider, customers: SEED_CUSTOMERS, policies: SEED_POLICIES });

describe('analysis pipeline safety invariants', () => {
  it('rejects disallowed attachment types during preprocessing', () => {
    const { communication, rejectedAttachments } = preprocessCommunication(comm);
    expect(rejectedAttachments).toEqual(['malware.exe']);
    expect(communication.attachments.map((a) => a.filename)).toEqual(['foto.jpg']);
  });

  it('discards candidate ids the provider invented', async () => {
    const result = await analyseCommunication(comm, deps(makeProvider({})));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = [
      ...result.analysis.customerCandidates.map((c) => c.id),
      ...result.analysis.policyCandidates.map((c) => c.id),
    ];
    expect(ids).not.toContain('INVENTED-999');
    expect(ids).not.toContain('INVENTED-POLICY');
  });

  it('replaces an out-of-catalogue action with a deterministic fallback', async () => {
    const result = await analyseCommunication(
      comm,
      deps(makeProvider({ suggestedActionCode: 'PREPARE_CANCELLATION_SUMMARY' })), // not valid for MOTOR_CLAIM
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(['REQUEST_CLAIM_DETAILS', 'PREPARE_CLAIM_OPENING']).toContain(result.analysis.suggestedActionCode);
  });

  it('fails safe when the provider returns externalActionAllowed=true', async () => {
    // The schema only admits `false`; a provider claiming true must not survive validation.
    const result = await analyseCommunication(comm, deps(makeProvider({ externalActionAllowed: true })));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe('SCHEMA_VALIDATION_FAILED');
  });

  it('overrides the model missing-information proposal with deterministic rules', async () => {
    const result = await analyseCommunication(
      comm,
      deps(
        makeProvider({
          missingInformation: [
            { key: 'invented_item', label: 'Invented', severity: 'REQUIRED', ruleId: 'FAKE-999' },
          ],
        }),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const keys = result.analysis.missingInformation.map((m) => m.key);
    expect(keys).not.toContain('invented_item');
    expect(keys).toContain('exact_incident_time');
  });

  it('returns a safe error state after a repair retry also fails validation', async () => {
    const provider = makeProvider({ workflow: 'NOT_A_WORKFLOW' });
    const result = await analyseCommunication(comm, deps(provider));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe('SCHEMA_VALIDATION_FAILED');
    expect(result.inputHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
