import type { Liquidacion, LiquidacionLine } from "./schemas/liquidacion";
import { present } from "./validate";

// Deterministic matching of an insurer settlement against what the brokerage
// expected to be paid (its own receipts, exported from the management system
// or read from EIAC files). The output is a list of euros to chase, which is
// the number the pilot is measured on.

export interface ExpectedReceipt {
  id: string;
  firmId: string;
  insurer: string;
  policyNumber: string;
  receiptNumber: string | null;
  premium: number;
  expectedCommission: number;
  /** YYYY-MM the receipt was expected to be settled in. */
  period: string;
  holder: string | null;
}

export type ReconcileStatus = "matched" | "amount_mismatch" | "not_settled" | "unexpected" | "unreadable";

export interface ReconcileItem {
  status: ReconcileStatus;
  policyNumber: string | null;
  receiptNumber: string | null;
  expectedCommission: number | null;
  settledCommission: number | null;
  /** Positive when the insurer paid less than expected. */
  differenceEur: number;
  note: string;
  expectedId: string | null;
  lineIndex: number | null;
}

export interface ReconcileSummary {
  insurer: string | null;
  period: { from: string | null; to: string | null };
  items: ReconcileItem[];
  totals: {
    expectedEur: number;
    settledEur: number;
    unpaidEur: number;
    mismatchEur: number;
    unexpectedEur: number;
  };
  counts: Record<ReconcileStatus, number>;
}

const TOLERANCE_EUR = 0.02;

export function normalizePolicy(s: string): string {
  return s.toUpperCase().replace(/[\s\-./]/g, "");
}

const es = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function reconcile(settlement: Liquidacion, expected: ExpectedReceipt[]): ReconcileSummary {
  const items: ReconcileItem[] = [];
  const byKey = new Map<string, ExpectedReceipt[]>();
  for (const e of expected) {
    const k = normalizePolicy(e.policyNumber);
    byKey.set(k, [...(byKey.get(k) ?? []), e]);
  }
  const consumed = new Set<string>();

  settlement.lineas.forEach((line: LiquidacionLine, idx) => {
    if (!present(line.numero_poliza)) {
      items.push({
        status: "unreadable",
        policyNumber: null,
        receiptNumber: present(line.numero_recibo) ? line.numero_recibo.value : null,
        expectedCommission: null,
        settledCommission: present(line.comision_importe) ? line.comision_importe.value : null,
        differenceEur: 0,
        note: "Línea sin número de póliza legible; revisar en el documento",
        expectedId: null,
        lineIndex: idx,
      });
      return;
    }
    const key = normalizePolicy(line.numero_poliza.value);
    const settled = present(line.comision_importe) ? line.comision_importe.value : null;
    const candidates = (byKey.get(key) ?? []).filter((e) => !consumed.has(e.id));
    // Prefer a receipt-number match when both sides have one.
    const receipt = present(line.numero_recibo) ? line.numero_recibo.value.trim() : null;
    const match =
      candidates.find((e) => receipt && e.receiptNumber && e.receiptNumber.trim() === receipt) ?? candidates[0];
    if (!match) {
      items.push({
        status: "unexpected",
        policyNumber: line.numero_poliza.value,
        receiptNumber: receipt,
        expectedCommission: null,
        settledCommission: settled,
        differenceEur: 0,
        note: "La aseguradora liquida una póliza que no consta en la cartera esperada",
        expectedId: null,
        lineIndex: idx,
      });
      return;
    }
    consumed.add(match.id);
    if (settled === null) {
      items.push({
        status: "unreadable",
        policyNumber: match.policyNumber,
        receiptNumber: receipt ?? match.receiptNumber,
        expectedCommission: match.expectedCommission,
        settledCommission: null,
        differenceEur: 0,
        note: "Importe de comisión no legible en la liquidación",
        expectedId: match.id,
        lineIndex: idx,
      });
      return;
    }
    const diff = round2(match.expectedCommission - settled);
    if (Math.abs(diff) <= TOLERANCE_EUR) {
      items.push({ status: "matched", policyNumber: match.policyNumber, receiptNumber: receipt ?? match.receiptNumber, expectedCommission: match.expectedCommission, settledCommission: settled, differenceEur: 0, note: "", expectedId: match.id, lineIndex: idx });
    } else {
      items.push({
        status: "amount_mismatch",
        policyNumber: match.policyNumber,
        receiptNumber: receipt ?? match.receiptNumber,
        expectedCommission: match.expectedCommission,
        settledCommission: settled,
        differenceEur: diff,
        note: diff > 0 ? `Pagado ${es(settled)} € de ${es(match.expectedCommission)} € esperados` : `Pagado ${es(Math.abs(diff))} € de más`,
        expectedId: match.id,
        lineIndex: idx,
      });
    }
  });

  for (const e of expected) {
    if (consumed.has(e.id)) continue;
    items.push({
      status: "not_settled",
      policyNumber: e.policyNumber,
      receiptNumber: e.receiptNumber,
      expectedCommission: e.expectedCommission,
      settledCommission: null,
      differenceEur: round2(e.expectedCommission),
      note: "Recibo esperado y no liquidado por la aseguradora",
      expectedId: e.id,
      lineIndex: null,
    });
  }

  const counts: Record<ReconcileStatus, number> = { matched: 0, amount_mismatch: 0, not_settled: 0, unexpected: 0, unreadable: 0 };
  let expectedEur = 0, settledEur = 0, unpaidEur = 0, mismatchEur = 0, unexpectedEur = 0;
  for (const it of items) {
    counts[it.status]++;
    if (it.expectedCommission != null) expectedEur += it.expectedCommission;
    if (it.settledCommission != null) settledEur += it.settledCommission;
    if (it.status === "not_settled") unpaidEur += it.differenceEur;
    if (it.status === "amount_mismatch" && it.differenceEur > 0) mismatchEur += it.differenceEur;
    if (it.status === "unexpected" && it.settledCommission != null) unexpectedEur += it.settledCommission;
  }
  return {
    insurer: present(settlement.aseguradora) ? settlement.aseguradora.value : null,
    period: {
      from: present(settlement.periodo_inicio) ? settlement.periodo_inicio.value : null,
      to: present(settlement.periodo_fin) ? settlement.periodo_fin.value : null,
    },
    items,
    totals: { expectedEur: round2(expectedEur), settledEur: round2(settledEur), unpaidEur: round2(unpaidEur), mismatchEur: round2(mismatchEur), unexpectedEur: round2(unexpectedEur) },
    counts,
  };
}

/** Parse the brokerage's own receipts from a CSV export (semicolon or comma). */
export function parseExpectedReceiptsCsv(firmId: string, csv: string, newId: () => string): ExpectedReceipt[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name);
  const need = ["aseguradora", "poliza", "prima", "comision", "periodo"];
  for (const n of need) if (col(n) < 0) throw new Error(`Falta la columna "${n}" en el CSV (columnas: ${headers.join(", ")})`);
  const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return lines.slice(1).map((l) => {
    const c = l.split(sep).map((x) => x.trim());
    return {
      id: newId(),
      firmId,
      insurer: c[col("aseguradora")],
      policyNumber: c[col("poliza")],
      receiptNumber: col("recibo") >= 0 ? c[col("recibo")] || null : null,
      premium: num(c[col("prima")]),
      expectedCommission: num(c[col("comision")]),
      period: c[col("periodo")],
      holder: col("tomador") >= 0 ? c[col("tomador")] || null : null,
    };
  });
}
