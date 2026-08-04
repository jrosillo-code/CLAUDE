import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getDb, listCases } from '@rosillo/database';
import { WORKFLOW_TYPES, CASE_STATUSES } from '@rosillo/domain';

const WORKFLOW_LABELS: Record<string, string> = {
  MOTOR_CLAIM: 'Siniestro auto',
  POLICY_CANCELLATION: 'Baja de póliza',
  POLICY_AMENDMENT: 'Modificación',
  QUOTE_REQUEST: 'Presupuesto',
  RENEWAL_QUESTION: 'Renovación',
  MISSING_DOCUMENT_FOLLOWUP: 'Docs. pendientes',
  UNKNOWN: 'Sin clasificar',
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; workflow?: string; assignee?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const filter: { status?: string; workflow?: string; assigneeId?: string } = {};
  if (params.status && (CASE_STATUSES as readonly string[]).includes(params.status)) filter.status = params.status;
  if (params.workflow && (WORKFLOW_TYPES as readonly string[]).includes(params.workflow)) filter.workflow = params.workflow;
  if (params.assignee === 'me') filter.assigneeId = user.id;

  const rows = await listCases(await getDb(), filter);

  return (
    <>
      <h1>{params.assignee === 'me' ? 'Mis casos' : 'Bandeja de entrada'}</h1>
      <div className="card">
        <form className="filters" method="get">
          {params.assignee === 'me' && <input type="hidden" name="assignee" value="me" />}
          <label>
            Estado
            <select name="status" defaultValue={params.status ?? ''}>
              <option value="">Todos</option>
              {CASE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Workflow
            <select name="workflow" defaultValue={params.workflow ?? ''}>
              <option value="">Todos</option>
              {WORKFLOW_TYPES.map((w) => (
                <option key={w} value={w}>{WORKFLOW_LABELS[w]}</option>
              ))}
            </select>
          </label>
          <button type="submit">Filtrar</button>
        </form>

        <table>
          <caption>
            {rows.length} caso(s) sintético(s). El análisis de IA solo se ejecuta cuando un empleado lo solicita.
          </caption>
          <thead>
            <tr>
              <th scope="col">Estado</th>
              <th scope="col">Prioridad</th>
              <th scope="col">Workflow</th>
              <th scope="col">Asunto</th>
              <th scope="col">Remitente</th>
              <th scope="col">Adjuntos</th>
              <th scope="col">Recibido</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.caseRow.id}>
                <td>
                  <span className={`badge status-${r.caseRow.status}`}>{r.caseRow.status}</span>
                </td>
                <td>
                  <span className={`badge prio-${r.caseRow.priority}`}>{r.caseRow.priority}</span>
                </td>
                <td>{r.caseRow.workflow === 'UNKNOWN' && r.caseRow.status === 'NEW' ? '—' : WORKFLOW_LABELS[r.caseRow.workflow]}</td>
                <td>
                  <Link href={`/cases/${r.caseRow.id}`}>{r.subject}</Link>
                </td>
                <td>{r.sender}</td>
                <td>{r.attachmentCount}</td>
                <td>{new Date(r.receivedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No hay casos con estos filtros. ¿Se ha ejecutado <code>npm run db:seed</code>?
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
