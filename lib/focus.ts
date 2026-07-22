// Country focus: find which country a coordinate is in (using the bundled
// country geometry — works fully offline) and return bounds that frame it.
// Longitudes are normalized around the query point so countries crossing the
// antimeridian (Fiji, Russia, New Zealand) frame correctly instead of
// spanning the whole world.

interface CountryFeature {
  properties?: { name?: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

interface CountryCollection {
  features: CountryFeature[];
}

export interface CountryFocus {
  name: string;
  w: number;
  s: number;
  e: number;
  n: number;
}

let countriesCache: CountryCollection | null = null;

async function loadCountries(): Promise<CountryCollection | null> {
  if (countriesCache) return countriesCache;
  try {
    const res = await fetch("/geo/countries-110m.json");
    if (!res.ok) return null;
    countriesCache = (await res.json()) as CountryCollection;
    return countriesCache;
  } catch {
    return null;
  }
}

/** Shift lng by whole turns until it's within 180° of ref. */
function wrapNear(lng: number, ref: number): number {
  let x = lng;
  while (x - ref > 180) x -= 360;
  while (x - ref < -180) x += 360;
  return x;
}

/** Ray-casting point-in-ring, wrap-aware around the test point's longitude. */
function inRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = wrapNear(ring[i][0], lng);
    const yi = ring[i][1];
    const xj = wrapNear(ring[j][0], lng);
    const yj = ring[j][1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonsOf(f: CountryFeature): number[][][][] {
  return f.geometry.type === "Polygon"
    ? [f.geometry.coordinates as number[][][]]
    : (f.geometry.coordinates as number[][][][]);
}

/** Wrap-aware bbox of a feature, normalized around `refLng`. */
function bboxOf(f: CountryFeature, refLng: number): { w: number; s: number; e: number; n: number } {
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const poly of polygonsOf(f)) {
    for (const pt of poly[0]) {
      const x = wrapNear(pt[0], refLng);
      w = Math.min(w, x);
      e = Math.max(e, x);
      s = Math.min(s, pt[1]);
      n = Math.max(n, pt[1]);
    }
  }
  return { w, s, e, n };
}

/**
 * The country containing (lng, lat), or null. When several match (enclaves —
 * standing in Lesotho also ray-casts inside South Africa's outer ring), the
 * smallest matching country wins.
 */
export async function findCountryAt(lng: number, lat: number): Promise<CountryFocus | null> {
  const fc = await loadCountries();
  if (!fc) return null;

  let best: { f: CountryFeature; area: number } | null = null;
  for (const f of fc.features) {
    const hit = polygonsOf(f).some((poly) => inRing(lng, lat, poly[0]));
    if (!hit) continue;
    const b = bboxOf(f, lng);
    const area = (b.e - b.w) * (b.n - b.s);
    if (!best || area < best.area) best = { f, area };
  }
  if (!best) return null;
  const b = bboxOf(best.f, lng);
  return { name: best.f.properties?.name ?? "your country", ...b };
}
