import { MemoryStore, type Store } from "./store";
import { SupabaseStore } from "./supabase-store";
import { ClaudeExtractor, ClaudeDrafter, ClaudeSettlementExtractor, type Extractor, type Drafter, type SettlementExtractor } from "./claude";
import { DemoExtractor, DemoDrafter, DemoSettlementExtractor } from "./demo";
import { CsvExportAdapter, type ManagementSystemAdapter } from "./adapters";
import { LoggingSender, RoutingSender, type Sender } from "./sender";
import { SmtpSender } from "./senders/email";
import { WhatsAppSender } from "./senders/whatsapp";
import { getSessionUser, supabaseAuthConfigured } from "./auth";
import type { Firm } from "./types";

// One place that decides, from the environment, which implementations run.
// No key → demo readers; no Supabase → in-memory store (seeded with a demo
// firm so the review queue has something to show). Both decisions are logged
// once so a deployment can never silently run in demo mode.

export interface Runtime {
  store: Store;
  extractor: Extractor;
  drafter: Drafter;
  settlementExtractor: SettlementExtractor;
  adapter: ManagementSystemAdapter;
  sender: Sender;
  mode: { store: "supabase" | "memory"; model: "claude" | "demo"; email: "smtp" | "log"; whatsapp: "cloud" | "log" };
}

export const DEMO_FIRM: Firm = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Correduría Demo",
  kind: "correduria",
  monthlyTokenBudget: 2_000_000,
  createdAt: "2026-09-01T00:00:00.000Z",
};

const globalRef = globalThis as unknown as { __opsRuntime?: Runtime };

export function getRuntime(): Runtime {
  if (globalRef.__opsRuntime) return globalRef.__opsRuntime;
  const supabase = SupabaseStore.fromEnv();
  const store: Store = supabase ?? new MemoryStore();
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const smtp = SmtpSender.fromEnv();
  const wa = WhatsAppSender.fromEnv();
  const rt: Runtime = {
    store,
    extractor: hasKey ? new ClaudeExtractor() : new DemoExtractor(),
    drafter: hasKey ? new ClaudeDrafter() : new DemoDrafter(),
    settlementExtractor: hasKey ? new ClaudeSettlementExtractor() : new DemoSettlementExtractor(),
    adapter: new CsvExportAdapter(),
    sender: new RoutingSender(smtp, wa, new LoggingSender()),
    mode: { store: supabase ? "supabase" : "memory", model: hasKey ? "claude" : "demo", email: smtp ? "smtp" : "log", whatsapp: wa ? "cloud" : "log" },
  };
  if (!supabase) void store.firms.upsert(DEMO_FIRM);
  console.log(`[ops] runtime: store=${rt.mode.store} model=${rt.mode.model} email=${rt.mode.email} whatsapp=${rt.mode.whatsapp}`);
  globalRef.__opsRuntime = rt;
  return rt;
}

export type Auth =
  | { ok: true; userId: string; viaKey: boolean }
  | { ok: false; status: number; error: string };

/**
 * Access to /api. Three ways in: the machine bearer token (OPS_API_KEY), a
 * member session cookie (checked against the firm when one is named), or, when
 * neither Supabase Auth nor a key is configured, localhost only.
 */
export async function authorize(req: Request, firmId: string | null = null): Promise<Auth> {
  const expected = process.env.OPS_API_KEY;
  const header = req.headers.get("authorization") ?? "";
  if (expected && header === `Bearer ${expected}`) return { ok: true, userId: req.headers.get("x-ops-user") ?? "api", viaKey: true };
  if (supabaseAuthConfigured()) {
    const user = await getSessionUser();
    if (user) {
      if (firmId && !(await getRuntime().store.memberships.isMember(firmId, user.id))) return { ok: false, status: 403, error: "No perteneces a este despacho" };
      return { ok: true, userId: user.id, viaKey: false };
    }
  }
  if (expected || supabaseAuthConfigured()) return { ok: false, status: 401, error: "No autorizado" };
  const host = req.headers.get("host") ?? "";
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return { ok: true, userId: req.headers.get("x-ops-user") ?? "local", viaKey: true };
  return { ok: false, status: 503, error: "OPS_API_KEY no configurada" };
}

/** For routes that learn the firm from the record they load. */
export async function assertFirmAccess(auth: Auth & { ok: true }, firmId: string): Promise<boolean> {
  if (auth.viaKey) return true;
  return getRuntime().store.memberships.isMember(firmId, auth.userId);
}

/** The demo firm id used in URLs when running without Supabase. */
export const DEMO_SLUG = "demo";
export function resolveFirmId(slug: string): string {
  return slug === DEMO_SLUG ? DEMO_FIRM.id : slug;
}

export async function requireFirm(store: Store, firmId: string | null): Promise<Firm> {
  const id = firmId ?? DEMO_FIRM.id;
  const firm = await store.firms.get(id);
  if (!firm) throw new Error(`Despacho no encontrado: ${id}`);
  return firm;
}
