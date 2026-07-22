// Geocoding behind one swappable module (plan §3). Search fans out to two
// engines in parallel — Photon (typo-tolerant autocomplete built for
// search-as-you-type) and Nominatim (exhaustive OSM coverage) — then merges,
// dedupes and ranks so results behave like Apple/Google Maps: the city named
// "lisbon" beats the six streets also called Lisbon, and nothing appears twice.

export interface GeoResult {
  placeName: string;
  /** Secondary line: region + country ("Alentejo, Portugal"). */
  context: string;
  countryCode: string;
  lng: number;
  lat: number;
  /** Broad kind, drives the result icon: place | poi | address. */
  kind: "place" | "poi" | "address";
}

const NOMINATIM = "https://nominatim.openstreetmap.org";
const PHOTON = "https://photon.komoot.io";
// Optional free-tier key (geoapify.com — 3,000 req/day, no card). When set,
// Geoapify's autocomplete leads the results; the keyless engines still run
// and fill any gaps.
const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;

/** Forward search: free-text place query → ranked candidate locations. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [geoapify, photon, nominatim] = await Promise.all([
    GEOAPIFY_KEY ? geoapifySearch(q, signal) : Promise.resolve([]),
    photonSearch(q, signal),
    nominatimSearch(q, signal),
  ]);

  // Merge with dedupe: same OSM object, or same name within ~1.5 km.
  const merged: (GeoResult & { dedupe: string })[] = [];
  const isDupe = (r: GeoResult & { dedupe: string }) =>
    merged.some(
      (m) =>
        m.dedupe === r.dedupe ||
        (norm(m.placeName) === norm(r.placeName) &&
          Math.abs(m.lat - r.lat) < 0.015 &&
          Math.abs(m.lng - r.lng) < 0.02)
    );
  for (const r of [...geoapify, ...photon, ...nominatim]) if (!isDupe(r)) merged.push(r);

  // Rank: exact-name matches first, then places (cities/countries) over POIs
  // over bare addresses/streets; each engine's own order breaks ties.
  const target = norm(q);
  const score = (r: GeoResult, i: number) => {
    let s = i;
    if (norm(r.placeName) === target) s -= 100;
    else if (norm(r.placeName).startsWith(target)) s -= 40;
    if (r.kind === "place") s -= 20;
    if (r.kind === "address") s += 25;
    return s;
  };
  return merged
    .map((r, i) => ({ r, s: score(r, i) }))
    .sort((a, b) => a.s - b.s)
    .slice(0, 8)
    .map(({ r }) => ({ ...r, dedupe: undefined }) as unknown as GeoResult);
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// ── Geoapify (optional free key) ───────────────────────────────────────────

interface GeoapifyFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    address_line1?: string;
    country?: string;
    country_code?: string;
    state?: string;
    city?: string;
    place_id?: string;
    result_type?: string;
  };
}

async function geoapifySearch(q: string, signal?: AbortSignal): Promise<(GeoResult & { dedupe: string })[]> {
  try {
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&limit=8&lang=en&apiKey=${GEOAPIFY_KEY}`,
      { signal }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data?.features ?? []) as GeoapifyFeature[])
      .filter((f) => f.geometry?.coordinates && (f.properties?.name || f.properties?.address_line1))
      .map((f) => {
        const p = f.properties;
        const [lng, lat] = f.geometry.coordinates;
        const name = p.name || p.address_line1!;
        const t = p.result_type ?? "";
        const kind: GeoResult["kind"] =
          t === "amenity"
            ? "poi"
            : t === "street" || t === "building"
              ? "address"
              : "place";
        const contextParts = [
          p.city && p.city !== name ? p.city : null,
          p.state && p.state !== name && p.state !== p.city ? p.state : null,
          p.country && p.country !== name ? p.country : null,
        ].filter(Boolean);
        return {
          placeName: name,
          context: contextParts.join(", "),
          countryCode: (p.country_code ?? "").toUpperCase(),
          lng,
          lat,
          kind,
          dedupe: p.place_id ?? `${name}@${lat.toFixed(2)}`,
        };
      });
  } catch {
    return [];
  }
}

// ── Photon ─────────────────────────────────────────────────────────────────

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    country?: string;
    countrycode?: string;
    state?: string;
    city?: string;
    street?: string;
    housenumber?: string;
    type?: string;
  };
}

async function photonSearch(q: string, signal?: AbortSignal): Promise<(GeoResult & { dedupe: string })[]> {
  try {
    const res = await fetch(
      `${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=8&lang=en`,
      { signal }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data?.features ?? []) as PhotonFeature[])
      .filter((f) => f.properties?.name && f.geometry?.coordinates)
      .map((f) => {
        const p = f.properties;
        const [lng, lat] = f.geometry.coordinates;
        const kind: GeoResult["kind"] =
          p.osm_key === "place" || p.osm_key === "boundary"
            ? "place"
            : p.osm_key === "highway" || p.housenumber || p.street
              ? "address"
              : "poi";
        const contextParts = [
          p.city && p.city !== p.name ? p.city : null,
          p.state && p.state !== p.name && p.state !== p.city ? p.state : null,
          p.country && p.country !== p.name ? p.country : null,
        ].filter(Boolean);
        return {
          placeName: p.name!,
          context: contextParts.join(", "),
          countryCode: (p.countrycode ?? "").toUpperCase(),
          lng,
          lat,
          kind,
          dedupe: p.osm_id ? `${p.osm_type ?? ""}${p.osm_id}` : `${p.name}@${lat.toFixed(2)}`,
        };
      });
  } catch {
    return [];
  }
}

// ── Nominatim ──────────────────────────────────────────────────────────────

interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  osm_type?: string;
  osm_id?: number;
  category?: string;
  class?: string;
  addresstype?: string;
  address?: {
    country_code?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

async function nominatimSearch(q: string, signal?: AbortSignal): Promise<(GeoResult & { dedupe: string })[]> {
  try {
    const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&dedupe=1&limit=8&accept-language=en&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { signal, headers: { "Accept-Language": "en" } });
    if (!res.ok) return [];
    const data = (await res.json()) as NominatimResult[];
    return data
      .filter((r) => r.lat && r.lon)
      .map((r) => {
        const a = r.address ?? {};
        const name = r.name || r.display_name.split(",")[0].trim();
        const cls = r.category ?? r.class ?? "";
        const kind: GeoResult["kind"] =
          cls === "place" || cls === "boundary"
            ? "place"
            : cls === "highway" || r.addresstype === "road"
              ? "address"
              : "poi";
        const locality = a.city || a.town || a.village;
        const contextParts = [
          locality && locality !== name ? locality : null,
          a.state && a.state !== name && a.state !== locality ? a.state : null,
          a.country && a.country !== name ? a.country : null,
        ].filter(Boolean);
        return {
          placeName: name,
          context: contextParts.join(", "),
          countryCode: (a.country_code ?? "").toUpperCase(),
          lng: parseFloat(r.lon),
          lat: parseFloat(r.lat),
          kind,
          dedupe: r.osm_id ? `${(r.osm_type ?? "").charAt(0).toUpperCase()}${r.osm_id}` : `${name}@${parseFloat(r.lat).toFixed(2)}`,
        };
      });
  } catch {
    return [];
  }
}

/** Reverse: coordinates → a human place label + country. */
export async function reverseGeocode(lng: number, lat: number): Promise<GeoResult> {
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=12&addressdetails=1&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (res.ok) {
      const data = (await res.json()) as NominatimResult;
      if (data && data.lat) {
        const a = data.address ?? {};
        const name =
          data.name || a.city || a.town || a.village || a.state || a.country ||
          data.display_name.split(",")[0].trim();
        return {
          placeName: name,
          context: [a.state, a.country].filter((x) => x && x !== name).join(", "),
          countryCode: (a.country_code ?? "").toUpperCase(),
          lng: parseFloat(data.lon),
          lat: parseFloat(data.lat),
          kind: "place",
        };
      }
    }
  } catch {
    /* fall through to coordinate label */
  }
  return {
    placeName: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
    context: "",
    countryCode: "",
    lng,
    lat,
    kind: "place",
  };
}
