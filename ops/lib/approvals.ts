import type { Approval, Draft } from "./types";
import type { Store } from "./store";
import type { Sender } from "./sender";
import type { ManagementSystemAdapter } from "./adapters";
import { log } from "./audit";
import { nowIso } from "./ids";

// The human step. An approval is the only path to sending a message or
// writing into the management system. Deciding twice, or deciding an approval
// that is not pending, is an error rather than a silent no-op.

export interface DecideInput {
  approvalId: string;
  decision: "approved" | "rejected";
  userId: string;
  note?: string;
}

export interface Effects {
  sender: Sender;
  adapter: ManagementSystemAdapter;
}

export async function decide(store: Store, effects: Effects, input: DecideInput): Promise<Approval> {
  const approval = await store.approvals.get(input.approvalId);
  if (!approval) throw new Error(`Aprobación no encontrada: ${input.approvalId}`);
  if (approval.status !== "pending") throw new Error(`La aprobación ya está ${approval.status}`);

  const patch: Partial<Approval> = {
    status: input.decision,
    decidedBy: input.userId,
    decidedAt: nowIso(),
    note: input.note ?? null,
  };
  await store.approvals.update(approval.id, patch);
  await log(store, {
    firmId: approval.firmId,
    action: `approval.${input.decision}`,
    entity: { type: "approval", id: approval.id },
    actor: { type: "user", id: input.userId },
    detail: { action: approval.action, documentId: approval.documentId, note: input.note ?? null },
  });

  if (input.decision === "rejected") {
    await store.documents.update(approval.documentId, { status: "rejected" });
    return { ...approval, ...patch };
  }

  if (approval.action === "send_draft") {
    const draft = approval.draftId ? await store.drafts.get(approval.draftId) : null;
    if (!draft) throw new Error("La aprobación no tiene borrador asociado");
    const result = await effects.sender.send(draft);
    await log(store, {
      firmId: approval.firmId,
      action: result.ok ? "message.sent" : "message.failed",
      entity: { type: "draft", id: draft.id },
      actor: { type: "user", id: input.userId },
      detail: { channel: draft.channel, to: draft.to, externalId: result.externalId },
    });
  }
  if (approval.action === "write_system") {
    const doc = await store.documents.get(approval.documentId);
    const extraction = await store.extractions.latestForDocument(approval.documentId);
    if (!doc || !extraction) throw new Error("Documento o extracción no encontrados");
    const result = await effects.adapter.writeDocument(doc, extraction);
    await log(store, {
      firmId: approval.firmId,
      action: result.ok ? "system.written" : "system.write_failed",
      entity: { type: "document", id: doc.id },
      actor: { type: "user", id: input.userId },
      detail: { adapter: effects.adapter.name, reference: result.reference, note: result.detail ?? null },
    });
  }

  const pendingLeft = (await store.approvals.listPending(approval.firmId)).some((a) => a.documentId === approval.documentId);
  if (!pendingLeft) await store.documents.update(approval.documentId, { status: "approved" });
  return { ...approval, ...patch };
}

export function draftPreview(d: Draft): string {
  return d.subject ? `${d.subject}\n\n${d.body}` : d.body;
}
