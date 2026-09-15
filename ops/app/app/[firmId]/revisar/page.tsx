import Link from "next/link";
import { redirect } from "next/navigation";
import { getRuntime, DEMO_FIRM, resolveFirmId } from "@/lib/runtime";
import { createUserClient, getSessionUser, supabaseAuthConfigured } from "@/lib/auth";
import { SupabaseStore } from "@/lib/supabase-store";
import type { Store } from "@/lib/store";
import { budgetStatus } from "@/lib/budget";
import { computeMetrics } from "@/lib/metrics";
import type { Field, Approval, Draft, Extraction, Validation, DocumentRecord } from "@/lib/types";
import { AppNav } from "@/components/app-nav";

export const dynamic = "force-dynamic";

// The reviewer's screen. A person sees the document and what the system
// proposes on one page, and can correct a field, edit the draft, approve or
// reject. In production the reads go through the member's own session so
// RLS applies; the writes go through the API routes.

const FIELD_LABELS: Record<string, string> = {
  emisor_nombre: "Emisor", emisor_nif: "NIF emisor", receptor_nombre: "Receptor", receptor_nif: "NIF receptor", serie: "Serie", numero: "Número", fecha_expedicion: "Fecha", base_imponible: "Base imponible", tipo_iva: "Tipo IVA", cuota_iva: "Cuota IVA", total: "Total", concepto: "Concepto",
  pagador: "Pagador", beneficiario: "Beneficiario", importe: "Importe", fecha: "Fecha", referencia_poliza: "Ref. póliza", estado: "Estado",
  tipo: "Tipo", numero_poliza: "Nº póliza", asegurado_nombre: "Asegurado", fecha_siniestro: "Fecha siniestro", lugar: "Lugar", descripcion: "Descripción", terceros_implicados: "Terceros",
  aseguradora: "Aseguradora", tomador_nombre: "Tomador", tomador_nif: "NIF tomador", ramo: "Ramo", fecha_efecto: "Efecto", fecha_vencimiento: "Vencimiento", prima_total: "Prima",
  nombre: "Nombre", numero_documento: "Nº documento", fecha_caducidad: "Caducidad", documentos_adjuntos: "Documentos adjuntos",
};

const show = (v: unknown) => (typeof v === "boolean" ? (v ? "sí" : "no") : String(v));

