import type { Firm, FirmSettings } from "./types";
import { firmSettings } from "./types";
import type { Store } from "./store";
import { log } from "./audit";
import { EMAIL } from "./claims";

// Per-firm settings written from the app or the API. Validated here so both
// paths agree; the merge itself lives in the store.

export interface SettingsInput {
  retentionDays?: string | number | null;
  alertEmail?: string | null;
  baselineHoursPerWeek?: string | number | null;
  /** "Aseguradora=liquidaciones@x.es" per line, or an object. */
  insurerEmails?: string | Record<string, string> | null;
}

function num(v: string | number | null | undefined, label: string, max: number): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Error(`${label}: indica un número entre 0 y ${max}`);
  return n;
}

export function parseInsurerEmails(v: string | Record<string, string> | null | undefined): Record<string, string> {
  if (!v) return {};
  const out: Record<string, string> = {};
  const entries = typeof v === "string"
    ? v.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf("="); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ""]; })
    : Object.entries(v);
  for (const [name, email] of entries) {
    if (!name) continue;
    if (!EMAIL.test(email)) throw new Error(`Correo no válido para ${name}: escribe "Aseguradora=correo@dominio.es"`);
    out[name] = email;
  }
  return out;
}

export function validateSettings(input: SettingsInput): Partial<FirmSettings> {
  const patch: Partial<FirmSettings> = {};
  if ("retentionDays" in input) { const d = num(input.retentionDays, "Retención", 3650); patch.retentionDays = d === null ? null : Math.round(d); }
  if ("alertEmail" in input) {
    const e = (input.alertEmail ?? "").trim();
    if (e && !EMAIL.test(e)) throw new Error("Correo de avisos no válido");
    patch.alertEmail = e || null;
  }
  if ("baselineHoursPerWeek" in input) patch.baselineHoursPerWeek = num(input.baselineHoursPerWeek, "Horas semanales antes", 500);
  if ("insurerEmails" in input) patch.insurerEmails = parseInsurerEmails(input.insurerEmails);
  return patch;
}

export async function updateFirmSettings(store: Store, firm: Firm, input: SettingsInput, userId: string): Promise<Firm> {
  const patch = validateSettings(input);
  const updated = await store.firms.updateSettings(firm.id, patch);
  await log(store, { firmId: firm.id, action: "settings.updated", entity: { type: "firm", id: firm.id }, actor: { type: "user", id: userId }, detail: { changed: Object.keys(patch), retentionDays: firmSettings(updated).retentionDays } });
  return updated;
}

/** Settings as strings for a form. */
export function settingsForForm(firm: Firm): { retentionDays: string; alertEmail: string; baselineHoursPerWeek: string; insurerEmails: string } {
  const s = firmSettings(firm);
  return {
    retentionDays: s.retentionDays == null ? "" : String(s.retentionDays),
    alertEmail: s.alertEmail ?? "",
    baselineHoursPerWeek: s.baselineHoursPerWeek == null ? "" : String(s.baselineHoursPerWeek),
    insurerEmails: Object.entries(s.insurerEmails).map(([k, v]) => `${k}=${v}`).join("\n"),
  };
}
