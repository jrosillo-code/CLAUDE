import { NextResponse } from "next/server";
import { assembleBrief, type NearbySummary } from "@/lib/fieldbrief/assemble";
import { narrativeFor } from "@/lib/fieldbrief/narrative";

// POST { lat, lng, date, countryCode?, nearby? } → the field brief.
// Legality comes from curated country files, light from math, wind from
// Open-Meteo; the viewer's nearby scouting is computed on the client from the
// store (already RLS-scoped in live mode) and echoed back. With
// ANTHROPIC_API_KEY set, a narrative rewrites the assembled JSON — never adds
// to it. source: "ai" | "live".

export const maxDuration = 30;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  let body: { lat?: number; lng?: number; date?: string; countryCode?: string; nearby?: NearbySummary };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }
  const date = typeof body.date === "string" && ISO_DATE.test(body.date) && !Number.isNaN(Date.parse(body.date)) ? body.date : new Date().toISOString().slice(0, 10);
  let countryCode = typeof body.countryCode === "string" && /^[A-Za-z]{2}$/.test(body.countryCode) ? body.countryCode.toUpperCase() : null;
  if (!countryCode) countryCode = await reverseCountry(lat, lng);

  const brief = await assembleBrief({ lat, lng, date, countryCode, nearby: body.nearby });
  const narrative = await narrativeFor(brief);
  return NextResponse.json(narrative ? { ...brief, source: "ai", narrative } : brief);
}

// Reverse geocode to a country code (Nominatim, keyless), cached an hour.
const ccCache = new Map<string, { at: number; cc: string | null }>();
async function reverseCountry(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = ccCache.get(key);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.cc;
  let cc: string | null = null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=3&lat=${lat}&lon=${lng}`,
      { signal: AbortSignal.timeout(4000), headers: { "User-Agent": "Waypoint field brief (demo)", "Accept-Language": "en" } }
    );
    if (res.ok) {
      const data = (await res.json()) as { address?: { country_code?: string } };
      const c = data.address?.country_code?.toUpperCase();
      if (c && /^[A-Z]{2}$/.test(c)) cc = c;
    }
  } catch {
    /* no country: the brief renders "not yet covered" */
  }
  ccCache.set(key, { at: Date.now(), cc });
  if (ccCache.size > 500) ccCache.delete(ccCache.keys().next().value!);
  return cc;
}