export default async function Revisar({ params, searchParams }: { params: Promise<{ firmId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { firmId: slug } = await params;
  const { error } = await searchParams;
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
    redirect("/app/demo/revisar");
  }

  const firm = (await store.firms.get(firmId)) ?? DEMO_FIRM;
  const [pending, tasks, activity, budget, metrics, reconciliations] = await Promise.all([
    store.approvals.listPending(firm.id),
    store.tasks.listOpenByFirm(firm.id),
    store.activity.list(firm.id, 40),
    budgetStatus(store, firm),
    computeMetrics(store, firm.id),
    store.reconciliations.listByFirm(firm.id, 5),
  ]);

  // Group pending approvals by document, with what the reviewer needs to see.
  const byDoc = new Map<string, Approval[]>();
  for (const a of pending) byDoc.set(a.documentId, [...(byDoc.get(a.documentId) ?? []), a]);
  const items = await Promise.all([...byDoc.entries()].map(async ([documentId, approvals]) => {
    const [doc, extraction, validation] = await Promise.all([store.documents.get(documentId), store.extractions.latestForDocument(documentId), store.validations.latestForDocument(documentId)]);
    const drafts = await Promise.all(approvals.map((a) => (a.draftId ? store.drafts.get(a.draftId) : Promise.resolve(null))));
    return { doc, extraction, validation, approvals, drafts };
  }));

  return (
    <main className="app-wrap">
      <AppNav slug={slug} firmName={firm.name} userLabel={userLabel} mode={rt.mode} active="revisar" logout={supabaseAuthConfigured()} />
      <div className="page-head">
        <h1>Cola de revisión</h1>
        <span className="meta">Presupuesto del mes · {budget.used.toLocaleString("es-ES")} de {budget.budget.toLocaleString("es-ES")} tokens{budget.warn ? " · por encima del 80 %" : ""}</span>
      </div>
      {error && <div className="notice err">{error}</div>}

      <div className="proof app-proof">
        <div className="stat"><div className="n">{metrics.fields.approvedWithoutCorrectionPct ?? "–"}{metrics.fields.approvedWithoutCorrectionPct != null ? <span className="unit">%</span> : ""}</div><div className="l">Campos aprobados sin corrección · {metrics.fields.extracted} leídos, {metrics.fields.corrected} corregidos</div></div>
        <div className="stat"><div className="n">{(metrics.euros.unpaid + metrics.euros.mismatch).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<span className="unit">€</span></div><div className="l">Comisiones no pagadas o mal pagadas en {metrics.euros.reconciliations} {metrics.euros.reconciliations === 1 ? "liquidación" : "liquidaciones"}</div></div>
        <div className="stat"><div className="n">{metrics.tasks.openFirm + metrics.tasks.openClient}</div><div className="l">Tareas abiertas · {metrics.tasks.openFirm} del despacho, {metrics.tasks.openClient} de clientes · modelo ${metrics.cost.usd.toFixed(2)}</div></div>
      </div>

      <div className="section-row"><h2>Pendiente de aprobación</h2><span className="count">{items.length}</span></div>
      {items.length === 0 && (
        <div className="empty">
          <div className="eyebrow">Nada pendiente</div>
          <p>Todo lo que llegó está aprobado o rechazado. Sube un documento para verlo pasar por la cadena.</p>
          <form action="/api/intake/upload" method="post" encType="multipart/form-data" className="row">
            <input type="hidden" name="firmId" value={firm.id} />
            <input type="hidden" name="process" value="1" />
            <input type="file" name="file" id="file" required className="input" />
            <button type="submit" className="btn">Subir y procesar</button>
          </form>
        </div>
      )}
      {items.map(({ doc, extraction, validation, approvals, drafts }) => doc && (
        <DocumentCard key={doc.id} doc={doc} extraction={extraction} validation={validation} approvals={approvals} drafts={drafts} />
      ))}

      <div className="section-row"><h2>Tareas abiertas</h2><span className="count">{tasks.length}</span></div>
      {tasks.length === 0 ? <div className="empty"><p>Sin tareas abiertas.</p></div> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Tarea</th><th>Detalle</th><th>Responsable</th><th></th></tr></thead>
          <tbody>{tasks.map((t) => <tr key={t.id}><td>{t.title}</td><td className="muted">{t.detail}</td><td><span className={`pill ${t.owner === "firm" ? "pending" : ""}`}>{t.owner === "firm" ? "despacho" : "cliente"}</span></td><td className="num"><form action={`/api/tasks/${t.id}`} method="post"><input type="hidden" name="status" value="done" /><button className="btn ghost sm" type="submit">Hecha</button></form></td></tr>)}</tbody>
        </table></div>
      )}

      {reconciliations.length > 0 && (<>
        <div className="section-row"><h2>Liquidaciones conciliadas</h2><Link className="small" href={`/app/${slug}/liquidaciones`}>Ver todas y reclamar →</Link></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Aseguradora</th><th>Periodo</th><th className="num">No pagado</th><th className="num">Diferencias</th></tr></thead>
          <tbody>{reconciliations.map((r) => <tr key={r.id}><td>{r.insurer ?? "?"}</td><td className="mono">{r.period ?? "?"}</td><td className="num">{r.unpaidEur.toFixed(2)} €</td><td className="num">{r.mismatchEur.toFixed(2)} €</td></tr>)}</tbody>
        </table></div>
      </>)}

      <div className="section-row"><h2>Registro de actividad</h2><Link className="small" href={`/api/export?kind=activity&firmId=${firm.id}`}>Exportar CSV</Link></div>
      <div className="table-wrap"><table className="log">
        <thead><tr><th>Cuándo</th><th>Acción</th><th>Actor</th><th className="num">Coste</th></tr></thead>
        <tbody>{activity.map((e) => <tr key={e.id}><td className="mono muted">{new Date(e.at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td className="mono">{e.action}</td><td className="muted">{e.actor.type}{e.actor.id ? ` · ${e.actor.id}` : ""}</td><td className="num muted">{e.usage ? `$${e.usage.costUsd.toFixed(4)}` : ""}</td></tr>)}</tbody>
      </table></div>
    </main>
  );
}

function DocumentCard({ doc, extraction, validation, approvals, drafts }: { doc: DocumentRecord; extraction: Extraction | null; validation: Validation | null; approvals: Approval[]; drafts: (Draft | null)[] }) {
  const section = extraction ? (extraction.data[extraction.kind] as Record<string, Field<unknown> | null> | null) : null;
  const isPdf = doc.mediaType === "application/pdf";
  const isImage = doc.mediaType.startsWith("image/");
  const fileUrl = `/api/documents/${doc.id}/file`;
  const missing = validation?.missing.length ?? 0;
  return (
    <div className="queue app-queue">
      <div className="queue-bar">
        <span>{doc.fileName} · {extraction?.kind ?? "sin leer"}{extraction ? ` · confianza ${(extraction.kindConfidence * 100).toFixed(0)} %` : ""}</span>
        <span className={`pill ${validation?.ok ? "ok" : "pending"}`}>{validation?.ok ? "válido" : `${missing} ${missing === 1 ? "falta" : "faltan"}`}</span>
      </div>
      <div className="queue-body">
        <div className="queue-doc">
          {isPdf && <iframe src={fileUrl} title={doc.fileName} className="doc-frame" />}
          {isImage && <img src={fileUrl} alt={doc.fileName} style={{ border: "1px solid var(--rule)", background: "#fff" }} />}
          {!isPdf && !isImage && <a href={fileUrl}>Abrir {doc.fileName}</a>}
          {validation && validation.issues.length > 0 && (
            <ul className="issues">
              {validation.issues.map((i, k) => <li key={k} className={i.severity === "error" ? "err" : ""}>{i.message}</li>)}
            </ul>
          )}
        </div>
        <div className="queue-fields">
          {section && typeof section === "object" && Object.entries(section).map(([k, f]) => {
            if (Array.isArray(f)) return <div className="field" key={k}><span className="k">{FIELD_LABELS[k] ?? k}</span><span className="tag ok">{f.length}</span><span className="v">{f.join(", ") || "—"}</span></div>;
            const fld = f as Field<unknown> | null;
            const has = !!fld && fld.quote?.trim();
            return (
              <div className="field" key={k}>
                <span className="k">{FIELD_LABELS[k] ?? k}</span>
                <span className={`tag ${has ? "ok" : "missing"}`}>{has ? (String(fld!.quote).startsWith("corregido") ? "corregido" : "leído") : "falta"}</span>
                <span className="v">{has ? show(fld!.value) : "—"}</span>
                <span className="src">{has ? `“${fld!.quote}”${fld!.page ? `, pág. ${fld!.page}` : ""}` : "no consta en el documento"}</span>
                <form action={`/api/documents/${doc.id}/correct`} method="post" className="fix">
                  <input type="hidden" name="field" value={k} />
                  <input name="value" placeholder="Corregir…" aria-label={`Corregir ${FIELD_LABELS[k] ?? k}`} className="input sm" />
                  <button type="submit" className="btn ghost sm">Guardar</button>
                </form>
              </div>
            );
          })}
        </div>
        <div className="queue-audit">
          {approvals.map((a, i) => (
            <div key={a.id} className="decision">
              <span className="pill pending">{a.action === "send_draft" ? `Enviar por ${drafts[i]?.channel ?? "mensaje"}` : "Escribir en el sistema de gestión"}</span>
              {drafts[i] && (
                <form action={`/api/documents/${doc.id}/correct`} method="post" className="draft">
                  <div className="small muted">Para: {drafts[i]!.to}{drafts[i]!.subject ? ` · Asunto: ${drafts[i]!.subject}` : ""}</div>
                  <input type="hidden" name="field" value="draft.body" />
                  <input type="hidden" name="draftId" value={drafts[i]!.id} />
                  <textarea name="value" defaultValue={drafts[i]!.body} rows={7} className="input" />
                  <button type="submit" className="btn ghost sm">Guardar cambios del mensaje</button>
                </form>
              )}
              <div className="queue-actions">
                <form action={`/api/approvals/${a.id}`} method="post"><input type="hidden" name="decision" value="approved" /><button type="submit" className="btn accent">{a.action === "send_draft" ? "Aprobar y enviar" : "Aprobar y escribir"}</button></form>
                <form action={`/api/approvals/${a.id}`} method="post"><input type="hidden" name="decision" value="rejected" /><button type="submit" className="btn ghost">Rechazar</button></form>
              </div>
            </div>
          ))}
          <span className="trail">registro · recibido {new Date(doc.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {extraction ? "leído" : "sin leer"} · {validation ? (validation.ok ? "validado" : `validado: ${missing} ${missing === 1 ? "elemento falta" : "elementos faltan"}`) : "sin validar"} · {approvals.length} {approvals.length === 1 ? "aprobación pendiente" : "aprobaciones pendientes"}</span>
        </div>
      </div>
    </div>
  );
}
