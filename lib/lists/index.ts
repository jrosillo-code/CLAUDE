// The world lists: lookup helpers over places that arrive on demand.
//
// The ten list files weigh about a megabyte. They used to be bundled into
// the map page for every visit; now they sit under public/lists and are
// fetched the first time anything asks for them — a list toggled on, the
// Top spots browser opened. Until then every helper here answers with
// nothing, and the components re-render when the places land.

import { LIST_IDS, LIST_META, type ListPlace, type WorldList, type WorldListId } from "./schema";
import { useSyncExternalStore } from "react";

export { LIST_META, LIST_IDS } from "./schema";
export type { ListPlace, WorldList, WorldListId } from "./schema";

let lists: WorldList[] = [];
let byId = new Map<WorldListId, WorldList>();
let allCache: PlaceWithList[] | null = null;
let placeIndex: Map<string, PlaceWithList> | null = null;
let loading: Promise<WorldList[]> | null = null;
const listeners = new Set<() => void>();

export interface PlaceWithList extends ListPlace {
  list: WorldListId;
}

/** Install the lists (tests and the validator pass the files directly). */
export function primeWorldLists(next: WorldList[]): void {
  lists = next.slice().sort((a, b) => LIST_IDS.indexOf(a.id) - LIST_IDS.indexOf(b.id));
  byId = new Map(lists.map((l) => [l.id, l]));
  allCache = null;
  placeIndex = null;
  for (const l of listeners) l();
}

/** Fetch every list file once; resolves with whatever loaded. */
export function loadWorldLists(): Promise<WorldList[]> {
  if (lists.length) return Promise.resolve(lists);
  if (typeof window === "undefined") return Promise.resolve(lists);
  if (!loading) {
    loading = Promise.all(
      LIST_IDS.map((id) =>
        fetch(`/lists/${id}.json`)
          .then((r) => (r.ok ? (r.json() as Promise<WorldList>) : null))
          .catch(() => null)
      )
    ).then((got) => {
      const ok = got.filter((l): l is WorldList => !!l && Array.isArray(l.places));
      if (ok.length) primeWorldLists(ok);
      else loading = null; // nothing arrived: allow a retry later
      return lists;
    });
  }
  return loading;
}

/** Whether the lists are on this device yet. */
export function worldListsReady(): boolean {
  return lists.length > 0;
}

/** Current snapshot; empty until loaded. */
export function worldLists(): WorldList[] {
  return lists;
}

/** React: the lists, starting the fetch on first use and re-rendering when
 *  they arrive. */
export function useWorldLists(): WorldList[] {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lists,
    () => lists
  );
  if (!snapshot.length && typeof window !== "undefined") void loadWorldLists();
  return snapshot;
}

/** Every place across every list, with its list id. */
export function allListPlaces(): PlaceWithList[] {
  if (!allCache) allCache = lists.flatMap((l) => l.places.map((p) => ({ ...p, list: l.id })));
  return allCache;
}

export function listPlaceById(id: string | null | undefined): PlaceWithList | null {
  if (!id) return null;
  if (!placeIndex) placeIndex = new Map(allListPlaces().map((p) => [p.id, p]));
  return placeIndex.get(id) ?? null;
}

export function worldList(id: WorldListId): WorldList | null {
  return byId.get(id) ?? null;
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
