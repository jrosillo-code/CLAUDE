"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateSupabaseEnv } from "./env";

// One browser client, created only when the env is configured AND valid.
// Every feature works without it (in-memory demo world); with it, auth +
// data + storage go live. `backendEnabled` is the single switch the rest of
// the app checks. Validation refuses to start the backend on a malformed
// URL or — critically — a service-role key in the public env, which would
// hand RLS-bypassing credentials to every visitor.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Captured at module load, BEFORE the client is built, because supabase-js
// strips the recovery fragment out of the URL as soon as it processes it —
// and it does that before React has mounted. Waiting to look from inside a
// component finds nothing. Listening for the PASSWORD_RECOVERY event is not
// enough either: it fires during client initialisation, which is over before
// the store gets a chance to subscribe, so the reset link just opened the app
// and quietly changed nothing.
export const arrivedForPasswordRecovery =
  typeof window !== "undefined" &&
  (/[#&]type=recovery/.test(window.location.hash) ||
    new URLSearchParams(window.location.search).get("type") === "recovery");

/**
 * Why an email link failed, if it did — read from the URL for the same reason
 * as above: supabase-js clears the fragment during initialisation.
 *
 * Supabase reports a dead link by bouncing back with `error` and
 * `error_description` on the URL. Nothing read them, so an expired or
 * already-used reset link just opened the login screen with no explanation,
 * which is indistinguishable from the link doing nothing at all.
 */
export const authLinkError: string | null = (() => {
  if (typeof window === "undefined") return null;
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const fromQuery = new URLSearchParams(window.location.search);
  const code = fromHash.get("error_code") ?? fromQuery.get("error_code");
  const desc =
    fromHash.get("error_description") ??
    fromQuery.get("error_description") ??
    fromHash.get("error") ??
    fromQuery.get("error");
  if (!desc) return null;
  const text = desc.replace(/\+/g, " ");
  if (/expired/i.test(text) || code === "otp_expired") {
    return "That link has expired — reset links are single-use and short-lived. Request a new one below.";
  }
  return text;
})();

function build(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  const check = validateSupabaseEnv(url, anonKey);
  if (!check.ok) {
    console.error(`[waypoint] backend disabled — ${check.reason}`);
    return null;
  }
  return createClient(url, anonKey);
}

export const supabase: SupabaseClient | null = build();

export const backendEnabled = !!supabase;
