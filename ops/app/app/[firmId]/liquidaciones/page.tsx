import Link from "next/link";
import { redirect } from "next/navigation";
import { getRuntime, DEMO_FIRM, resolveFirmId } from "@/lib/runtime";
import { createUserClient, getSessionUser, supabaseAuthConfigured } from "@/lib/auth";
import { SupabaseStore } from "@/lib/supabase-store";
import type { Store } from "@/lib/store";
import type { ReconcileItem, ReconcileStatus, ReconcileSummary } from "@/lib/reconcile";
import type { Approval, Draft, ReconciliationRecord } from "@/lib/types";
import { AppNav } from "@/components/app-nav";
import { claimTotal, claimableItems, eur, findPendingClaim, periodLabel } from "@/lib/claims";
import { firmSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

// The settlements screen. Every reconciled statement in a table with tabular
// figures; one selected, its lines with a status pill each; and the only
// accent-colored action on the page is the one that sends the claim to the
// insurer, after a person approves it.

const STATUS: Record<ReconcileStatus, { label: string; pill: "ok" | "pending" | "err" | "muted" }> = {
  matched: { label: "cuadra", pill: "ok" },
  amount_mismatch: { label: "diferencia", pill: "pending" },
  not_settled: { label: "no pagado", pill: "pending" },
  unexpected: { label: "no esperado", pill: "err" },
  unreadable: { label: "ilegible", pill: "err" },
};

export default async function Liquidaciones({ params, searchParams }: { params: Promise<{ firmId: string }>; searchParams: Promise<{ id?: string; error?: string }> }) {
  const { firmId: slug } = await params;
  const { id: selectedId, error } = await searchParams;
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
    redirect("/app/demo/liquidaciones");
  }

  const firm = (await store.firms.get(firmId)) ?? DEMO_FIRM;
  const records = await store.reconciliations.listByFirm(firm.id, 100);
  const selected = records.find((r) => r.id === selectedId) ?? records[0] ?? null;
  const totals = records.reduce((t, r) => ({ unpaid: t.unpaid + r.unpaidEur, mismatch: t.mismatch + r.mismatchEur }), { unpaid: 0, mismatch: 0 });

  let detail: { summary: ReconcileSummary; pendingClaim: Approval | null; pendingDraft: Draft | null; history: Approval[] } | null = null;
  if (selected) {
    const summary = selected.summary as unknown as ReconcileSummary;
    const pendingClaim = await findPendingClaim(store, selected);
    const pendingDraft = pendingClaim?.draftId ? await store.drafts.get(pendingClaim.draftId) : null;
    const history = (await store.approvals.listByDocument(selected.documentId)).filter((a) => a.action === "send_draft" && a.status !== "pending");
    detail = { summary, pendingClaim, pendingDraft, history };
  }

  return (
    <main className="app-wrap">
      <AppNav slug={slug} firmName={firm.name} userLabel={userLabel} mode={rt.mode} active="liquidaciones" logout={supabaseAuthConfigured()} />
      <h1 style={{ marginTop: 18 }}>Liquidaciones de comisiones</h1>
      {error && <div className="card" style={{ borderColor: "var(--bad)" }}>{error}</div>}

      <div className="proof" style={{ margin: "20px 0 8px" }}>
        <div className="stat"><div className="n mono">{records.length}</div><div className="l">Liquidaciones conciliadas</div></div>
        <div className="stat"><div className="n mono">{eur(totals.unpaid)}</div><div className="l">Comisiones no pagadas: recibos que la aseguradora no liquidó</div></div>
        <div className="stat"><div className="n mono">{eur(totals.mismatch)}</div><div className="l">Diferencias de importe: liquidado por debajo de lo esperado</div></div>
      </div>

      <h2 style={{ marginTop: 28 }}>Conciliadas ({records.length})</h2>
      {records.length === 0 && (
        <div className="card">
          <p className="muted">Todavía no hay ninguna liquidación conciliada. Importa primero los recibos que esperabas cobrar y sube después la liquidación de la aseguradora.</p>
          {rt.mode.model === "demo" && (
            <form action="/api/settlements/upload" method="post" encType="multipart/form-data" style={{ marginTop: 12 }}>
              <input type="hidden" name="firmId" value={firm.id} />
              <input type="hidden" name="example" value="1" />
              <button type="submit" className="secondary">Cargar una liquidación de ejemplo</button>
            </form>
          )}
        </div>
      )}
      {records.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Aseguradora</th><th>Periodo</th><th>Conciliada</th><th className="num">Esperado</th><th className="num">Liquidado</th><th className="num">No pagado</th><th className="num">Diferencias</th><th></th></tr></thead>
            <tbody>
              {records.map((r) => <Row key={r.id} r={r} slug={slug} selected={r.id === selected?.id} />)}
            </tbody>
          </table>
        </div>
      )}

      {selected && detail && (
        <section style={{ paddingBlock: 28 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ margin: 0 }}>{selected.insurer ?? "Aseguradora sin nombre"} · {periodLabel(selected.period)}</h2>
            <span className="small muted">{detail.summary.items.length} líneas · {claimableItems(detail.summary).length} reclamables · <a href={`/api/documents/${selected.documentId}/file`}>ver liquidación</a></span>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Estado</th><th>Póliza</th><th>Recibo</th><th className="num">Esperado</th><th className="num">Liquidado</th><th className="num">Diferencia</th><th>Nota</th></tr></thead>
              <tbody>{detail.summary.items.map((i, k) => <Line key={k} i={i} />)}</tbody>
              <tfoot><tr><th colSpan={3}>Total</th><th className="num">{eur(detail.summary.totals.expectedEur)}</th><th className="num">{eur(detail.summary.totals.settledEur)}</th><th className="num">{eur(claimTotal(detail.summary))}</th><th></th></tr></tfoot>
            </table>
          </div>

          <Claim slug={slug} record={selected} summary={detail.summary} pending={detail.pendingClaim} draft={detail.pendingDraft} history={detail.history} mailbox={selected.insurer ? firmSettings(firm).insurerEmails[selected.insurer] ?? "" : ""} />
        </section>
      )}

      <h2>Recibos esperados</h2>
      <div className="two">
        <div className="card" style={{ margin: 0 }}>
          <strong>Importar recibos de un periodo</strong>
          <p className="small muted" style={{ marginTop: 6 }}>CSV exportado de tu programa de gestión con columnas aseguradora; poliza; recibo; tomador; prima; comision; periodo. Sustituye lo que hubiera para esa aseguradora y mes.</p>
          <form action="/api/receipts/import" method="post" encType="multipart/form-data" className="form" style={{ marginTop: 10 }}>
            <input type="hidden" name="firmId" value={firm.id} />
            <label>Aseguradora<input name="insurer" required placeholder="Aseguradora Ejemplo SA" /></label>
            <label>Periodo<input name="period" required pattern="\d{4}-\d{2}" placeholder="2026-08" /></label>
            <label>Archivo CSV<input type="file" name="file" accept=".csv,text/csv" required /></label>
            <div><button type="submit" className="secondary">Importar recibos</button></div>
          </form>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <strong>Subir una liquidación</strong>
          <p className="small muted" style={{ marginTop: 6 }}>El PDF o la exportación de la aseguradora. Se lee línea a línea, se cruza con los recibos del periodo y cada euro no pagado pasa a ser una tarea.</p>
          <form action="/api/settlements/upload" method="post" encType="multipart/form-data" className="form" style={{ marginTop: 10 }}>
            <input type="hidden" name="firmId" value={firm.id} />
            <label>Aseguradora (opcional, si no, la que diga el documento)<input name="insurer" placeholder="Aseguradora Ejemplo SA" /></label>
            <label>Periodo (opcional)<input name="period" pattern="\d{4}-\d{2}" placeholder="2026-08" /></label>
            <label>Liquidación<input type="file" name="file" accept=".pdf,.csv,.xlsx,image/*" required /></label>
            <div><button type="submit" className="secondary">Conciliar</button></div>
          </form>
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 16 }}><Link href={`/app/${slug}/revisar`}>Volver a la cola de revisión</Link></p>
    </main>
  );
}

