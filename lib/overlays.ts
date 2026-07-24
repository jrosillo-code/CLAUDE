// Worldwide reference overlays, toggled from the Layers card. Each is a static
// GeoJSON in /public/overlays, lazy-loaded the first time its toggle turns on
// (they total ~900 KB, so they never touch the initial bundle) and rendered as
// an icon + label symbol layer on the map. Icon collision keeps the world
// readable even fully zoomed out, so they stay visible at every zoom.
//
// Data provenance (all open):
//   airports — OurAirports (public domain): the 4,563 large + medium airports
//              worldwide that carry an IATA code.
//   stations — Trainline EU stations (ODbL): the 828 flagged main stations
//              (major termini; strongest in Europe).
//   stadiums — mapsam/world-stadiums (OSM-derived): 667 stadiums worldwide,
//              with capacity.

export type OverlayId = "airports" | "stations" | "stadiums";

export interface OverlayDef {
  id: OverlayId;
  label: string;
  file: string;
  color: string;
  /** Icon shape drawn for this overlay. */
  icon: "plane" | "train" | "stadium";
  /** Emoji used on the tapped-feature info card. */
  glyph: string;
  /** Labels appear from this zoom up (icons show at every zoom). */
  labelMinzoom: number;
  /** Feature property used for the label. */
  labelField: "iata" | "name";
  /** Human word for a single feature, used in the info card subtitle. */
  singular: string;
}

// Icons show from the map's own minimum zoom so they never vanish when you
// pull the globe all the way out — same as the landmarks layer.
const ICON_MINZOOM = 1.05;

export { ICON_MINZOOM };

export const OVERLAYS: OverlayDef[] = [
  {
    id: "airports",
    label: "Airports",
    file: "/overlays/airports.json",
    color: "#2f80ed",
    icon: "plane",
    glyph: "✈️",
    labelMinzoom: 6.5,
    labelField: "iata",
    singular: "Airport",
  },
  {
    id: "stations",
    label: "Train stations",
    file: "/overlays/stations.json",
    color: "#12a150",
    icon: "train",
    glyph: "🚉",
    labelMinzoom: 9,
    labelField: "name",
    singular: "Train station",
  },
  {
    id: "stadiums",
    label: "Stadiums",
    file: "/overlays/stadiums.json",
    color: "#8b3fd6",
    icon: "stadium",
    glyph: "🏟️",
    labelMinzoom: 8,
    labelField: "name",
    singular: "Stadium",
  },
];
