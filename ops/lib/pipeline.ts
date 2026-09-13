import type { Firm, DocumentRecord, Extraction, Validation, Task, Draft, Approval, InboundMessage } from "./types";
import type { Store } from "./store";
import type { Sender } from "./sender";
import type { Extractor, Drafter } from "./claude";
import { withDisclosure } from "./claude";
import { validateExtraction } from "./validate";
import { assertWithinBudget } from "./budget";
import { log } from "./audit";
import { newId, nowIso, sha256 } from "./ids";

// The chain for one document: read → validate → tasks → draft → approval.
// It never sends and never writes to the management system; it ends by asking
// a person. Approval side effects live in lib/approvals.ts.

export interface PipelineDeps {
  store: Store;
  extractor: Extractor;
  drafter: Drafter;
  /** Used only for the operational budget warning. */
  sender?: Sender;
}

export interface IntakeInput {
  firm: Firm;
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
  inbound?: InboundMessage | null;
  clientRef?: string | null;
}

export async function receiveDocument(deps: PipelineDeps, input: IntakeInput): Promise<DocumentRecord> {
  const { store } = deps;
  const id = newId();
  const storagePath = `${input.firm.id}/${id}/${input.fileName}`;
  await store.files.put(storagePath, input.bytes, input.mediaType);
  const doc: DocumentRecord = {
    id,
    firmId: input.firm.id,
    inboundMessageId: input.inbound?.id ?? null,
    clientRef: input.clientRef ?? null,
    storagePath,
    fileName: input.fileName,
    mediaType: input.mediaType,
    sha256: sha256(input.bytes),
    status: "received",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await store.documents.insert(doc);
  await log(store, {
    firmId: doc.firmId,
    action: "document.received",
    entity: { type: "document", id: doc.id },
    detail: { channel: input.inbound?.channel ?? "upload", fileName: doc.fileName, sha256: doc.sha256 },
  });
  return doc;
}

export interface ProcessResult {
  document: DocumentRecord;
  extraction: Extraction;
  validation: Validation;
  tasks: Task[];
  draft: Draft | null;
  approvals: Approval[];
}

export async function processDocument(deps: PipelineDeps, firm: Firm, documentId: string): Promise<ProcessResult> {
  const { store, extractor, drafter } = deps;
  const doc = await store.documents.get(documentId);
  if (!doc) throw new Error(`Documento no encontrado: ${documentId}`);
  const file = await store.files.get(doc.storagePath);
  if (!file) throw new Error(`Archivo no encontrado: ${doc.storagePath}`);

  try {
    // 1. Read. Budget is checked before every model call.
    await assertWithinBudget(store, firm, deps.sender ?? null);
    const read = await extractor.extract({ mediaType: file.mediaType, bytes: file.bytes, fileName: doc.fileName });
    const extraction: Extraction = {
      id: newId(),
      documentId: doc.id,
      kind: read.data.kind,
      kindConfidence: read.data.kind_confidence,
      data: read.data as unknown as Record<string, unknown>,
      usage: read.usage,
      createdAt: nowIso(),
    };
    await store.extractions.insert(extraction);
    await store.documents.update(doc.id, { status: "extracted" });
    await log(store, {
      firmId: firm.id,
      action: "document.extracted",
      entity: { type: "extraction", id: extraction.id },
      actor: { type: "model", id: read.usage.model },
      usage: read.usage,
      detail: { documentId: doc.id, kind: extraction.kind, confidence: extraction.kindConfidence, summary: read.data.summary },
    });

    // 2. Validate: deterministic, no model.
    const result = validateExtraction(read.data);
    const validation: Validation = {
      id: newId(),
      extractionId: extraction.id,
      documentId: doc.id,
      ok: result.ok,
      issues: result.issues,
      missing: result.missing,
      createdAt: nowIso(),
    };
    await store.validations.insert(validation);
    await store.documents.update(doc.id, { status: "validated" });
    await log(store, {
      firmId: firm.id,
      action: "document.validated",
      entity: { type: "validation", id: validation.id },
      detail: { documentId: doc.id, ok: result.ok, errors: result.issues.filter((i) => i.severity === "error").length, missing: result.missing },
    });

    // 3. Tasks: one per missing item for the sender, one for the firm per hard error.
    const tasks: Task[] = [];
    for (const m of result.missing) {
      tasks.push({ id: newId(), firmId: firm.id, documentId: doc.id, title: `Pedir: ${m}`, detail: `Falta en ${doc.fileName}`, owner: "client", status: "open", createdAt: nowIso() });
    }
    for (const issue of result.issues) {
      if (issue.severity === "error" && !["missing", "missing_document"].includes(issue.code)) {
        tasks.push({ id: newId(), firmId: firm.id, documentId: doc.id, title: `Revisar: ${issue.message}`, detail: `Campo ${issue.field ?? "-"} en ${doc.fileName}`, owner: "firm", status: "open", createdAt: nowIso() });
      }
    }
    for (const t of tasks) await store.tasks.insert(t);
    if (tasks.length) {
      await log(store, { firmId: firm.id, action: "tasks.created", entity: { type: "document", id: doc.id }, detail: { count: tasks.length } });
    }

    // 4. Draft the reply only when there is something to ask for, and only from
    //    the validator's list. Then the disclosure is appended by code.
    let draft: Draft | null = null;
    const approvals: Approval[] = [];
    const to = doc.inboundMessageId ? await senderAddress(store, doc) : null;
    if (result.missing.length > 0 && to) {
      await assertWithinBudget(store, firm, deps.sender ?? null);
      const warnings = result.issues.filter((i) => i.severity === "warning").map((i) => i.message);
      const written = await drafter.draft({
        firmName: firm.name,
        firmKind: firm.kind,
        recipientName: null,
        channel: to.channel,
        documentSummary: read.data.summary,
        missing: result.missing,
        warnings,
      });
      draft = {
        id: newId(),
        firmId: firm.id,
        documentId: doc.id,
        channel: to.channel,
        to: to.address,
        subject: to.channel === "email" ? written.data.subject : null,
        body: withDisclosure(written.data.body, firm.name),
        usage: written.usage,
        createdAt: nowIso(),
      };
      await store.drafts.insert(draft);
      await log(store, {
        firmId: firm.id,
        action: "draft.created",
        entity: { type: "draft", id: draft.id },
        actor: { type: "model", id: written.usage.model },
        usage: written.usage,
        detail: { documentId: doc.id, channel: draft.channel, to: draft.to },
      });
      const a: Approval = { id: newId(), firmId: firm.id, documentId: doc.id, action: "send_draft", draftId: draft.id, status: "pending", decidedBy: null, decidedAt: null, note: null, createdAt: nowIso() };
      await store.approvals.insert(a);
      approvals.push(a);
    }

    // 5. Writing into the management system is always its own approval.
    if (extraction.kind !== "otro") {
      const a: Approval = { id: newId(), firmId: firm.id, documentId: doc.id, action: "write_system", draftId: null, status: "pending", decidedBy: null, decidedAt: null, note: null, createdAt: nowIso() };
      await store.approvals.insert(a);
      approvals.push(a);
    }
    await store.documents.update(doc.id, { status: approvals.length ? "awaiting_approval" : "validated" });
    await log(store, { firmId: firm.id, action: "approvals.requested", entity: { type: "document", id: doc.id }, detail: { count: approvals.length, actions: approvals.map((a) => a.action) } });

    const updated = (await store.documents.get(doc.id))!;
    return { document: updated, extraction, validation, tasks, draft, approvals };
  } catch (err) {
    await store.documents.update(doc.id, { status: "failed" });
    await log(store, { firmId: firm.id, action: "document.failed", entity: { type: "document", id: doc.id }, detail: { error: err instanceof Error ? err.message : String(err) } });
    throw err;
  }
}

async function senderAddress(store: Store, doc: DocumentRecord): Promise<{ channel: "email" | "whatsapp"; address: string } | null> {
  // The inbound message knows the channel and the address to reply to.
  const inbound = doc.inboundMessageId ? await findInbound(store, doc) : null;
  if (!inbound) return null;
  if (inbound.channel === "email") return { channel: "email", address: inbound.fromAddress };
  if (inbound.channel === "whatsapp") return { channel: "whatsapp", address: inbound.fromAddress };
  return null;
}

async function findInbound(store: Store, doc: DocumentRecord): Promise<InboundMessage | null> {
  return doc.inboundMessageId ? store.inbound.byId(doc.inboundMessageId) : null;
}
