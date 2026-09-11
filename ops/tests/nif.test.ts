import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidDni, isValidNie, isValidCif, isValidSpanishTaxId } from "../lib/nif";

test("DNI check letter", () => {
  assert.equal(isValidDni("12345678Z"), true);
  assert.equal(isValidDni("12345678-Z"), true);
  assert.equal(isValidDni("12345678A"), false);
  assert.equal(isValidDni("1234567Z"), false);
});

test("NIE check letter", () => {
  assert.equal(isValidNie("X1234567L"), true);
  assert.equal(isValidNie("Y1234567X"), true);
  assert.equal(isValidNie("X1234567A"), false);
});

test("CIF control digit and letter", () => {
  assert.equal(isValidCif("B12345674"), true);
  assert.equal(isValidCif("A58818501"), true);
  assert.equal(isValidCif("B12345670"), false);
  assert.equal(isValidCif("Q2826000H"), true);
});

test("combined check", () => {
  assert.equal(isValidSpanishTaxId("nope"), false);
  assert.equal(isValidSpanishTaxId("b-12345674"), true);
});
