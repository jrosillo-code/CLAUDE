import {
  loadCaseFixtures,
  SEED_CUSTOMERS,
  SEED_POLICIES,
  SEED_INSURERS,
  SEED_USERS,
} from '@rosillo/domain';
import type { Db } from './client';
import * as t from './schema';
import { appendAudit } from './repositories';

/**
 * Reproducible synthetic seed (spec section 14). Idempotent: wipes and reloads.
 * Inserts are batched per table so seeding a remote Supabase database stays fast.
 */
export async function seedDatabase(db: Db, fixturesRoot: string) {
  const now = new Date().toISOString();

  // Order matters for foreign keys.
  await db.delete(t.evaluationLabels);
  await db.delete(t.decisions);
  await db.delete(t.analysisRuns);
  await db.delete(t.attachments);
  await db.delete(t.communications);
  await db.delete(t.cases);
  await db.delete(t.policies);
  await db.delete(t.customers);
  await db.delete(t.insurers);
  await db.delete(t.users);

  await db
    .insert(t.users)
    .values(SEED_USERS.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: now })));
  await db.insert(t.insurers).values([...SEED_INSURERS]);
  await db.insert(t.customers).values(
    SEED_CUSTOMERS.map((c) => ({
      id: c.id,
      customerType: c.customerType,
      name: c.name,
      email: c.email,
      phone: c.phone,
      taxIdFake: c.taxIdFake,
      classification: 'SYNTHETIC',
    })),
  );
  await db.insert(t.policies).values(
    SEED_POLICIES.map((p) => ({
      id: p.id,
      policyNumber: p.policyNumber,
      customerId: p.customerId,
      insurerId: p.insurerId,
      product: p.product,
      status: p.status,
      inceptionDate: p.inceptionDate,
      renewalDate: p.renewalDate,
      premium: p.premium,
      riskSummary: p.riskSummary,
    })),
  );

  const fixtures = loadCaseFixtures(fixturesRoot);
  await db.insert(t.cases).values(
    fixtures.map(({ fixture }) => ({
      id: fixture.case_id,
      workflow: 'UNKNOWN',
      status: 'NEW',
      priority: fixture.priority,
      createdAt: fixture.received_at,
      updatedAt: fixture.received_at,
    })),
  );
  await db.insert(t.communications).values(
    fixtures.map(({ fixture, communication }) => ({
      id: communication.id,
      caseId: fixture.case_id,
      sender: communication.from,
      subject: communication.subject,
      bodyText: communication.bodyText,
      receivedAt: communication.receivedAt,
    })),
  );
  const attachmentRows = fixtures.flatMap(({ communication }) =>
    communication.attachments.map((a) => ({
      id: a.id,
      communicationId: communication.id,
      filename: a.filename,
      mimeType: a.mimeType,
      text: a.text,
      hash: a.hash,
    })),
  );
  if (attachmentRows.length > 0) await db.insert(t.attachments).values(attachmentRows);
  await db.insert(t.evaluationLabels).values(
    fixtures.map(({ fixture }) => ({
      id: `label-${fixture.case_id}`,
      caseId: fixture.case_id,
      expectedJson: JSON.stringify(fixture.expected),
      labelerId: 'USER-eva',
      version: 1,
    })),
  );
  for (const { fixture } of fixtures) {
    await appendAudit(db, {
      actorId: 'system-seed',
      entityType: 'case',
      entityId: fixture.case_id,
      eventType: 'INGESTED',
      payload: { source: 'synthetic-fixture', fixture: fixture.case_id },
    });
  }

  return {
    users: SEED_USERS.length,
    insurers: SEED_INSURERS.length,
    customers: SEED_CUSTOMERS.length,
    policies: SEED_POLICIES.length,
    cases: fixtures.length,
  };
}
