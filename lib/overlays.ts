// Worldwide reference overlays, toggled from the Layers card. Each is a static
// GeoJSON in /public/overlays, lazy-loaded the first time its toggle turns on
// (they total ~900 KB, so they never touch the initial bundle) and rendered as
// a zoom-gated GPU circle + label layer on the map.
//
// Data provenance (all open):
//   airports — OurAirports (public domain): the 4,563 large + medium airports
//              worldwide that carry an IATA code.
//   stations — Trainline EU stations (ODbL): the 828 flagged main stations
//              (major termini; strongest in Europe).
//   stadiums — mapsam/world-stadiums (OSM-derived): 667 stadiums & arenas
//              worldwide, with capacity.

export type OverlayId = "airports" | "stations" | "stadiums";

export interface OverlayDef {
  id: OverlayId;
  label: string;
  file: string;
  color: string;
  /** Below this zoom the dots are hidden (keeps the world uncluttered). */
  minzoom: number;
  /** Labels appear from here up. */
  labelMinzoom: number;
  /** Feature property used for the label. */
  labelField: "iata" | "name";
}

export const OVERLAYS: OverlayDef[] = [
  {
    id: "airports",
    label: "Airports",
    file: "/overlays/airports.json",
    color: "#2f80ed",
    minzoom: 3,
    labelMinzoom: 7,
    labelField: "iata",
  },
  {
    id: "stations",
    label: "Train stations",
    file: "/overlays/stations.json",
    color: "#12a150",
    minzoom: 7,
    labelMinzoom: 10.5,
    labelField: "name",
  },
  {
    id: "stadiums",
    label: "Stadiums & arenas",
    file: "/overlays/stadiums.json",
    color: "#8b3fd6",
    minzoom: 6,
    labelMinzoom: 9.5,
    labelField: "name",
  },
];
