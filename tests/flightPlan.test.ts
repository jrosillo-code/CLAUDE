import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlightPlan, HOLD0_MS, FLIGHT_PITCH } from "../lib/flightPlan";

// The film's motion is a pure function of time: flat on the holds, a lean
// in flight, the trail head never runs backwards, and the plan lands.
const stops = [
  { lng: -9.14, lat: 38.72 },
  { lng: 2.35, lat: 48.86 },
  { lng: 139.69, lat: 35.68 },
];

test("holds are flat, flight leans, and the landing settles flat", () => {
  const plan = buildFlightPlan(stops);
  assert.equal(plan.stateAt(0).pitch, 0);
  assert.equal(plan.stateAt(0).phase, "hold");
  const mid = plan.stateAt(HOLD0_MS + 1500);
  assert.equal(mid.phase, "fly");
  assert.ok(mid.pitch > FLIGHT_PITCH * 0.9, `pitch ${mid.pitch}`);
  const end = plan.stateAt(plan.totalMs);
  assert.equal(end.phase, "settle");
  assert.equal(end.pitch, 0);
  assert.equal(end.frac, 1);
});

test("the trail head is monotonic and the long leg breathes out more than the short one", () => {
  const plan = buildFlightPlan(stops);
  let last = -1;
  let minZoomLeg1 = 99, minZoomLeg2 = 99;
  for (let t = 0; t <= plan.totalMs; t += 33) {
    const s = plan.stateAt(t);
    assert.ok(s.frac >= last - 1e-9, `frac went backwards at ${t}`);
    last = s.frac;
    if (s.phase === "fly") {
      if (s.frac < plan.stopFracs[1]) minZoomLeg1 = Math.min(minZoomLeg1, s.zoom);
      else minZoomLeg2 = Math.min(minZoomLeg2, s.zoom);
    }
  }
  assert.ok(minZoomLeg2 < minZoomLeg1, "Paris→Tokyo pulls back further than Lisbon→Paris");
});
