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

// Bright daytime atmosphere: a soft blue halo around the planet, kept subtle so
// the ocean and land read clearly (not fogged out). Fades away as you zoom in.
export const SKY: SkySpecification = {
  "sky-color": "#8ec2ee",
  "sky-horizon-blend": 0.4,
  "horizon-color": "#d6e8f8",
  "horizon-fog-blend": 0.3,
  "fog-color": "#e4f0fb",
  "fog-ground-blend": 0.85,
  "atmosphere-blend": [
    "interpolate",
    ["linear"],
    ["zoom"],
    0, 0.5,
    4, 0.25,
    7, 0,
  ],
};

// Bright, daytime, fully-offline basemap built from bundled country geometry
// (public/geo). Used when the online vector tiles can't load — so even with no
// network the app shows a clean Apple-style globe with land, ocean, borders,
// and country labels rather than a blank sphere. "A map should never feel empty."
export function brightWorldStyle(): StyleSpecification {
  return {
    version: 8,
    name: "waypoint-bright",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      countries: { type: "geojson", data: "/geo/countries-110m.json" },
    },
    layers: [
      // Soft daytime ocean.
      { id: "ocean", type: "background", paint: { "background-color": "#add3f0" } },
      // Land fill — bright, warm off-white like Apple's daytime map.
      {
        id: "land",
        type: "fill",
        source: "countries",
        paint: { "fill-color": "#f4efe6", "fill-opacity": 1 },
      },
      // Subtle country borders.
      {
        id: "borders",
        type: "line",
        source: "countries",
        paint: { "line-color": "#d8cfbf", "line-width": 0.8 },
      },
      // Country labels — muted, letter-spaced, placed at centroids.
      {
        id: "country-labels",
        type: "symbol",
        source: "countries",
        layout: {
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 1, 10, 4, 14],
          "text-letter-spacing": 0.08,
          "text-transform": "uppercase",
          "text-max-width": 8,
        },
        paint: {
          "text-color": "#9a8f7d",
          "text-halo-color": "#f4efe6",
          "text-halo-width": 1.2,
        },
      },
    ],
  };
}

// Absolute last resort if even the glyphs (labels) can't load: geometry only.
export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  name: "waypoint-fallback",
  sources: {
    countries: { type: "geojson", data: "/geo/countries-110m.json" },
  },
  layers: [
    { id: "ocean", type: "background", paint: { "background-color": "#add3f0" } },
    { id: "land", type: "fill", source: "countries", paint: { "fill-color": "#f4efe6" } },
    { id: "borders", type: "line", source: "countries", paint: { "line-color": "#d8cfbf", "line-width": 0.8 } },
  ],
};
