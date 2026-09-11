import { getRuntime, DEMO_FIRM } from "@/lib/runtime";
import { budgetStatus } from "@/lib/budget";

export const dynamic = "force-dynamic";

// The review queue: what a person sees and decides. Server-rendered from the
// store; approving posts to the API, which is the only path to a send or a
// write. In production this page sits behind the firm's login.
export default async function Revisar() {
  const rt = getRuntime();
  const firm = (await rt.store.firms.get(DEMO_FIRM.id)) ?? DEMO_FIRM;
  const [pending, tasks, activity, budget, reconciliations] = await Promise.all([
    rt.store.approvals.listPending(firm.id),
    rt.store.tasks.listOpenByFirm(firm.id),
    rt.store.activity.list(firm.id, 30),
    budgetStatus(rt.store, firm),
    rt.store.reconciliations.listByFirm(firm.id, 5),
  ]);
  const drafts = await Promise.all(pending.map((a) => (a.draftId ? rt.store.drafts.get(a.draftId) : Promise.resolve(null))));

  return (
    <main className="app-wrap">
      <p className="muted">{firm.name} · modo {rt.mode.model === "demo" ? "demo (sin clave de modelo)" : "producción"} · almacenamiento {rt.mode.store}</p>
      <h1>Cola de revisión</h1>
      <p className="muted">Presupuesto del mes: {budget.used.toLocaleString("es-ES")} de {budget.budget.toLocaleString("es-ES")} tokens{budget.warn ? " · aviso: por encima del 80 %" : ""}</p>

      <h2>Pendiente de aprobación ({pending.length})</h2>
      {pending.length === 0 && <p className="muted">Nada pendiente. Sube un documento con <code>POST /api/intake/upload</code> (campo <code>file</code>, <code>process=1</code>).</p>}
      {pending.map((a, i) => (
        <div className="card" key={a.id}>
          <div className="row">
            <span className="pill pending">{a.action === "send_draft" ? "Enviar mensaje" : "Escribir en el sistema"}</span>
            <span className="muted">documento {a.documentId.slice(0, 8)} · {new Date(a.createdAt).toLocaleString("es-ES")}</span>
          </div>
          {drafts[i] && (
            <pre>{drafts[i]!.channel === "email" ? `Para: ${drafts[i]!.to}\nAsunto: ${drafts[i]!.subject}\n\n` : `WhatsApp a ${drafts[i]!.to}\n\n`}{drafts[i]!.body}</pre>
          )}
          <form action={`/api/approvals/${a.id}`} method="post" className="row">
            <input type="hidden" name="decision" value="approved" />
            <button type="submit">Aprobar</button>
          </form>
          <form action={`/api/approvals/${a.id}`} method="post" className="row" style={{ marginTop: 8 }}>
            <input type="hidden" name="decision" value="rejected" />
            <button type="submit" className="secondary">Rechazar</button>
          </form>
        </div>
      ))}

      <h2>Tareas abiertas ({tasks.length})</h2>
      <table><thead><tr><th>Tarea</th><th>Detalle</th><th>Responsable</th></tr></thead><tbody>
        {tasks.map((t) => <tr key={t.id}><td>{t.title}</td><td className="muted">{t.detail}</td><td>{t.owner === "firm" ? "Despacho" : "Cliente"}</td></tr>)}
      </tbody></table>

      {reconciliations.length > 0 && (<>
        <h2>Liquidaciones conciliadas</h2>
        <table><thead><tr><th>Aseguradora</th><th>Periodo</th><th>No pagado</th><th>Diferencias</th></tr></thead><tbody>
          {reconciliations.map((r) => <tr key={r.id}><td>{r.insurer ?? "?"}</td><td>{r.period ?? "?"}</td><td>{r.unpaidEur.toFixed(2)} €</td><td>{r.mismatchEur.toFixed(2)} €</td></tr>)}
        </tbody></table>
      </>)}

      <h2>Registro de actividad</h2>
      <table><thead><tr><th>Cuándo</th><th>Acción</th><th>Actor</th><th>Coste</th></tr></thead><tbody>
        {activity.map((e) => <tr key={e.id}><td className="muted">{new Date(e.at).toLocaleTimeString("es-ES")}</td><td>{e.action}</td><td className="muted">{e.actor.type}{e.actor.id ? ` · ${e.actor.id}` : ""}</td><td className="muted">{e.usage ? `$${e.usage.costUsd.toFixed(4)}` : ""}</td></tr>)}
      </tbody></table>
    </main>
  );
}
