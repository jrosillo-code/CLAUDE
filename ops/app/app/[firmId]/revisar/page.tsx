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
  nombre: "Nombre", numero_documento: "Nº documento", fecha_caducidad: "Caducidad",
};

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
      <h1 style={{ marginTop: 18 }}>Cola de revisión</h1>
      {error && <div className="card" style={{ borderColor: "var(--bad)" }}>{error}</div>}

      <div className="proof" style={{ margin: "20px 0 8px" }}>
        <div className="stat"><div className="n mono">{metrics.fields.approvedWithoutCorrectionPct ?? "–"}{metrics.fields.approvedWithoutCorrectionPct != null ? "%" : ""}</div><div className="l">Campos aprobados sin corrección ({metrics.fields.extracted} leídos, {metrics.fields.corrected} corregidos)</div></div>
        <div className="stat"><div className="n mono">{(metrics.euros.unpaid + metrics.euros.mismatch).toFixed(2)} €</div><div className="l">Comisiones no pagadas o mal pagadas detectadas en {metrics.euros.reconciliations} liquidaciones</div></div>
        <div className="stat"><div className="n mono">{metrics.tasks.openFirm + metrics.tasks.openClient}</div><div className="l">Tareas abiertas ({metrics.tasks.openFirm} del despacho, {metrics.tasks.openClient} de clientes) · coste del modelo ${metrics.cost.usd.toFixed(2)}</div></div>
      </div>
      <p className="muted small">Presupuesto del mes: {budget.used.toLocaleString("es-ES")} de {budget.budget.toLocaleString("es-ES")} tokens{budget.warn ? " · aviso: por encima del 80 %" : ""}</p>

      <h2 style={{ marginTop: 28 }}>Pendiente de aprobación ({items.length})</h2>
      {items.length === 0 && (
        <div className="card">
          <p className="muted">Nada pendiente.</p>
          <form action="/api/intake/upload" method="post" encType="multipart/form-data" className="row" style={{ marginTop: 10 }}>
            <input type="hidden" name="firmId" value={firm.id} />
            <input type="hidden" name="process" value="1" />
            <input type="file" name="file" id="file" required />
            <button type="submit">Subir y procesar</button>
          </form>
        </div>
      )}
      {items.map(({ doc, extraction, validation, approvals, drafts }) => doc && (
        <DocumentCard key={doc.id} doc={doc} extraction={extraction} validation={validation} approvals={approvals} drafts={drafts} />
      ))}

      <h2>Tareas abiertas ({tasks.length})</h2>
      <table><thead><tr><th>Tarea</th><th>Detalle</th><th>Responsable</th><th></th></tr></thead><tbody>
        {tasks.map((t) => <tr key={t.id}><td>{t.title}</td><td className="muted">{t.detail}</td><td>{t.owner === "firm" ? "Despacho" : "Cliente"}</td><td><form action={`/api/tasks/${t.id}`} method="post"><input type="hidden" name="status" value="done" /><button className="secondary" type="submit">Hecha</button></form></td></tr>)}
      </tbody></table>

      {reconciliations.length > 0 && (<>
        <h2>Liquidaciones conciliadas <span className="small muted" style={{ fontFamily: "var(--sans)", fontWeight: 400 }}>· <Link href={`/app/${slug}/liquidaciones`}>ver todas y reclamar</Link></span></h2>
        <table><thead><tr><th>Aseguradora</th><th>Periodo</th><th>No pagado</th><th>Diferencias</th></tr></thead><tbody>
          {reconciliations.map((r) => <tr key={r.id}><td>{r.insurer ?? "?"}</td><td>{r.period ?? "?"}</td><td>{r.unpaidEur.toFixed(2)} €</td><td>{r.mismatchEur.toFixed(2)} €</td></tr>)}
        </tbody></table>
      </>)}

      <h2>Registro de actividad</h2>
      <table><thead><tr><th>Cuándo</th><th>Acción</th><th>Actor</th><th>Coste</th></tr></thead><tbody>
        {activity.map((e) => <tr key={e.id}><td className="muted">{new Date(e.at).toLocaleString("es-ES")}</td><td>{e.action}</td><td className="muted">{e.actor.type}{e.actor.id ? ` · ${e.actor.id}` : ""}</td><td className="muted">{e.usage ? `$${e.usage.costUsd.toFixed(4)}` : ""}</td></tr>)}
      </tbody></table>
    </main>
  );
}

