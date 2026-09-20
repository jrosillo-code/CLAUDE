// The constellation's stars: real coastline vertices from the bundled world
// atlas, sampled once and shared by the profile backdrop and the share card.

export interface Star {
  lng: number;
  lat: number;
  phase: number;
  bright: boolean;
  ring: number; // ring id — segments only connect within a ring
  idx: number;
}

export interface AmbientStar {
  x: number; // 0..1 of canvas
  y: number;
  phase: number;
  r: number;
}

let starCache: Star[] | null = null;

/** Warm the geo fetch + star sampling ahead of time (called from the map page
 *  during idle) so the Me page paints its backdrop instantly. */
export function preloadStars(): void {
  void loadStars().catch(() => {});
}

export async function loadStars(): Promise<Star[]> {
  if (starCache) return starCache;
  const res = await fetch("/geo/countries-110m.json");
  const geo = await res.json();
  return (starCache = starsFromGeo(geo));
}

/** Pure: sample stars from a parsed countries GeoJSON (tests and node). */
export function starsFromGeo(geo: { features?: { geometry?: { type?: string; coordinates?: unknown } }[] }): Star[] {
  const stars: Star[] = [];
  let ring = 0;
  for (const f of geo.features ?? []) {
    const polys =
      f.geometry?.type === "MultiPolygon"
        ? (f.geometry.coordinates as [number, number][][][])
        : f.geometry?.type === "Polygon"
          ? [f.geometry.coordinates as [number, number][][]]
          : [];
    for (const poly of polys) {
      const outer: [number, number][] = poly[0] ?? [];
      ring++;
      // Sample density tuned for ~1400 stars worldwide.
      const step = Math.max(1, Math.round(outer.length / Math.max(6, outer.length / 7)));
      let idx = 0;
      for (let i = 0; i < outer.length; i += step) {
        const [lng, lat] = outer[i];
        stars.push({
          lng,
          lat,
          phase: ((lng * 7919 + lat * 104729) % 6.28318 + 6.28318) % 6.28318,
          bright: stars.length % 23 === 0, // slightly larger, still ink
          ring,
          idx: idx++,
        });
      }
    }
  }
  return stars;
}
