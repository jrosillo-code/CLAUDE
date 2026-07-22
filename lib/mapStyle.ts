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
