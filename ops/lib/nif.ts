// Spanish tax identifiers: DNI (8 digits + letter), NIE (X/Y/Z + 7 digits +
// letter), CIF (letter + 7 digits + control digit or letter). The check
// letters are deterministic, so a mistyped or invented NIF is caught before it
// reaches an invoice record.

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
const CIF_CONTROL_LETTERS = "JABCDEFGHI";

export function normalizeNif(raw: string): string {
  return raw.toUpperCase().replace(/[\s.\-]/g, "");
}

export function isValidDni(raw: string): boolean {
  const nif = normalizeNif(raw);
  const m = /^(\d{8})([A-Z])$/.exec(nif);
  if (!m) return false;
  return DNI_LETTERS[Number(m[1]) % 23] === m[2];
}

export function isValidNie(raw: string): boolean {
  const nif = normalizeNif(raw);
  const m = /^([XYZ])(\d{7})([A-Z])$/.exec(nif);
  if (!m) return false;
  const prefix = { X: "0", Y: "1", Z: "2" }[m[1] as "X" | "Y" | "Z"];
  return DNI_LETTERS[Number(prefix + m[2]) % 23] === m[3];
}

export function isValidCif(raw: string): boolean {
  const nif = normalizeNif(raw);
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(nif);
  if (!m) return false;
  const [, letter, digits, control] = m;
  let even = 0;
  let odd = 0;
  for (let i = 0; i < 7; i++) {
    const n = Number(digits[i]);
    if (i % 2 === 0) {
      const d = n * 2;
      odd += Math.floor(d / 10) + (d % 10);
    } else {
      even += n;
    }
  }
  const unit = (10 - ((even + odd) % 10)) % 10;
  const expectDigit = String(unit);
  const expectLetter = CIF_CONTROL_LETTERS[unit];
  // Public bodies and some entity types use a letter; most companies a digit.
  if ("KPQS".includes(letter)) return control === expectLetter;
  if ("ABEH".includes(letter)) return control === expectDigit;
  return control === expectDigit || control === expectLetter;
}

export function isValidSpanishTaxId(raw: string): boolean {
  return isValidDni(raw) || isValidNie(raw) || isValidCif(raw);
}
