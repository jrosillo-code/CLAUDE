// Country drone rules: the schema, the validator, and the lookup. Every
// legality statement Waypoint shows comes from one of these records — a rule
// without a source and a date is not a rule, and the model never writes one.

export type Regime = "easa" | "national";
export type ImportRestriction = "none" | "declare" | "banned" | "unknown";

/** Unknown is distinct from false: `null` means "depends on the operation or
 *  not established" and the note carries the condition. Never flatten it. */
export interface Flag {
  value: boolean | null;
  note: string;
}

export interface CountryRules {
  countryCode: string;
  countryName: string;
  regime: Regime;
  /** baseline = only the shared (EASA) rules; national = country specifics reviewed. */
  coverage?: "baseline" | "national";
  /** One sentence on what this record does and does not cover. */
  scope?: string;
  authorityName: string;
  authorityUrl: string;
  registrationRequired: Flag;
  pilotCertRequired: Flag;
  weightClasses: { maxGrams: number; summary: string }[];
  /** null = no altitude rule verified for this record. */
  maxAltitudeM: number | null;
  altitudeNote?: string;
  maxDistanceRule: string;
  insuranceRequired: Flag;
  importRestriction: { value: ImportRestriction; note: string };
  noFlyHighlights: string[];
  permitProcess: { who: string; how: string; leadTimeDays: number; url: string } | null;
  nationalApp: { name: string; url: string } | null;
  sourceUrls: string[];
  /** ISO date the facts were last checked against the sources. */
  lastVerifiedOn: string;
  verifiedBy: string;
  notes: string;
}

/** Days after which a record renders with a stale warning. */
export const STALE_AFTER_DAYS = 180;
/** Days after which the test suite refuses the record. */
export const EXPIRED_AFTER_DAYS = 365;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CC = /^[A-Z]{2}$/;

function isFlag(v: unknown): v is Flag {
  if (!v || typeof v !== "object") return false;
  const f = v as Flag;
  if (typeof f.note !== "string") return false;
  // an unknown/conditional flag must explain itself
  if (f.value === null) return f.note.trim().length > 0;
  return typeof f.value === "boolean";
}

function isUrl(s: unknown): boolean {
  if (typeof s !== "string") return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Validate a parsed JSON object. Returns a list of problems; empty = valid. */
export function validateRules(input: unknown): string[] {
  const problems: string[] = [];
  if (!input || typeof input !== "object") return ["not an object"];
  const r = input as Record<string, unknown>;
  const str = (k: string) => { if (typeof r[k] !== "string" || !(r[k] as string).trim()) problems.push(`${k}: required string`); };
  const flag = (k: string) => { if (!isFlag(r[k])) problems.push(`${k}: { value: boolean | null (null needs a note), note: string }`); };

  if (typeof r.countryCode !== "string" || !CC.test(r.countryCode)) problems.push("countryCode: two upper-case letters");
  str("countryName");
  if (r.regime !== "easa" && r.regime !== "national") problems.push("regime: easa | national");
  str("authorityName");
  if (!isUrl(r.authorityUrl)) problems.push("authorityUrl: valid URL");
  flag("registrationRequired");
  flag("pilotCertRequired");
  flag("insuranceRequired");
  if (!Array.isArray(r.weightClasses) || r.weightClasses.some((w) => !w || typeof w.maxGrams !== "number" || typeof w.summary !== "string")) {
    problems.push("weightClasses: [{ maxGrams: number, summary: string }]");
  }
  if (r.maxAltitudeM !== null && (typeof r.maxAltitudeM !== "number" || !Number.isFinite(r.maxAltitudeM))) problems.push("maxAltitudeM: number | null");
  if (r.maxAltitudeM === null && (typeof r.altitudeNote !== "string" || !r.altitudeNote.trim())) problems.push("altitudeNote: required when maxAltitudeM is null");
  if (r.coverage !== undefined && r.coverage !== "baseline" && r.coverage !== "national") problems.push("coverage: baseline | national");
  if (r.scope !== undefined && typeof r.scope !== "string") problems.push("scope: string");
  if (r.altitudeNote !== undefined && typeof r.altitudeNote !== "string") problems.push("altitudeNote: string");
  str("maxDistanceRule");
  const imp = r.importRestriction as { value?: unknown; note?: unknown } | undefined;
  if (!imp || !["none", "declare", "banned", "unknown"].includes(imp.value as string) || typeof imp.note !== "string") {
    problems.push("importRestriction: { value: none|declare|banned|unknown, note }");
  }
  if (!Array.isArray(r.noFlyHighlights) || r.noFlyHighlights.some((s) => typeof s !== "string")) problems.push("noFlyHighlights: string[]");
  const pp = r.permitProcess as Record<string, unknown> | null | undefined;
  if (pp !== null && (!pp || typeof pp.who !== "string" || typeof pp.how !== "string" || typeof pp.leadTimeDays !== "number" || !isUrl(pp.url))) {
    problems.push("permitProcess: { who, how, leadTimeDays, url } | null");
  }
  const app = r.nationalApp as Record<string, unknown> | null | undefined;
  if (app !== null && (!app || typeof app.name !== "string" || !isUrl(app.url))) problems.push("nationalApp: { name, url } | null");
  if (!Array.isArray(r.sourceUrls) || r.sourceUrls.length === 0 || r.sourceUrls.some((u) => !isUrl(u))) problems.push("sourceUrls: at least one valid URL");
  if (typeof r.lastVerifiedOn !== "string" || !ISO_DATE.test(r.lastVerifiedOn) || Number.isNaN(Date.parse(r.lastVerifiedOn))) problems.push("lastVerifiedOn: ISO date");
  str("verifiedBy");
  if (typeof r.notes !== "string") problems.push("notes: string");
  return problems;
}

/** Days since the record was verified, against a reference date. */
export function daysSinceVerified(rules: Pick<CountryRules, "lastVerifiedOn">, now = new Date()): number {
  return Math.floor((now.getTime() - Date.parse(rules.lastVerifiedOn)) / 86_400_000);
}

export function isStale(rules: Pick<CountryRules, "lastVerifiedOn">, now = new Date()): boolean {
  return daysSinceVerified(rules, now) > STALE_AFTER_DAYS;
}

/** Hostname of the first source, for "per {source}" attributions. */
export function sourceLabel(rules: Pick<CountryRules, "sourceUrls">): string {
  try {
    return new URL(rules.sourceUrls[0]).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

// ── Lookup ─────────────────────────────────────────────────────────────────

import { RULE_FILES } from "./rules/index";

export function rulesFor(countryCode: string | undefined | null): CountryRules | null {
  if (!countryCode) return null;
  return RULE_FILES[countryCode.toUpperCase()] ?? null;
}

export function coveredCountries(): CountryRules[] {
  return Object.values(RULE_FILES).sort((a, b) => a.countryName.localeCompare(b.countryName));
}
