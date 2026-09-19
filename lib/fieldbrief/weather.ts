// Sky conditions for the brief, read from the same Open-Meteo call as wind.
// WMO codes become a short word and a glyph; the day is summarised as dry
// windows and rain hours. Nothing here forecasts on its own — it only
// relabels what the forecast service returned.

import type { WindHour } from "./wind";

export interface Sky {
  /** Short label: "Clear", "Partly cloudy", "Rain showers", … */
  label: string;
  /** A plain glyph for the hourly table. */
  glyph: string;
  /** true when the hour brings precipitation of any kind. */
  wet: boolean;
}

const SKY: [number[], string, string, boolean][] = [
  [[0], "Clear", "☀", false],
  [[1], "Mainly clear", "🌤", false],
  [[2], "Partly cloudy", "⛅", false],
  [[3], "Overcast", "☁", false],
  [[45, 48], "Fog", "🌫", false],
  [[51, 53, 55], "Drizzle", "🌦", true],
  [[56, 57], "Freezing drizzle", "🌧", true],
  [[61], "Light rain", "🌧", true],
  [[63], "Rain", "🌧", true],
  [[65], "Heavy rain", "🌧", true],
  [[66, 67], "Freezing rain", "🌧", true],
  [[71, 73, 75, 77], "Snow", "🌨", true],
  [[80, 81, 82], "Rain showers", "🌦", true],
  [[85, 86], "Snow showers", "🌨", true],
  [[95], "Thunderstorm", "⛈", true],
  [[96, 99], "Thunderstorm with hail", "⛈", true],
];

/** Label a WMO weather code. Unknown codes read as "Unknown", never invented. */
export function skyFor(code: number | undefined | null): Sky {
  if (code == null) return { label: "Unknown", glyph: "·", wet: false };
  for (const [codes, label, glyph, wet] of SKY) if (codes.includes(code)) return { label, glyph, wet };
  return { label: "Unknown", glyph: "·", wet: false };
}

export interface WeatherSummary {
  /** The most common sky across the forecast hours. */
  dominant: Sky;
  /** Hours whose code is wet or whose chance of rain is at least 50 %. */
  rainHours: number;
  /** Total forecast hours that carried a weather code. */
  totalHours: number;
  /** Contiguous runs of hours that are neither wet nor likely to rain. */
  dryWindows: { start: string; end: string; hours: number }[];
  tempMinC: number | null;
  tempMaxC: number | null;
}

/** An hour counts as wet when its code is wet or rain is at least as likely as not. */
export function isWetHour(h: WindHour): boolean {
  return skyFor(h.weatherCode).wet || (h.precipProb != null && h.precipProb >= 50);
}

export function weatherSummary(hours: WindHour[]): WeatherSummary | null {
  const coded = hours.filter((h) => h.weatherCode != null);
  if (coded.length === 0) return null;
  const counts = new Map<string, { sky: Sky; n: number }>();
  for (const h of coded) {
    const sky = skyFor(h.weatherCode);
    const e = counts.get(sky.label) ?? { sky, n: 0 };
    e.n += 1;
    counts.set(sky.label, e);
  }
  const dominant = [...counts.values()].sort((a, b) => b.n - a.n)[0].sky;
  const dryWindows: WeatherSummary["dryWindows"] = [];
  let run: WindHour[] = [];
  const flush = () => { if (run.length) dryWindows.push({ start: run[0].time, end: run[run.length - 1].time, hours: run.length }); run = []; };
  for (const h of coded) { if (isWetHour(h)) flush(); else run.push(h); }
  flush();
  const temps = hours.map((h) => h.tempC).filter((t): t is number => t != null);
  return {
    dominant,
    rainHours: coded.filter(isWetHour).length,
    totalHours: coded.length,
    dryWindows,
    tempMinC: temps.length ? Math.min(...temps) : null,
    tempMaxC: temps.length ? Math.max(...temps) : null,
  };
}
