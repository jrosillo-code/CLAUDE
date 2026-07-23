// Hand-off deep links to external navigation apps.
//
// Why names instead of raw coordinates: "38.712000,-9.140000" makes
// Google/Apple snap to whatever address happens to be nearest that point —
// the user sees a route to "R. do Açúcar 12" instead of "Lisbon" — and Apple
// Maps handles bare coordinates worst of all. So every stop travels as its
// human place name, falling back to coordinates only when no usable name
// exists. Apple's URL scheme officially supports one destination; the
// "+to:" chain is the extension its Maps app honors for multi-stop.

interface Stop {
  lat: number;
  lng: number;
  placeName?: string;
}

// A name that is just a coordinate fallback ("38.712, -9.140") is not a name.
const COORDS_LIKE = /^-?\d+(\.\d+)?[,\s]/;

/** The string the maps app should geocode: place name if usable, else coords. */
function loc(s: Stop): string {
  const name = s.placeName?.trim();
  if (name && !COORDS_LIKE.test(name)) return name;
  return `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;
}

export function googleMapsDirectionsUrl(lat: number, lng: number, placeName?: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    loc({ lat, lng, placeName })
  )}`;
}

export function appleMapsDirectionsUrl(lat: number, lng: number, placeName?: string): string {
  return `https://maps.apple.com/?daddr=${encodeURIComponent(loc({ lat, lng, placeName }))}`;
}

/**
 * Multi-stop route from the user's current location through every stop in
 * order. Google's URL API takes the last stop as destination and up to 9
 * intermediate waypoints (pipe-separated).
 */
export function googleMapsRouteUrl(stops: Stop[]): string {
  if (stops.length === 0) return "https://www.google.com/maps";
  if (stops.length === 1) {
    return googleMapsDirectionsUrl(stops[0].lat, stops[0].lng, stops[0].placeName);
  }
  const dest = stops[stops.length - 1];
  const mids = stops.slice(0, -1).slice(-9);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    loc(dest)
  )}&waypoints=${encodeURIComponent(mids.map(loc).join("|"))}`;
}

/** Apple Maps chains extra destinations with "+to:" after the first daddr. */
export function appleMapsRouteUrl(stops: Stop[]): string {
  if (stops.length === 0) return "https://maps.apple.com/";
  const [first, ...rest] = stops;
  return `https://maps.apple.com/?daddr=${encodeURIComponent(loc(first))}${rest
    .map((s) => `+to:${encodeURIComponent(loc(s))}`)
    .join("")}`;
}
