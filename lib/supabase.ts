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
