import type { SkySpecification } from "maplibre-gl";

// Waypoint themes. Each theme styles BOTH the UI chrome (light or dark
// variables in globals.css, switched via data-theme on <html>) and the globe
// itself (ocean/land/label colors for the bundled basemap, an atmosphere, and
// — when reachable — a matching online street style to upgrade to).
export type ThemeId = "daylight" | "sandstone" | "mint" | "midnight";

export interface MapTheme {
  id: ThemeId;
  label: string;
  /** Switches the whole app UI into dark chrome. */
  darkUI: boolean;
  /** Online street-map style to upgrade to when its host is reachable. */
  remoteStyle?: string;
  /** Bundled-globe colors (always available, even offline). */
  ocean: string;
  land: string;
  border: string;
  labelColor: string;
  labelHalo: string;
  sky: SkySpecification;
  /** Two-stop gradient for the theme picker swatch. */
  swatch: [string, string];
}

const DAYLIGHT_REMOTE =
  process.env.NEXT_PUBLIC_MAP_STYLE ?? "https://tiles.openfreemap.org/styles/liberty";

export const THEMES: Record<ThemeId, MapTheme> = {
  daylight: {
    id: "daylight",
    label: "Daylight",
    darkUI: false,
    remoteStyle: DAYLIGHT_REMOTE,
    ocean: "#add3f0",
    land: "#f4efe6",
    border: "#d8cfbf",
    labelColor: "#9a8f7d",
    labelHalo: "#f4efe6",
    sky: {
      "sky-color": "#8ec2ee",
      "sky-horizon-blend": 0.4,
      "horizon-color": "#d6e8f8",
      "horizon-fog-blend": 0.3,
      "fog-color": "#e4f0fb",
      "fog-ground-blend": 0.85,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 4, 0.25, 7, 0],
    },
    swatch: ["#add3f0", "#f4efe6"],
  },
  sandstone: {
    id: "sandstone",
    label: "Sandstone",
    darkUI: false,
    remoteStyle: "https://tiles.openfreemap.org/styles/positron",
    ocean: "#b9cdd4",
    land: "#efe6d2",
    border: "#d9c8a6",
    labelColor: "#a08c66",
    labelHalo: "#efe6d2",
    sky: {
      "sky-color": "#d9c9a0",
      "sky-horizon-blend": 0.35,
      "horizon-color": "#f0e6cf",
      "horizon-fog-blend": 0.3,
      "fog-color": "#f6efdd",
      "fog-ground-blend": 0.85,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.4, 4, 0.2, 7, 0],
    },
    swatch: ["#b9cdd4", "#efe6d2"],
  },
  mint: {
    id: "mint",
    label: "Mint",
    darkUI: false,
    remoteStyle: "https://tiles.openfreemap.org/styles/bright",
    ocean: "#a9dcd0",
    land: "#f4f8ef",
    border: "#c8ddcd",
    labelColor: "#6f9484",
    labelHalo: "#f4f8ef",
    sky: {
      "sky-color": "#a8ded2",
      "sky-horizon-blend": 0.35,
      "horizon-color": "#dff2ec",
      "horizon-fog-blend": 0.3,
      "fog-color": "#eaf7f2",
      "fog-ground-blend": 0.85,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.4, 4, 0.2, 7, 0],
    },
    swatch: ["#a9dcd0", "#f4f8ef"],
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    darkUI: true,
    // OpenFreeMap has no official dark style; if this 404s the app simply stays
    // on the bundled midnight globe, which is fully styled anyway.
    remoteStyle: "https://tiles.openfreemap.org/styles/dark",
    ocean: "#0c1626",
    land: "#1d2734",
    border: "#33415a",
    labelColor: "#8fa3bd",
    labelHalo: "#111a29",
    sky: {
      "sky-color": "#1e3a5f",
      "sky-horizon-blend": 0.4,
      "horizon-color": "#16233a",
      "horizon-fog-blend": 0.35,
      "fog-color": "#0d1524",
      "fog-ground-blend": 0.9,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.45, 4, 0.25, 7, 0],
    },
    swatch: ["#0c1626", "#33415a"],
  },
};

export const THEME_ORDER: ThemeId[] = ["daylight", "sandstone", "mint", "midnight"];
