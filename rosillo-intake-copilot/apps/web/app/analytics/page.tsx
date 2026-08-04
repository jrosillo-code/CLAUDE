import { requireUser, can } from '@/lib/auth';
import { getDb, analyticsOverview } from '@rosillo/database';

export default async function AnalyticsPage() {
  const user = await requireUser();
  if (!can(user, 'analytics.read') && !can(user, 'cases.read_all')) {
    return <p className="notice error">Tu rol no permite acceder a la analítica.</p>;
  }
  const { byStatus, byWorkflow, decisionsByType } = analyticsOverview(getDb());

  const section = (title: string, rows: Array<{ label: string; count: number }>) => (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div className="metric-grid">
        {rows.map((r) => (
          <div className="metric" key={r.label}>
            <div className="value">{r.count}</div>
            <div className="label">{r.label}</div>
          </div>
        ))}
        {rows.length === 0 && <p className="muted">Sin datos todavía.</p>}
      </div>
    </div>
  );

  return (
    <>
      <h1>Analítica operativa (datos sintéticos)</h1>
      {section('Casos por estado', byStatus.map((r) => ({ label: r.status, count: r.count })))}
      {section('Casos por workflow', byWorkflow.map((r) => ({ label: r.workflow, count: r.count })))}
      {section('Decisiones por tipo', decisionsByType.map((r) => ({ label: r.decisionType, count: r.count })))}
    </>
  );
}
