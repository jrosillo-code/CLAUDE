import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv, csvCell } from "../lib/csv";
import { isoWeek } from "../lib/metrics";

test("cells quote separators and newlines, neutralize formulas, keep accents", () => {
  assert.equal(csvCell("Correduría; Norte"), '"Correduría; Norte"');
  assert.equal(csvCell('di "hola"'), '"di ""hola"""');
  assert.equal(csvCell("=1+1"), "'=1+1");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell({ a: 1 }), '"{""a"":1}"');
});

test("the file opens in Spanish Excel: BOM, semicolons, CRLF", () => {
  const csv = toCsv([{ n: "Ana", v: 12.5 }], [{ header: "nombre", value: (r) => r.n }, { header: "valor", value: (r) => r.v }]);
  assert.equal(csv, "﻿nombre;valor\r\nAna;12.5\r\n");
});

test("ISO weeks follow the standard", () => {
  assert.equal(isoWeek("2026-01-01T10:00:00Z"), "2026-W01");
  assert.equal(isoWeek("2026-09-13T10:00:00Z"), "2026-W37");
  assert.equal(isoWeek("2027-01-03T10:00:00Z"), "2026-W53");
});
