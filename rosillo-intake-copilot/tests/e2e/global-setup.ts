import { rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Fresh, reproducible database for every e2e run: wipe data/e2e.db, migrate,
 * seed the synthetic fixtures, then add security-only records (XSS payload
 * case and a forged AI analysis) that must never ship as regular fixtures.
 */
export default async function globalSetup() {
  process.env.DATA_CLASSIFICATION = 'SYNTHETIC';
  const root = process.cwd();
  const dbPath = join(root, 'data', 'e2e.db');
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(`${dbPath}${suffix}`, { force: true });
  }

  const { openDatabase, seedDatabase, schema, appendAudit } = await import('@rosillo/database');
  const { db, sqlite } = openDatabase(dbPath);
  seedDatabase(db, join(root, 'fixtures'));

  // ── Security-probe case: hostile customer content (XSS attempts). ─────────
  const now = '2026-08-04T12:00:00+02:00';
  db.insert(schema.cases)
    .values({ id: 'SEC-XSS', workflow: 'UNKNOWN', status: 'NEW', priority: 'LOW', createdAt: now, updatedAt: now })
    .run();
  db.insert(schema.communications)
    .values({
      id: 'SEC-XSS-comm',
      caseId: 'SEC-XSS',
      sender: '<script>alert("sender")</script>@evil.test',
      subject: '<img src=x onerror=alert("subject")> Consulta',
      bodyText: 'Hola <script>alert("body")</script> <a href="javascript:alert(1)">enlace</a> "quotes" &amp; fin.',
      receivedAt: now,
    })
    .run();
  db.insert(schema.attachments)
    .values({
      id: 'SEC-XSS-att-1',
      communicationId: 'SEC-XSS-comm',
      filename: '<svg onload=alert("filename")>.pdf',
      mimeType: 'application/pdf',
      text: 'Contenido con <script>alert("attachment")</script> dentro.',
      hash: 'sec-xss-hash',
    })
    .run();

  // ── Forged AI output: what if a (compromised) provider emitted HTML? ──────
  const hostileAnalysis = {
    workflow: 'UNKNOWN',
    workflowConfidence: 0.5,
    secondaryWorkflows: [],
    summary: 'Resumen con <script>alert("summary")</script> incrustado',
    entities: {
      hostile_field: {
        value: '<img src=x onerror=alert("value")>',
        status: 'EXPLICIT',
        confidence: 0.9,
        evidenceIds: ['sec-ev-1'],
        note: null,
      },
    },
    evidence: [
      {
        id: 'sec-ev-1',
        sourceType: 'EMAIL_BODY',
        sourceId: 'SEC-XSS-comm',
        quote: '<script>alert("quote")</script>',
        offsets: null,
      },
    ],
    customerCandidates: [],
    policyCandidates: [],
    missingInformation: [],
    riskFlags: ['<script>alert("flag")</script>'],
    suggestedActionCode: 'NO_ACTION_NOT_OPERATIONAL',
    suggestedActionRationale: 'prueba de seguridad',
    externalActionAllowed: false,
  };
  db.insert(schema.analysisRuns)
    .values({
      id: 'run-sec-xss',
      caseId: 'SEC-XSS',
      version: 1,
      provider: 'security-fixture',
      model: 'forged',
      promptVersions: '{}',
      rulesVersion: 'rules-v1',
      inputHash: 'sec',
      outputJson: JSON.stringify(hostileAnalysis),
      draftJson: JSON.stringify({
        language: 'es',
        tone: 'WARM',
        body: 'Borrador con <script>alert("draft")</script> y <b>markup</b>.',
        placeholders: [],
      }),
      outputHash: 'sec',
      confidence: 0.5,
      durationMs: 1,
      createdAt: now,
    })
    .run();
  sqlite.prepare("UPDATE cases SET status = 'ANALYSED' WHERE id = 'SEC-XSS'").run();
  appendAudit(db, {
    actorId: 'security-fixture',
    entityType: 'case',
    entityId: 'SEC-XSS',
    eventType: 'ANALYSED',
    payload: { runId: 'run-sec-xss' },
  });

  sqlite.close();
}
