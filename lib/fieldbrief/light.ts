// Sun position and the photographer's windows for one place and date.
// Computed here, offline, from the standard low-precision solar algorithm
// (the same one suncalc implements); no API, no key. Accuracy is a minute or
// two, which is what golden hour needs. Times are ISO strings in UTC — the
// panel renders them in the viewer's clock.

export interface LightWindows {
  /** ISO instants, or null when the sun never crosses that threshold (polar day/night). */
  sunrise: string | null;
  sunset: string | null;
  goldenAm: [string, string] | null;
  goldenPm: [string, string] | null;
  blueAm: [string, string] | null;
  bluePm: [string, string] | null;
  /** Compass bearing (degrees from north) of the sun as golden hour pm begins. */
  sunAzimuthAtGoldenPm: number | null;
  /** Peak solar altitude of the day, degrees. */
  maxAltitudeDeg: number;
  polar: "day" | "night" | null;
}

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

function toDays(ms: number): number {
  return ms / DAY_MS - 0.5 + J1970 - J2000;
}

function sunCoords(d: number): { dec: number; ra: number } {
  const M = RAD * (357.5291 + 0.98560028 * d);
  const L = M + RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + RAD * 102.9372 + Math.PI;
  return {
    dec: Math.asin(Math.sin(0) * Math.cos(OBLIQUITY) + Math.cos(0) * Math.sin(OBLIQUITY) * Math.sin(L)),
    ra: Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY) - Math.tan(0) * Math.sin(OBLIQUITY), Math.cos(L)),
  };
}

/** Solar altitude and azimuth (degrees; azimuth from north, clockwise). */
export function sunPosition(ms: number, lat: number, lng: number): { altitude: number; azimuth: number } {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(ms);
  const c = sunCoords(d);
  const H = RAD * (280.16 + 360.9856235 * d) - lw - c.ra;
  const altitude = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H));
  const azSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(c.dec) * Math.cos(phi));
  return { altitude: altitude / RAD, azimuth: ((azSouth / RAD + 180) % 360 + 360) % 360 };
}

const SUNRISE_ALT = -0.833; // refraction + solar disc
const GOLDEN_HIGH = 6;
const GOLDEN_LOW = -4;
const BLUE_LOW = -6;

/**
 * Windows for the civil day at (lat, lng). `date` is YYYY-MM-DD in the
 * place's own day: we scan a 24-hour span centred on local mean noon, so
 * Tokyo's 21 June is Tokyo's, not UTC's.
 */
export function lightWindows(lat: number, lng: number, date: string): LightWindows {
  const [y, m, d] = date.split("-").map(Number);
  const noonUtc = Date.UTC(y, m - 1, d, 12) - (lng / 15) * 3_600_000;
  const start = noonUtc - 12 * 3_600_000;
  const step = 60_000;
  const samples: { ms: number; alt: number }[] = [];
  let max = -90, min = 90;
  for (let i = 0; i <= 1440; i++) {
    const ms = start + i * step;
    const alt = sunPosition(ms, lat, lng).altitude;
    samples.push({ ms, alt });
    if (alt > max) max = alt;
    if (alt < min) min = alt;
  }
  // first crossing of `threshold` in the given direction; linear interpolation
  const cross = (threshold: number, dir: "up" | "down", from = 0): number | null => {
    for (let i = Math.max(1, from); i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i];
      const hit = dir === "up" ? a.alt < threshold && b.alt >= threshold : a.alt >= threshold && b.alt < threshold;
      if (hit) {
        const t = (threshold - a.alt) / (b.alt - a.alt);
        return a.ms + t * step;
      }
    }
    return null;
  };
  const iso = (ms: number | null) => (ms == null ? null : new Date(Math.round(ms / 1000) * 1000).toISOString());
  const pair = (a: number | null, b: number | null): [string, string] | null =>
    a != null && b != null && b > a ? [iso(a)!, iso(b)!] : null;

  const sunrise = cross(SUNRISE_ALT, "up");
  const sunset = cross(SUNRISE_ALT, "down");
  const goldenAmStart = cross(GOLDEN_LOW, "up");
  const goldenAmEnd = cross(GOLDEN_HIGH, "up");
  const goldenPmStart = cross(GOLDEN_HIGH, "down");
  const goldenPmEnd = cross(GOLDEN_LOW, "down");
  const blueAmStart = cross(BLUE_LOW, "up");
  const bluePmEnd = cross(BLUE_LOW, "down");
  const polar: LightWindows["polar"] = max < SUNRISE_ALT ? "night" : min > SUNRISE_ALT ? "day" : null;

  return {
    sunrise: iso(sunrise),
    sunset: iso(sunset),
    goldenAm: pair(goldenAmStart, goldenAmEnd),
    goldenPm: pair(goldenPmStart, goldenPmEnd),
    blueAm: pair(blueAmStart, goldenAmStart),
    bluePm: pair(goldenPmEnd, bluePmEnd),
    sunAzimuthAtGoldenPm:
      goldenPmStart != null ? Math.round(sunPosition(goldenPmStart, lat, lng).azimuth) : sunset != null ? Math.round(sunPosition(sunset, lat, lng).azimuth) : null,
    maxAltitudeDeg: Math.round(max * 10) / 10,
    polar,
  };
}
