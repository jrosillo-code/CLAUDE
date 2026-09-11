import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../lib/store";
import { DemoExtractor, DemoDrafter, DemoSettlementExtractor } from "../lib/demo";
import { receiveDocument, processDocument } from "../lib/pipeline";
import { decide } from "../lib/approvals";
import { RecordingSender } from "../lib/sender";
import { CsvExportAdapter } from "../lib/adapters";
import { processSettlement } from "../lib/settlements";
import { BudgetExceeded } from "../lib/budget";
import type { Firm, InboundMessage } from "../lib/types";
import { newId, nowIso } from "../lib/ids";

const firm: Firm = { id: "f1", name: "Correduría Test", kind: "correduria", monthlyTokenBudget: 1_000_000, createdAt: nowIso() };

function setup() {
  const store = new MemoryStore();
  const deps = { store, extractor: new DemoExtractor(), drafter: new DemoDrafter() };
  const sender = new RecordingSender();
  const adapter = new CsvExportAdapter();
  return { store, deps, sender, adapter };
}

async function inboundWhatsApp(store: MemoryStore): Promise<InboundMessage> {
  const m: InboundMessage = { id: newId(), firmId: firm.id, channel: "whatsapp", fromAddress: "+34600000000", receivedAt: nowIso(), subject: null, text: null, externalId: "wamid.1", attachments: [] };
  await store.inbound.insert(m);
  return m;
}

