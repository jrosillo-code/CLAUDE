import type { Store } from "./store";
import type { Field } from "./types";
import { present } from "./validate";

// The three numbers the landing page promises to measure, computed from the
// store for a firm and a period: fields approved without correction, euros
// found in settlements, and open work. Model cost is included so a firm can
// see what the month is costing before the invoice.

export interface Metrics {
  period: { from: string | null; to: string | null };
  documents: { total: number; byKind: Record<string, number>; received: number };
  fields: { extracted: number; corrected: number; approvedWithoutCorrectionPct: number | null };
  euros: { unpaid: number; mismatch: number; reconciliations: number };
  tasks: { openFirm: number; openClient: number };
  cost: { usd: number; tokens: number; modelCalls: number };
  /** Hours from a document arriving to its first approval, over documents approved in the period. */
  cycle: { documents: number; medianHours: number | null; p90Hours: number | null };
  /** What the reviewers did: decisions and the fields they had to correct most. */
  review: { approved: number; rejected: number; correctionsByField: { field: string; count: number }[] };
  /** Things that went wrong and were logged: failed sends, failed documents, failed jobs. */
  incidents: { total: number; byAction: Record<string, number> };
  /** Documents received per ISO week, oldest first. */
  weekly: { week: string; received: number }[];
}

const SECTIONS = ["factura", "recibo", "parte_siniestro", "poliza", "identidad"];

export async function computeMetrics(store: Store, firmId: string, from?: string, to?: string): Promise<Metrics> {
  const [extractions, corrections, reconciliations, tasks, activity] = await Promise.all([
    store.extractions.listByFirm(firmId, from, to),
    store.corrections.listByFirm(firmId, from, to),
    store.reconciliations.listByFirm(firmId, 1000),
    store.tasks.listOpenByFirm(firmId),
    store.activity.list(firmId, 20000, from, to),
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

  // Activity-derived figures. The log is the source: it is append-only and
  // survives retention, so the pilot numbers can be recomputed later.
  const receivedAt = new Map<string, string>();
  const approvedAt = new Map<string, string>();
  let approved = 0, rejected = 0;
  const byField = new Map<string, number>();
  const incidentsBy: Record<string, number> = {};
  const weeklyMap = new Map<string, number>();
  for (const a of activity) {
    if (a.action === "document.received") {
      if (!receivedAt.has(a.entity.id) || a.at < receivedAt.get(a.entity.id)!) receivedAt.set(a.entity.id, a.at);
      const w = isoWeek(a.at); weeklyMap.set(w, (weeklyMap.get(w) ?? 0) + 1);
    } else if (a.action === "approval.approved") {
      approved++;
      const d = typeof a.detail?.documentId === "string" ? a.detail.documentId : null;
      if (d && (!approvedAt.has(d) || a.at < approvedAt.get(d)!)) approvedAt.set(d, a.at);
    } else if (a.action === "approval.rejected") {
      rejected++;
    } else if (a.action === "field.corrected") {
      const f = typeof a.detail?.field === "string" ? a.detail.field : "?";
      byField.set(f, (byField.get(f) ?? 0) + 1);
    } else if (INCIDENTS.has(a.action)) {
      incidentsBy[a.action] = (incidentsBy[a.action] ?? 0) + 1;
    }
  }
  const cycleHours: number[] = [];
  for (const [doc, t1] of approvedAt) { const t0 = receivedAt.get(doc); if (t0) cycleHours.push((Date.parse(t1) - Date.parse(t0)) / 3_600_000); }
  cycleHours.sort((a, b) => a - b);

  return {
    period: { from: from ?? null, to: to ?? null },
    documents: { total: extractions.length, byKind, received: receivedAt.size },
    fields: { extracted, corrected, approvedWithoutCorrectionPct: totalFields ? Math.round((extracted / totalFields) * 1000) / 10 : null },
    euros: { unpaid: round2(recs.reduce((s, r) => s + r.unpaidEur, 0)), mismatch: round2(recs.reduce((s, r) => s + r.mismatchEur, 0)), reconciliations: recs.length },
    tasks: { openFirm: tasks.filter((t) => t.owner === "firm").length, openClient: tasks.filter((t) => t.owner === "client").length },
    cost: { usd: round2(modelEntries.reduce((s, a) => s + (a.usage?.costUsd ?? 0), 0) * 100) / 100, tokens: modelEntries.reduce((s, a) => s + (a.usage?.inputTokens ?? 0) + (a.usage?.outputTokens ?? 0), 0), modelCalls: modelEntries.length },
    cycle: { documents: cycleHours.length, medianHours: quantile(cycleHours, 0.5), p90Hours: quantile(cycleHours, 0.9) },
    review: { approved, rejected, correctionsByField: [...byField.entries()].map(([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count).slice(0, 5) },
    incidents: { total: Object.values(incidentsBy).reduce((s, n) => s + n, 0), byAction: incidentsBy },
    weekly: [...weeklyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, received]) => ({ week, received })),
  };
}

const INCIDENTS = new Set(["message.failed", "document.failed", "job.failed", "system.write_failed", "inbound.media_failed", "document.purge_failed"]);

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  const v = sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  return Math.round(v * 100) / 100;
}

/** ISO week key, e.g. 2026-W37. */
export function isoWeek(iso: string): string {
  const d = new Date(iso);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
