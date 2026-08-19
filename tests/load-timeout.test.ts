import { test } from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "../lib/backend";

// Regression cover for the bug that stranded signed-in users on the loading
// screen.
//
// `sessionReady` — the one flag standing between the app and its pulsing
// logo — was set at the end of a chain of awaited backend calls, with nothing
// catching. That is survivable while every call either resolves or rejects.
// It is not survivable when one NEVER ANSWERS, which is exactly what a
// Promise.all over Supabase query builders did when a request failed at the
// network level: not rejected, just permanently pending. loadWorld never
// returned, sessionReady was never set, and the app had no way forward — no
// error, nothing to click, not even a route to sign out.
//
// So the contract every startup load now has to keep: answer, one way or
// another, within a bounded time.

test("withTimeout passes a successful value straight through", async () => {
  const result = await withTimeout(Promise.resolve("world"), 1000, "fallback", "t");
  assert.equal(result, "world");
});

test("withTimeout converts a rejection into the fallback", async () => {
  const result = await withTimeout(Promise.reject(new Error("boom")), 1000, "fallback", "t");
  assert.equal(result, "fallback");
});

test("a promise that NEVER settles still resolves — the actual bug", async () => {
  const started = Date.now();
  // This is the shape that hung: no resolve, no reject, ever.
  const neverAnswers = new Promise<string>(() => {});
  const result = await withTimeout(neverAnswers, 120, "fallback", "t");
  assert.equal(result, "fallback");
  assert.ok(Date.now() - started >= 100, "should have waited for the timeout");
  assert.ok(Date.now() - started < 3000, "should not have waited much longer");
});

test("a late answer cannot overwrite the fallback already returned", async () => {
  let settle: (v: string) => void = () => {};
  const slow = new Promise<string>((r) => {
    settle = r;
  });
  const result = await withTimeout(slow, 60, "fallback", "t");
  assert.equal(result, "fallback");
  // The real request finishing afterwards must be harmless.
  settle("late");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(result, "fallback");
});

test("the timeout is disarmed when the work wins the race", async () => {
  // A resolved call must not leave a pending timer holding the process (or,
  // in the browser, firing a spurious 'timed out' log seconds later).
  const before = process.getActiveResourcesInfo?.().filter((r) => r === "Timeout").length ?? 0;
  await withTimeout(Promise.resolve(1), 5000, 0, "t");
  const after = process.getActiveResourcesInfo?.().filter((r) => r === "Timeout").length ?? 0;
  assert.ok(after <= before, `left ${after - before} timer(s) armed`);
});