test("a claim with missing documents yields tasks, a draft with disclosure, and pending approvals; nothing is sent", async () => {
  const { store, deps, sender, adapter } = setup();
  await store.firms.upsert(firm);
  const inbound = await inboundWhatsApp(store);
  const doc = await receiveDocument(deps, { firm, fileName: "parte-siniestro.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1, 2, 3]), inbound });
  const r = await processDocument(deps, firm, doc.id);

  assert.equal(r.extraction.kind, "parte_siniestro");
  assert.equal(r.validation.ok, false);
  assert.deepEqual(r.validation.missing, ["Permiso de circulación", "Carné de conducir del conductor"]);
  assert.equal(r.tasks.filter((t) => t.owner === "client").length, 2);
  assert.ok(r.draft, "a draft is produced when something is missing and a sender is known");
  assert.equal(r.draft!.channel, "whatsapp");
  assert.match(r.draft!.body, /inteligencia artificial/);
  assert.match(r.draft!.body, /Permiso de circulación/);
  assert.deepEqual(r.approvals.map((a) => a.action).sort(), ["send_draft", "write_system"]);
  assert.equal(r.document.status, "awaiting_approval");
  assert.equal(sender.sent.length, 0);
  assert.equal(adapter.rows.length, 1, "adapter untouched before approval");

  const log = await store.activity.list(firm.id);
  const actions = log.map((e) => e.action);
  for (const a of ["document.received", "document.extracted", "document.validated", "tasks.created", "draft.created", "approvals.requested"]) {
    assert.ok(actions.includes(a), `activity log has ${a}`);
  }
  assert.ok(log.some((e) => e.actor.type === "model" && e.usage), "model calls are logged with usage");
});

test("approval is the only path to send and write; decisions are logged and cannot be repeated", async () => {
  const { store, deps, sender, adapter } = setup();
  await store.firms.upsert(firm);
  const inbound = await inboundWhatsApp(store);
  const doc = await receiveDocument(deps, { firm, fileName: "parte-siniestro.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1]), inbound });
  const r = await processDocument(deps, firm, doc.id);
  const send = r.approvals.find((a) => a.action === "send_draft")!;
  const write = r.approvals.find((a) => a.action === "write_system")!;

  await decide(store, { sender, adapter }, { approvalId: send.id, decision: "approved", userId: "u1" });
  assert.equal(sender.sent.length, 1);
  assert.equal(sender.sent[0].to, "+34600000000");
  await assert.rejects(decide(store, { sender, adapter }, { approvalId: send.id, decision: "approved", userId: "u1" }), /ya está approved/);
  assert.equal((await store.documents.get(doc.id))!.status, "awaiting_approval", "still one pending approval");

  await decide(store, { sender, adapter }, { approvalId: write.id, decision: "approved", userId: "u1" });
  assert.ok(adapter.rows.length > 1, "adapter received the extracted fields");
  assert.ok(adapter.toCsv().includes("numero_poliza;AU-2024-778812;Póliza nº AU-2024-778812"), "writes carry provenance");
  assert.equal((await store.documents.get(doc.id))!.status, "approved");

  const log = await store.activity.list(firm.id);
  assert.ok(log.some((e) => e.action === "approval.approved" && e.actor.id === "u1"));
  assert.ok(log.some((e) => e.action === "message.sent"));
  assert.ok(log.some((e) => e.action === "system.written"));
});

test("rejecting an approval sends nothing and marks the document", async () => {
  const { store, deps, sender, adapter } = setup();
  await store.firms.upsert(firm);
  const inbound = await inboundWhatsApp(store);
  const doc = await receiveDocument(deps, { firm, fileName: "parte-siniestro.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1]), inbound });
  const r = await processDocument(deps, firm, doc.id);
  await decide(store, { sender, adapter }, { approvalId: r.approvals[0].id, decision: "rejected", userId: "u2", note: "no procede" });
  assert.equal(sender.sent.length, 0);
  assert.equal((await store.documents.get(doc.id))!.status, "rejected");
});

test("an upload with no sender produces tasks but no draft", async () => {
  const { store, deps } = setup();
  await store.firms.upsert(firm);
  const doc = await receiveDocument(deps, { firm, fileName: "factura-taller.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1]) });
  const r = await processDocument(deps, firm, doc.id);
  assert.equal(r.extraction.kind, "factura");
  assert.equal(r.draft, null);
  assert.ok(r.validation.issues.some((i) => i.field === "receptor_nif" && i.severity === "warning"));
  assert.deepEqual(r.approvals.map((a) => a.action), ["write_system"]);
});

test("the monthly budget stops model calls before they happen", async () => {
  const { store, deps } = setup();
  const tiny: Firm = { ...firm, monthlyTokenBudget: 10 };
  await store.firms.upsert(tiny);
  await store.usage.add(tiny.id, new Date().toISOString().slice(0, 7), 10, 0);
  const doc = await receiveDocument(deps, { firm: tiny, fileName: "factura.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1]) });
  await assert.rejects(processDocument(deps, tiny, doc.id), BudgetExceeded);
  assert.equal((await store.documents.get(doc.id))!.status, "failed");
});

test("settlement reconciliation creates a task per unpaid euro line", async () => {
  const { store } = setup();
  await store.firms.upsert(firm);
  const deps = { store, extractor: new DemoExtractor(), drafter: new DemoDrafter() };
  await store.receipts.replaceForPeriod(firm.id, "Aseguradora Ejemplo SA", "2026-08", [
    { id: "e1", firmId: firm.id, insurer: "Aseguradora Ejemplo SA", policyNumber: "HG-55-220931", receiptNumber: "R-1", premium: 412.5, expectedCommission: 82.5, period: "2026-08", holder: null },
    { id: "e2", firmId: firm.id, insurer: "Aseguradora Ejemplo SA", policyNumber: "AU-2024-778812", receiptNumber: "R-2", premium: 640, expectedCommission: 76.8, period: "2026-08", holder: null },
    { id: "e3", firmId: firm.id, insurer: "Aseguradora Ejemplo SA", policyNumber: "SA-1", receiptNumber: null, premium: 100, expectedCommission: 12, period: "2026-08", holder: null },
  ]);
  const doc = await receiveDocument(deps, { firm, fileName: "liquidacion-agosto.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1]) });
  const { record, tasks } = await processSettlement({ store, settlementExtractor: new DemoSettlementExtractor() }, { firm, documentId: doc.id });
  assert.equal(record.unpaidEur, 12);
  assert.equal(record.mismatchEur, 6.4);
  assert.equal(tasks.filter((t) => t.title.startsWith("Reclamar")).length, 2);
  assert.equal(tasks.filter((t) => t.title.startsWith("Revisar")).length, 1);
  assert.ok((await store.activity.list(firm.id)).some((e) => e.action === "settlement.reconciled"));
});
