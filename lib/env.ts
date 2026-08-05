// Startup environment validation. Runs once when lib/supabase.ts builds the
// client (browser and server both import it). The rules protect the preview
// deployment story:
//
//   1. NEXT_PUBLIC_SUPABASE_URL must be an http(s) URL.
//   2. The anon key must actually be an ANON key. A service-role key in a
//      NEXT_PUBLIC_* var would ship god-mode credentials to every browser —
//      if the JWT's role claim says "service_role", the backend REFUSES to
//      start rather than run wide open.
//
// Failures never crash the app: it falls back to the seeded demo world and
// says why in the console.

export interface EnvCheck {
  ok: boolean;
  reason?: string;
}

/** Decode a JWT payload without verifying — enough to read the role claim.
 *  Works in browsers (atob) and Node (Buffer) alike. */
function jwtRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const text =
      typeof atob === "function"
        ? atob(b64)
        : Buffer.from(b64, "base64").toString("utf8");
    const json = JSON.parse(text) as { role?: string };
    return json.role ?? null;
  } catch {
    return null;
  }
}

export function validateSupabaseEnv(url: string, anonKey: string): EnvCheck {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { ok: false, reason: `NEXT_PUBLIC_SUPABASE_URL has protocol ${parsed.protocol}` };
    }
  } catch {
    return { ok: false, reason: "NEXT_PUBLIC_SUPABASE_URL is not a valid URL" };
  }

  const role = jwtRole(anonKey);
  if (role === "service_role") {
    return {
      ok: false,
      reason:
        "NEXT_PUBLIC_SUPABASE_ANON_KEY is a SERVICE ROLE key — it bypasses RLS and must never " +
        "reach a browser. Use the anon (public) key; keep the service key server-side only.",
    };
  }
  return { ok: true };
}

/** Debug breadcrumbs (realtime status etc.) stay out of production builds. */
export const debugLoggingEnabled =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEBUG === "1";

/** Preview deployments carry a synthetic-data banner and a noindex flag. */
export const isPreviewEnv = process.env.NEXT_PUBLIC_PREVIEW === "1";
