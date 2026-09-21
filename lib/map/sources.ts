// GeoJSON sources for the map's symbol layers: the world lists (built
// lazily from whatever lists are on the device, invalidated when they
// arrive) and the landmarks (static).

import { allListPlaces, worldLists } from "@/lib/lists";
import { LANDMARKS } from "@/lib/landmarks";

// Every world-list place in one source; the layer's filter picks the lists
// that are switched on (plus anything saved, when Saved is on).
// Cached per lists snapshot: primeWorldLists() installs a new array, so a
// collection built while the lists were still empty is never served again.
let listsFCCache: GeoJSON.FeatureCollection | null = null;
let listsFCFor: unknown = null;
export function listsFC(): GeoJSON.FeatureCollection {
  const current = worldLists();
  if (!listsFCCache || listsFCFor !== current) {
    listsFCFor = current;
    listsFCCache = {
      type: "FeatureCollection",
      features: allListPlaces().map((p) => ({
        type: "Feature",
        properties: { id: p.id, list: p.list, name: p.name },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      })),
    };
  }
  return listsFCCache;
}

export const landmarksFC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: LANDMARKS.map((lm) => ({
    type: "Feature",
    properties: { id: lm.id, category: lm.category },
    geometry: { type: "Point", coordinates: [lm.lng, lm.lat] },
  })),
};

/** Forget the built collection (the lists just loaded). */
export function invalidateListsFC(): void {
  listsFCCache = null;
}
