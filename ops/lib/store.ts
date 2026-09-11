import type {
  Firm, InboundMessage, DocumentRecord, Extraction, Validation, Task, Draft, Approval, ActivityEntry, MonthlyUsage, ReconciliationRecord,
} from "./types";
import type { ExpectedReceipt } from "./reconcile";

// Persistence boundary. Two implementations: an in-memory store for tests and
// the keyless demo, and Supabase for production. Everything above this
// interface is the same in both, which is what makes the pipeline testable.

export interface FileStore {
  put(path: string, bytes: Uint8Array, mediaType: string): Promise<void>;
  get(path: string): Promise<{ bytes: Uint8Array; mediaType: string } | null>;
}

export interface Store {
  firms: {
    get(id: string): Promise<Firm | null>;
    upsert(firm: Firm): Promise<void>;
  };
  inbound: {
    insert(m: InboundMessage): Promise<void>;
    byExternalId(firmId: string, externalId: string): Promise<InboundMessage | null>;
    byId(id: string): Promise<InboundMessage | null>;
  };
  documents: {
    insert(d: DocumentRecord): Promise<void>;
    get(id: string): Promise<DocumentRecord | null>;
    update(id: string, patch: Partial<DocumentRecord>): Promise<void>;
    listByFirm(firmId: string, limit?: number): Promise<DocumentRecord[]>;
  };
  extractions: {
    insert(e: Extraction): Promise<void>;
    latestForDocument(documentId: string): Promise<Extraction | null>;
  };
  validations: {
    insert(v: Validation): Promise<void>;
    latestForDocument(documentId: string): Promise<Validation | null>;
  };
  tasks: {
    insert(t: Task): Promise<void>;
    listByDocument(documentId: string): Promise<Task[]>;
    listOpenByFirm(firmId: string): Promise<Task[]>;
  };
  drafts: {
    insert(d: Draft): Promise<void>;
    get(id: string): Promise<Draft | null>;
  };
  approvals: {
    insert(a: Approval): Promise<void>;
    get(id: string): Promise<Approval | null>;
    update(id: string, patch: Partial<Approval>): Promise<void>;
    listPending(firmId: string): Promise<Approval[]>;
  };
  activity: {
    append(e: ActivityEntry): Promise<void>;
    list(firmId: string, limit?: number): Promise<ActivityEntry[]>;
  };
  usage: {
    get(firmId: string, month: string): Promise<MonthlyUsage | null>;
    add(firmId: string, month: string, tokens: number, costUsd: number): Promise<void>;
  };
  receipts: {
    replaceForPeriod(firmId: string, insurer: string, period: string, rows: ExpectedReceipt[]): Promise<void>;
    list(firmId: string, insurer: string | null, period: string | null): Promise<ExpectedReceipt[]>;
  };
  reconciliations: {
    insert(r: ReconciliationRecord): Promise<void>;
    get(id: string): Promise<ReconciliationRecord | null>;
    listByFirm(firmId: string, limit?: number): Promise<ReconciliationRecord[]>;
  };
  files: FileStore;
}

export class MemoryStore implements Store {
  private firmsMap = new Map<string, Firm>();
  private inboundList: InboundMessage[] = [];
  private docs = new Map<string, DocumentRecord>();
  private extractionList: Extraction[] = [];
  private validationList: Validation[] = [];
  private taskList: Task[] = [];
  private draftMap = new Map<string, Draft>();
  private approvalMap = new Map<string, Approval>();
  private activityList: ActivityEntry[] = [];
  private usageMap = new Map<string, MonthlyUsage>();
  private receiptList: ExpectedReceipt[] = [];
  private reconciliationMap = new Map<string, ReconciliationRecord>();
  private fileMap = new Map<string, { bytes: Uint8Array; mediaType: string }>();

