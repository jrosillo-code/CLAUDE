import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { getRuntime } from "./runtime";
import { MODEL } from "./claude";
import { supabaseUrl, supabaseAnonKey, supabaseServiceKey } from "./env";

// Deployment self-check. Runs where the secrets live and reports pass or
// fail per item with a short reason. Secret values never appear in the
// output: every configured secret is redacted from detail strings.

export interface Check { name: string; label: string; ok: boolean; detail: string }
export interface SelfCheck { ok: boolean; at: string; checks: Check[] }

const SECRET_ENV = ["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "ANON_KEY", "ANTHROPIC_API_KEY", "OPS_API_KEY", "CRON_SECRET", "EMAIL_WEBHOOK_SECRET", "SMTP_URL", "WHATSAPP_APP_SECRET", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_VERIFY_TOKEN"];

export function redact(text: string, env: NodeJS.ProcessEnv = process.env): string {
  let out = text;
  for (const k of SECRET_ENV) {
    const v = env[k];
    if (v && v.length >= 8) out = out.split(v).join("[redactado]");
  }
  return out.length > 200 ? `${out.slice(0, 199)}…` : out;
}

const TABLES = ["firms", "memberships", "documents", "extractions", "validations", "tasks", "drafts", "approvals", "activity_log", "monthly_usage", "expected_receipts", "reconciliations", "corrections", "jobs", "leads"];

async function withTimeout<T>(p: Promise<T>, ms = 10_000): Promise<T> {
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`sin respuesta en ${ms / 1000} s`)), ms); });
  try { return await Promise.race([p, timeout]); } finally { clearTimeout(t!); }
}

async function check(name: string, label: string, fn: () => Promise<string>): Promise<Check> {
  try {
    const detail = await withTimeout(fn());
    return { name, label, ok: true, detail: redact(detail) };
  } catch (err) {
    return { name, label, ok: false, detail: redact(err instanceof Error ? err.message : String(err)) };
  }
}

