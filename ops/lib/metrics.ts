import type { Store } from "./store";
import type { Field } from "./types";
import { present } from "./validate";

// The three numbers the landing page promises to measure, computed from the
// store for a firm and a period: fields approved without correction, euros
// found in settlements, and open work. Model cost is included so a firm can
// see what the month is costing before the invoice.

export interface Metrics {
  period: { from: string | null; to: string | null };
  documents: { total: number; byKind: Record<string, number> };
  fields: { extracted: number; corrected: number; approvedWithoutCorrectionPct: number | null };
  euros: { unpaid: number; mismatch: number; reconciliations: number };
  tasks: { openFirm: number; openClient: number };
  cost: { usd: number; tokens: number; modelCalls: number };
}

const SECTIONS = ["factura", "recibo", "parte_siniestro", "poliza", "identidad"];

export async function computeMetrics(store: Store, firmId: string, from?: string, to?: string): Promise<Metrics> {
  const [extractions, corrections, reconciliations, tasks, activity] = await Promise.all([
    store.extractions.listByFirm(firmId, from, to),
    store.corrections.listByFirm(firmId, from, to),
    store.reconciliations.listByFirm(firmId, 1000),
    store.tasks.listOpenByFirm(firmId),
    store.activity.list(firmId, 5000),
  ]);
  const inPeriod = (at: string) => (!from || at >= from) && (!to || at <= to);

  const byKind: Record<string, number> = {};
  let extracted = 0;
  for (const e of extractions) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
    for (const s of SECTIONS) {
      const section = e.data[s] as Record<string, Field<unknown> | null> | null | undefined;
      if (!section || typeof section !== "object") continue;
      for (const f of Object.values(section)) if (present(f as Field<unknown> | null) && !String((f as Field<unknown>).quote).startsWith("corregido por")) extracted++;
    }
  }
  const corrected = corrections.filter((c) => c.field !== "draft.body").length;
  const totalFields = extracted + corrected;

  const recs = reconciliations.filter((r) => inPeriod(r.createdAt));
  const modelEntries = activity.filter((a) => a.usage && inPeriod(a.at));

  return {
    period: { from: from ?? null, to: to ?? null },
    documents: { total: extractions.length, byKind },
    fields: { extracted, corrected, approvedWithoutCorrectionPct: totalFields ? Math.round((extracted / totalFields) * 1000) / 10 : null },
    euros: { unpaid: round2(recs.reduce((s, r) => s + r.unpaidEur, 0)), mismatch: round2(recs.reduce((s, r) => s + r.mismatchEur, 0)), reconciliations: recs.length },
    tasks: { openFirm: tasks.filter((t) => t.owner === "firm").length, openClient: tasks.filter((t) => t.owner === "client").length },
    cost: { usd: round2(modelEntries.reduce((s, a) => s + (a.usage?.costUsd ?? 0), 0) * 100) / 100, tokens: modelEntries.reduce((s, a) => s + (a.usage?.inputTokens ?? 0) + (a.usage?.outputTokens ?? 0), 0), modelCalls: modelEntries.length },
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
