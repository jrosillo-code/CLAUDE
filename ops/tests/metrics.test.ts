import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../lib/store";
import { DemoExtractor, DemoDrafter } from "../lib/demo";
import { receiveDocument, processDocument } from "../lib/pipeline";
import { decide } from "../lib/approvals";
import { correctField } from "../lib/corrections";
import { RecordingSender } from "../lib/sender";
import { CsvExportAdapter } from "../lib/adapters";
import { computeMetrics } from "../lib/metrics";
import type { Firm, InboundMessage } from "../lib/types";
import { newId, nowIso } from "../lib/ids";

const firm: Firm = { id: "f1", name: "Correduría Test", kind: "correduria", monthlyTokenBudget: 1_000_000, createdAt: nowIso() };

test("cycle time, review decisions, corrections by field and incidents come from the activity log", async () => {
  const store = new MemoryStore();
  await store.firms.upsert(firm);
  const deps = { store, extractor: new DemoExtractor(), drafter: new DemoDrafter() };
  const sender = new RecordingSender();
  const effects = { sender, adapter: new CsvExportAdapter() };

  const doc = await receiveDocument(deps, { firm, fileName: "factura-taller.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1]) });
  const r = await processDocument(deps, firm, doc.id);
  await correctField(store, { firm, documentId: doc.id, field: "total", value: "999", userId: "u1" });
  await correctField(store, { firm, documentId: doc.id, field: "total", value: "998", userId: "u1" });
  for (const a of r.approvals) await decide(store, effects, { approvalId: a.id, decision: "approved", userId: "u1" });

  const inbound: InboundMessage = { id: newId(), firmId: firm.id, channel: "whatsapp", fromAddress: "+34600000000", receivedAt: nowIso(), subject: null, text: null, externalId: "wamid.1", attachments: [] };
  await store.inbound.insert(inbound);
  const doc2 = await receiveDocument(deps, { firm, fileName: "parte-siniestro.pdf", mediaType: "application/pdf", bytes: new Uint8Array([2]), inbound });
  const r2 = await processDocument(deps, firm, doc2.id);
  sender.failNextWith = "SMTP caído";
  const send = r2.approvals.find((a) => a.action === "send_draft")!;
  await assert.rejects(decide(store, effects, { approvalId: send.id, decision: "approved", userId: "u1" }));
  await decide(store, effects, { approvalId: send.id, decision: "rejected", userId: "u1" });

  const m = await computeMetrics(store, firm.id);
  assert.equal(m.documents.received, 2);
  assert.equal(m.cycle.documents, 1, "only the approved document has a cycle time");
  assert.ok(m.cycle.medianHours != null && m.cycle.medianHours >= 0 && m.cycle.medianHours < 0.1);
  assert.equal(m.review.approved, 1);
  assert.equal(m.review.rejected, 1);
  assert.deepEqual(m.review.correctionsByField, [{ field: "total", count: 2 }]);
  assert.equal(m.incidents.byAction["message.failed"], 1);
  assert.equal(m.weekly.length, 1);
  assert.equal(m.weekly[0].received, 2);

  const empty = await computeMetrics(store, firm.id, "2000-01-01T00:00:00.000Z", "2000-12-31T00:00:00.000Z");
  assert.equal(empty.documents.received, 0);
  assert.equal(empty.cycle.medianHours, null);
});
