import Link from "next/link";
import { redirect } from "next/navigation";
import { getRuntime, DEMO_FIRM, resolveFirmId } from "@/lib/runtime";
import { createUserClient, getSessionUser, supabaseAuthConfigured } from "@/lib/auth";
import { SupabaseStore } from "@/lib/supabase-store";
import type { Store } from "@/lib/store";
import { AppNav } from "@/components/app-nav";
import { computeMetrics } from "@/lib/metrics";
import { firmSettings } from "@/lib/types";
import { eur } from "@/lib/claims";

export const dynamic = "force-dynamic";

// The pilot report: the two pages the agreement promises, with the figures
// it names (hours before and after, cycle time, documents processed, errors
// caught by review, incidents) computed from the activity log and printable
// as they stand. Nothing here is typed by hand except the baseline, which
// comes from the week-1 inventory and lives in the firm's settings.

const KIND: Record<string, string> = { factura: "Facturas", recibo: "Recibos", parte_siniestro: "Partes de siniestro", poliza: "Pólizas", identidad: "Documentos de identidad", otro: "Otros" };
const FIELD: Record<string, string> = { total: "Total", base_imponible: "Base imponible", cuota_iva: "Cuota IVA", fecha_expedicion: "Fecha", numero: "Número", emisor_nif: "NIF emisor", receptor_nif: "NIF receptor", numero_poliza: "Nº póliza", fecha_siniestro: "Fecha del siniestro", "draft.body": "Texto del mensaje" };
const INCIDENT: Record<string, string> = { "message.failed": "Envíos fallidos", "document.failed": "Documentos no procesados", "job.failed": "Trabajos fallidos", "system.write_failed": "Escrituras fallidas", "inbound.media_failed": "Adjuntos no descargados", "document.purge_failed": "Borrados fallidos" };

const day = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
const hours = (h: number | null) => (h == null ? "—" : h < 1 ? `${Math.round(h * 60)} min` : `${h.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h`);
const n = (v: number) => v.toLocaleString("es-ES");

