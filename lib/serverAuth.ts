// Server-side check that a request comes from a signed-in Waypoint account.
//
// The client sends its Supabase access token as a Bearer header; this asks
// Supabase Auth who the token belongs to. With no Supabase configured the
// app is the keyless demo, where there are no accounts to check — so every
// caller passes as the demo viewer. Nothing here grants data access: it only
// gates routes that spend money on the caller's behalf.

import { createClient } from "@supabase/supabase-js";

export interface ServerSession {
  userId: string;
  demo: boolean;
}

export async function sessionFromRequest(req: Request): Promise<ServerSession | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { userId: "demo", demo: true };
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  try {
    const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return null;
    return { userId: data.user.id, demo: false };
  } catch {
    return null;
  }
}
