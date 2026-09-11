import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFactura, validateParteSiniestro, validatePoliza, present } from "../lib/validate";
import type { Factura, ParteSiniestro, Poliza } from "../lib/schemas/document";

const f = <T,>(value: T, quote = "x"): { value: T; quote: string; page: number | null } => ({ value, quote, page: 1 });

const goodInvoice: Factura = {
  emisor_nombre: f("Talleres Norte SL"), emisor_nif: f("B12345674"), receptor_nombre: f("Marta"), receptor_nif: f("12345678Z"),
  serie: null, numero: f("2026/0412"), fecha_expedicion: f("2026-09-05"), base_imponible: f(820), tipo_iva: f(21), cuota_iva: f(172.2), total: f(992.2), concepto: f("Reparación"),
};

test("a complete, consistent invoice passes", () => {
  const r = validateFactura(goodInvoice);
  assert.equal(r.ok, true);
  assert.deepEqual(r.missing, []);
});

test("a value without a quote is treated as missing, never as fact", () => {
  const r = validateFactura({ ...goodInvoice, emisor_nif: { value: "B12345674", quote: "", page: null } });
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.code === "value_without_source" && i.field === "emisor_nif"));
  assert.ok(r.missing.includes("NIF del emisor"));
  assert.equal(present({ value: "x", quote: "  ", page: null }), false);
});

test("arithmetic and NIF rules fire", () => {
  const r = validateFactura({ ...goodInvoice, total: f(900), emisor_nif: f("B12345670") });
  assert.ok(r.issues.some((i) => i.code === "total_mismatch"));
  assert.ok(r.issues.some((i) => i.code === "bad_nif"));
  assert.equal(r.ok, false);
});

test("claim checklist produces missing documents per claim type", () => {
  const p: ParteSiniestro = {
    tipo: f("auto"), numero_poliza: f("AU-1"), asegurado_nombre: f("M"), fecha_siniestro: f("2026-09-03"), lugar: f("Madrid"),
    descripcion: f("Alcance"), terceros_implicados: f(true), documentos_adjuntos: ["fotos", "parte_amistoso"],
  };
  const r = validateParteSiniestro(p);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ["Permiso de circulación", "Carné de conducir del conductor"]);
});

test("policy near expiry raises a renewal warning without failing", () => {
  const soon = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  const p: Poliza = { numero: f("HG-1"), aseguradora: f("X"), tomador_nombre: f("Luis"), tomador_nif: f("12345678Z"), ramo: f("Hogar"), fecha_efecto: f("2025-10-15"), fecha_vencimiento: f(soon), prima_total: f(400) };
  const r = validatePoliza(p);
  assert.equal(r.ok, true);
  assert.ok(r.issues.some((i) => i.code === "renewal_due"));
});
