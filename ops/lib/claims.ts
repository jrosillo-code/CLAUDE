import type { Approval, Draft, Firm, ReconciliationRecord } from "./types";
import type { Store } from "./store";
import type { ReconcileItem, ReconcileSummary } from "./reconcile";
import { withDisclosure } from "./claude";
import { log } from "./audit";
import { newId, nowIso } from "./ids";

// From a reconciled settlement to a claim the insurer can act on. The letter
// is assembled by code from the reconciliation lines (no model call: every
// figure already carries its quote from the statement or the firm's own
// receipts), stored as a draft, and put behind an approval. Sending is the
// reviewer's decision in the queue, like any other message.

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lines that represent money the insurer still owes the firm. */
export function claimableItems(summary: ReconcileSummary): ReconcileItem[] {
  return summary.items.filter((i) => i.status === "not_settled" || (i.status === "amount_mismatch" && i.differenceEur > 0));
}

export function claimTotal(summary: ReconcileSummary): number {
  return Math.round(claimableItems(summary).reduce((s, i) => s + i.differenceEur, 0) * 100) / 100;
}

export function eur(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function periodLabel(period: string | null): string {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period ?? "el periodo indicado";
  const [y, m] = period.split("-").map(Number);
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
  return name;
}

/** The claim letter, without the disclosure block (appended by withDisclosure). */
export function buildClaimBody(firm: Firm, record: ReconciliationRecord): { subject: string; body: string; total: number; lines: ReconcileItem[] } {
  const summary = record.summary as unknown as ReconcileSummary;
  const lines = claimableItems(summary);
  const total = claimTotal(summary);
  const insurer = record.insurer ?? "la aseguradora";
  const period = periodLabel(record.period);
  const subject = `Reclamación de comisiones no liquidadas · ${period}`;
  const bullets = lines.map((i) => {
    const ref = [i.policyNumber ? `póliza ${i.policyNumber}` : null, i.receiptNumber ? `recibo ${i.receiptNumber}` : null].filter(Boolean).join(", ");
    const settled = i.status === "not_settled" ? "no figura en la liquidación" : `liquidada ${eur(i.settledCommission)}`;
    return `- ${ref || "línea sin referencia"}: comisión esperada ${eur(i.expectedCommission)}, ${settled}, diferencia ${eur(i.differenceEur)}.`;
  });
  const body = [
    "Estimados señores:",
    "",
    `Revisada la liquidación de comisiones de ${insurer} correspondiente a ${period}, detectamos las siguientes diferencias respecto a los recibos gestionados por ${firm.name}:`,
    "",
    ...bullets,
    "",
    `Total reclamado: ${eur(total)}.`,
    "",
    "Les rogamos que revisen estos recibos y regularicen el importe en la próxima liquidación, o que nos indiquen el motivo de la diferencia.",
    "",
    "Atentamente,",
  ].join("\n");
  return { subject, body, total, lines };
}

/** Marker stored on the pending approval so a second click does not create a second claim. */
export function claimMarker(recordId: string): string {
  return `claim:${recordId}`;
}

export async function findPendingClaim(store: Store, record: ReconciliationRecord): Promise<Approval | null> {
  const pending = await store.approvals.listPending(record.firmId);
  return pending.find((a) => a.action === "send_draft" && a.note === claimMarker(record.id)) ?? null;
}

export interface ClaimInput {
  firm: Firm;
  record: ReconciliationRecord;
  /** Insurer's settlements mailbox. */
  to: string;
  userId: string;
}

export async function createClaim(store: Store, input: ClaimInput): Promise<{ draft: Draft; approval: Approval; total: number }> {
  const { firm, record } = input;
  if (record.firmId !== firm.id) throw new Error("La liquidación no pertenece a este despacho");
  const to = input.to.trim();
  if (!EMAIL.test(to)) throw new Error("Indica el correo de liquidaciones de la aseguradora");
  const existing = await findPendingClaim(store, record);
  if (existing) throw new Error("Ya hay una reclamación pendiente de aprobar para esta liquidación");
  const { subject, body, total, lines } = buildClaimBody(firm, record);
  if (lines.length === 0) throw new Error("No hay importes que reclamar en esta liquidación");

  const draft: Draft = {
    id: newId(),
    firmId: firm.id,
    documentId: record.documentId,
    channel: "email",
    to,
    subject,
    body: withDisclosure(body, firm.name),
    usage: null,
    createdAt: nowIso(),
  };
  await store.drafts.insert(draft);
  const approval: Approval = {
    id: newId(),
    firmId: firm.id,
    documentId: record.documentId,
    action: "send_draft",
    draftId: draft.id,
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    note: claimMarker(record.id),
    createdAt: nowIso(),
  };
  await store.approvals.insert(approval);
  await log(store, {
    firmId: firm.id,
    action: "claim.drafted",
    entity: { type: "reconciliation", id: record.id },
    actor: { type: "user", id: input.userId },
    detail: { to, lines: lines.length, totalEur: total, approvalId: approval.id, draftId: draft.id },
  });
  return { draft, approval, total };
}
