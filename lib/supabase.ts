"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// One browser client, created only when the env is configured. Every feature
// works without it (in-memory demo world); with it, auth + data + storage go
// live. `backendEnabled` is the single switch the rest of the app checks.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const backendEnabled = !!supabase;
