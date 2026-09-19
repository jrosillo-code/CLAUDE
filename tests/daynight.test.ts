import { test } from "node:test";
import assert from "node:assert/strict";
import { isNightAt, autoThemeFor } from "../lib/daynight";

// The auto theme follows the sun where the location is known and the clock
// where it is not. Lisbon at solar noon in June is day; at 02:00 it is night.

test("with a location the sun decides", () => {
  const lisbon = { lat: 38.72, lng: -9.14 };
  assert.equal(isNightAt(new Date("2026-06-21T13:00:00Z"), lisbon), false);
  assert.equal(isNightAt(new Date("2026-06-21T02:00:00Z"), lisbon), true);
  // dusk in December: 18:30 local (18:30Z) is after civil dusk
  assert.equal(isNightAt(new Date("2026-12-21T18:30:00Z"), lisbon), true);
  assert.equal(autoThemeFor(new Date("2026-06-21T13:00:00Z"), lisbon), "daylight");
  assert.equal(autoThemeFor(new Date("2026-06-21T02:00:00Z"), lisbon), "midnight");
});

test("without a location the device clock decides (7:00–19:00 is day)", () => {
  const at = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d; };
  assert.equal(isNightAt(at(12), null), false);
  assert.equal(isNightAt(at(6), null), true);
  assert.equal(isNightAt(at(19), null), true);
  assert.equal(isNightAt(at(7), null), false);
});
