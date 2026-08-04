import { describe, it, expect } from 'vitest';
import {
  findCustomerCandidates,
  findPolicyCandidates,
  SEED_CUSTOMERS,
  SEED_POLICIES,
  type CommunicationInput,
} from '../src';

const comm = (over: Partial<CommunicationInput>): CommunicationInput => ({
  id: 'c1',
  from: 'someone@example.test',
  subject: '',
  bodyText: '',
  receivedAt: '2026-08-04T10:00:00+02:00',
  attachments: [],
  ...over,
});

describe('candidate matching', () => {
  it('matches the customer by sender email as top candidate', () => {
    const result = findCustomerCandidates(comm({ from: 'laura.martin@example.test' }), SEED_CUSTOMERS);
    expect(result[0]?.id).toBe('CUST-0001');
    expect(result[0]?.signals.join(' ')).toMatch(/email/i);
  });

  it('ranks a policy first when its number is quoted', () => {
    const c = comm({ from: 'unknown@example.test', bodyText: 'Sobre la póliza AUTO-000184, quería preguntar algo.' });
    const result = findPolicyCandidates(c, SEED_POLICIES, []);
    expect(result[0]?.id).toBe('AUTO-000184');
  });

  it('uses risk keywords plus customer ownership', () => {
    const c = comm({ from: 'laura.martin@example.test', subject: 'Golpe en parking - Audi Q5' });
    const customers = findCustomerCandidates(c, SEED_CUSTOMERS);
    const policies = findPolicyCandidates(c, SEED_POLICIES, customers);
    expect(policies[0]?.id).toBe('AUTO-000184');
  });

  it('returns no customers for an unknown sender with no identifying content', () => {
    const result = findCustomerCandidates(comm({ from: 'stranger@nowhere.test', bodyText: 'Hola, quiero un presupuesto.' }), SEED_CUSTOMERS);
    expect(result).toHaveLength(0);
  });

  it('never lets the score exceed 1', () => {
    const c = comm({
      from: 'laura.martin@example.test',
      bodyText: 'Laura Martin Vega, DNI 00000001A, teléfono 600111222, póliza AUTO-000184 del Audi Q5 1234-XYZ',
    });
    const customers = findCustomerCandidates(c, SEED_CUSTOMERS);
    const policies = findPolicyCandidates(c, SEED_POLICIES, customers);
    for (const cand of [...customers, ...policies]) {
      expect(cand.score).toBeLessThanOrEqual(1);
      expect(cand.score).toBeGreaterThan(0);
    }
  });
});
