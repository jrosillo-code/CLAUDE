// CSV the way a Spanish office opens it: semicolon separated (Excel with a
// comma decimal locale expects it), UTF-8 with BOM so accents survive, RFC
// 4180 quoting. Values that could be read as formulas are neutralized.

export interface Column<T> { header: string; value: (row: T) => unknown }

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(";")];
  for (const r of rows) lines.push(columns.map((c) => csvCell(c.value(r))).join(";"));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
