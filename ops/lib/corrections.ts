import type { Firm, Correction, Validation, Field } from "./types";
import type { Store } from "./store";
import type { DocumentExtraction } from "./schemas/document";
import { validateExtraction } from "./validate";
import { withDisclosure } from "./claude";
import { log } from "./audit";
import { newId, nowIso } from "./ids";

// A reviewer's correction is the product's accuracy signal and the only way
// an extracted value changes after the model read it. The corrected value is
// stored as a Field whose quote names the person, never as if the document
// said it. Validation re-runs so tasks reflect the new state.

export interface CorrectInput {
  firm: Firm;
  documentId: string;
  /** Field name within the document's section, e.g. "total", or "draft.body". */
  field: string;
  value: string;
  userId: string;
  draftId?: string | null;
}

export interface CorrectResult {
  correction: Correction;
  validation: Validation | null;
}

function coerce(old: unknown, raw: string): unknown {
  if (typeof old === "number") {
    const n = Number(raw.replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(n)) throw new Error(`"${raw}" no es un número`);
    return n;
  }
  if (typeof old === "boolean") return /^(s[ií]|true|1|yes)$/i.test(raw.trim());
  return raw;
}

export async function correctField(store: Store, input: CorrectInput): Promise<CorrectResult> {
  const doc = await store.documents.get(input.documentId);
  if (!doc || doc.firmId !== input.firm.id) throw new Error("Documento no encontrado");

  if (input.field === "draft.body") {
    if (!input.draftId) throw new Error("Falta el borrador a corregir");
    const draft = await store.drafts.get(input.draftId);
    if (!draft || draft.documentId !== doc.id) throw new Error("Borrador no encontrado");
    const body = input.value.includes("inteligencia artificial") ? input.value : withDisclosure(input.value, input.firm.name);
    await store.drafts.update(draft.id, { body });
    const correction: Correction = { id: newId(), firmId: input.firm.id, documentId: doc.id, extractionId: null, field: "draft.body", oldValue: draft.body, newValue: body, userId: input.userId, createdAt: nowIso() };
    await store.corrections.insert(correction);
    await log(store, { firmId: input.firm.id, action: "draft.corrected", entity: { type: "draft", id: draft.id }, actor: { type: "user", id: input.userId }, detail: { documentId: doc.id } });
    return { correction, validation: null };
  }

  const extraction = await store.extractions.latestForDocument(doc.id);
  if (!extraction) throw new Error("El documento no tiene lectura que corregir");
  const data = structuredClone(extraction.data) as unknown as DocumentExtraction;
  const sectionName = extraction.kind as keyof DocumentExtraction;
  const section = data[sectionName] as unknown as Record<string, Field<unknown> | null> | null;
  if (!section || typeof section !== "object") throw new Error(`El documento (${extraction.kind}) no tiene campos corregibles`);
  if (!(input.field in section)) throw new Error(`Campo desconocido: ${input.field}`);

  const old = section[input.field];
  const value = coerce(old?.value, input.value);
  const corrected: Field<unknown> = { value, quote: `corregido por ${input.userId}`, page: null };
  section[input.field] = corrected;
  await store.extractions.updateData(extraction.id, data as unknown as Record<string, unknown>);

  const correction: Correction = { id: newId(), firmId: input.firm.id, documentId: doc.id, extractionId: extraction.id, field: input.field, oldValue: old?.value ?? null, newValue: value, userId: input.userId, createdAt: nowIso() };
  await store.corrections.insert(correction);

  // Re-validate and close client tasks for items no longer missing.
  const result = validateExtraction(data);
  const validation: Validation = { id: newId(), extractionId: extraction.id, documentId: doc.id, ok: result.ok, issues: result.issues, missing: result.missing, createdAt: nowIso() };
  await store.validations.insert(validation);
  const stillMissing = new Set(result.missing.map((m) => `Pedir: ${m}`));
  for (const t of await store.tasks.listByDocument(doc.id)) {
    if (t.owner === "client" && t.status === "open" && t.title.startsWith("Pedir: ") && !stillMissing.has(t.title)) {
      await store.tasks.update(t.id, { status: "done" });
    }
  }
  await log(store, { firmId: input.firm.id, action: "field.corrected", entity: { type: "extraction", id: extraction.id }, actor: { type: "user", id: input.userId }, detail: { documentId: doc.id, field: input.field, old: old?.value ?? null, new: value, ok: result.ok } });
  return { correction, validation };
}