  firms = {
    get: async (id: string) => this.firmsMap.get(id) ?? null,
    upsert: async (f: Firm) => { this.firmsMap.set(f.id, f); },
  };
  inbound = {
    insert: async (m: InboundMessage) => { this.inboundList.push(m); },
    byExternalId: async (firmId: string, externalId: string) =>
      this.inboundList.find((m) => m.firmId === firmId && m.externalId === externalId) ?? null,
    byId: async (id: string) => this.inboundList.find((m) => m.id === id) ?? null,
  };
  documents = {
    insert: async (d: DocumentRecord) => { this.docs.set(d.id, d); },
    get: async (id: string) => this.docs.get(id) ?? null,
    update: async (id: string, patch: Partial<DocumentRecord>) => {
      const cur = this.docs.get(id);
      if (cur) this.docs.set(id, { ...cur, ...patch, updatedAt: new Date().toISOString() });
    },
    listByFirm: async (firmId: string, limit = 50) =>
      [...this.docs.values()].filter((d) => d.firmId === firmId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit),
  };
  extractions = {
    insert: async (e: Extraction) => { this.extractionList.push(e); },
    latestForDocument: async (documentId: string) =>
      [...this.extractionList].reverse().find((e) => e.documentId === documentId) ?? null,
  };
  validations = {
    insert: async (v: Validation) => { this.validationList.push(v); },
    latestForDocument: async (documentId: string) =>
      [...this.validationList].reverse().find((v) => v.documentId === documentId) ?? null,
  };
  tasks = {
    insert: async (t: Task) => { this.taskList.push(t); },
    listByDocument: async (documentId: string) => this.taskList.filter((t) => t.documentId === documentId),
    listOpenByFirm: async (firmId: string) => this.taskList.filter((t) => t.firmId === firmId && t.status === "open"),
  };
  drafts = {
    insert: async (d: Draft) => { this.draftMap.set(d.id, d); },
    get: async (id: string) => this.draftMap.get(id) ?? null,
  };
  approvals = {
    insert: async (a: Approval) => { this.approvalMap.set(a.id, a); },
    get: async (id: string) => this.approvalMap.get(id) ?? null,
    update: async (id: string, patch: Partial<Approval>) => {
      const cur = this.approvalMap.get(id);
      if (cur) this.approvalMap.set(id, { ...cur, ...patch });
    },
    listPending: async (firmId: string) =>
      [...this.approvalMap.values()].filter((a) => a.firmId === firmId && a.status === "pending"),
  };
  activity = {
    append: async (e: ActivityEntry) => { this.activityList.push(e); },
    list: async (firmId: string, limit = 100) =>
      this.activityList.filter((e) => e.firmId === firmId).slice(-limit).reverse(),
  };
  usage = {
    get: async (firmId: string, month: string) => this.usageMap.get(`${firmId}:${month}`) ?? null,
    add: async (firmId: string, month: string, tokens: number, costUsd: number) => {
      const k = `${firmId}:${month}`;
      const cur = this.usageMap.get(k) ?? { firmId, month, tokens: 0, costUsd: 0 };
      this.usageMap.set(k, { ...cur, tokens: cur.tokens + tokens, costUsd: cur.costUsd + costUsd });
    },
  };
  receipts = {
    replaceForPeriod: async (firmId: string, insurer: string, period: string, rows: ExpectedReceipt[]) => {
      this.receiptList = this.receiptList.filter((r) => !(r.firmId === firmId && r.insurer === insurer && r.period === period));
      this.receiptList.push(...rows);
    },
    list: async (firmId: string, insurer: string | null, period: string | null) =>
      this.receiptList.filter((r) => r.firmId === firmId && (!insurer || r.insurer === insurer) && (!period || r.period === period)),
  };
  reconciliations = {
    insert: async (r: ReconciliationRecord) => { this.reconciliationMap.set(r.id, r); },
    get: async (id: string) => this.reconciliationMap.get(id) ?? null,
    listByFirm: async (firmId: string, limit = 50) =>
      [...this.reconciliationMap.values()].filter((r) => r.firmId === firmId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit),
  };
  files: FileStore = {
    put: async (path, bytes, mediaType) => { this.fileMap.set(path, { bytes, mediaType }); },
    get: async (path) => this.fileMap.get(path) ?? null,
  };
}
