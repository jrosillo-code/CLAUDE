// Hand-off deep links to external navigation apps. Both accept a bare
// destination coordinate and let the app plan the route from the user's
// current location.

export function googleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function appleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://maps.apple.com/?daddr=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

const c = (s: { lat: number; lng: number }) => `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;

/**
 * Multi-stop route from the user's current location through every stop in
 * order. Google's URL API takes the last stop as destination and up to 9
 * intermediate waypoints (pipe-separated).
 */
export function googleMapsRouteUrl(stops: { lat: number; lng: number }[]): string {
  if (stops.length === 0) return "https://www.google.com/maps";
  if (stops.length === 1) return googleMapsDirectionsUrl(stops[0].lat, stops[0].lng);
  const dest = stops[stops.length - 1];
  const mids = stops.slice(0, -1).slice(-9);
  return `https://www.google.com/maps/dir/?api=1&destination=${c(dest)}&waypoints=${encodeURIComponent(
    mids.map(c).join("|")
  )}`;
}

/** Apple Maps chains extra destinations with "+to:" after the first daddr. */
export function appleMapsRouteUrl(stops: { lat: number; lng: number }[]): string {
  if (stops.length === 0) return "https://maps.apple.com/";
  const [first, ...rest] = stops;
  return `https://maps.apple.com/?daddr=${c(first)}${rest.map((s) => `+to:${c(s)}`).join("")}`;
}
