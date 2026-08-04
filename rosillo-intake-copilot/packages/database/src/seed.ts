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

/** Reproducible synthetic seed (spec section 14). Idempotent: wipes and reloads. */
export function seedDatabase(db: Db, fixturesRoot: string) {
  const now = new Date().toISOString();

  // Order matters for foreign keys.
  db.delete(t.evaluationLabels).run();
  db.delete(t.decisions).run();
  db.delete(t.analysisRuns).run();
  db.delete(t.attachments).run();
  db.delete(t.communications).run();
  db.delete(t.cases).run();
  db.delete(t.policies).run();
  db.delete(t.customers).run();
  db.delete(t.insurers).run();
  db.delete(t.users).run();

  for (const u of SEED_USERS) {
    db.insert(t.users).values({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: now }).run();
  }
  for (const i of SEED_INSURERS) db.insert(t.insurers).values(i).run();
  for (const c of SEED_CUSTOMERS) {
    db.insert(t.customers)
      .values({
        id: c.id,
        customerType: c.customerType,
        name: c.name,
        email: c.email,
        phone: c.phone,
        taxIdFake: c.taxIdFake,
        classification: 'SYNTHETIC',
      })
      .run();
  }
  for (const p of SEED_POLICIES) {
    db.insert(t.policies)
      .values({
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
      })
      .run();
  }

  const fixtures = loadCaseFixtures(fixturesRoot);
  for (const { fixture, communication } of fixtures) {
    db.insert(t.cases)
      .values({
        id: fixture.case_id,
        workflow: 'UNKNOWN',
        status: 'NEW',
        priority: fixture.priority,
        createdAt: fixture.received_at,
        updatedAt: fixture.received_at,
      })
      .run();
    db.insert(t.communications)
      .values({
        id: communication.id,
        caseId: fixture.case_id,
        sender: communication.from,
        subject: communication.subject,
        bodyText: communication.bodyText,
        receivedAt: communication.receivedAt,
      })
      .run();
    for (const a of communication.attachments) {
      db.insert(t.attachments)
        .values({
          id: a.id,
          communicationId: communication.id,
          filename: a.filename,
          mimeType: a.mimeType,
          text: a.text,
          hash: a.hash,
        })
        .run();
    }
    db.insert(t.evaluationLabels)
      .values({
        id: `label-${fixture.case_id}`,
        caseId: fixture.case_id,
        expectedJson: JSON.stringify(fixture.expected),
        labelerId: 'USER-eva',
        version: 1,
      })
      .run();
    appendAudit(db, {
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
