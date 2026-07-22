import type { StyleSpecification, SkySpecification } from "maplibre-gl";

// ── Vector basemap (the "Map" mode) ──
// Swappable via env (plan §3). Default is OpenFreeMap "liberty" — a soft,
// detailed Apple/Google-streets-like style that reads well on a globe.
export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE ??
  "https://tiles.openfreemap.org/styles/liberty";

// ── Keyless elevation for real 3D terrain ──
// Terrarium-encoded DEM (AWS Open Data). Feeds both setTerrain (relief when you
// tilt) and a subtle hillshade layer.
export const TERRAIN_TILES =
  "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";
export const TERRAIN_ATTRIBUTION =
  "Elevation: Mapzen / AWS Terrain Tiles";

// ── Satellite basemap (the "Satellite" mode) ──
// ESRI World Imagery + a boundaries/places reference overlay = Apple-style
// hybrid. Keyless; attribution required and surfaced via AttributionControl.
export function satelliteStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      "esri-imagery": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      },
      "esri-reference": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [
      { id: "sat-bg", type: "background", paint: { "background-color": "#0b1a2b" } },
      { id: "sat-imagery", type: "raster", source: "esri-imagery" },
      {
        id: "sat-reference",
        type: "raster",
        source: "esri-reference",
        paint: { "raster-opacity": 0.9 },
      },
    ],
  };
}

// Atmospheric halo + space, the signature "planet from orbit" look. Fades out
// as you zoom into street level.
export const SKY: SkySpecification = {
  "sky-color": "#4a90d9",
  "sky-horizon-blend": 0.6,
  "horizon-color": "#dfeaf6",
  "horizon-fog-blend": 0.6,
  "fog-color": "#f6f3ee",
  "fog-ground-blend": 0.2,
  "atmosphere-blend": [
    "interpolate",
    ["linear"],
    ["zoom"],
    0, 1,
    6, 0.7,
    10, 0,
  ],
};

// Bare globe fallback if the remote basemap can't load — markers still place
// correctly on a paper-colored sphere. "A map should never feel empty."
export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  name: "waypoint-fallback",
  sources: {},
  layers: [
    { id: "bg-ocean", type: "background", paint: { "background-color": "#dfe6ea" } },
  ],
};
