import type { Field } from "../types";
import type { Fixture } from "./fixtures";

// Field-level scoring of a reading against a fixture's ground truth, plus a
// provenance check: every present value must carry a quote that actually
// occurs in the document text. A value with a quote that is not in the
// document is counted as invented, which is the one number that must be zero.

export interface FieldScore { field: string; status: "correct" | "wrong" | "missed" | "invented" | "true_null"; expected: unknown; got: unknown; quoteFound: boolean | null }
export interface FixtureScore { name: string; kindOk: boolean; fields: FieldScore[]; correct: number; wrong: number; missed: number; invented: number; quoteMisses: number; linesOk: boolean | null }

const norm = (v: unknown) => (typeof v === "string" ? v.normalize("NFC").toUpperCase().replace(/[\s\-./]/g, "") : v);

function same(expected: unknown, got: unknown): boolean {
  if (typeof expected === "number" && typeof got === "number") return Math.abs(expected - got) <= 0.01;
  if (typeof expected === "boolean") return expected === got;
  return norm(expected) === norm(got);
}

function normText(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").toLowerCase();
}

export function scoreFixture(fx: Fixture, kind: string, section: Record<string, unknown> | null, lines?: unknown[]): FixtureScore {
  const doc = normText([fx.title, ...fx.lines].join(" "));
  const fields: FieldScore[] = [];
  for (const [name, expected] of Object.entries(fx.expected)) {
    const raw = section ? (section[name] as Field<unknown> | null | undefined) : null;
    const present = !!raw && raw.value !== null && raw.value !== undefined && !!raw.quote?.trim();
    const quoteFound = present ? doc.includes(normText(raw!.quote)) : null;
    let status: FieldScore["status"];
    if (expected === null) status = present ? "invented" : "true_null";
    else if (!present) status = "missed";
    else if (!quoteFound) status = "invented";
    else status = same(expected, raw!.value) ? "correct" : "wrong";
    fields.push({ field: name, status, expected, got: present ? raw!.value : null, quoteFound });
  }
  const count = (s: FieldScore["status"]) => fields.filter((x) => x.status === s).length;
  return {
    name: fx.name,
    kindOk: kind === fx.kind,
    fields,
    correct: count("correct"),
    wrong: count("wrong"),
    missed: count("missed"),
    invented: count("invented"),
    quoteMisses: fields.filter((x) => x.quoteFound === false).length,
    linesOk: fx.expectedLines != null ? (lines?.length ?? 0) === fx.expectedLines : null,
  };
}

export function summarize(scores: FixtureScore[]) {
  const total = scores.reduce((a, s) => a + s.correct + s.wrong + s.missed + s.invented, 0);
  const correct = scores.reduce((a, s) => a + s.correct, 0);
  return {
    fixtures: scores.length,
    kindsOk: scores.filter((s) => s.kindOk).length,
    fieldsScored: total,
    correct,
    wrong: scores.reduce((a, s) => a + s.wrong, 0),
    missed: scores.reduce((a, s) => a + s.missed, 0),
    invented: scores.reduce((a, s) => a + s.invented, 0),
    accuracyPct: total ? Math.round((correct / total) * 1000) / 10 : null,
  };
}