export async function runSelfCheck(env: NodeJS.ProcessEnv = process.env): Promise<SelfCheck> {
  const checks: Check[] = [];
  const url = supabaseUrl(env);
  const service = supabaseServiceKey(env);
  const pubUrl = supabaseUrl(env);
  const anon = supabaseAnonKey(env);

  checks.push(await check("env.supabase.server", "Supabase (servidor)", async () => {
    if (!url || !service) throw new Error("faltan la URL de Supabase (SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL) o SUPABASE_SERVICE_ROLE_KEY");
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) throw new Error(`SUPABASE_URL no parece una URL de proyecto: ${url}`);
    return url;
  }));
  checks.push(await check("env.supabase.public", "Supabase (acceso de usuarios)", async () => {
    if (!pubUrl || !anon) throw new Error("faltan la URL de Supabase o la clave anon (NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY o ANON_KEY)");
    return "configurado";
  }));

  const db = url && service ? createClient(url, service, { auth: { persistSession: false } }) : null;
  checks.push(await check("db.connect", "Base de datos accesible", async () => {
    if (!db) throw new Error("sin credenciales");
    const r = await db.from("firms").select("id", { count: "exact", head: true });
    if (r.error) throw new Error(r.error.message);
    return `${r.count ?? 0} despachos`;
  }));
  checks.push(await check("db.migrations", "Migraciones aplicadas", async () => {
    if (!db) throw new Error("sin credenciales");
    const missing: string[] = [];
    for (const t of TABLES) {
      const r = await db.from(t).select("*", { head: true, count: "exact" }).limit(0);
      if (r.error) missing.push(t);
    }
    if (missing.length) throw new Error(`faltan tablas: ${missing.join(", ")} (ejecuta las migraciones en orden)`);
    const fn = await db.rpc("claim_jobs", { p_limit: 0 });
    if (fn.error) throw new Error(`falta claim_jobs(): ${fn.error.message} (migración 0002)`);
    return `${TABLES.length} tablas y funciones presentes`;
  }));
  checks.push(await check("db.rls", "Seguridad por filas en todas las tablas", async () => {
    if (!db) throw new Error("sin credenciales");
    const r = await db.rpc("tables_without_rls");
    if (r.error) throw new Error(`no se puede comprobar: ${r.error.message} (migración 0003)`);
    const rows = (r.data as string[] | null) ?? [];
    if (rows.length) throw new Error(`sin RLS: ${rows.join(", ")}`);
    return "todas las tablas protegidas";
  }));
  checks.push(await check("storage.bucket", "Almacén de documentos privado", async () => {
    if (!db) throw new Error("sin credenciales");
    const r = await db.storage.getBucket("documents");
    if (r.error || !r.data) throw new Error(`bucket "documents" no existe (${r.error?.message ?? "sin datos"})`);
    if (r.data.public) throw new Error('el bucket "documents" es público; debe ser privado');
    return "bucket documents, privado";
  }));
  checks.push(await check("auth", "Inicio de sesión y alta de despachos", async () => {
    if (!pubUrl || !anon) throw new Error("sin credenciales públicas");
    const a = createClient(pubUrl, anon, { auth: { persistSession: false } });
    const s = await a.auth.getSession();
    if (s.error) throw new Error(s.error.message);
    if (!db) return "auth accesible; no se puede contar despachos";
    const m = await db.from("memberships").select("firm_id", { count: "exact", head: true });
    if (m.error) throw new Error(m.error.message);
    if (!m.count) throw new Error("auth accesible, pero ningún usuario pertenece a un despacho todavía (ejecuta npm run onboard)");
    return `auth accesible; ${m.count} miembros`;
  }));
  checks.push(await check("anthropic", "Modelo de IA", async () => {
    if (!env.ANTHROPIC_API_KEY) throw new Error("falta ANTHROPIC_API_KEY (la app funciona en modo demo)");
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const model = env.OPS_MODEL || MODEL;
    const m = await client.models.retrieve(model);
    return `${m.id} disponible`;
  }));
  checks.push(await check("api.key", "Clave de acceso a la API", async () => {
    const k = env.OPS_API_KEY;
    if (!k) throw new Error("falta OPS_API_KEY");
    if (k.length < 32) throw new Error(`OPS_API_KEY demasiado corta (${k.length} caracteres; mínimo 32)`);
    return `${k.length} caracteres`;
  }));
  checks.push(await check("cron", "Ejecutor de trabajos", async () => {
    if (!env.CRON_SECRET && !env.OPS_API_KEY) throw new Error("falta CRON_SECRET");
    return env.CRON_SECRET ? "CRON_SECRET configurado; vercel.json programa /api/jobs/run cada minuto" : "sin CRON_SECRET; el cron usará OPS_API_KEY si se configura en Vercel";
  }));
  checks.push(await check("senders", "Envíos", async () => {
    const email = env.SMTP_URL && env.MAIL_FROM ? "correo por SMTP" : "correo solo en registro";
    const wa = env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN ? `WhatsApp Cloud API${env.WHATSAPP_TEMPLATE_NAME ? " con plantilla" : " sin plantilla"}` : "WhatsApp solo en registro";
    return `${email}; ${wa}`;
  }));
  checks.push(await check("runtime.mode", "Modo de ejecución", async () => {
    const m = getRuntime().mode;
    if (m.store !== "supabase" || m.model !== "claude") throw new Error(`store=${m.store} model=${m.model} (esperado supabase y claude)`);
    return `store=${m.store} model=${m.model} email=${m.email} whatsapp=${m.whatsapp}`;
  }));

  const informational = new Set(["senders"]);
  return { ok: checks.every((c) => c.ok || informational.has(c.name)), at: new Date().toISOString(), checks };
}

export function asText(r: SelfCheck): string {
  return [`estado ${r.ok ? "OK" : "CON FALLOS"} · ${r.at}`, ...r.checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`)].join("\n");
}
