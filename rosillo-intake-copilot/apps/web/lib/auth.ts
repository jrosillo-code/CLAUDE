import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hasPermission, type Role } from '@rosillo/domain';
import { getDb, getUserById, getUserByEmail } from '@rosillo/database';

/**
 * Prototype-only synthetic authentication (ADR-0004): seeded users, shared demo
 * password, HMAC-signed httpOnly cookie. Roles are re-read from the database on
 * every request; all permission checks stay server-side.
 */

const COOKIE = 'rosillo_session';
const DEMO_PASSWORD = 'demo';
const secret = () => process.env.AUTH_SECRET ?? 'dev-only-secret-change-me';

const sign = (value: string) => createHmac('sha256', secret()).update(value).digest('hex');

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export async function login(email: string, password: string): Promise<string | null> {
  if (password !== DEMO_PASSWORD) return 'Credenciales no válidas.';
  const user = getUserByEmail(getDb(), email);
  if (!user || user.status !== 'ACTIVE') return 'Credenciales no válidas.';
  const store = await cookies();
  store.set(COOKIE, `${user.id}.${sign(user.id)}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return null;
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const userId = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const expected = sign(userId);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'))
  ) {
    return null;
  }
  const user = getUserById(getDb(), userId);
  if (!user || user.status !== 'ACTIVE') return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role as Role };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export function can(user: SessionUser, permission: string): boolean {
  return hasPermission(user.role, permission);
}

/** Operators may open unassigned cases (to claim them) or their own; supervisors/admins see all. */
export function canViewCase(user: SessionUser, assigneeId: string | null): boolean {
  if (can(user, 'cases.read_all')) return true;
  return assigneeId === null || assigneeId === user.id;
}