export default async function Informe({ params, searchParams }: { params: Promise<{ firmId: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const { firmId: slug } = await params;
  const q = await searchParams;
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
    redirect("/app/demo/informe");
  }

  const firm = (await store.firms.get(firmId)) ?? DEMO_FIRM;
  const settings = firmSettings(firm);
  const to = q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to) ? `${q.to}T23:59:59.999Z` : new Date().toISOString();
  const from = q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from) ? `${q.from}T00:00:00.000Z` : new Date(Date.parse(to) - 42 * 86_400_000).toISOString();
  const m = await computeMetrics(store, firm.id, from, to);
  const weeks = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / (7 * 86_400_000)));
  const perWeek = m.documents.received / weeks;
  const exportQs = `firmId=${firm.id}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return (
    <main className="app-wrap report">
      <div className="no-print">
        <AppNav slug={slug} firmName={firm.name} userLabel={userLabel} mode={rt.mode} active="informe" logout={supabaseAuthConfigured()} />
        <form method="get" className="row" style={{ marginTop: 18, alignItems: "end" }}>
          <label className="small" style={{ display: "grid", gap: 4 }}>Desde<input type="date" name="from" defaultValue={from.slice(0, 10)} className="input" /></label>
          <label className="small" style={{ display: "grid", gap: 4 }}>Hasta<input type="date" name="to" defaultValue={to.slice(0, 10)} className="input" /></label>
          <button type="submit" className="secondary">Recalcular</button>
          <span className="small muted">Imprime esta página (Ctrl+P) para obtener el PDF de dos páginas. Exportar: <a href={`/api/export?kind=activity&${exportQs}`}>registro</a> · <a href={`/api/export?kind=corrections&${exportQs}`}>correcciones</a> · <a href={`/api/export?kind=extractions&${exportQs}`}>lecturas</a> (CSV)</span>
        </form>
      </div>

      <section className="page">
        <div className="eyebrow">Informe de piloto · {firm.name} · {day(from)} a {day(to)}</div>
        <h1 style={{ marginTop: 10, fontSize: 40 }}>Lo que hizo el sistema y lo que hizo el equipo.</h1>
        <p className="muted" style={{ marginTop: 10, maxWidth: "62ch" }}>Cifras calculadas del registro de actividad del despacho, sin estimaciones. Cada línea del registro puede exportarse y comprobarse.</p>

        <h2 style={{ marginTop: 28 }}>Antes y después</h2>
        <div className="table-wrap" style={{ marginTop: 10 }}><table>
          <thead><tr><th>Medida</th><th className="num">Antes del piloto</th><th className="num">Durante el piloto</th><th>Fuente</th></tr></thead>
          <tbody>
            <tr><td>Horas semanales del equipo en el flujo</td><td className="num">{settings.baselineHoursPerWeek != null ? `${n(settings.baselineHoursPerWeek)} h` : "sin dato"}</td><td className="num">—</td><td className="small muted">Antes: inventario de la semana 1. Después: se mide con el interlocutor en la semana 6</td></tr>
            <tr><td>Documentos procesados por semana</td><td className="num">—</td><td className="num">{perWeek.toLocaleString("es-ES", { maximumFractionDigits: 1 })}</td><td className="small muted">{n(m.documents.received)} recibidos en {weeks} semanas</td></tr>
            <tr><td>Tiempo de ciclo: del documento a la aprobación (mediana)</td><td className="num">—</td><td className="num">{hours(m.cycle.medianHours)}</td><td className="small muted">{n(m.cycle.documents)} {m.cycle.documents === 1 ? "documento aprobado" : "documentos aprobados"}; percentil 90: {hours(m.cycle.p90Hours)}</td></tr>
            <tr><td>Campos aprobados sin corrección</td><td className="num">—</td><td className="num">{m.fields.approvedWithoutCorrectionPct != null ? `${n(m.fields.approvedWithoutCorrectionPct)} %` : "—"}</td><td className="small muted">{n(m.fields.extracted)} leídos, {n(m.fields.corrected)} corregidos por una persona</td></tr>
            <tr><td>Comisiones no pagadas o mal pagadas detectadas</td><td className="num">—</td><td className="num">{eur(m.euros.unpaid + m.euros.mismatch)}</td><td className="small muted">{n(m.euros.reconciliations)} {m.euros.reconciliations === 1 ? "liquidación conciliada" : "liquidaciones conciliadas"}</td></tr>
          </tbody>
        </table></div>

        <div className="proof" style={{ marginTop: 28 }}>
          <div className="stat"><div className="n mono">{n(m.documents.received)}</div><div className="l">Documentos recibidos</div></div>
          <div className="stat"><div className="n mono">{n(m.review.approved)}</div><div className="l">Aprobaciones por una persona ({n(m.review.rejected)} rechazos)</div></div>
          <div className="stat"><div className="n mono">${m.cost.usd.toFixed(2)}</div><div className="l">Coste del modelo en el periodo ({n(m.cost.modelCalls)} llamadas)</div></div>
        </div>

        <h2 style={{ marginTop: 28 }}>Documentos por tipo y por semana</h2>
        <div className="two" style={{ marginTop: 10 }}>
          <div className="table-wrap"><table><thead><tr><th>Tipo</th><th className="num">Leídos</th></tr></thead><tbody>
            {Object.entries(m.documents.byKind).sort(([, a], [, b]) => b - a).map(([k, v]) => <tr key={k}><td>{KIND[k] ?? k}</td><td className="num">{n(v)}</td></tr>)}
            {Object.keys(m.documents.byKind).length === 0 && <tr><td className="muted" colSpan={2}>Sin documentos en el periodo.</td></tr>}
          </tbody></table></div>
          <div className="table-wrap"><table><thead><tr><th>Semana</th><th className="num">Recibidos</th></tr></thead><tbody>
            {m.weekly.map((w) => <tr key={w.week}><td className="mono">{w.week}</td><td className="num">{n(w.received)}</td></tr>)}
            {m.weekly.length === 0 && <tr><td className="muted" colSpan={2}>Sin documentos en el periodo.</td></tr>}
          </tbody></table></div>
        </div>
      </section>

      <section className="page">
        <h2>Errores detectados por la revisión humana</h2>
        <p className="small muted" style={{ marginTop: 6 }}>Cada corrección se guarda como el valor de la persona, con el valor leído al lado. Los campos que más se corrigen marcan dónde ajustar el sistema.</p>
        <div className="table-wrap" style={{ marginTop: 10 }}><table>
          <thead><tr><th>Campo</th><th className="num">Correcciones</th></tr></thead>
          <tbody>
            {m.review.correctionsByField.map((c) => <tr key={c.field}><td>{FIELD[c.field] ?? c.field}</td><td className="num">{n(c.count)}</td></tr>)}
            {m.review.correctionsByField.length === 0 && <tr><td className="muted" colSpan={2}>Ninguna corrección en el periodo.</td></tr>}
          </tbody>
        </table></div>

        <h2 style={{ marginTop: 28 }}>Incidencias</h2>
        <div className="table-wrap" style={{ marginTop: 10 }}><table>
          <thead><tr><th>Tipo</th><th className="num">Veces</th></tr></thead>
          <tbody>
            {Object.entries(m.incidents.byAction).map(([k, v]) => <tr key={k}><td>{INCIDENT[k] ?? k}</td><td className="num">{n(v)}</td></tr>)}
            {m.incidents.total === 0 && <tr><td className="muted" colSpan={2}>Ninguna incidencia registrada en el periodo.</td></tr>}
          </tbody>
        </table></div>

        <h2 style={{ marginTop: 28 }}>Trabajo pendiente al cierre</h2>
        <p style={{ marginTop: 6 }}>{n(m.tasks.openFirm)} tareas abiertas del despacho y {n(m.tasks.openClient)} pendientes de clientes.</p>

        <h2 style={{ marginTop: 28 }}>Cumplimiento durante el piloto</h2>
        <ul className="list-plain" style={{ marginTop: 8 }}>
          <li>Ningún envío ni escritura en el programa de gestión sin la aprobación de una persona: {n(m.review.approved)} aprobaciones, {n(m.review.rejected)} rechazos.</li>
          <li>Toda comunicación generada lleva el aviso de uso de IA, añadido por el sistema, no por el modelo.</li>
          <li>Cada dato leído enlaza con el texto y la página de origen; lo que no está en el documento se marca como ausente.</li>
          <li>Registro de actividad completo y exportable en CSV; se conserva aunque se borren los documentos{settings.retentionDays ? ` (retención configurada: ${n(settings.retentionDays)} días)` : ""}.</li>
          <li>Datos tratados en la UE bajo contrato de encargo; presupuesto mensual de tokens con aviso al 80 %.</li>
        </ul>
        <p className="small muted" style={{ marginTop: 28 }}>Generado el {day(new Date().toISOString())} desde el registro de actividad de {firm.name}. Las cifras de “antes” proceden del inventario de la semana 1 y se confirman con el interlocutor del despacho.</p>
        <p className="small muted no-print"><Link href={`/app/${slug}/ajustes`}>Ajustar la línea base de horas</Link></p>
      </section>
    </main>
  );
}
