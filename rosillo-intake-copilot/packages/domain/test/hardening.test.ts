import { describe, it, expect } from 'vitest';
import { RateLimiter, analyseCommunication, SEED_CUSTOMERS, SEED_POLICIES, type AIProvider, type CommunicationInput } from '../src';

describe('rate limiter', () => {
  it('allows up to the limit within the window and blocks after', () => {
    let t = 0;
    const limiter = new RateLimiter({ limit: 3, windowMs: 60_000, now: () => t });
    expect(limiter.tryAcquire('u1')).toBe(true);
    expect(limiter.tryAcquire('u1')).toBe(true);
    expect(limiter.tryAcquire('u1')).toBe(true);
    expect(limiter.tryAcquire('u1')).toBe(false);
    expect(limiter.retryAfterSeconds('u1')).toBe(60);
    // Other keys are unaffected.
    expect(limiter.tryAcquire('u2')).toBe(true);
    // The window slides.
    t = 61_000;
    expect(limiter.tryAcquire('u1')).toBe(true);
  });
});

describe('provider timeout', () => {
  it('ends in the safe error state when the provider hangs', async () => {
    const hangingProvider: AIProvider = {
      name: 'hanging',
      model: 'hang-1',
      promptVersions: {},
      analyseCase: () => new Promise(() => {}), // never resolves
      rankCandidates: async () => ({}),
      draftResponse: async () => ({}),
      healthCheck: async () => ({ ok: false, provider: 'hanging', model: 'hang-1' }),
    };
    const comm: CommunicationInput = {
      id: 'c-timeout',
      from: 'a@example.test',
      subject: 'x',
      bodyText: 'y',
      receivedAt: '2026-08-04T10:00:00+02:00',
      attachments: [],
    };
    const result = await analyseCommunication(comm, {
      provider: hangingProvider,
      customers: SEED_CUSTOMERS,
      policies: SEED_POLICIES,
      providerTimeoutMs: 50,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe('PROVIDER_TIMEOUT');
    expect(result.durationMs).toBeGreaterThanOrEqual(50);
  });
});
