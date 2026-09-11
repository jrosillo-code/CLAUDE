import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcile, parseExpectedReceiptsCsv, type ExpectedReceipt } from "../lib/reconcile";
import { DemoSettlementExtractor } from "../lib/demo";

test("settlement lines match, mismatch, go unpaid, or are unexpected", async () => {
  const { data } = await new DemoSettlementExtractor().extractSettlement();
  const expected: ExpectedReceipt[] = [
    { id: "e1", firmId: "f", insurer: "Aseguradora Ejemplo SA", policyNumber: "HG-55-220931", receiptNumber: "R-1", premium: 412.5, expectedCommission: 82.5, period: "2026-08", holder: null },
    { id: "e2", firmId: "f", insurer: "Aseguradora Ejemplo SA", policyNumber: "AU 2024 778812", receiptNumber: "R-2", premium: 640, expectedCommission: 76.8, period: "2026-08", holder: null },
    { id: "e3", firmId: "f", insurer: "Aseguradora Ejemplo SA", policyNumber: "SA-1", receiptNumber: null, premium: 100, expectedCommission: 12, period: "2026-08", holder: null },
  ];
  const s = reconcile(data, expected);
  assert.equal(s.counts.matched, 1);
  assert.equal(s.counts.amount_mismatch, 1);
  assert.equal(s.counts.not_settled, 1);
  assert.equal(s.counts.unexpected, 1);
  assert.equal(s.totals.unpaidEur, 12);
  assert.equal(s.totals.mismatchEur, 6.4);
  assert.equal(s.insurer, "Aseguradora Ejemplo SA");
});

test("CSV import handles Spanish number formats and separators", () => {
  const csv = "aseguradora;poliza;recibo;tomador;prima;comision;periodo\nX;P-1;R-9;Ana;1.234,50;123,45;2026-08\nX;P-2;;Luis;100;10;2026-08";
  const rows = parseExpectedReceiptsCsv("f", csv, () => "id");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].premium, 1234.5);
  assert.equal(rows[0].expectedCommission, 123.45);
  assert.equal(rows[1].receiptNumber, null);
  assert.throws(() => parseExpectedReceiptsCsv("f", "a;b\n1;2", () => "id"), /Falta la columna/);
});