function Row({ r, slug, selected }: { r: ReconciliationRecord; slug: string; selected: boolean }) {
  const s = r.summary as unknown as ReconcileSummary;
  return (
    <tr className={selected ? "selected" : undefined}>
      <td>{r.insurer ?? "?"}</td>
      <td className="mono">{r.period ?? "?"}</td>
      <td className="muted">{new Date(r.createdAt).toLocaleDateString("es-ES")}</td>
      <td className="num">{eur(s.totals?.expectedEur)}</td>
      <td className="num">{eur(s.totals?.settledEur)}</td>
      <td className="num">{eur(r.unpaidEur)}</td>
      <td className="num">{eur(r.mismatchEur)}</td>
      <td>{selected ? <span className="pill ok">abierta</span> : <Link href={`/app/${slug}/liquidaciones?id=${r.id}`}>Ver</Link>}</td>
    </tr>
  );
}

function Line({ i }: { i: ReconcileItem }) {
  const st = STATUS[i.status];
  return (
    <tr>
      <td><span className={`pill ${st.pill === "muted" ? "" : st.pill}`}>{st.label}</span></td>
      <td className="mono">{i.policyNumber ?? "—"}</td>
      <td className="mono">{i.receiptNumber ?? "—"}</td>
      <td className="num">{eur(i.expectedCommission)}</td>
      <td className="num">{eur(i.settledCommission)}</td>
      <td className="num">{i.differenceEur ? eur(i.differenceEur) : "—"}</td>
      <td className="small muted">{i.note}</td>
    </tr>
  );
}

