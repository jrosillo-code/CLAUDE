import { runSelfCheck, asText } from "@/lib/selfcheck";

export const dynamic = "force-dynamic";

export default async function Estado() {
  const r = await runSelfCheck();
  return (
    <main className="app-wrap" style={{ maxWidth: 760 }}>
      <div className="eyebrow">Estado del despliegue · {new Date(r.at).toLocaleString("es-ES")}</div>
      <h1 style={{ marginTop: 10 }}>{r.ok ? "Todo en orden" : "Hay elementos por configurar"}</h1>
      <div className="card" style={{ marginTop: 16 }}>
        {r.checks.map((c) => (
          <div key={c.name} className="row" style={{ padding: "8px 0", borderBottom: "1px solid var(--rule)", alignItems: "flex-start" }}>
            <span className={`pill ${c.ok ? "ok" : "err"}`} style={{ minWidth: 28, textAlign: "center" }}>{c.ok ? "✓" : "✗"}</span>
            <div style={{ flex: 1, minWidth: 0 }}><strong>{c.label}</strong><div className="small muted">{c.detail}</div></div>
          </div>
        ))}
      </div>
      <h2 style={{ marginTop: 24 }}>Para pegar</h2>
      <pre>{asText(r)}</pre>
      <h2 style={{ marginTop: 24 }}>Comprobaciones manuales</h2>
      <ol className="muted" style={{ paddingLeft: 20 }}>
        <li><a href="/api/health">/api/health</a> debe decir store supabase y model claude.</li>
        <li><a href="/login">/login</a> debe mostrar el formulario y enviar el enlace al correo.</li>
        <li>Tras entrar, <a href="/app">/app</a> debe mostrar tu despacho.</li>
      </ol>
      <p className="small muted" style={{ marginTop: 24 }}>Esta página no muestra ningún secreto; los valores configurados se sustituyen por “[redactado]”.</p>
    </main>
  );
}
