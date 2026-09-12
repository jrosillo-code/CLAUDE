import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Store, FileStore } from "./store";
import type {
  Firm, InboundMessage, DocumentRecord, Extraction, Validation, Task, Draft, Approval, ActivityEntry, MonthlyUsage, ReconciliationRecord,
  Correction, Job, Membership,
} from "./types";
import type { ExpectedReceipt } from "./reconcile";
import type { Lead } from "./leads";
import { supabaseUrl, supabaseServiceKey } from "./env";

// Server-only. Uses the service role, so RLS does not apply here: this file is
// the only writer for most tables, and it must never be imported from client
// code. Members read through their own Supabase session with RLS applied.

type Row = Record<string, unknown>;

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  if (res.data === null) throw new Error(`${what}: sin datos`);
  return res.data;
}

const toFirm = (r: Row): Firm => ({ id: r.id as string, name: r.name as string, kind: r.kind as Firm["kind"], monthlyTokenBudget: Number(r.monthly_token_budget), createdAt: r.created_at as string });
const toInbound = (r: Row): InboundMessage => ({ id: r.id as string, firmId: r.firm_id as string, channel: r.channel as InboundMessage["channel"], fromAddress: r.from_address as string, receivedAt: r.received_at as string, subject: (r.subject as string) ?? null, text: (r.text as string) ?? null, externalId: (r.external_id as string) ?? null, attachments: (r.attachments as InboundMessage["attachments"]) ?? [] });
const toDoc = (r: Row): DocumentRecord => ({ id: r.id as string, firmId: r.firm_id as string, inboundMessageId: (r.inbound_message_id as string) ?? null, clientRef: (r.client_ref as string) ?? null, storagePath: r.storage_path as string, fileName: r.file_name as string, mediaType: r.media_type as string, sha256: r.sha256 as string, status: r.status as DocumentRecord["status"], createdAt: r.created_at as string, updatedAt: r.updated_at as string });
const toExtraction = (r: Row): Extraction => ({ id: r.id as string, documentId: r.document_id as string, kind: r.kind as Extraction["kind"], kindConfidence: Number(r.kind_confidence), data: r.data as Record<string, unknown>, usage: (r.usage as Extraction["usage"]) ?? null, createdAt: r.created_at as string });
const toValidation = (r: Row): Validation => ({ id: r.id as string, extractionId: r.extraction_id as string, documentId: r.document_id as string, ok: r.ok as boolean, issues: r.issues as Validation["issues"], missing: r.missing as string[], createdAt: r.created_at as string });
const toTask = (r: Row): Task => ({ id: r.id as string, firmId: r.firm_id as string, documentId: r.document_id as string, title: r.title as string, detail: r.detail as string, owner: r.owner as Task["owner"], status: r.status as Task["status"], createdAt: r.created_at as string });
const toDraft = (r: Row): Draft => ({ id: r.id as string, firmId: r.firm_id as string, documentId: r.document_id as string, channel: r.channel as Draft["channel"], to: r.to_address as string, subject: (r.subject as string) ?? null, body: r.body as string, usage: (r.usage as Draft["usage"]) ?? null, createdAt: r.created_at as string });
const toApproval = (r: Row): Approval => ({ id: r.id as string, firmId: r.firm_id as string, documentId: r.document_id as string, action: r.action as Approval["action"], draftId: (r.draft_id as string) ?? null, status: r.status as Approval["status"], decidedBy: (r.decided_by as string) ?? null, decidedAt: (r.decided_at as string) ?? null, note: (r.note as string) ?? null, createdAt: r.created_at as string });
const toActivity = (r: Row): ActivityEntry => ({ id: r.id as string, firmId: r.firm_id as string, at: r.at as string, actor: r.actor as ActivityEntry["actor"], action: r.action as string, entity: r.entity as ActivityEntry["entity"], usage: (r.usage as ActivityEntry["usage"]) ?? null, detail: (r.detail as Record<string, unknown>) ?? null });
const toReceipt = (r: Row): ExpectedReceipt => ({ id: r.id as string, firmId: r.firm_id as string, insurer: r.insurer as string, policyNumber: r.policy_number as string, receiptNumber: (r.receipt_number as string) ?? null, premium: Number(r.premium), expectedCommission: Number(r.expected_commission), period: r.period as string, holder: (r.holder as string) ?? null });
const toCorrection = (r: Row): Correction => ({ id: r.id as string, firmId: r.firm_id as string, documentId: r.document_id as string, extractionId: (r.extraction_id as string) ?? null, field: r.field as string, oldValue: r.old_value, newValue: r.new_value, userId: r.user_id as string, createdAt: r.created_at as string });
const toJob = (r: Row): Job => ({ id: r.id as string, firmId: r.firm_id as string, kind: r.kind as Job["kind"], payload: (r.payload as Record<string, unknown>) ?? {}, status: r.status as Job["status"], attempts: Number(r.attempts), runAfter: r.run_after as string, lastError: (r.last_error as string) ?? null, createdAt: r.created_at as string, updatedAt: r.updated_at as string });
const toReconciliation = (r: Row): ReconciliationRecord => ({ id: r.id as string, firmId: r.firm_id as string, documentId: r.document_id as string, insurer: (r.insurer as string) ?? null, period: (r.period as string) ?? null, summary: r.summary as Record<string, unknown>, unpaidEur: Number(r.unpaid_eur), mismatchEur: Number(r.mismatch_eur), usage: (r.usage as ReconciliationRecord["usage"]) ?? null, createdAt: r.created_at as string });

