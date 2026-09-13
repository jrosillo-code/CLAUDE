import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Store } from "./store";
import type { Firm } from "./types";
import { supabaseUrl, supabaseAnonKey } from "./env";

// Member sessions. The browser holds a Supabase Auth session in cookies; the
// server rebuilds a client from them per request. Reads made with that client
// are subject to RLS, which is the point: a member sees their firm and nothing
// else, enforced by the database rather than by this code.

export function supabaseAuthConfigured(): boolean {
  return !!(supabaseUrl() && supabaseAnonKey());
}

export async function createUserClient(): Promise<SupabaseClient | null> {
  if (!supabaseAuthConfigured()) return null;
  const store = await cookies();
  return createServerClient(supabaseUrl()!, supabaseAnonKey()!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // Server components cannot set cookies; route handlers can. Refreshed
        // tokens are written when a route handler runs, which is fine.
        try { for (const c of list) store.set(c.name, c.value, { ...c.options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" }); } catch { /* read-only context */ }
      },
    },
  });
}

export interface SessionUser { id: string; email: string | null }

export async function getSessionUser(): Promise<SessionUser | null> {
  const client = await createUserClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

export async function firmsForUser(store: Store, user: SessionUser): Promise<Firm[]> {
  return store.memberships.firmsFor(user.id);
}
