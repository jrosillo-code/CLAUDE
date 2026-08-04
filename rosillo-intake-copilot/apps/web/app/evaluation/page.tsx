import { join } from 'node:path';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser, can } from '@/lib/auth';
import { createProvider, runEvaluation, type EvaluationResult } from '@rosillo/ai';
import { findRepoRoot } from '@rosillo/domain';

/** Latest in-process evaluation result (also written to evaluation-reports/ by the CLI). */
const store = globalThis as unknown as { __rosilloEval?: { runAt: string; result: EvaluationResult } };

async function runEvaluationAction() {
  'use server';
  const user = await requireUser();
  if (!can(user, 'evaluations.run') && !can(user, 'cases.read_all')) redirect('/evaluation');
  const result = await runEvaluation(createProvider(), join(findRepoRoot(), 'fixtures'));
  store.__rosilloEval = { runAt: new Date().toISOString(), result };
  revalidatePath('/evaluation');
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default async function EvaluationPage() {
  const user = await requireUser();
  if (!can(user, 'evaluations.run') && !can(user, 'cases.read_all') && !can(user, 'analytics.read')) {
    return <p className="notice error">Tu rol no permite acceder a la evaluación.</p>;
  }
  const current = store.__rosilloEval;

  return (
    <>
      <h1>Evaluación sobre casos sintéticos etiquetados</h1>
      <div className="card">
        <form action={runEvaluationAction}>
          <button type="submit" className="primary">Ejecutar evaluación</button>{' '}
          <span className="muted">Compara la salida del pipeline con las etiquetas esperadas de los 12 casos.</span>
        </form>
      </div>

      {current && (
        <>
          <div className="card">
            <p className="muted">
              Ejecutada: {new Date(current.runAt).toLocaleString('es-ES')} · proveedor {current.result.provider} (
              {current.result.model}) · reglas {current.result.rulesVersion}
            </p>
            <div className="metric-grid">
              {(
                [
                  ['Validez de esquema', current.result.metrics.schemaValidity, '≥ 98%'],
                  ['Precisión de workflow', current.result.metrics.workflowAccuracy, '≥ 90%'],
                  ['Recall info. faltante', current.result.metrics.missingInfoRecall, '≥ 85%'],
                  ['Precisión info. faltante', current.result.metrics.missingInfoPrecision, '—'],
                  ['Recall campos explícitos', current.result.metrics.explicitFieldRecall, '≥ 90%'],
                  ['Top-1 póliza', current.result.metrics.candidatePolicyTop1, '≥ 90%'],
                  ['Top-1 cliente', current.result.metrics.candidateCustomerTop1, '≥ 90%'],
                  ['Precisión de acción', current.result.metrics.actionAccuracy, '—'],
                  ['Cumpl. acciones prohibidas', current.result.metrics.prohibitedActionCompliance, '100%'],
                ] as Array<[string, number, string]>
              ).map(([label, value, target]) => (
                <div className="metric" key={label}>
                  <div className="value">{pct(value)}</div>
                  <div className="label">
                    {label} · objetivo {target}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Detalle por caso</h2>
            <table>
              <thead>
                <tr>
                  <th>Caso</th>
                  <th>Workflow esperado</th>
                  <th>Workflow observado</th>
                  <th>Acción</th>
                  <th>Faltantes no detectados</th>
                </tr>
              </thead>
              <tbody>
                {current.result.cases.map((c) => (
                  <tr key={c.caseId}>
                    <td>{c.caseId}</td>
                    <td>{c.expectedWorkflow}</td>
                    <td>
                      {c.actualWorkflow ?? '—'}{' '}
                      {c.workflowCorrect ? (
                        <span className="badge explicit">OK</span>
                      ) : (
                        <span className="badge status-ERROR">KO</span>
                      )}
                    </td>
                    <td>{c.actionActual ?? '—'}</td>
                    <td className="muted">
                      {c.missingInfoExpected.filter((k) => !c.missingInfoFound.includes(k)).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!current && <p className="muted">Todavía no se ha ejecutado ninguna evaluación en esta sesión del servidor. También puede ejecutarse con <code>npm run evaluate</code>.</p>}
    </>
  );
}
