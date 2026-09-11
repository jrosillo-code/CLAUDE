import { test } from "node:test";
import assert from "node:assert/strict";
import { makePdf } from "../lib/eval/pdf";
import { FIXTURES } from "../lib/eval/fixtures";
import { scoreFixture, summarize } from "../lib/eval/score";
import { DemoExtractor } from "../lib/demo";

test("the PDF writer produces a well-formed file with the text inside", () => {
  const bytes = makePdf([{ title: "FACTURA", lines: ["Base imponible 820,00", "Total 992,20 €"] }]);
  const s = Buffer.from(bytes).toString("latin1");
  assert.ok(s.startsWith("%PDF-1.4"));
  assert.ok(s.includes("/Type /Catalog"));
  assert.ok(s.includes("(Base imponible 820,00) Tj"));
  assert.ok(s.trimEnd().endsWith("%%EOF"));
  const startxref = Number(/startxref\n(\d+)/.exec(s)![1]);
  assert.equal(s.slice(startxref, startxref + 4), "xref");
});

test("scoring counts correct, wrong, missed and invented values with provenance", async () => {
  const fx = FIXTURES[0];
  const r = await new DemoExtractor().extract({ mediaType: "application/pdf", bytes: fx.pdf(), fileName: fx.fileName });
  const section = (r.data as unknown as Record<string, unknown>).factura as Record<string, unknown>;
  const good = scoreFixture(fx, r.data.kind, section);
  assert.equal(good.kindOk, true);
  assert.equal(good.invented, 0);
  assert.equal(good.wrong, 0);
  assert.equal(good.missed, 0);

  const tampered = structuredClone(section) as Record<string, { value: unknown; quote: string; page: number | null }>;
  tampered.total = { value: 999, quote: "TOTAL 999,00", page: 1 }; // quote not in the document
  tampered.receptor_nif = { value: "12345678Z", quote: "NIF 12345678Z", page: 1 }; // expected null and quote absent
  tampered.numero = { value: "2026/0001", quote: "Factura nº 2026/0412", page: 1 }; // quote real, value wrong
  delete tampered.fecha_expedicion;
  const bad = scoreFixture(fx, "factura", tampered);
  assert.equal(bad.invented, 2);
  assert.equal(bad.wrong, 1);
  assert.equal(bad.missed, 1);
  const s = summarize([good, bad]);
  assert.equal(s.invented, 2);
  assert.ok(s.accuracyPct! < 100);
});
