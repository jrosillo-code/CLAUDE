import { redirect } from 'next/navigation';
import { login, getCurrentUser } from '@/lib/auth';
import { getDb, listUsers } from '@rosillo/database';

async function loginAction(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const error = await login(email, password);
  if (error) redirect(`/login?error=${encodeURIComponent(error)}`);
  redirect('/');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect('/');
  const { error } = await searchParams;
  const users = await listUsers(await getDb());

  return (
    <div className="card" style={{ maxWidth: 460, margin: '40px auto' }}>
      <h1>Acceso de empleados (sintético)</h1>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <form action={loginAction} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          Usuario sintético
          <br />
          <select name="email" required style={{ width: '100%' }}>
            {users.map((u) => (
              <option key={u.id} value={u.email}>
                {u.name} — {u.role} ({u.email})
              </option>
            ))}
          </select>
        </label>
        <label>
          Contraseña (prototipo: <code>demo</code>)
          <br />
          <input type="password" name="password" required autoComplete="current-password" style={{ width: '100%' }} />
        </label>
        <button type="submit" className="primary">
          Entrar
        </button>
      </form>
      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
        Autenticación simplificada de desarrollo (ADR-0004). Un piloto real requeriría el proveedor de identidad corporativo.
      </p>
    </div>
  );
}
