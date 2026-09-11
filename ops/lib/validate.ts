import type { Field, ValidationIssue } from "./types";
import type { DocumentExtraction, Factura, Recibo, ParteSiniestro, Poliza } from "./schemas/document";
import { isValidSpanishTaxId } from "./nif";

// Deterministic rules. The model reads; this file decides. Every rule names
// the field and says, in Spanish, what to ask the sender for, so a task and a
// draft can be produced without another model call.

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  missing: string[];
}

type AnyField = Field<unknown> | null | undefined;

/** A value counts only when it comes with the text it was read from. */
export function present<T>(f: Field<T> | null | undefined): f is Field<T> {
  return !!f && f.value !== null && f.value !== undefined && typeof f.quote === "string" && f.quote.trim().length > 0;
}

function req(
  issues: ValidationIssue[],
  missing: string[],
  f: AnyField,
  field: string,
  label: string,
): boolean {
  if (present(f)) return true;
  const invented = !!f && (f as Field<unknown>).value != null && !(f as Field<unknown>).quote?.trim();
  issues.push({
    code: invented ? "value_without_source" : "missing",
    severity: "error",
    field,
    message: invented
      ? `${label}: valor sin cita en el documento; se trata como ausente`
      : `${label}: no consta en el documento`,
  });
  missing.push(label);
  return false;
}

function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateRule(issues: ValidationIssue[], f: Field<string> | null | undefined, field: string, label: string, opts: { notFuture?: boolean } = {}) {
  if (!present(f)) return;
  const d = parseIsoDate(f.value);
  if (!d) {
    issues.push({ code: "bad_date", severity: "error", field, message: `${label}: fecha no válida (${f.value})` });
    return;
  }
  if (opts.notFuture && d.getTime() > Date.now() + 24 * 3600 * 1000) {
    issues.push({ code: "future_date", severity: "warning", field, message: `${label}: fecha en el futuro (${f.value})` });
  }
}

function nifRule(issues: ValidationIssue[], f: Field<string> | null | undefined, field: string, label: string) {
  if (!present(f)) return;
  if (!isValidSpanishTaxId(f.value)) {
    issues.push({ code: "bad_nif", severity: "error", field, message: `${label}: NIF/CIF no supera la comprobación (${f.value})` });
  }
}

export function validateFactura(f: Factura): ValidationResult {
  const issues: ValidationIssue[] = [];
  const missing: string[] = [];
  // Fields a Verifactu-grade invoice record needs. Verifactu itself is not
  // implemented here (that is a certified engine's job); this is the pre-check.
  req(issues, missing, f.emisor_nif, "emisor_nif", "NIF del emisor");
  req(issues, missing, f.emisor_nombre, "emisor_nombre", "Nombre del emisor");
  req(issues, missing, f.numero, "numero", "Número de factura");
  req(issues, missing, f.fecha_expedicion, "fecha_expedicion", "Fecha de expedición");
  const hasBase = req(issues, missing, f.base_imponible, "base_imponible", "Base imponible");
  const hasTipo = req(issues, missing, f.tipo_iva, "tipo_iva", "Tipo de IVA");
  const hasCuota = req(issues, missing, f.cuota_iva, "cuota_iva", "Cuota de IVA");
  const hasTotal = req(issues, missing, f.total, "total", "Total");
  if (!present(f.receptor_nif)) {
    issues.push({ code: "missing", severity: "warning", field: "receptor_nif", message: "NIF del receptor: no consta (obligatorio salvo factura simplificada)" });
  }
  nifRule(issues, f.emisor_nif, "emisor_nif", "NIF del emisor");
  nifRule(issues, f.receptor_nif, "receptor_nif", "NIF del receptor");
  dateRule(issues, f.fecha_expedicion, "fecha_expedicion", "Fecha de expedición", { notFuture: true });

  if (hasBase && hasTipo && hasCuota) {
    const expected = (f.base_imponible!.value * f.tipo_iva!.value) / 100;
    if (Math.abs(expected - f.cuota_iva!.value) > 0.05) {
      issues.push({ code: "iva_mismatch", severity: "error", field: "cuota_iva", message: `Cuota de IVA ${f.cuota_iva!.value} no coincide con base ${f.base_imponible!.value} al ${f.tipo_iva!.value}% (esperado ${expected.toFixed(2)})` });
    }
  }
  if (hasBase && hasCuota && hasTotal) {
    const expected = f.base_imponible!.value + f.cuota_iva!.value;
    if (Math.abs(expected - f.total!.value) > 0.02) {
      issues.push({ code: "total_mismatch", severity: "error", field: "total", message: `Total ${f.total!.value} no coincide con base + cuota (${expected.toFixed(2)})` });
    }
  }
  return { ok: !issues.some((i) => i.severity === "error"), issues, missing };
}

