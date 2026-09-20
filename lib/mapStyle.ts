import type { LayerSpecification, SkySpecification, StyleSpecification } from "maplibre-gl";
import type { MapTheme } from "./themes";

// ── Keyless elevation for real 3D terrain ──
// Terrarium-encoded DEM (AWS Open Data). Feeds both setTerrain (relief when you
// tilt) and a subtle hillshade layer.
export const TERRAIN_TILES =
  "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";
export const TERRAIN_ATTRIBUTION = "Elevation: Mapzen / AWS Terrain Tiles";

// ── Satellite basemap (the "Satellite" mode) ──
// ESRI World Imagery for the picture; place names, borders and roads drawn as
// VECTOR text and lines from OpenFreeMap when its host is reachable, so labels
// are crisp at any pixel ratio, with ESRI's raster reference overlay as the
// fallback. Keyless; attribution required and surfaced via AttributionControl.
//
// Never black: a second copy of the imagery source capped at zoom 3 (at most
// 64 tiles for the whole planet, resident for the session) is drawn UNDER the
// full-resolution layer. Zooming out fast shows those coarse tiles until the
// sharp ones land, instead of the background colour.
export const VECTOR_TILES_URL = "https://tiles.openfreemap.org/planet";

// The sky over satellite imagery is the same in every theme, and it is the
// Midnight theme's sky: deep-blue rim, dark ground fog, a thin atmosphere.
// The light themes' skies carry a pale, near-white fog (right for a paper
// street map) that washed the imagery out — switching to Midnight "fixed"
// it, so Midnight's values are the ones imagery always gets.
export const SATELLITE_SKY: SkySpecification = {
  "sky-color": "#27486e",
  "sky-horizon-blend": 0.4,
  "horizon-color": "#1a2c47",
  "horizon-fog-blend": 0.35,
  "fog-color": "#0e1929",
  "fog-ground-blend": 0.9,
  "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.45, 4, 0.25, 7, 0],
};
const ESRI_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_REFERENCE = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION = "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community";
/** The zoom the base copy of the imagery is capped at: 4^3 = 64 tiles, ever. */
export const SATELLITE_BASE_MAXZOOM = 3;

export interface SatelliteOptions {
  /** Draw labels as vector text (needs the OpenFreeMap host). */
  vectorLabels?: boolean;
}

const LABEL_FONT = ["Noto Sans Regular"];
const LABEL_FONT_BOLD = ["Noto Sans Bold"];
const LABEL_FONT_ITALIC = ["Noto Sans Italic"];
const NAME: unknown = ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name:latin"], ["get", "name"]];
const HALO = "rgba(8, 18, 32, 0.75)";

