// GeoJSON sources for the map's symbol layers: the world lists (built
// lazily from whatever lists are on the device, invalidated when they
// arrive) and the landmarks (static).

import { allListPlaces } from "@/lib/lists";
import { LANDMARKS } from "@/lib/landmarks";

// Every world-list place in one source; the layer's filter picks the lists
// that are switched on (plus anything saved, when Saved is on).
let listsFCCache: GeoJSON.FeatureCollection | null = null;
export function listsFC(): GeoJSON.FeatureCollection {
  if (!listsFCCache) {
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
