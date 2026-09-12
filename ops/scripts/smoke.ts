// Smoke test against a deployment: npm run smoke -- https://your-domain
export {};
const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!base) { console.error("uso: npm run smoke -- https://dominio"); process.exit(1); }

interface Row { name: string; ok: boolean; detail: string }
async function probe(name: string, path: string, test: (res: Response, text: string) => string | Promise<string>): Promise<Row> {
  try {
    const res = await fetch(`${base}${path}`, { redirect: "manual" });
    const text = await res.text();
    return { name, ok: true, detail: await test(res, text) };
  } catch (e) { return { name, ok: false, detail: e instanceof Error ? e.message : String(e) }; }
}
const rows = await Promise.all([
  probe("health", "/api/health", (res, t) => { const j = JSON.parse(t); if (!res.ok) throw new Error(`HTTP ${res.status}`); if (j.mode?.store !== "supabase" || j.mode?.model !== "claude") throw new Error(`modo ${JSON.stringify(j.mode)}`); return "supabase + claude"; }),
  probe("selfcheck", "/api/selfcheck", (res, t) => { const j = JSON.parse(t); const bad = (j.checks ?? []).filter((c: { ok: boolean }) => !c.ok).map((c: { name: string; detail: string }) => `${c.name}: ${c.detail}`); if (bad.length) throw new Error(bad.join(" | ")); return `${j.checks.length} comprobaciones`; }),
  probe("login", "/login", (res, t) => { if (res.status >= 300 && res.status < 400) throw new Error(`redirige a ${res.headers.get("location")} (faltan variables públicas de Supabase)`); if (!t.includes("Enviar enlace")) throw new Error("no muestra el formulario"); return "formulario visible"; }),
  probe("legal", "/legal/privacidad", (res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return "ok"; }),
  probe("landing", "/", (res, t) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); if (!t.includes("Cola de revisi")) throw new Error("contenido inesperado"); return "ok"; }),
]);
for (const r of rows) console.log(`${r.ok ? "✓" : "✗"} ${r.name.padEnd(10)} ${r.detail}`);
process.exit(rows.every((r) => r.ok) ? 0 : 1);
