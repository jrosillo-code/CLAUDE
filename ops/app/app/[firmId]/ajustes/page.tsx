import { redirect } from "next/navigation";
import { getRuntime, DEMO_FIRM, resolveFirmId } from "@/lib/runtime";
import { createUserClient, getSessionUser, supabaseAuthConfigured } from "@/lib/auth";
import { SupabaseStore } from "@/lib/supabase-store";
import type { Store } from "@/lib/store";
import { AppNav } from "@/components/app-nav";
import { settingsForForm } from "@/lib/settings";
import { budgetStatus } from "@/lib/budget";

export const dynamic = "force-dynamic";

// The firm's own knobs: how long data is kept, who hears about the budget,
// the baseline the pilot report compares against, and the insurers' mailboxes.

export default async function Ajustes({ params, searchParams }: { params: Promise<{ firmId: string }>; searchParams: Promise<{ error?: string; guardado?: string }> }) {
  const { firmId: slug } = await params;
  const { error, guardado } = await searchParams;
  const rt = getRuntime();
  const firmId = resolveFirmId(slug);

  let store: Store = rt.store;
  let userLabel = "modo demo";
  if (supabaseAuthConfigured()) {
    const user = await getSessionUser();
    if (!user) redirect("/login");
    if (!(await rt.store.memberships.isMember(firmId, user.id))) redirect("/app");
    const client = await createUserClient();
    if (client) store = new SupabaseStore(client);
    userLabel = user.email ?? user.id;
  } else if (slug !== "demo") {
    redirect("/app/demo/ajustes");
  }

  const firm = (await store.firms.get(firmId)) ?? DEMO_FIRM;
  const form = settingsForForm(firm);
  const budget = await budgetStatus(store, firm);

  return (
    <main className="app-wrap">
      <AppNav slug={slug} firmName={firm.name} userLabel={userLabel} mode={rt.mode} active="ajustes" logout={supabaseAuthConfigured()} />
      <div className="page-head"><h1>Ajustes del despacho</h1></div>
      {error && <div className="notice err">{error}</div>}
      {guardado && !error && <div className="card"><span className="pill ok">guardado</span> <span className="small muted">Los cambios se aplican desde ahora y quedan en el registro de actividad.</span></div>}

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
    </main>
  );
}
