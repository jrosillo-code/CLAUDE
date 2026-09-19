import type { StyleSpecification } from "maplibre-gl";
import type { MapTheme } from "./themes";

// ── Keyless elevation for real 3D terrain ──
// Terrarium-encoded DEM (AWS Open Data). Feeds both setTerrain (relief when you
// tilt) and a subtle hillshade layer.
export const TERRAIN_TILES =
  "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";
export const TERRAIN_ATTRIBUTION = "Elevation: Mapzen / AWS Terrain Tiles";

// ── Satellite basemap (the "Satellite" mode) ──
// ESRI World Imagery + a boundaries/places reference overlay = Apple-style
// hybrid. Keyless; attribution required and surfaced via AttributionControl.
//
// Sharpness: ESRI serves 256 px tiles with no @2x variant. MapLibre picks the
// tile zoom as map zoom + log2(512 / tileSize), so on a HiDPI screen a 256 px
// tile stretched over 256 CSS px is drawn at half the device resolution and
// reads soft. Declaring the tile as 128 px fetches one zoom level deeper —
// four times the tiles, but every imagery pixel lands on a device pixel.
// Only worth it when the screen can show the difference.
export function satelliteTileSize(devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1): 128 | 256 {
  return devicePixelRatio >= 1.5 ? 128 : 256;
}

export function satelliteStyle(devicePixelRatio?: number): StyleSpecification {
  const tileSize = satelliteTileSize(devicePixelRatio);
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      "esri-imagery": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize,
        // ESRI has imagery to 19 (more in cities); with the 128 px trick the
        // deepest map zoom is one level lower than the tile zoom.
        maxzoom: 19,
        attribution:
          "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      },
      "esri-reference": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize,
        maxzoom: 19,
      },
    },
    layers: [
      { id: "sat-bg", type: "background", paint: { "background-color": "#0b1a2b" } },
      {
        id: "sat-imagery",
        type: "raster",
        source: "esri-imagery",
        // No 300 ms cross-fade per tile: a loaded tile is drawn at once, so a
        // pan settles as fast as the network delivers rather than a beat later.
        paint: { "raster-fade-duration": 0, "raster-resampling": "linear" },
      },
      {
        id: "sat-reference",
        type: "raster",
        source: "esri-reference",
        paint: { "raster-opacity": 0.9, "raster-fade-duration": 0 },
      },
    ],
  };
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
