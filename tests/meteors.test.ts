import { test } from "node:test";
import assert from "node:assert/strict";
import { createMeteorField } from "../lib/meteors";

// A minimal 2D-context stub: the field only needs gradients, paths and strokes.
function stubCtx() {
  const calls: string[] = [];
  const grad = { addColorStop: () => {} };
  const ctx = {
    save: () => calls.push("save"), restore: () => calls.push("restore"),
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, arc: () => {},
    stroke: () => calls.push("stroke"), fill: () => calls.push("fill"),
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    lineCap: "", lineWidth: 0, strokeStyle: "", fillStyle: "",
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

test("meteors spawn on the schedule, streak, and die within their life", () => {
  let n = 0;
  const seq = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const rnd = () => seq[n++ % seq.length];
  const f = createMeteorField({ minGapS: 2, maxGapS: 2, rnd });
  const { ctx, calls } = stubCtx();
  assert.equal(f.draw(ctx, 800, 600, 0), false, "nothing before the first gap");
  assert.equal(f.count(), 0);
  assert.equal(f.draw(ctx, 800, 600, 1000), false, "still before the first gap");
  assert.equal(f.draw(ctx, 800, 600, 2000), true, "first streak at the gap");
  assert.equal(f.count(), 1);
  assert.ok(calls.includes("stroke") && calls.includes("fill"));
  assert.equal(f.draw(ctx, 800, 600, 2300), true, "still flying");
  assert.equal(f.draw(ctx, 800, 600, 3600), false, "gone after its life (≤ 1.5 s), before the next gap");
  assert.equal(f.count(), 0);
});

test("spawn() forces one for screenshots and it stays on screen at first", () => {
  const f = createMeteorField({ rnd: () => 0.3 });
  f.spawn(390, 844, 5000);
  assert.equal(f.count(), 1);
  const { ctx } = stubCtx();
  assert.equal(f.draw(ctx, 390, 844, 5010), true);
});

test("with a globe to avoid, streaks start in clear sky or not at all", () => {
  let n = 0;
  const f = createMeteorField({ rnd: () => [0.1, 0.5, 0.9, 0.3, 0.7][n++ % 5] });
  // a planet far larger than the canvas: nothing can be placed
  f.spawn(400, 400, 0, { cx: 200, cy: 200, r: 4000 });
  assert.equal(f.count(), 0);
  // a big planet filling most of a desktop frame: still placeable in the sky ring
  f.spawn(1280, 800, 0, { cx: 640, cy: 400, r: 360 });
  assert.equal(f.count(), 1);
});
