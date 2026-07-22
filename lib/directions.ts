// Hand-off deep links to external navigation apps. Both accept a bare
// destination coordinate and let the app plan the route from the user's
// current location.

export function googleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function appleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://maps.apple.com/?daddr=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
