// The bundled world lists: lookup helpers over the generated registry.
import { LIST_FILES } from "./data/index";
import { LIST_META, type ListPlace, type WorldList, type WorldListId } from "./schema";

export { LIST_META, LIST_IDS } from "./schema";
export type { ListPlace, WorldList, WorldListId } from "./schema";

export const WORLD_LISTS: WorldList[] = LIST_FILES;
const BY_ID = new Map<WorldListId, WorldList>(WORLD_LISTS.map((l) => [l.id, l]));

export interface PlaceWithList extends ListPlace {
  list: WorldListId;
}

let allCache: PlaceWithList[] | null = null;
/** Every place across every list, with its list id. */
export function allListPlaces(): PlaceWithList[] {
  if (!allCache) allCache = WORLD_LISTS.flatMap((l) => l.places.map((p) => ({ ...p, list: l.id })));
  return allCache;
}

let placeIndex: Map<string, PlaceWithList> | null = null;
export function listPlaceById(id: string | null | undefined): PlaceWithList | null {
  if (!id) return null;
  if (!placeIndex) placeIndex = new Map(allListPlaces().map((p) => [p.id, p]));
  return placeIndex.get(id) ?? null;
}

export function worldList(id: WorldListId): WorldList | null {
  return BY_ID.get(id) ?? null;
}

export function listLabel(id: WorldListId): string {
  return LIST_META[id]?.label ?? id;
}

/** The label every list surface carries so it never poses as a friend's tip. */
export const LIST_HONESTY = "From public rankings — not from anyone you know.";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "May–Oct", "Dec–Mar", "All year", or a short list for scattered months. */
export function monthsLabel(months: number[]): string {
  if (!months.length) return "All year";
  const m = [...new Set(months)].sort((a, b) => a - b);
  if (m.length === 12) return "All year";
  // find the longest circular run
  const set = new Set(m);
  let bestStart = m[0], bestLen = 0;
  for (const start of m) {
    let len = 0;
    while (len < 12 && set.has(((start - 1 + len) % 12) + 1)) len++;
    if (len > bestLen) { bestLen = len; bestStart = start; }
  }
  if (bestLen === m.length && bestLen > 1) return `${MONTHS[bestStart - 1]}–${MONTHS[((bestStart - 1 + bestLen - 1) % 12)]}`;
  return m.map((x) => MONTHS[x - 1]).join(", ");
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, dLat = ((bLat - aLat) * Math.PI) / 180, dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Nearest list places to a point, closest first. */
export function listPlacesNear(lat: number, lng: number, maxKm: number, limit = 6, lists?: WorldListId[]): (PlaceWithList & { distanceKm: number })[] {
  const pool = lists?.length ? allListPlaces().filter((p) => lists.includes(p.list)) : allListPlaces();
  return pool
    .map((p) => ({ ...p, distanceKm: haversine(lat, lng, p.lat, p.lng) }))
    .filter((p) => p.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
