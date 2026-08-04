import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { getCurrentUser, logout, can } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Rosillo Intake Copilot',
  description: 'Prototipo interno con datos sintéticos — clasificación y triaje de comunicaciones de seguros.',
};

async function logoutAction() {
  'use server';
  await logout();
  redirect('/login');
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="es">
      <body>
        <div className="synthetic-banner" role="note">
          ENTORNO DE DATOS SINTÉTICOS — prohibido introducir datos reales de clientes. Este prototipo no envía correos ni ejecuta acciones externas.
        </div>
        <header className="top-nav">
          <Link href="/" className="brand">Rosillo Intake Copilot</Link>
          {user && (
            <nav aria-label="Navegación principal">
              <Link href="/">Bandeja de entrada</Link>
              <Link href="/?assignee=me">Mis casos</Link>
              {can(user, 'analytics.read') && <Link href="/analytics">Analítica</Link>}
              {(can(user, 'evaluations.run') || can(user, 'cases.read_all')) && <Link href="/evaluation">Evaluación</Link>}
              {can(user, 'prompts.manage') && <Link href="/admin">Administración</Link>}
            </nav>
          )}
          {user && (
            <div className="user">
              <span>
                {user.name} · <strong>{user.role}</strong>
              </span>
              <form action={logoutAction}>
                <button type="submit">Salir</button>
              </form>
            </div>
          )}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