/** Vector labels, borders and roads for the hybrid look (OpenMapTiles schema). */
export function satelliteLabelLayers(): LayerSpecification[] {
  const text = (id: string, extra: Record<string, unknown>, layout: Record<string, unknown>, paint: Record<string, unknown> = {}): LayerSpecification =>
    ({
      id,
      type: "symbol",
      source: "openmaptiles",
      ...extra,
      layout: { "text-field": NAME, "text-font": LABEL_FONT, "text-max-width": 8, "text-padding": 4, ...layout },
      paint: { "text-color": "#ffffff", "text-halo-color": HALO, "text-halo-width": 1.3, "text-halo-blur": 0.4, ...paint },
    }) as LayerSpecification;
  return [
    {
      id: "sat-boundary-state",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      minzoom: 4,
      filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
      paint: { "line-color": "rgba(255,255,255,0.45)", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 10, 1.1], "line-dasharray": [3, 2] },
    },
    {
      id: "sat-boundary-country",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1], ["!=", ["get", "disputed"], 1]],
      paint: { "line-color": "rgba(255,255,255,0.7)", "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.5, 6, 1.2, 10, 1.8] },
    },
    {
      id: "sat-road-major",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 9,
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary"]]],
      paint: { "line-color": "rgba(255,255,255,0.55)", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.6, 14, 2, 17, 4] },
    },
    {
      id: "sat-road-minor",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 13,
      filter: ["in", ["get", "class"], ["literal", ["minor", "service", "street"]]],
      paint: { "line-color": "rgba(255,255,255,0.4)", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.5, 17, 2] },
    },
    text("sat-water-name", { "source-layer": "water_name", maxzoom: 9, filter: ["in", ["get", "class"], ["literal", ["ocean", "sea"]]] },
      { "text-font": LABEL_FONT_ITALIC, "text-size": ["interpolate", ["linear"], ["zoom"], 1, 10, 5, 14], "text-letter-spacing": 0.15, "text-transform": "uppercase" },
      { "text-color": "rgba(214, 232, 255, 0.9)" }),
    text("sat-place-country", { "source-layer": "place", maxzoom: 8, filter: ["==", ["get", "class"], "country"] },
      { "text-font": LABEL_FONT_BOLD, "text-size": ["interpolate", ["linear"], ["zoom"], 1, 10, 4, 14, 7, 18], "text-transform": "uppercase", "text-letter-spacing": 0.12 },
      { "text-halo-width": 1.6 }),
    text("sat-place-state", { "source-layer": "place", minzoom: 3, maxzoom: 9, filter: ["==", ["get", "class"], "state"] },
      { "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 8, 13], "text-transform": "uppercase", "text-letter-spacing": 0.08 },
      { "text-color": "rgba(255,255,255,0.85)" }),
    text("sat-place-city", { "source-layer": "place", minzoom: 3, maxzoom: 14, filter: ["==", ["get", "class"], "city"] },
      { "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 8, 14, 12, 17], "text-anchor": "top", "text-offset": [0, 0.3], "icon-image": ["step", ["zoom"], "sat-dot", 9, ""], "icon-allow-overlap": true },
      { "text-halo-width": 1.5 }),
    text("sat-place-town", { "source-layer": "place", minzoom: 8, maxzoom: 15, filter: ["==", ["get", "class"], "town"] },
      { "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 13, 14] }),
    text("sat-place-village", { "source-layer": "place", minzoom: 11, filter: ["in", ["get", "class"], ["literal", ["village", "hamlet", "suburb", "neighbourhood", "quarter", "island"]]] },
      { "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 13] },
      { "text-color": "rgba(255,255,255,0.9)" }),
    text("sat-road-name", { "source-layer": "transportation_name", minzoom: 13, filter: ["!=", ["get", "class"], "path"] },
      { "symbol-placement": "line", "text-size": ["interpolate", ["linear"], ["zoom"], 13, 10, 17, 13], "text-rotation-alignment": "map" },
      { "text-halo-width": 1.1 }),
  ];
}

export function satelliteStyle(opts: SatelliteOptions = {}): StyleSpecification {
  const sources: StyleSpecification["sources"] = {
    "esri-imagery-base": { type: "raster", tiles: [ESRI_IMAGERY], tileSize: 256, maxzoom: SATELLITE_BASE_MAXZOOM },
    "esri-imagery": { type: "raster", tiles: [ESRI_IMAGERY], tileSize: 256, maxzoom: 19, attribution: ESRI_ATTRIBUTION },
  };
  const layers: LayerSpecification[] = [
    { id: "sat-bg", type: "background", paint: { "background-color": "#0b1a2b" } },
    { id: "sat-imagery-base", type: "raster", source: "esri-imagery-base", paint: { "raster-fade-duration": 0 } },
    // No 300 ms cross-fade per tile: a loaded tile is drawn at once, so a pan
    // settles as fast as the network delivers rather than a beat later.
    { id: "sat-imagery", type: "raster", source: "esri-imagery", paint: { "raster-fade-duration": 0, "raster-resampling": "linear" } },
  ];
  if (opts.vectorLabels) {
    sources.openmaptiles = { type: "vector", url: VECTOR_TILES_URL, attribution: "© OpenMapTiles © OpenStreetMap contributors" };
    layers.push(...satelliteLabelLayers());
  } else {
    sources["esri-reference"] = { type: "raster", tiles: [ESRI_REFERENCE], tileSize: 256, maxzoom: 19 };
    layers.push({ id: "sat-reference", type: "raster", source: "esri-reference", paint: { "raster-opacity": 0.9, "raster-fade-duration": 0 } });
  }
  return { version: 8, glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf", sources, layers };
}

// Bundled basemap built from local country geometry (public/geo), themed. It is
// local, so it paints instantly and always renders — even fully offline. The
// app then upgrades to the theme's online street style when reachable.
export function bundledWorldStyle(theme: MapTheme): StyleSpecification {
  return {
    version: 8,
    name: `waypoint-${theme.id}`,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      countries: { type: "geojson", data: "/geo/countries-110m.json" },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": theme.ocean } },
      {
        id: "land",
        type: "fill",
        source: "countries",
        paint: { "fill-color": theme.land, "fill-opacity": 1 },
      },
      {
        id: "borders",
        type: "line",
        source: "countries",
        paint: { "line-color": theme.border, "line-width": 0.8 },
      },
      {
        id: "country-labels",
        type: "symbol",
        source: "countries",
        layout: {
          "text-field": ["get", "name"],
          // The same face the online styles use, so the first paint and the
          // upgraded street map set their labels in one and the same type.
          // Without this MapLibre asks the glyph host for its own default
          // stack, which reads as a different, rougher font until a theme
          // switch swaps the style.
          "text-font": LABEL_FONT_BOLD,
          "text-size": ["interpolate", ["linear"], ["zoom"], 1, 10, 4, 14],
          "text-letter-spacing": 0.08,
          "text-transform": "uppercase",
          "text-max-width": 8,
        },
        paint: {
          "text-color": theme.labelColor,
          "text-halo-color": theme.labelHalo,
          "text-halo-width": 1.2,
        },
      },
    ],
  };
}
