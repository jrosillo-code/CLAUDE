import { requireUser, can } from '@/lib/auth';
import { getDb, listUsers } from '@rosillo/database';
import { createProvider, promptRegistry } from '@rosillo/ai';
import { listRules } from '@rosillo/domain';

export default async function AdminPage() {
  const user = await requireUser();
  if (!can(user, 'prompts.manage')) {
    return <p className="notice error">Solo el rol de administración puede acceder a esta página.</p>;
  }

  const users = await listUsers(await getDb());
  const provider = createProvider();
  const health = await provider.healthCheck();
  const rules = listRules();

  return (
    <>
      <h1>Administración</h1>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Proveedor de IA</h2>
        <p>
          Configurado: <strong>{provider.name}</strong> ({provider.model}) ·{' '}
          {health.ok ? <span className="badge explicit">operativo</span> : <span className="badge status-ERROR">no disponible</span>}
        </p>
        <p className="muted">
          Se cambia con la variable de entorno <code>AI_PROVIDER</code> (mock | anthropic). Las claves de API nunca llegan al
          navegador.
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Versiones de prompt</h2>
        <table>
          <thead>
            <tr><th>Prompt</th><th>Versión activa</th></tr>
          </thead>
          <tbody>
            {Object.entries(promptRegistry.currentVersions()).map(([name, version]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{version}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Cada análisis registra las versiones exactas utilizadas (auditable en cada ejecución).</p>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Reglas deterministas de información faltante ({rules.length})</h2>
        <table>
          <thead>
            <tr><th>Regla</th><th>Workflow</th></tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.workflow}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Usuarios sintéticos</h2>
        <table>
          <thead>
            <tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
