import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../lib/store";
import { DemoExtractor, DemoDrafter, DemoSettlementExtractor } from "../lib/demo";
import { receiveDocument } from "../lib/pipeline";
import { processSettlement } from "../lib/settlements";
import { buildClaimBody, createClaim, findPendingClaim, claimTotal, eur, periodLabel } from "../lib/claims";
import { decide } from "../lib/approvals";
import { RecordingSender } from "../lib/sender";
import { CsvExportAdapter } from "../lib/adapters";
import type { Firm } from "../lib/types";
import type { ReconcileSummary } from "../lib/reconcile";
import { nowIso } from "../lib/ids";

const firm: Firm = { id: "f1", name: "Correduría Test", kind: "correduria", monthlyTokenBudget: 1_000_000, createdAt: nowIso() };

async function reconciled() {
  const store = new MemoryStore();
  await store.firms.upsert(firm);
  await store.receipts.replaceForPeriod(firm.id, "Aseguradora Ejemplo SA", "2026-08", [
    { id: "e1", firmId: firm.id, insurer: "Aseguradora Ejemplo SA", policyNumber: "HG-55-220931", receiptNumber: "R-1", premium: 412.5, expectedCommission: 82.5, period: "2026-08", holder: null },
    { id: "e2", firmId: firm.id, insurer: "Aseguradora Ejemplo SA", policyNumber: "AU-2024-778812", receiptNumber: "R-2", premium: 640, expectedCommission: 76.8, period: "2026-08", holder: null },
    { id: "e3", firmId: firm.id, insurer: "Aseguradora Ejemplo SA", policyNumber: "SA-1", receiptNumber: "R-3", premium: 100, expectedCommission: 12, period: "2026-08", holder: null },
  ]);
  const doc = await receiveDocument({ store, extractor: new DemoExtractor(), drafter: new DemoDrafter() }, { firm, fileName: "liquidacion-agosto.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1]) });
  const { record } = await processSettlement({ store, settlementExtractor: new DemoSettlementExtractor() }, { firm, documentId: doc.id });
  return { store, record };
}

test("the claim letter lists every unpaid or short-paid line with its figures", async () => {
  const { record } = await reconciled();
  const { subject, body, total, lines } = buildClaimBody(firm, record);
  assert.equal(lines.length, 2);
  assert.equal(total, 18.4);
  assert.match(subject, /agosto de 2026/);
  assert.match(body, /póliza SA-1, recibo R-3: comisión esperada 12,00 €, no figura en la liquidación, diferencia 12,00 €/);
  assert.match(body, /póliza AU-2024-778812, recibo R-2: comisión esperada 76,80 €, liquidada 70,40 €, diferencia 6,40 €/);
  assert.match(body, /Total reclamado: 18,40 €/);
  assert.doesNotMatch(body, /HG-55-220931/, "matched lines are not claimed");
  assert.equal(claimTotal(record.summary as unknown as ReconcileSummary), 18.4);
});

test("creating a claim stores a draft behind a pending approval and refuses a duplicate", async () => {
  const { store, record } = await reconciled();
  await assert.rejects(createClaim(store, { firm, record, to: "no-es-un-correo", userId: "u1" }), /correo de liquidaciones/);
  const { draft, approval } = await createClaim(store, { firm, record, to: "liquidaciones@ejemplo.es", userId: "u1" });
  assert.equal(approval.status, "pending");
  assert.equal(approval.action, "send_draft");
  assert.equal(approval.draftId, draft.id);
  assert.equal(draft.channel, "email");
  assert.match(draft.body, /Correduría Test\nEste mensaje se ha preparado con ayuda de un sistema de inteligencia artificial/);
  assert.equal((await findPendingClaim(store, record))?.id, approval.id);
  await assert.rejects(createClaim(store, { firm, record, to: "otro@ejemplo.es", userId: "u1" }), /Ya hay una reclamación pendiente/);
  assert.ok((await store.activity.list(firm.id)).some((e) => e.action === "claim.drafted"));
});

test("nothing reaches the insurer until the approval; a failed send keeps it pending", async () => {
  const { store, record } = await reconciled();
  const sender = new RecordingSender();
  const { approval } = await createClaim(store, { firm, record, to: "liquidaciones@ejemplo.es", userId: "u1" });
  assert.equal(sender.sent.length, 0);
  sender.failNextWith = "SMTP caído";
  await assert.rejects(decide(store, { sender, adapter: new CsvExportAdapter() }, { approvalId: approval.id, decision: "approved", userId: "u1" }), /No se pudo enviar/);
  assert.equal((await store.approvals.get(approval.id))!.status, "pending");
  await decide(store, { sender, adapter: new CsvExportAdapter() }, { approvalId: approval.id, decision: "approved", userId: "u1" });
  assert.equal(sender.sent.length, 1);
  assert.equal(sender.sent[0].to, "liquidaciones@ejemplo.es");
  assert.equal((await store.approvals.get(approval.id))!.status, "approved");
  assert.equal(await findPendingClaim(store, record), null);
  const history = await store.approvals.listByDocument(record.documentId);
  assert.equal(history.filter((a) => a.status === "approved").length, 1);
});

test("a settlement with nothing owed cannot be claimed", async () => {
  const store = new MemoryStore();
  await store.firms.upsert(firm);
  const summary: ReconcileSummary = { insurer: "X", period: { from: null, to: null }, items: [{ status: "matched", policyNumber: "P", receiptNumber: null, expectedCommission: 1, settledCommission: 1, differenceEur: 0, note: "", expectedId: "e", lineIndex: 0 }], totals: { expectedEur: 1, settledEur: 1, unpaidEur: 0, mismatchEur: 0, unexpectedEur: 0 }, counts: { matched: 1, amount_mismatch: 0, not_settled: 0, unexpected: 0, unreadable: 0 } };
  const record = { id: "r1", firmId: firm.id, documentId: "d1", insurer: "X", period: "2026-08", summary: summary as unknown as Record<string, unknown>, unpaidEur: 0, mismatchEur: 0, usage: null, createdAt: nowIso() };
  await assert.rejects(createClaim(store, { firm, record, to: "a@b.es", userId: "u" }), /No hay importes que reclamar/);
});

test("figures and periods read as a Spanish reader expects", () => {
  assert.equal(eur(1234.5), "1234,50 €".replace("1234", (1234).toLocaleString("es-ES")));
  assert.equal(eur(null), "—");
  assert.equal(periodLabel("2026-08"), "agosto de 2026");
  assert.equal(periodLabel(null), "el periodo indicado");
});
