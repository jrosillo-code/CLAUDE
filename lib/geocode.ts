// Geocoding behind one swappable module (plan §3). Dev impl uses Nominatim;
// swap for Mapbox / Google Places later by implementing the same interface and
// pointing NEXT_PUBLIC_GEOCODER at it.

export interface GeoResult {
  placeName: string;
  countryCode: string;
  lng: number;
  lat: number;
}

const NOMINATIM = "https://nominatim.openstreetmap.org";

/** Forward search: free-text place query → candidate locations. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      signal,
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as NominatimResult[];
    return data.map((r) => toGeoResult(r));
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
      if (data && data.lat) return toGeoResult(data, lng, lat);
    }
  } catch {
    /* fall through to coordinate label */
  }
  return {
    placeName: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
    countryCode: "",
    lng,
    lat,
  };
}

interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: {
    country_code?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

function toGeoResult(r: NominatimResult, fallbackLng?: number, fallbackLat?: number): GeoResult {
  const a = r.address ?? {};
  const locality = r.name || a.city || a.town || a.village || a.state || a.country;
  const parts = r.display_name.split(",").map((s) => s.trim());
  const placeName = locality || parts.slice(0, 2).join(", ") || parts[0] || "Unknown place";
  return {
    placeName,
    countryCode: (a.country_code || "").toUpperCase(),
    lng: r.lon ? parseFloat(r.lon) : fallbackLng ?? 0,
    lat: r.lat ? parseFloat(r.lat) : fallbackLat ?? 0,
  };
}
