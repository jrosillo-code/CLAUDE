import { MemoryStore, type Store } from "./store";
import { SupabaseStore } from "./supabase-store";
import { ClaudeExtractor, ClaudeDrafter, ClaudeSettlementExtractor, type Extractor, type Drafter, type SettlementExtractor } from "./claude";
import { DemoExtractor, DemoDrafter, DemoSettlementExtractor } from "./demo";
import { CsvExportAdapter, type ManagementSystemAdapter } from "./adapters";
import { LoggingSender, type Sender } from "./sender";
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
  mode: { store: "supabase" | "memory"; model: "claude" | "demo" };
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
  const rt: Runtime = {
    store,
    extractor: hasKey ? new ClaudeExtractor() : new DemoExtractor(),
    drafter: hasKey ? new ClaudeDrafter() : new DemoDrafter(),
    settlementExtractor: hasKey ? new ClaudeSettlementExtractor() : new DemoSettlementExtractor(),
    adapter: new CsvExportAdapter(),
    sender: new LoggingSender(),
    mode: { store: supabase ? "supabase" : "memory", model: hasKey ? "claude" : "demo" },
  };
  if (!supabase) void store.firms.upsert(DEMO_FIRM);
  console.log(`[ops] runtime: store=${rt.mode.store} model=${rt.mode.model}`);
  globalRef.__opsRuntime = rt;
  return rt;
}

/** Machine access to /api: a bearer token. In demo mode (no key configured) access is open on localhost only. */
export function authorize(req: Request): { ok: true; userId: string } | { ok: false; status: number; error: string } {
  const expected = process.env.OPS_API_KEY;
  const auth = req.headers.get("authorization") ?? "";
  if (expected) {
    if (auth === `Bearer ${expected}`) return { ok: true, userId: req.headers.get("x-ops-user") ?? "api" };
    return { ok: false, status: 401, error: "No autorizado" };
  }
  const host = req.headers.get("host") ?? "";
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return { ok: true, userId: req.headers.get("x-ops-user") ?? "local" };
  return { ok: false, status: 503, error: "OPS_API_KEY no configurada" };
}

export async function requireFirm(store: Store, firmId: string | null): Promise<Firm> {
  const id = firmId ?? DEMO_FIRM.id;
  const firm = await store.firms.get(id);
  if (!firm) throw new Error(`Despacho no encontrado: ${id}`);
  return firm;
}
