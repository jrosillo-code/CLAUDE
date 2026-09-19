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
  const f = createMeteorField({ minGapS: 1, maxGapS: 1, rnd });
  const { ctx, calls } = stubCtx();
  assert.equal(f.draw(ctx, 800, 600, 0), false, "nothing before the first gap");
  assert.equal(f.count(), 0);
  assert.equal(f.draw(ctx, 800, 600, 1000), true, "first streak at the gap");
  assert.equal(f.count(), 1);
  assert.ok(calls.includes("stroke") && calls.includes("fill"));
  assert.equal(f.draw(ctx, 800, 600, 1300), true, "still flying");
  assert.equal(f.draw(ctx, 800, 600, 1990), false, "gone after its life, before the next gap");
  assert.equal(f.count(), 0);
});

test("spawn() forces one for screenshots and it stays on screen at first", () => {
  const f = createMeteorField({ rnd: () => 0.3 });
  f.spawn(390, 844, 5000);
  assert.equal(f.count(), 1);
  const { ctx } = stubCtx();
  assert.equal(f.draw(ctx, 390, 844, 5010), true);
});
