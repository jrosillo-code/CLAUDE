import type { SkySpecification } from "maplibre-gl";

// Waypoint themes. Each theme styles BOTH the UI chrome (light or dark
// variables in globals.css, switched via data-theme on <html>) and the globe
// itself (ocean/land/label colors for the bundled basemap, an atmosphere, and
// — when reachable — a matching online street style to upgrade to).
export type ThemeId = "daylight" | "sandstone" | "mint" | "vermilion" | "midnight";

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
  vermilion: {
    id: "vermilion",
    label: "Vermilion",
    darkUI: false,
    remoteStyle: "https://tiles.openfreemap.org/styles/positron",
    // Warm rice-paper land, soft blue-gray water, vermilion-red borders and
    // labels — styled after the Chinese edition of Apple Maps.
    ocean: "#c7dae4",
    land: "#faf3e6",
    border: "#e08a7a",
    labelColor: "#b04a3c",
    labelHalo: "#faf3e6",
    sky: {
      "sky-color": "#e8a598",
      "sky-horizon-blend": 0.35,
      "horizon-color": "#f6ddd2",
      "horizon-fog-blend": 0.3,
      "fog-color": "#f9ece2",
      "fog-ground-blend": 0.85,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.4, 4, 0.2, 7, 0],
    },
    swatch: ["#d84b40", "#faf3e6"],
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    darkUI: true,
    // OpenFreeMap has no official dark style; if this 404s the app simply stays
    // on the bundled midnight globe, which is fully styled anyway.
    remoteStyle: "https://tiles.openfreemap.org/styles/dark",
    // A clearly-blue deep ocean against near-charcoal land, so water reads as
    // water instead of undifferentiated darkness.
    ocean: "#16324f",
    land: "#1b2330",
    border: "#3d4f68",
    labelColor: "#9db4d0",
    labelHalo: "#101827",
    sky: {
      "sky-color": "#27486e",
      "sky-horizon-blend": 0.4,
      "horizon-color": "#1a2c47",
      "horizon-fog-blend": 0.35,
      "fog-color": "#0e1929",
      "fog-ground-blend": 0.9,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.45, 4, 0.25, 7, 0],
    },
    swatch: ["#16324f", "#3d4f68"],
  },
};

export const THEME_ORDER: ThemeId[] = [
  "daylight",
  "sandstone",
  "mint",
  "vermilion",
  "midnight",
];
