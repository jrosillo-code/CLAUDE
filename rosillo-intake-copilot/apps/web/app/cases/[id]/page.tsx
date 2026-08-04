import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser, can, canViewCase } from '@/lib/auth';
import { getDb, getCaseDetail, listUsers } from '@rosillo/database';
import {
  ACTION_CATALOGUE,
  type ActionCode,
  type CaseAnalysis,
  type ResponseDraft,
} from '@rosillo/domain';
import { analyseCaseAction, claimCaseAction, reassignCaseAction, decideAction } from './actions';

const STATUS_LABELS: Record<string, string> = {
  EXPLICIT: 'Explícito',
  INFERRED: 'Inferido — confirmar',
  UNKNOWN: 'Desconocido',
};

const FEEDBACK_OPTIONS: Array<[string, string]> = [
  ['wrong_workflow', 'Workflow incorrecto'],
  ['wrong_match', 'Cliente/póliza incorrectos'],
  ['wrong_extraction', 'Extracción incorrecta'],
  ['missing_info_wrong', 'Checklist de faltantes incorrecta'],
  ['draft_quality', 'Calidad del borrador mejorable'],
];

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string; run?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { error, ok, run: runParam } = await searchParams;

  const detail = getCaseDetail(getDb(), id);
  if (!detail || !detail.communication) notFound();
  const { caseRow, communication, attachments, runs, decisions, audit } = detail;

  if (!canViewCase(user, caseRow.assigneeId)) {
    return (
      <div className="notice error" role="alert">
        Este caso está asignado a otra persona. Un supervisor puede reasignarlo.
      </div>
    );
  }

  const selectedRun = runs.find((r) => r.id === runParam) ?? runs[0] ?? null;
  const analysis: CaseAnalysis | null = selectedRun?.outputJson ? JSON.parse(selectedRun.outputJson) : null;
  const draft: ResponseDraft | null = selectedRun?.draftJson ? JSON.parse(selectedRun.draftJson) : null;
  const evidenceById = new Map((analysis?.evidence ?? []).map((e) => [e.id, e]));
  const isLatest = selectedRun != null && selectedRun.id === runs[0]?.id;
  const decided = caseRow.status === 'DECIDED';
  const users = can(user, 'cases.assign') ? listUsers(getDb()) : [];
  const requiredItems = (analysis?.missingInformation ?? []).filter((m) => m.severity === 'REQUIRED');

  return (
    <>
      <p>
        <Link href="/">← Bandeja de entrada</Link>
      </p>
      <h1>
        {communication.subject}{' '}
        <span className={`badge status-${caseRow.status}`}>{caseRow.status}</span>{' '}
        <span className={`badge prio-${caseRow.priority}`}>{caseRow.priority}</span>
      </h1>
      {error && <p className="notice error" role="alert">{error}</p>}
      {ok && <p className="notice info" role="status">Decisión registrada y auditada.</p>}

      <div className="two-pane">
        {/* ── Original communication ─────────────────────────────── */}
        <section aria-label="Comunicación original">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Comunicación original</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              De: <strong>{communication.sender}</strong> · Recibido:{' '}
              {new Date(communication.receivedAt).toLocaleString('es-ES')} · Caso {caseRow.id}
            </p>
            <div className="email-body">{communication.bodyText}</div>
            <h2>Adjuntos ({attachments.length})</h2>
            {attachments.length === 0 && <p className="muted">Sin adjuntos.</p>}
            {attachments.map((a) => (
              <details key={a.id} style={{ marginBottom: 6 }}>
                <summary>
                  {a.filename} <span className="muted">({a.mimeType})</span>
                </summary>
                {a.text ? <div className="email-body">{a.text}</div> : <p className="muted">Sin texto extraíble (imagen).</p>}
              </details>
            ))}
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Asignación</h2>
            <p className="muted">
              {caseRow.assigneeId ? `Asignado a ${caseRow.assigneeId}` : 'Sin asignar'}
            </p>
            {!decided && (!caseRow.assigneeId || caseRow.assigneeId !== user.id) && (
              <form action={claimCaseAction.bind(null, caseRow.id)}>
                <button type="submit">Tomar caso</button>
              </form>
            )}
            {can(user, 'cases.assign') && (
              <form action={reassignCaseAction.bind(null, caseRow.id)} className="actions-row">
                <select name="assignee" defaultValue={caseRow.assigneeId ?? ''}>
                  <option value="">— Sin asignar —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button type="submit">Reasignar</button>
              </form>
            )}
          </div>
        </section>

        {/* ── AI analysis ────────────────────────────────────────── */}
        <section aria-label="Análisis de IA">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Análisis de IA</h2>

            {runs.length === 0 && (
              <>
                <p className="muted">Este caso aún no ha sido analizado. El análisis solo se ejecuta a petición de un empleado.</p>
                <form action={analyseCaseAction.bind(null, caseRow.id)}>
                  <button type="submit" className="primary">Analizar caso</button>
                </form>
              </>
            )}

            {runs.length > 1 && (
              <p className="muted" style={{ fontSize: 13 }}>
                Versiones:{' '}
                {runs.map((r) => (
                  <Link key={r.id} href={`/cases/${caseRow.id}?run=${r.id}`} style={{ marginRight: 8 }}>
                    {r.id === selectedRun?.id ? <strong>v{r.version}</strong> : <>v{r.version}</>}
                  </Link>
                ))}
                — cada re-análisis crea una versión inmutable nueva.
              </p>
            )}

            {selectedRun && selectedRun.errorCode && (
              <div className="notice error">
                El análisis falló de forma segura: {selectedRun.errorCode} — {selectedRun.errorDetail}
              </div>
            )}

            {selectedRun && analysis && (
              <>
                <p>
                  <strong>Workflow:</strong> {analysis.workflow}{' '}
                  <span className="badge explicit">confianza {(analysis.workflowConfidence * 100).toFixed(0)}%</span>
                  {analysis.secondaryWorkflows.length > 0 && (
                    <span className="muted"> · secundarios: {analysis.secondaryWorkflows.join(', ')}</span>
                  )}
                </p>
                <p className="muted">{analysis.summary}</p>
                <p className="muted" style={{ fontSize: 12 }}>
                  v{selectedRun.version} · proveedor {selectedRun.provider} ({selectedRun.model}) · prompts{' '}
                  {selectedRun.promptVersions} · reglas {selectedRun.rulesVersion} · {selectedRun.durationMs} ms
                </p>

                <h2>Candidatos de cliente y póliza</h2>
                {analysis.customerCandidates.length + analysis.policyCandidates.length === 0 && (
                  <p className="muted">Sin candidatos — puede ser un cliente nuevo o un mensaje no operativo.</p>
                )}
                <div className="field-list">
                  {[...analysis.customerCandidates, ...analysis.policyCandidates].map((c) => (
                    <div className="field-row" key={c.id}>
                      <span className="k">{c.kind === 'CUSTOMER' ? 'Cliente' : 'Póliza'}</span>{' '}
                      <span className="v">{c.label}</span>{' '}
                      <span className="badge explicit">{(c.score * 100).toFixed(0)}%</span>
                      <div className="evidence">{c.signals.join(' · ')}</div>
                    </div>
                  ))}
                </div>

                <h2>Campos extraídos</h2>
                {Object.keys(analysis.entities).length === 0 && <p className="muted">Sin campos extraídos.</p>}
                <div className="field-list">
                  {Object.entries(analysis.entities).map(([key, f]) => (
                    <div className="field-row" key={key}>
                      <span className="k">{key}</span>{' '}
                      <span className={`badge ${f.status.toLowerCase()}`}>{STATUS_LABELS[f.status]}</span>
                      <div className="v">{f.value ?? '—'}</div>
                      {f.evidenceIds.map((eid) => {
                        const ev = evidenceById.get(eid);
                        return ev ? (
                          <div className="evidence" key={eid}>
                            Fuente ({ev.sourceType}): «{ev.quote}»
                          </div>
                        ) : null;
                      })}
                      {f.note && <div className="evidence">{f.note}</div>}
                    </div>
                  ))}
                </div>

                <h2>Información faltante ({analysis.missingInformation.length})</h2>
                {analysis.missingInformation.length === 0 && <p className="muted">Las reglas no detectan información faltante.</p>}
                {analysis.missingInformation.map((m) => (
                  <div className="missing-item" key={m.key}>
                    <span className={`badge ${m.severity === 'REQUIRED' ? 'inferred' : 'unknown'}`}>
                      {m.severity === 'REQUIRED' ? 'Obligatorio' : 'Recomendado'}
                    </span>
                    <span>
                      {m.label} <span className="muted">({m.ruleId})</span>
                    </span>
                  </div>
                ))}

                {analysis.riskFlags.length > 0 && (
                  <>
                    <h2>Avisos</h2>
                    <ul>
                      {analysis.riskFlags.map((r, i) => (
                        <li key={i} className="muted">{r}</li>
                      ))}
                    </ul>
                  </>
                )}

                <h2>Acción sugerida</h2>
                <p>
                  <strong>{analysis.suggestedActionCode}</strong> — {ACTION_CATALOGUE[analysis.suggestedActionCode as ActionCode]}
                  <br />
                  <span className="muted">{analysis.suggestedActionRationale}</span>
                </p>
                <p className="muted" style={{ fontSize: 12 }}>
                  Acción externa permitida: <strong>NO</strong> (invariante del prototipo — no existe botón de envío).
                </p>

                <details>
                  <summary>Vista previa de exportación estructurada (futuro mapeo a segElevia)</summary>
                  <pre style={{ overflow: 'auto', fontSize: 12 }}>{JSON.stringify({ case: caseRow.id, analysis }, null, 2)}</pre>
                </details>
              </>
            )}
          </div>

          {selectedRun && analysis && isLatest && !decided && (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Revisión del empleado</h2>
              <form action={decideAction.bind(null, caseRow.id)}>
                <input type="hidden" name="analysisRunId" value={selectedRun.id} />

                {requiredItems.length > 0 && (
                  <fieldset>
                    <legend>Resolver elementos obligatorios (o dejar en blanco y registrar excepción de supervisión)</legend>
                    {requiredItems.map((m) => (
                      <p key={m.key} style={{ margin: '6px 10px' }}>
                        <label>
                          {m.label}
                          <br />
                          <input type="text" name={`edit_${m.key}`} style={{ width: '100%' }} />
                        </label>
                      </p>
                    ))}
                  </fieldset>
                )}

                <fieldset>
                  <legend>Borrador de respuesta (editable — nunca se envía desde esta aplicación)</legend>
                  <p style={{ margin: '6px 10px' }}>
                    <textarea name="draftBody" rows={10} defaultValue={draft?.body ?? ''} aria-label="Borrador de respuesta" />
                  </p>
                </fieldset>

                <fieldset>
                  <legend>Feedback para evaluación</legend>
                  <p style={{ margin: '6px 10px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {FEEDBACK_OPTIONS.map(([code, label]) => (
                      <label key={code} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="checkbox" name="feedback" value={code} /> {label}
                      </label>
                    ))}
                  </p>
                  <p style={{ margin: '6px 10px' }}>
                    <label>
                      Nota
                      <br />
                      <textarea name="note" rows={2} />
                    </label>
                  </p>
                  {can(user, 'decisions.review') && (
                    <p style={{ margin: '6px 10px' }}>
                      <label>
                        Motivo de excepción de supervisión (permite aprobar con obligatorios sin resolver)
                        <br />
                        <input type="text" name="overrideReason" style={{ width: '100%' }} />
                      </label>
                    </p>
                  )}
                </fieldset>

                <div className="actions-row">
                  <button type="submit" name="decisionType" value="REJECT" className="danger">Rechazar</button>
                  <button type="submit" name="decisionType" value="REQUEST_REANALYSIS">Re-analizar</button>
                  <button type="submit" name="decisionType" value="ESCALATE">Escalar</button>
                  <button type="submit" name="decisionType" value="APPROVE" className="primary">Aprobar análisis</button>
                </div>
              </form>
            </div>
          )}

          {decisions.length > 0 && (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Decisiones</h2>
              {decisions.map((d) => (
                <div className="field-row" key={d.id} style={{ marginBottom: 8 }}>
                  <span className="v">{d.decisionType}</span> <span className="muted">por {d.userId}</span>
                  <div className="evidence">
                    {new Date(d.createdAt).toLocaleString('es-ES')} · análisis {d.analysisRunId.slice(0, 12)}…
                    {d.note && <> · nota: {d.note}</>}
                    {d.overrideReason && <> · excepción: {d.overrideReason}</>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Historial de auditoría (inmutable)</h2>
        {audit.map((a) => (
          <div className="audit-line" key={a.id}>
            {new Date(a.createdAt).toLocaleString('es-ES')} · <strong>{a.eventType}</strong> · actor {a.actorId} · hash{' '}
            {a.payloadHash.slice(0, 12)}…
          </div>
        ))}
      </div>
    </>
  );
}
