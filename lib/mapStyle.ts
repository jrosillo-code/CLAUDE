import type { StyleSpecification } from "maplibre-gl";

// Tile provider is swappable via env (plan §3: "swap tile provider via env var").
// Default is OpenFreeMap's positron — a muted, editorial basemap that lets the
// photography carry the color.
export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE ??
  "https://tiles.openfreemap.org/styles/positron";

// If the remote style fails to load (offline, blocked, provider down), we fall
// back to this bare globe so the app still works — markers place correctly on a
// paper-colored sphere. "A map should never feel empty."
export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  name: "waypoint-fallback",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {},
  layers: [
    {
      id: "bg-ocean",
      type: "background",
      paint: { "background-color": "#dfe6ea" },
    },
  ],
};
