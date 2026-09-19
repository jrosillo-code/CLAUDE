import { test } from "node:test";
import assert from "node:assert/strict";
import { lightWindows, sunPosition } from "../lib/fieldbrief/light";

// Two known places and dates, checked against published almanac times
// (tolerance: a few minutes — the algorithm is the standard low-precision one).
const minutes = (iso: string) => {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const near = (iso: string | null, hh: number, mm: number, tol: number, what: string) => {
  assert.ok(iso, `${what} should exist`);
  const got = minutes(iso!);
  assert.ok(Math.abs(got - (hh * 60 + mm)) <= tol, `${what}: got ${iso}, expected ~${hh}:${String(mm).padStart(2, "0")} UTC`);
};

test("Lisbon, 21 June 2025: sunrise ~05:12 UTC, sunset ~20:05 UTC", () => {
  const w = lightWindows(38.7223, -9.1393, "2025-06-21");
  near(w.sunrise, 5, 12, 6, "sunrise");
  near(w.sunset, 20, 5, 6, "sunset");
  assert.equal(w.polar, null);
  assert.ok(w.goldenPm && w.sunset && w.goldenPm[0] < w.sunset, "golden hour pm begins before sunset");
  assert.ok(w.bluePm && w.sunset && w.bluePm[0] > w.sunset, "blue hour pm follows sunset");
  assert.ok(w.goldenAm && w.sunrise && w.goldenAm[1] > w.sunrise, "golden hour am ends after sunrise");
  assert.ok(w.sunAzimuthAtGoldenPm! > 270 && w.sunAzimuthAtGoldenPm! < 320, `midsummer evening sun sits in the north-west (${w.sunAzimuthAtGoldenPm})`);
});

test("Reykjavík, 21 December 2025: sunrise ~11:22 UTC, sunset ~15:30 UTC", () => {
  const w = lightWindows(64.1466, -21.9426, "2025-12-21");
  near(w.sunrise, 11, 22, 8, "sunrise");
  near(w.sunset, 15, 30, 8, "sunset");
  assert.ok(w.maxAltitudeDeg < 3.5 && w.maxAltitudeDeg > 1.5, `the sun barely clears the horizon (${w.maxAltitudeDeg}°)`);
});

test("Longyearbyen in June is polar day: no sunrise, no sunset, no golden hour", () => {
  const w = lightWindows(78.2232, 15.6267, "2025-06-21");
  assert.equal(w.polar, "day");
  assert.equal(w.sunrise, null);
  assert.equal(w.sunset, null);
});

test("Tokyo's date is Tokyo's: the windows fall on 21 June local, not UTC's", () => {
  const w = lightWindows(35.6895, 139.6917, "2025-06-21");
  // Tokyo sunrise 04:25 JST = 19:25 UTC on 20 June.
  assert.ok(w.sunrise!.startsWith("2025-06-20T19:2"), `sunrise ${w.sunrise}`);
  assert.ok(w.sunset!.startsWith("2025-06-21T10:0"), `sunset ${w.sunset}`);
});

test("solar noon at the equator on an equinox is near the zenith", () => {
  const { altitude } = sunPosition(Date.UTC(2025, 2, 20, 12, 0), 0, 0);
  assert.ok(altitude > 87, `altitude ${altitude}`);
});
