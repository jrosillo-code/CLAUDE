import type { DocumentStatus } from "./types";
import { firmSettings } from "./types";
import type { Store } from "./store";
import { log } from "./audit";

// Client-defined retention (compliance kit, item 5). Once a document has
// reached a final status and the firm's retention period has passed, the
// original file, the extractions, the drafts and the corrections are deleted.
// The document row stays as a stub (name, hash, status "purged") and the
// activity log is never touched: the audit trail outlives the data.

export const FINAL: DocumentStatus[] = ["approved", "rejected", "failed"];

export interface PurgeSummary { firms: number; purged: number; errors: number }

export async function purgeExpired(store: Store, now: Date = new Date()): Promise<PurgeSummary> {
  const summary: PurgeSummary = { firms: 0, purged: 0, errors: 0 };
  for (const firm of await store.firms.listAll()) {
    const days = firmSettings(firm).retentionDays;
    if (!days || days <= 0) continue;
    summary.firms++;
    const before = new Date(now.getTime() - days * 86_400_000).toISOString();
    for (const doc of await store.documents.listOlderThan(firm.id, before, FINAL)) {
      try {
        await store.files.delete(doc.storagePath);
        const removed = {
          extractions: await store.extractions.deleteByDocument(doc.id),
          drafts: await store.drafts.deleteByDocument(doc.id),
          corrections: await store.corrections.deleteByDocument(doc.id),
        };
        await store.documents.update(doc.id, { status: "purged" });
        await log(store, { firmId: firm.id, action: "document.purged", entity: { type: "document", id: doc.id }, detail: { fileName: doc.fileName, sha256: doc.sha256, previousStatus: doc.status, retentionDays: days, removed } });
        summary.purged++;
      } catch (err) {
        summary.errors++;
        await log(store, { firmId: firm.id, action: "document.purge_failed", entity: { type: "document", id: doc.id }, detail: { error: err instanceof Error ? err.message : String(err) } });
      }
    }
  }
  return summary;
}
