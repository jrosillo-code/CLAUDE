// Nearest airfields to a place, from the bundled OurAirports overlay
// (public/overlays/airports.json: large and medium airports only). This is
// a distance, not an airspace check — the brief says so wherever it shows
// one. Loaded once per process, lazily, from disk.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Airfield {
  name: string;
  iata: string;
  big: boolean;
  lat: number;
  lng: number;
}

export interface AirfieldNear extends Airfield {
  distanceKm: number;
  bearingDeg: number;
}

/** Within this distance an airfield is worth a line in the brief. */
export const AIRFIELD_NEAR_KM = 30;

let cached: Airfield[] | null = null;

export function loadAirfields(read: () => string = () => readFileSync(join(process.cwd(), "public", "overlays", "airports.json"), "utf8")): Airfield[] {
  if (cached) return cached;
  try {
    const data = JSON.parse(read()) as { features?: { geometry?: { coordinates?: number[] }; properties?: { name?: string; iata?: string; big?: number } }[] };
    cached = (data.features ?? []).flatMap((f) => {
      const c = f.geometry?.coordinates;
      if (!c || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return [];
      return [{ name: f.properties?.name ?? "Airfield", iata: f.properties?.iata ?? "", big: !!f.properties?.big, lng: c[0], lat: c[1] }];
    });
  } catch {
    cached = [];
  }
  return cached;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function bearing(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const φ1 = (aLat * Math.PI) / 180, φ2 = (bLat * Math.PI) / 180, Δλ = ((bLng - aLng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/** The nearest airfields, closest first: everything within AIRFIELD_NEAR_KM,
 *  and always at least the single nearest one so the line is never empty. */
export function nearestAirfields(lat: number, lng: number, fields: Airfield[] = loadAirfields(), limit = 3): AirfieldNear[] {
  if (!fields.length) return [];
  // A few thousand haversines is cheap; no pre-filter, so the single
  // nearest is found even in the middle of an ocean.
  const scored = fields
    .map((f) => ({ ...f, distanceKm: haversineKm(lat, lng, f.lat, f.lng), bearingDeg: Math.round(bearing(lat, lng, f.lat, f.lng)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  if (!scored.length) return [];
  const near = scored.filter((f) => f.distanceKm <= AIRFIELD_NEAR_KM).slice(0, limit);
  return (near.length ? near : scored.slice(0, 1)).map((f) => ({ ...f, distanceKm: Math.round(f.distanceKm * 10) / 10 }));
}

/** Test hook. */
export function _resetAirfields(): void {
  cached = null;
}