export class SupabaseStore implements Store {
  constructor(private db: SupabaseClient, private bucket = "documents") {}

  static fromEnv(): SupabaseStore | null {
    const url = supabaseUrl();
    const key = supabaseServiceKey();
    if (!url || !key) return null;
    return new SupabaseStore(createClient(url, key, { auth: { persistSession: false } }));
  }

  firms = {
    get: async (id: string) => { const r = await this.db.from("firms").select("*").eq("id", id).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data ? toFirm(r.data) : null; },
    upsert: async (f: Firm) => { must(await this.db.from("firms").upsert({ id: f.id, name: f.name, kind: f.kind, monthly_token_budget: f.monthlyTokenBudget, created_at: f.createdAt }).select("id"), "firms.upsert"); },
  };
  memberships = {
    isMember: async (firmId: string, userId: string) => { const r = await this.db.from("memberships").select("firm_id").eq("firm_id", firmId).eq("user_id", userId).maybeSingle(); if (r.error) throw new Error(r.error.message); return !!r.data; },
    firmsFor: async (userId: string) => {
      const r = await this.db.from("memberships").select("firm_id").eq("user_id", userId); if (r.error) throw new Error(r.error.message);
      const ids = (r.data ?? []).map((x) => x.firm_id as string);
      if (!ids.length) return [];
      const f = await this.db.from("firms").select("*").in("id", ids); if (f.error) throw new Error(f.error.message);
      return (f.data ?? []).map(toFirm);
    },
    add: async (m: Membership) => { const r = await this.db.from("memberships").upsert({ firm_id: m.firmId, user_id: m.userId, role: m.role }); if (r.error) throw new Error(r.error.message); },
  };
  inbound = {
    insert: async (m: InboundMessage) => { must(await this.db.from("inbound_messages").insert({ id: m.id, firm_id: m.firmId, channel: m.channel, from_address: m.fromAddress, received_at: m.receivedAt, subject: m.subject, text: m.text, external_id: m.externalId, attachments: m.attachments }).select("id"), "inbound.insert"); },
    byExternalId: async (firmId: string, externalId: string) => { const r = await this.db.from("inbound_messages").select("*").eq("firm_id", firmId).eq("external_id", externalId).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data ? toInbound(r.data) : null; },
    byId: async (id: string) => { const r = await this.db.from("inbound_messages").select("*").eq("id", id).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data ? toInbound(r.data) : null; },
  };
  documents = {
    insert: async (d: DocumentRecord) => { must(await this.db.from("documents").insert({ id: d.id, firm_id: d.firmId, inbound_message_id: d.inboundMessageId, client_ref: d.clientRef, storage_path: d.storagePath, file_name: d.fileName, media_type: d.mediaType, sha256: d.sha256, status: d.status, created_at: d.createdAt, updated_at: d.updatedAt }).select("id"), "documents.insert"); },
    get: async (id: string) => { const r = await this.db.from("documents").select("*").eq("id", id).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data ? toDoc(r.data) : null; },
    update: async (id: string, patch: Partial<DocumentRecord>) => {
      const row: Row = { updated_at: new Date().toISOString() };
      if (patch.status) row.status = patch.status;
      if (patch.clientRef !== undefined) row.client_ref = patch.clientRef;
      const r = await this.db.from("documents").update(row).eq("id", id); if (r.error) throw new Error(r.error.message);
    },
    listByFirm: async (firmId: string, limit = 50) => { const r = await this.db.from("documents").select("*").eq("firm_id", firmId).order("created_at", { ascending: false }).limit(limit); if (r.error) throw new Error(r.error.message); return (r.data ?? []).map(toDoc); },
  };
  extractions = {
    insert: async (e: Extraction) => {
      const doc = await this.documents.get(e.documentId);
      must(await this.db.from("extractions").insert({ id: e.id, firm_id: doc?.firmId, document_id: e.documentId, kind: e.kind, kind_confidence: e.kindConfidence, data: e.data, usage: e.usage, created_at: e.createdAt }).select("id"), "extractions.insert");
    },
    latestForDocument: async (documentId: string) => { const r = await this.db.from("extractions").select("*").eq("document_id", documentId).order("created_at", { ascending: false }).limit(1).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data ? toExtraction(r.data) : null; },
    updateData: async (id: string, data: Record<string, unknown>) => { const r = await this.db.from("extractions").update({ data }).eq("id", id); if (r.error) throw new Error(r.error.message); },
    listByFirm: async (firmId: string, from?: string, to?: string) => {
      let q = this.db.from("extractions").select("*").eq("firm_id", firmId);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      const r = await q; if (r.error) throw new Error(r.error.message); return (r.data ?? []).map(toExtraction);
    },
  };
  validations = {
    insert: async (v: Validation) => {
      const doc = await this.documents.get(v.documentId);
      must(await this.db.from("validations").insert({ id: v.id, firm_id: doc?.firmId, extraction_id: v.extractionId, document_id: v.documentId, ok: v.ok, issues: v.issues, missing: v.missing, created_at: v.createdAt }).select("id"), "validations.insert");
    },
    latestForDocument: async (documentId: string) => { const r = await this.db.from("validations").select("*").eq("document_id", documentId).order("created_at", { ascending: false }).limit(1).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data ? toValidation(r.data) : null; },
  };
  tasks = {
    insert: async (t: Task) => { must(await this.db.from("tasks").insert({ id: t.id, firm_id: t.firmId, document_id: t.documentId, title: t.title, detail: t.detail, owner: t.owner, status: t.status, created_at: t.createdAt }).select("id"), "tasks.insert"); },
    listByDocument: async (documentId: string) => { const r = await this.db.from("tasks").select("*").eq("document_id", documentId); if (r.error) throw new Error(r.error.message); return (r.data ?? []).map(toTask); },
    listOpenByFirm: async (firmId: string) => { const r = await this.db.from("tasks").select("*").eq("firm_id", firmId).eq("status", "open"); if (r.error) throw new Error(r.error.message); return (r.data ?? []).map(toTask); },
    update: async (id: string, patch: Partial<Task>) => { const row: Row = {}; if (patch.status) row.status = patch.status; if (patch.title) row.title = patch.title; if (patch.detail !== undefined) row.detail = patch.detail; const r = await this.db.from("tasks").update(row).eq("id", id); if (r.error) throw new Error(r.error.message); },
    get: async (id: string) => { const r = await this.db.from("tasks").select("*").eq("id", id).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data ? toTask(r.data) : null; },
  };
  drafts = {
    insert: async (d: Draft) => { must(await this.db.from("drafts").insert({ id: d.id, firm_id: d.firmId, document_id: d.documentId, channel: d.channel, to_address: d.to, subject: d.subject, body: d.body, usage: d.usage, created_at: d.createdAt }).select("id"), "drafts.insert"); },
    get: async (id: string) => { const r = await this.db.from("drafts").select("*").eq("id", id).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data ? toDraft(r.data) : null; },
    update: async (id: string, patch: Partial<Draft>) => { const row: Row = {}; if (patch.body !== undefined) row.body = patch.body; if (patch.subject !== undefined) row.subject = patch.subject; if (patch.to !== undefined) row.to_address = patch.to; const r = await this.db.from("drafts").update(row).eq("id", id); if (r.error) throw new Error(r.error.message); },
  };
  corrections = {
    insert: async (c: Correction) => { must(await this.db.from("corrections").insert({ id: c.id, firm_id: c.firmId, document_id: c.documentId, extraction_id: c.extractionId, field: c.field, old_value: c.oldValue ?? null, new_value: c.newValue ?? null, user_id: c.userId, created_at: c.createdAt }).select("id"), "corrections.insert"); },
    listByDocument: async (documentId: string) => { const r = await this.db.from("corrections").select("*").eq("document_id", documentId); if (r.error) throw new Error(r.error.message); return (r.data ?? []).map(toCorrection); },
    listByFirm: async (firmId: string, from?: string, to?: string) => {
      let q = this.db.from("corrections").select("*").eq("firm_id", firmId);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to);
      const r = await q; if (r.error) throw new Error(r.error.message); return (r.data ?? []).map(toCorrection);
    },
  };
  jobs = {
    enqueue: async (j: Job) => { must(await this.db.from("jobs").insert({ id: j.id, firm_id: j.firmId, kind: j.kind, payload: j.payload, status: j.status, attempts: j.attempts, run_after: j.runAfter, last_error: j.lastError, created_at: j.createdAt, updated_at: j.updatedAt }).select("id"), "jobs.enqueue"); },
    claim: async (limit: number) => { const r = await this.db.rpc("claim_jobs", { p_limit: limit }); if (r.error) throw new Error(r.error.message); return ((r.data as Row[]) ?? []).map(toJob); },
    complete: async (id: string) => { const r = await this.db.from("jobs").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", id); if (r.error) throw new Error(r.error.message); },
    fail: async (id: string, error: string, retryAt: string | null) => {
      const row: Row = { last_error: error, updated_at: new Date().toISOString(), status: retryAt ? "queued" : "failed" };
      if (retryAt) row.run_after = retryAt;
      const r = await this.db.from("jobs").update(row).eq("id", id); if (r.error) throw new Error(r.error.message);
    },
    get: async (id: string) => { const r = await this.db.from("jobs").select("*").eq("id", id).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data ? toJob(r.data) : null; },
  };
  approvals = {
    insert: async (a: Approval) => { must(await this.db.from("approvals").insert({ id: a.id, firm_id: a.firmId, document_id: a.documentId, action: a.action, draft_id: a.draftId, status: a.status, created_at: a.createdAt }).select("id"), "approvals.insert"); },
    get: async (id: string) => { const r = await this.db.from("approvals").select("*").eq("id", id).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data ? toApproval(r.data) : null; },
    update: async (id: string, patch: Partial<Approval>) => {
      const row: Row = {};
      if (patch.status) row.status = patch.status;
      if (patch.decidedBy !== undefined) row.decided_by = patch.decidedBy;
      if (patch.decidedAt !== undefined) row.decided_at = patch.decidedAt;
      if (patch.note !== undefined) row.note = patch.note;
      const r = await this.db.from("approvals").update(row).eq("id", id); if (r.error) throw new Error(r.error.message);
    },
    listPending: async (firmId: string) => { const r = await this.db.from("approvals").select("*").eq("firm_id", firmId).eq("status", "pending").order("created_at"); if (r.error) throw new Error(r.error.message); return (r.data ?? []).map(toApproval); },
  };
  activity = {
    append: async (e: ActivityEntry) => { must(await this.db.from("activity_log").insert({ id: e.id, firm_id: e.firmId, at: e.at, actor: e.actor, action: e.action, entity: e.entity, usage: e.usage, detail: e.detail }).select("id"), "activity.append"); },
    list: async (firmId: string, limit = 100) => { const r = await this.db.from("activity_log").select("*").eq("firm_id", firmId).order("at", { ascending: false }).limit(limit); if (r.error) throw new Error(r.error.message); return (r.data ?? []).map(toActivity); },
  };
  usage = {
    get: async (firmId: string, month: string) => { const r = await this.db.from("monthly_usage").select("*").eq("firm_id", firmId).eq("month", month).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data ? ({ firmId, month, tokens: Number(r.data.tokens), costUsd: Number(r.data.cost_usd) } satisfies MonthlyUsage) : null; },
    add: async (firmId: string, month: string, tokens: number, costUsd: number) => { const r = await this.db.rpc("add_monthly_usage", { p_firm: firmId, p_month: month, p_tokens: tokens, p_cost: costUsd }); if (r.error) throw new Error(r.error.message); },
  };
  receipts = {
    replaceForPeriod: async (firmId: string, insurer: string, period: string, rows: ExpectedReceipt[]) => {
      const del = await this.db.from("expected_receipts").delete().eq("firm_id", firmId).eq("insurer", insurer).eq("period", period); if (del.error) throw new Error(del.error.message);
      if (rows.length) { const ins = await this.db.from("expected_receipts").insert(rows.map((x) => ({ id: x.id, firm_id: x.firmId, insurer: x.insurer, policy_number: x.policyNumber, receipt_number: x.receiptNumber, premium: x.premium, expected_commission: x.expectedCommission, period: x.period, holder: x.holder }))); if (ins.error) throw new Error(ins.error.message); }
    },
    list: async (firmId: string, insurer: string | null, period: string | null) => {
      let q = this.db.from("expected_receipts").select("*").eq("firm_id", firmId);
      if (insurer) q = q.eq("insurer", insurer);
      if (period) q = q.eq("period", period);
      const r = await q; if (r.error) throw new Error(r.error.message); return (r.data ?? []).map(toReceipt);
    },
  };
  reconciliations = {
    insert: async (x: ReconciliationRecord) => { must(await this.db.from("reconciliations").insert({ id: x.id, firm_id: x.firmId, document_id: x.documentId, insurer: x.insurer, period: x.period, summary: x.summary, unpaid_eur: x.unpaidEur, mismatch_eur: x.mismatchEur, usage: x.usage, created_at: x.createdAt }).select("id"), "reconciliations.insert"); },
    get: async (id: string) => { const r = await this.db.from("reconciliations").select("*").eq("id", id).maybeSingle(); if (r.error) throw new Error(r.error.message); return r.data ? toReconciliation(r.data) : null; },
    listByFirm: async (firmId: string, limit = 50) => { const r = await this.db.from("reconciliations").select("*").eq("firm_id", firmId).order("created_at", { ascending: false }).limit(limit); if (r.error) throw new Error(r.error.message); return (r.data ?? []).map(toReconciliation); },
  };
  leads = {
    insert: async (l: Lead) => { must(await this.db.from("leads").insert({ id: l.id, name: l.name, email: l.email, phone: l.phone, firm: l.firm, kind: l.kind, message: l.message, source: l.source, ip_hash: l.ipHash, created_at: l.createdAt }).select("id"), "leads.insert"); },
    list: async (limit = 100) => { const r = await this.db.from("leads").select("*").order("created_at", { ascending: false }).limit(limit); if (r.error) throw new Error(r.error.message); return (r.data ?? []).map((x) => ({ id: x.id as string, name: x.name as string, email: x.email as string, phone: (x.phone as string) ?? null, firm: (x.firm as string) ?? null, kind: x.kind as Lead["kind"], message: x.message as string, source: x.source as string, ipHash: (x.ip_hash as string) ?? null, createdAt: x.created_at as string })); },
  };
  files: FileStore = {
    put: async (path, bytes, mediaType) => { const r = await this.db.storage.from(this.bucket).upload(path, bytes, { contentType: mediaType, upsert: false }); if (r.error) throw new Error(`storage.upload: ${r.error.message}`); },
    get: async (path) => {
      const r = await this.db.storage.from(this.bucket).download(path);
      if (r.error || !r.data) return null;
      return { bytes: new Uint8Array(await r.data.arrayBuffer()), mediaType: r.data.type || "application/octet-stream" };
    },
  };
}