function Claim({ slug, record, summary, pending, draft, history, mailbox }: { slug: string; record: ReconciliationRecord; summary: ReconcileSummary; pending: Approval | null; draft: Draft | null; history: Approval[]; mailbox: string }) {
  const total = claimTotal(summary);
  const lines = claimableItems(summary).length;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>Reclamación a la aseguradora</strong>
        <span className={`pill ${pending ? "pending" : lines ? "" : "ok"}`}>{pending ? "pendiente de aprobar" : lines ? `${lines} líneas · ${eur(total)}` : "nada que reclamar"}</span>
      </div>
      {history.length > 0 && (
        <ul className="small muted" style={{ paddingLeft: 18, marginTop: 8 }}>
          {history.map((a) => <li key={a.id}>{a.status === "approved" ? "Enviada" : "Rechazada"} el {a.decidedAt ? new Date(a.decidedAt).toLocaleString("es-ES") : "?"}{a.decidedBy ? ` por ${a.decidedBy}` : ""}</li>)}
        </ul>
      )}
      {!pending && lines > 0 && (
        <form action={`/api/settlements/${record.id}/claim`} method="post" className="row" style={{ marginTop: 12 }}>
          <label className="small" style={{ display: "grid", gap: 4, flex: 1, minWidth: 220 }}>Correo de liquidaciones de {record.insurer ?? "la aseguradora"}
            <input name="to" type="email" required defaultValue={mailbox} placeholder="liquidaciones@aseguradora.es" style={{ font: "inherit", fontSize: 15, padding: "8px 10px", border: "1px solid var(--rule)", background: "var(--surface)" }} />
          </label>
          <button type="submit" className="secondary" style={{ alignSelf: "end" }}>Preparar reclamación</button>
        </form>
      )}
      {!pending && lines > 0 && <p className="small muted" style={{ marginTop: 8 }}>Se redacta la carta con las {lines} líneas anteriores y queda pendiente de tu aprobación. No se envía nada hasta que la apruebes.</p>}
      {pending && draft && (
        <div style={{ marginTop: 12 }}>
          <div className="small muted">Para: {draft.to} · Asunto: {draft.subject}</div>
          <div className="letter" style={{ marginTop: 8 }}>{draft.body}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <form action={`/api/approvals/${pending.id}`} method="post"><input type="hidden" name="decision" value="approved" /><button type="submit" className="btn accent">Aprobar y enviar a la aseguradora</button></form>
            <form action={`/api/approvals/${pending.id}`} method="post"><input type="hidden" name="decision" value="rejected" /><button type="submit" className="secondary">Rechazar</button></form>
            <span className="small muted">Para cambiar el texto, edítalo en la <Link href={`/app/${slug}/revisar`}>cola de revisión</Link>. Los correos de las aseguradoras se guardan en <Link href={`/app/${slug}/ajustes`}>ajustes</Link>.</span>
          </div>
        </div>
      )}
    </div>
  );
}
