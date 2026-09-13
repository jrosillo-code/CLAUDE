import type { Firm, ReconciliationRecord, Task } from "./types";
import type { Store } from "./store";
import type { Sender } from "./sender";
import type { SettlementExtractor } from "./claude";
import { reconcile, type ReconcileSummary } from "./reconcile";
import { assertWithinBudget } from "./budget";
import { log } from "./audit";
import { newId, nowIso } from "./ids";

// The brokerage pilot workflow: an insurer's settlement statement arrives,
// is read into lines, matched against the receipts the firm expected for that
// insurer and period, and every euro not paid becomes a task for the firm.
// Nothing is sent to the insurer: chasing is a person's decision.

export interface SettlementDeps {
  store: Store;
  settlementExtractor: SettlementExtractor;
  /** Used only for the operational budget warning. */
  sender?: Sender;
}

export interface SettlementInput {
  firm: Firm;
  documentId: string;
  /** Insurer name as used in the expected-receipts import; null = as read. */
  insurer?: string | null;
  /** YYYY-MM; null = as read from the period end. */
  period?: string | null;
}

export async function processSettlement(deps: SettlementDeps, input: SettlementInput): Promise<{ record: ReconciliationRecord; tasks: Task[] }> {
  const { store, settlementExtractor } = deps;
  const doc = await store.documents.get(input.documentId);
  if (!doc) throw new Error(`Documento no encontrado: ${input.documentId}`);
  const file = await store.files.get(doc.storagePath);
  if (!file) throw new Error(`Archivo no encontrado: ${doc.storagePath}`);

  await assertWithinBudget(store, input.firm, deps.sender ?? null);
  const read = await settlementExtractor.extractSettlement({ mediaType: file.mediaType, bytes: file.bytes, fileName: doc.fileName });
  await log(store, {
    firmId: input.firm.id,
    action: "settlement.extracted",
    entity: { type: "document", id: doc.id },
    actor: { type: "model", id: read.usage.model },
    usage: read.usage,
    detail: { lines: read.data.lineas.length, insurer: read.data.aseguradora?.value ?? null },
  });

  const insurer = input.insurer ?? read.data.aseguradora?.value ?? null;
  const period = input.period ?? (read.data.periodo_fin?.value ? read.data.periodo_fin.value.slice(0, 7) : null);
  const expected = await store.receipts.list(input.firm.id, insurer, period);
  const summary: ReconcileSummary = reconcile(read.data, expected);

  const record: ReconciliationRecord = {
    id: newId(),
    firmId: input.firm.id,
    documentId: doc.id,
    insurer,
    period,
    summary: summary as unknown as Record<string, unknown>,
    unpaidEur: summary.totals.unpaidEur,
    mismatchEur: summary.totals.mismatchEur,
    usage: read.usage,
    createdAt: nowIso(),
  };
  await store.reconciliations.insert(record);

  const tasks: Task[] = [];
  for (const item of summary.items) {
    if (item.status === "not_settled" || (item.status === "amount_mismatch" && item.differenceEur > 0)) {
      tasks.push({
        id: newId(),
        firmId: input.firm.id,
        documentId: doc.id,
        title: `Reclamar ${item.differenceEur.toFixed(2)} € a ${insurer ?? "la aseguradora"}: póliza ${item.policyNumber ?? "?"}`,
        detail: item.note,
        owner: "firm",
        status: "open",
        createdAt: nowIso(),
      });
    }
    if (item.status === "unexpected" || item.status === "unreadable") {
      tasks.push({
        id: newId(),
        firmId: input.firm.id,
        documentId: doc.id,
        title: `Revisar línea de liquidación: póliza ${item.policyNumber ?? "ilegible"}`,
        detail: item.note,
        owner: "firm",
        status: "open",
        createdAt: nowIso(),
      });
    }
  }
  for (const t of tasks) await store.tasks.insert(t);
  await store.documents.update(doc.id, { status: "validated" });
  await log(store, {
    firmId: input.firm.id,
    action: "settlement.reconciled",
    entity: { type: "reconciliation", id: record.id },
    detail: { insurer, period, expected: expected.length, lines: read.data.lineas.length, counts: summary.counts, unpaidEur: summary.totals.unpaidEur, mismatchEur: summary.totals.mismatchEur, tasks: tasks.length },
  });
  return { record, tasks };
}