function DocumentCard({ doc, extraction, validation, approvals, drafts }: { doc: DocumentRecord; extraction: Extraction | null; validation: Validation | null; approvals: Approval[]; drafts: (Draft | null)[] }) {
  const section = extraction ? (extraction.data[extraction.kind] as Record<string, Field<unknown> | null> | null) : null;
  const isPdf = doc.mediaType === "application/pdf";
  const isImage = doc.mediaType.startsWith("image/");
  const fileUrl = `/api/documents/${doc.id}/file`;
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div><strong>{doc.fileName}</strong> <span className="muted">· {extraction?.kind ?? "sin leer"}{extraction ? ` · confianza ${(extraction.kindConfidence * 100).toFixed(0)} %` : ""}</span></div>
        <span className={`pill ${validation?.ok ? "ok" : "pending"}`}>{validation?.ok ? "válido" : `${validation?.missing.length ?? 0} faltan`}</span>
      </div>
      <div className="two" style={{ marginTop: 12 }}>
        <div>
          {isPdf && <iframe src={fileUrl} title={doc.fileName} style={{ width: "100%", height: 420, border: "1px solid var(--rule)", background: "#fff" }} />}
          {isImage && <img src={fileUrl} alt={doc.fileName} style={{ border: "1px solid var(--rule)" }} />}
          {!isPdf && !isImage && <a href={fileUrl}>Abrir {doc.fileName}</a>}
          {validation && validation.issues.length > 0 && (
            <ul className="small muted" style={{ paddingLeft: 18, marginTop: 10 }}>
              {validation.issues.map((i, k) => <li key={k}>{i.severity === "error" ? "⚠ " : ""}{i.message}</li>)}
            </ul>
          )}
        </div>
        <div>
          {section && typeof section === "object" && Object.entries(section).map(([k, f]) => {
            if (Array.isArray(f)) return <div className="field" key={k}><span className="k">{k}</span><span className="tag ok">{f.length}</span><span className="v">{f.join(", ") || "—"}</span></div>;
            const fld = f as Field<unknown> | null;
            const has = !!fld && fld.quote?.trim();
            return (
              <div className="field" key={k}>
                <span className="k">{FIELD_LABELS[k] ?? k}</span>
                <span className={`tag ${has ? "ok" : "missing"}`}>{has ? (String(fld!.quote).startsWith("corregido") ? "corregido" : "leído") : "falta"}</span>
                <span className="v">{has ? String(fld!.value) : "—"}</span>
                <span className="src">{has ? `“${fld!.quote}”${fld!.page ? `, pág. ${fld!.page}` : ""}` : "no consta en el documento"}</span>
                <form action={`/api/documents/${doc.id}/correct`} method="post" className="row" style={{ gridColumn: "1 / -1", gap: 6 }}>
                  <input type="hidden" name="field" value={k} />
                  <input name="value" placeholder="Corregir…" aria-label={`Corregir ${k}`} style={{ font: "inherit", fontSize: 13, padding: "4px 6px", border: "1px solid var(--rule)", flex: 1, minWidth: 0 }} />
                  <button type="submit" className="secondary" style={{ padding: "4px 8px", fontSize: 13 }}>Guardar</button>
                </form>
              </div>
            );
          })}
        </div>
      </div>
      {approvals.map((a, i) => (
        <div key={a.id} style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--rule)" }}>
          <span className="pill pending">{a.action === "send_draft" ? `Enviar ${drafts[i]?.channel ?? "mensaje"}` : "Escribir en el sistema de gestión"}</span>
          {drafts[i] && (
            <form action={`/api/documents/${doc.id}/correct`} method="post" style={{ marginTop: 8 }}>
              <div className="small muted">Para: {drafts[i]!.to}{drafts[i]!.subject ? ` · Asunto: ${drafts[i]!.subject}` : ""}</div>
              <input type="hidden" name="field" value="draft.body" />
              <input type="hidden" name="draftId" value={drafts[i]!.id} />
              <textarea name="value" defaultValue={drafts[i]!.body} rows={8} style={{ width: "100%", font: "inherit", fontSize: 14, padding: 8, border: "1px solid var(--rule)", marginTop: 6 }} />
              <button type="submit" className="secondary" style={{ marginTop: 6 }}>Guardar cambios del mensaje</button>
            </form>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <form action={`/api/approvals/${a.id}`} method="post"><input type="hidden" name="decision" value="approved" /><button type="submit" className="btn accent">{a.action === "send_draft" ? "Aprobar y enviar" : "Aprobar y escribir"}</button></form>
            <form action={`/api/approvals/${a.id}`} method="post"><input type="hidden" name="decision" value="rejected" /><button type="submit" className="secondary">Rechazar</button></form>
          </div>
        </div>
      ))}
    </div>
  );
}
