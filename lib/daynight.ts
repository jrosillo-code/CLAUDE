// Day or night for the auto theme. With a location the sun decides (civil
// dusk, altitude below −6°, is night); without one the device clock does.

import { sunPosition } from "./fieldbrief/light";
import type { ThemeId } from "./themes";

export const NIGHT_ALTITUDE_DEG = -6;
export const CLOCK_DAY_START_HOUR = 7;
export const CLOCK_DAY_END_HOUR = 19;

export function isNightAt(now: Date, location: { lat: number; lng: number } | null): boolean {
  if (location && Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
    return sunPosition(now.getTime(), location.lat, location.lng).altitude < NIGHT_ALTITUDE_DEG;
  }
  const h = now.getHours();
  return h < CLOCK_DAY_START_HOUR || h >= CLOCK_DAY_END_HOUR;
}

export function autoThemeFor(now: Date, location: { lat: number; lng: number } | null): ThemeId {
  return isNightAt(now, location) ? "midnight" : "daylight";
}
