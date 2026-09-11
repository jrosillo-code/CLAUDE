import type { DocumentRecord, Extraction, Task } from "../types";

// Boundary to the firm's management system (ebroker, segElevia, Mediator,
// Holded, A3...). Real adapters are written per system once a pilot firm names
// theirs. Until then a CSV export keeps every write reviewable and importable,
// and the interface keeps the pipeline honest: writes happen only here, and
// only after an approval.

export interface SystemWrite {
  documentId: string;
  clientRef: string | null;
  kind: string;
  fields: Record<string, unknown>;
}

export interface ManagementSystemAdapter {
  readonly name: string;
  writeDocument(doc: DocumentRecord, extraction: Extraction): Promise<{ ok: boolean; reference: string | null; detail?: string }>;
  createTask(task: Task): Promise<{ ok: boolean; reference: string | null }>;
}

export class NoopAdapter implements ManagementSystemAdapter {
  readonly name = "none";
  async writeDocument() { return { ok: true, reference: null, detail: "sin sistema de gestión configurado" }; }
  async createTask() { return { ok: true, reference: null }; }
}

/** Collects writes as rows the firm can import; also what the tests inspect. */
export class CsvExportAdapter implements ManagementSystemAdapter {
  readonly name = "csv";
  readonly rows: string[] = ["documento;cliente;tipo;campo;valor;cita;pagina"];
  readonly tasks: Task[] = [];
  async writeDocument(doc: DocumentRecord, extraction: Extraction) {
    const section = extraction.data[extraction.kind] as Record<string, unknown> | undefined;
    if (section && typeof section === "object") {
      for (const [k, v] of Object.entries(section)) {
        if (v && typeof v === "object" && "value" in (v as object)) {
          const f = v as { value: unknown; quote: string; page: number | null };
          this.rows.push([doc.id, doc.clientRef ?? "", extraction.kind, k, String(f.value), f.quote.replace(/;/g, ","), f.page ?? ""].join(";"));
        }
      }
    }
    return { ok: true, reference: `csv:${this.rows.length - 1}` };
  }
  async createTask(task: Task) {
    this.tasks.push(task);
    return { ok: true, reference: `csv-task:${this.tasks.length}` };
  }
  toCsv(): string { return this.rows.join("\n"); }
}