export function validateRecibo(r: Recibo): ValidationResult {
  const issues: ValidationIssue[] = [];
  const missing: string[] = [];
  req(issues, missing, r.importe, "importe", "Importe");
  req(issues, missing, r.fecha, "fecha", "Fecha del recibo");
  req(issues, missing, r.pagador, "pagador", "Pagador");
  if (!present(r.referencia_poliza)) {
    issues.push({ code: "missing", severity: "warning", field: "referencia_poliza", message: "Referencia de póliza: no consta" });
  }
  dateRule(issues, r.fecha, "fecha", "Fecha del recibo", { notFuture: true });
  if (present(r.estado) && r.estado.value === "devuelto") {
    issues.push({ code: "returned_receipt", severity: "warning", field: "estado", message: "Recibo devuelto: requiere gestión de cobro" });
  }
  return { ok: !issues.some((i) => i.severity === "error"), issues, missing };
}

const CLAIM_CHECKLIST: Record<string, Array<{ doc: string; label: string }>> = {
  auto: [
    { doc: "parte_amistoso", label: "Parte amistoso o declaración del siniestro" },
    { doc: "fotos", label: "Fotografías de los daños" },
    { doc: "permiso_circulacion", label: "Permiso de circulación" },
    { doc: "carnet_conducir", label: "Carné de conducir del conductor" },
  ],
  hogar: [
    { doc: "fotos", label: "Fotografías de los daños" },
    { doc: "presupuesto", label: "Presupuesto o factura de reparación" },
  ],
  salud: [{ doc: "informe_medico", label: "Informe médico" }],
  otro: [{ doc: "fotos", label: "Fotografías o justificantes de los daños" }],
};

export function validateParteSiniestro(p: ParteSiniestro): ValidationResult {
  const issues: ValidationIssue[] = [];
  const missing: string[] = [];
  req(issues, missing, p.numero_poliza, "numero_poliza", "Número de póliza");
  req(issues, missing, p.fecha_siniestro, "fecha_siniestro", "Fecha del siniestro");
  req(issues, missing, p.descripcion, "descripcion", "Descripción de lo ocurrido");
  dateRule(issues, p.fecha_siniestro, "fecha_siniestro", "Fecha del siniestro", { notFuture: true });
  const tipo = present(p.tipo) ? p.tipo.value : "otro";
  const attached = new Set(p.documentos_adjuntos ?? []);
  for (const item of CLAIM_CHECKLIST[tipo] ?? CLAIM_CHECKLIST.otro) {
    if (!attached.has(item.doc as never)) {
      issues.push({ code: "missing_document", severity: "error", field: `documentos.${item.doc}`, message: `${item.label}: falta` });
      missing.push(item.label);
    }
  }
  if (present(p.terceros_implicados) && p.terceros_implicados.value && !attached.has("parte_amistoso")) {
    issues.push({ code: "third_party_without_report", severity: "warning", field: "terceros_implicados", message: "Hay terceros implicados y no consta parte amistoso ni denuncia" });
  }
  return { ok: !issues.some((i) => i.severity === "error"), issues, missing };
}

export function validatePoliza(p: Poliza): ValidationResult {
  const issues: ValidationIssue[] = [];
  const missing: string[] = [];
  req(issues, missing, p.numero, "numero", "Número de póliza");
  req(issues, missing, p.aseguradora, "aseguradora", "Aseguradora");
  req(issues, missing, p.tomador_nombre, "tomador_nombre", "Tomador");
  req(issues, missing, p.fecha_vencimiento, "fecha_vencimiento", "Fecha de vencimiento");
  nifRule(issues, p.tomador_nif, "tomador_nif", "NIF del tomador");
  dateRule(issues, p.fecha_efecto, "fecha_efecto", "Fecha de efecto");
  dateRule(issues, p.fecha_vencimiento, "fecha_vencimiento", "Fecha de vencimiento");
  if (present(p.fecha_vencimiento)) {
    const d = parseIsoDate(p.fecha_vencimiento.value);
    if (d) {
      const days = (d.getTime() - Date.now()) / 86_400_000;
      if (days < 0) issues.push({ code: "expired", severity: "warning", field: "fecha_vencimiento", message: "Póliza vencida" });
      else if (days <= 45) issues.push({ code: "renewal_due", severity: "warning", field: "fecha_vencimiento", message: `Vence en ${Math.ceil(days)} días: iniciar renovación` });
    }
  }
  return { ok: !issues.some((i) => i.severity === "error"), issues, missing };
}

export function validateExtraction(x: DocumentExtraction): ValidationResult {
  switch (x.kind) {
    case "factura":
      return x.factura ? validateFactura(x.factura) : unclassified("factura");
    case "recibo":
      return x.recibo ? validateRecibo(x.recibo) : unclassified("recibo");
    case "parte_siniestro":
      return x.parte_siniestro ? validateParteSiniestro(x.parte_siniestro) : unclassified("parte de siniestro");
    case "poliza":
      return x.poliza ? validatePoliza(x.poliza) : unclassified("póliza");
    case "identidad":
      return { ok: true, issues: [], missing: [] };
    default:
      return {
        ok: false,
        issues: [{ code: "unrecognized", severity: "error", field: null, message: "Documento no reconocido: revisar manualmente" }],
        missing: [],
      };
  }
}

function unclassified(kind: string): ValidationResult {
  return {
    ok: false,
    issues: [{ code: "no_data", severity: "error", field: null, message: `Clasificado como ${kind} pero sin datos extraídos: revisar manualmente` }],
    missing: [],
  };
}
