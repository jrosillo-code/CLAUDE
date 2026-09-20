import { test } from "node:test";
import assert from "node:assert/strict";
import { dayFraction, skyPalette, skyVars } from "../lib/skyTint";

const at = (h: number, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };

test("the day runs 6:00 → 20:00 and clamps outside it", () => {
  assert.equal(dayFraction(at(6)), 0);
  assert.equal(dayFraction(at(13)), 0.5);
  assert.equal(dayFraction(at(20)), 1);
  assert.equal(dayFraction(at(2)), 0);
  assert.equal(dayFraction(at(23)), 1);
});

test("morning is peach, midday pale, evening amber, with smooth blends between", () => {
  const morning = skyPalette(at(7)), midday = skyPalette(at(13)), evening = skyPalette(at(19));
  assert.ok(morning.glow[2] > evening.glow[2], "morning glow is pinker (more blue) than the evening amber");
  assert.ok(midday.glow2[2] > morning.glow2[2] && midday.glow2[2] > evening.glow2[2], "midday's second layer leans blue");
  assert.ok(evening.glow[1] < midday.glow[1], "evening drops green: amber");
  const between = skyPalette(at(10));
  assert.ok(between.glow[1] > morning.glow[1] && between.glow[1] < midday.glow[1], "10:00 sits between morning and midday");
  const vars = skyVars(midday);
  assert.match(vars["--sky-glow"], /^\d+, \d+, \d+$/);
  assert.match(vars["--sky-top"], /^#[0-9a-f]{6}$/);
});
