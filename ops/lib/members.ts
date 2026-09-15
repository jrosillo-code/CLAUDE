import { createHash } from "node:crypto";
import type { Firm, Membership } from "./types";
import type { Store } from "./store";
import { SupabaseStore } from "./supabase-store";
import { log } from "./audit";
import { EMAIL } from "./claims";

// The firm's team, managed from the app by its owner. In Supabase mode an
// invitation creates the auth user (or finds it) and sends the sign-in link;
// the membership row is what grants access, and RLS reads it. Keyless mode
// derives a stable id from the email so the flow can be exercised.

export interface Member extends Membership { email: string | null }

export async function listMembers(store: Store, firmId: string): Promise<Member[]> {
  const rows = await store.memberships.listByFirm(firmId);
  const out: Member[] = [];
  for (const m of rows) {
    let email: string | null = null;
    if (store instanceof SupabaseStore) {
      const r = await store.db.auth.admin.getUserById(m.userId);
      email = r.data.user?.email ?? null;
    } else if (m.userId.startsWith("demo:")) {
      email = m.userId.slice(5);
    }
    out.push({ ...m, email });
  }
  return out.sort((a, b) => (a.role === b.role ? (a.email ?? "").localeCompare(b.email ?? "") : a.role === "owner" ? -1 : 1));
}

async function resolveUserId(store: Store, email: string, redirectTo: string | null): Promise<{ userId: string; invited: boolean }> {
  if (!(store instanceof SupabaseStore)) return { userId: `demo:${email}`, invited: false };
  const admin = store.db.auth.admin;
  const inv = await admin.inviteUserByEmail(email, redirectTo ? { redirectTo } : undefined);
  if (!inv.error && inv.data.user) return { userId: inv.data.user.id, invited: true };
  // Already registered: find the user by email (paged; fine for a firm-sized directory).
  for (let page = 1; page <= 20; page++) {
    const r = await admin.listUsers({ page, perPage: 200 });
    if (r.error) throw new Error(r.error.message);
    const u = r.data.users.find((x) => (x.email ?? "").toLowerCase() === email);
    if (u) return { userId: u.id, invited: false };
    if (r.data.users.length < 200) break;
  }
  throw new Error(inv.error?.message ?? "No se pudo invitar al usuario");
}

export interface InviteInput { firm: Firm; email: string; role: Membership["role"]; actorId: string; redirectTo?: string | null }

export async function inviteMember(store: Store, input: InviteInput): Promise<{ member: Member; invited: boolean }> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new Error("Indica un correo válido");
  if (input.role !== "owner" && input.role !== "staff") throw new Error("El rol debe ser owner o staff");
  const { userId, invited } = await resolveUserId(store, email, input.redirectTo ?? null);
  if (await store.memberships.isMember(input.firm.id, userId)) throw new Error("Esa persona ya pertenece al despacho");
  await store.memberships.add({ firmId: input.firm.id, userId, role: input.role });
  await log(store, { firmId: input.firm.id, action: "member.added", entity: { type: "membership", id: userId }, actor: { type: "user", id: input.actorId }, detail: { emailHash: createHash("sha256").update(email).digest("hex").slice(0, 16), role: input.role, invited } });
  return { member: { firmId: input.firm.id, userId, role: input.role, email }, invited };
}

/** Owners manage the team; the machine key may too. */
export async function canManage(store: Store, firmId: string, userId: string, viaKey: boolean): Promise<boolean> {
  if (viaKey) return true;
  return (await store.memberships.roleOf(firmId, userId)) === "owner";
}
