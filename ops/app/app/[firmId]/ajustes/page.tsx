import { redirect } from "next/navigation";
import { getRuntime, DEMO_FIRM, resolveFirmId } from "@/lib/runtime";
import { createUserClient, getSessionUser, supabaseAuthConfigured } from "@/lib/auth";
import { SupabaseStore } from "@/lib/supabase-store";
import type { Store } from "@/lib/store";
import { AppNav } from "@/components/app-nav";
import { settingsForForm } from "@/lib/settings";
import { budgetStatus } from "@/lib/budget";
import { listMembers, canManage } from "@/lib/members";

export const dynamic = "force-dynamic";

// The firm's own knobs: how long data is kept, who hears about the budget,
// the baseline the pilot report compares against, and the insurers' mailboxes.

export default async function Ajustes({ params, searchParams }: { params: Promise<{ firmId: string }>; searchParams: Promise<{ error?: string; guardado?: string; invitado?: string }> }) {
  const { firmId: slug } = await params;
  const { error, guardado, invitado } = await searchParams;
  const rt = getRuntime();
  const firmId = resolveFirmId(slug);

  let store: Store = rt.store;
  let userLabel = "modo demo";
  let userId = "local";
  if (supabaseAuthConfigured()) {
    const user = await getSessionUser();
    if (!user) redirect("/login");
    if (!(await rt.store.memberships.isMember(firmId, user.id))) redirect("/app");
    const client = await createUserClient();
    if (client) store = new SupabaseStore(client);
    userLabel = user.email ?? user.id;
    userId = user.id;
  } else if (slug !== "demo") {
    redirect("/app/demo/ajustes");
  }

  const firm = (await store.firms.get(firmId)) ?? DEMO_FIRM;
  const form = settingsForForm(firm);
  const budget = await budgetStatus(store, firm);
  const members = await listMembers(rt.store, firm.id);
  const owner = await canManage(rt.store, firm.id, userId, !supabaseAuthConfigured());

  return (
    <main className="app-wrap">
      <AppNav slug={slug} firmName={firm.name} userLabel={userLabel} mode={rt.mode} active="ajustes" logout={supabaseAuthConfigured()} />
      <div className="page-head"><h1>Ajustes del despacho</h1></div>
      {error && <div className="notice err">{error}</div>}
      {guardado && !error && <div className="notice"><span className="pill ok">guardado</span> <span className="small muted">Los cambios se aplican desde ahora y quedan en el registro de actividad.</span></div>}
      {invitado && !error && <div className="notice"><span className="pill ok">{invitado === "1" ? "invitación enviada" : "añadido"}</span> <span className="small muted">{invitado === "1" ? "La persona recibirá un enlace para entrar; al usarlo verá este despacho." : "La persona ya tenía cuenta y ahora ve este despacho."}</span></div>}

      <form action={`/api/firms/${firm.id}`} method="post" className="two" style={{ marginTop: 20, alignItems: "start" }}>
        <div className="card" style={{ margin: 0 }}>
          <strong>Datos y coste</strong>
          <div className="form" style={{ marginTop: 12 }}>
            <label>Retención de documentos (días)
              <input name="retentionDays" inputMode="numeric" defaultValue={form.retentionDays} placeholder="Vacío: se conservan" />
              <span className="small muted">Pasados esos días desde la aprobación o el rechazo se borran el original, los datos leídos, los borradores y las correcciones. El registro de actividad se conserva siempre.</span>
            </label>
            <label>Correo para avisos de presupuesto
              <input name="alertEmail" type="email" defaultValue={form.alertEmail} placeholder="operaciones@despacho.es" />
              <span className="small muted">Recibe un aviso al llegar al 80 % del presupuesto mensual. Este mes: {budget.used.toLocaleString("es-ES")} de {budget.budget.toLocaleString("es-ES")} tokens.</span>
            </label>
          </div>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <strong>Piloto y aseguradoras</strong>
          <div className="form" style={{ marginTop: 12 }}>
            <label>Horas semanales antes del piloto
              <input name="baselineHoursPerWeek" inputMode="decimal" defaultValue={form.baselineHoursPerWeek} placeholder="Del inventario de la semana 1" />
              <span className="small muted">Es la cifra contra la que el informe compara. Sin ella el informe muestra solo lo medido.</span>
            </label>
            <label>Correos de liquidaciones de las aseguradoras
              <textarea name="insurerEmails" rows={5} defaultValue={form.insurerEmails} placeholder={"Aseguradora Ejemplo SA=liquidaciones@ejemplo.es\nOtra Aseguradora=comisiones@otra.es"} />
              <span className="small muted">Una por línea, nombre=correo. Se usan para rellenar el destinatario de las reclamaciones.</span>
            </label>
          </div>
          <div style={{ marginTop: 14 }}><button type="submit" className="btn">Guardar ajustes</button></div>
        </div>
      </form>

      <div className="section-row"><h2>Equipo</h2><span className="count">{members.length}</span></div>
      <div className="two" style={{ alignItems: "start" }}>
        <div className="table-wrap"><table>
          <thead><tr><th>Persona</th><th>Rol</th></tr></thead>
          <tbody>
            {members.map((m) => <tr key={m.userId}><td>{m.email ?? <span className="mono muted">{m.userId}</span>}</td><td><span className={`pill ${m.role === "owner" ? "ok" : ""}`}>{m.role === "owner" ? "propietario" : "equipo"}</span></td></tr>)}
            {members.length === 0 && <tr><td colSpan={2} className="muted">Sin miembros todavía.</td></tr>}
          </tbody>
        </table></div>
        <div className="card" style={{ margin: 0 }}>
          <strong>Invitar a una persona</strong>
          <p className="small muted" style={{ marginTop: 6 }}>Recibe un enlace de acceso por correo, sin contraseña. Verá solo este despacho. {owner ? "" : "Solo el propietario puede invitar."}</p>
          <form action={`/api/firms/${firm.id}/members`} method="post" className="form" style={{ marginTop: 10 }}>
            <label>Correo<input name="email" type="email" required placeholder="persona@despacho.es" disabled={!owner} /></label>
            <label>Rol<select name="role" defaultValue="staff" disabled={!owner}><option value="staff">Equipo: revisa y aprueba</option><option value="owner">Propietario: además invita y ajusta</option></select></label>
            <div><button type="submit" className="btn" disabled={!owner}>Invitar</button></div>
          </form>
        </div>
      </div>
    </main>
  );
}
