import { createClient } from "@supabase/supabase-js";
import { seedFieldReports, users as seedUsers } from "@/lib/seed";
import type { ReportOutcome } from "@/lib/types";

// Public field reports for a country, for the server-rendered /fly pages.
// Live: an anonymous query — RLS lets anon read only `visibility = 'public'`
// rows, so nothing else can leak here. Demo: the seeded public reports.

export interface PublicReport {
  id: string;
  quote: string;
  ownerHandle: string;
  flownOn: string;
  outcome: ReportOutcome;
  droneClass: string;
}

export async function publicReportsFor(countryCode: string): Promise<PublicReport[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      const sb = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await sb
        .from("field_reports")
        .select("id, quote, flown_on, outcome, drone_class, users(handle)")
        .eq("country_code", countryCode)
        .eq("visibility", "public")
        .eq("status", "complete")
        .order("flown_on", { ascending: false })
        .limit(50);
      if (error) throw error;
      return ((data ?? []) as unknown as { id: string; quote: string; flown_on: string; outcome: ReportOutcome; drone_class: string; users: { handle: string } | { handle: string }[] | null }[]).map((r) => ({
        id: r.id,
        quote: r.quote,
        ownerHandle: Array.isArray(r.users) ? r.users[0]?.handle ?? "pilot" : r.users?.handle ?? "pilot",
        flownOn: r.flown_on,
        outcome: r.outcome,
        droneClass: r.drone_class ?? "",
      }));
    } catch (e) {
      console.error("fly page: field reports query failed", e);
      return [];
    }
  }
  const handles = new Map(seedUsers.map((u) => [u.id, u.handle]));
  return seedFieldReports
    .filter((r) => r.countryCode === countryCode && r.visibility === "public" && r.status === "complete")
    .sort((a, b) => b.flownOn.localeCompare(a.flownOn))
    .map((r) => ({ id: r.id, quote: r.quote, ownerHandle: handles.get(r.userId) ?? "pilot", flownOn: r.flownOn, outcome: r.outcome, droneClass: r.droneClass }));
}
