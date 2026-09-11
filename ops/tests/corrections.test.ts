import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../lib/store";
import { DemoExtractor, DemoDrafter } from "../lib/demo";
import { receiveDocument, processDocument } from "../lib/pipeline";
import { correctField } from "../lib/corrections";
import { computeMetrics } from "../lib/metrics";
import { decide } from "../lib/approvals";
import { RecordingSender } from "../lib/sender";
import { CsvExportAdapter } from "../lib/adapters";
import type { Firm, InboundMessage } from "../lib/types";
import { newId, nowIso } from "../lib/ids";

const firm: Firm = { id: "f1", name: "Correduría Test", kind: "correduria", monthlyTokenBudget: 1_000_000, createdAt: nowIso() };

async function setup() {
  const store = new MemoryStore();
  await store.firms.upsert(firm);
  const deps = { store, extractor: new DemoExtractor(), drafter: new DemoDrafter() };
  const inbound: InboundMessage = { id: newId(), firmId: firm.id, channel: "whatsapp", fromAddress: "+34600000000", receivedAt: nowIso(), subject: null, text: null, externalId: "w1", attachments: [] };
  await store.inbound.insert(inbound);
  const doc = await receiveDocument(deps, { firm, fileName: "factura.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1]), inbound });
  const r = await processDocument(deps, firm, doc.id);
  return { store, deps, doc, r };
}

test("a correction is stored as a person's value, re-validates, closes the task and is logged", async () => {
  const { store, doc, r } = await setup();
  assert.ok(r.validation.issues.some((i) => i.field === "receptor_nif"));
  const out = await correctField(store, { firm, documentId: doc.id, field: "receptor_nif", value: "12345678Z", userId: "ana" });
  assert.equal(out.correction.oldValue, null);
  assert.equal(out.correction.newValue, "12345678Z");
  const ext = (await store.extractions.latestForDocument(doc.id))!;
  const f = (ext.data.factura as Record<string, { value: unknown; quote: string }>).receptor_nif;
  assert.equal(f.value, "12345678Z");
  assert.match(f.quote, /^corregido por ana/);
  assert.ok(!out.validation!.issues.some((i) => i.field === "receptor_nif"));
  assert.ok((await store.activity.list(firm.id)).some((e) => e.action === "field.corrected" && e.actor.id === "ana"));
});

test("numbers are coerced with Spanish formatting and arithmetic re-runs", async () => {
  const { store, doc } = await setup();
  const out = await correctField(store, { firm, documentId: doc.id, field: "total", value: "1.000,00", userId: "ana" });
  assert.equal(out.correction.newValue, 1000);
  assert.ok(out.validation!.issues.some((i) => i.code === "total_mismatch"));
  await assert.rejects(correctField(store, { firm, documentId: doc.id, field: "total", value: "abc", userId: "ana" }), /no es un número/);
  await assert.rejects(correctField(store, { firm, documentId: doc.id, field: "nope", value: "x", userId: "ana" }), /Campo desconocido/);
});

test("editing the draft keeps the disclosure and is a correction of draft.body", async () => {
  const store = new MemoryStore();
  await store.firms.upsert(firm);
  const deps = { store, extractor: new DemoExtractor(), drafter: new DemoDrafter() };
  const inbound: InboundMessage = { id: newId(), firmId: firm.id, channel: "whatsapp", fromAddress: "+34600000000", receivedAt: nowIso(), subject: null, text: null, externalId: "w2", attachments: [] };
  await store.inbound.insert(inbound);
  const doc = await receiveDocument(deps, { firm, fileName: "parte-siniestro.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1]), inbound });
  const r = await processDocument(deps, firm, doc.id);
  const out = await correctField(store, { firm, documentId: doc.id, field: "draft.body", value: "Hola Marta, nos falta el permiso de circulación.", userId: "ana", draftId: r.draft!.id });
  const draft = (await store.drafts.get(r.draft!.id))!;
  assert.match(draft.body, /^Hola Marta/);
  assert.match(draft.body, /inteligencia artificial/);
  assert.equal(out.correction.field, "draft.body");
});

test("metrics count fields, corrections, euros and cost", async () => {
  const { store, doc } = await setup();
  await correctField(store, { firm, documentId: doc.id, field: "receptor_nif", value: "12345678Z", userId: "ana" });
  const m = await computeMetrics(store, firm.id);
  assert.equal(m.documents.total, 1);
  assert.equal(m.documents.byKind.factura, 1);
  assert.equal(m.fields.corrected, 1);
  assert.ok(m.fields.extracted >= 9);
  assert.ok(m.fields.approvedWithoutCorrectionPct! > 80);
  assert.equal(m.tasks.openFirm + m.tasks.openClient, (await store.tasks.listOpenByFirm(firm.id)).length);
  assert.equal(m.cost.modelCalls, 1);
});

test("a failed send keeps the approval pending and logs the failure", async () => {
  const store = new MemoryStore();
  await store.firms.upsert(firm);
  const deps = { store, extractor: new DemoExtractor(), drafter: new DemoDrafter() };
  const inbound: InboundMessage = { id: newId(), firmId: firm.id, channel: "whatsapp", fromAddress: "+34600000000", receivedAt: nowIso(), subject: null, text: null, externalId: "w3", attachments: [] };
  await store.inbound.insert(inbound);
  const doc = await receiveDocument(deps, { firm, fileName: "parte-siniestro.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1]), inbound });
  const r = await processDocument(deps, firm, doc.id);
  const send = r.approvals.find((a) => a.action === "send_draft")!;
  const sender = new RecordingSender();
  sender.failNextWith = "SMTP caído";
  await assert.rejects(decide(store, { sender, adapter: new CsvExportAdapter() }, { approvalId: send.id, decision: "approved", userId: "u1" }), /No se pudo enviar/);
  assert.equal((await store.approvals.get(send.id))!.status, "pending");
  assert.ok((await store.activity.list(firm.id)).some((e) => e.action === "message.failed"));
  await decide(store, { sender, adapter: new CsvExportAdapter() }, { approvalId: send.id, decision: "approved", userId: "u1" });
  assert.equal((await store.approvals.get(send.id))!.status, "approved");
  assert.equal(sender.sent.length, 1);
});
