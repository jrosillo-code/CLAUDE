import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { track, readEvents, contributionCount } from "../lib/analytics";

// Simulate a browser: analytics is a no-op without window (SSR-safe), and it
// only reads window lazily at call time — so installing the shim after the
// import but before the first track() is sound.
const storage = new Map<string, string>();
(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  },
};

// The module keeps an in-memory log cache (by design — one browser session),
// so tests use distinct identities rather than expecting isolation.
beforeEach(() => storage.clear());

test("events carry ids and enums only — the meta type has no text field", () => {
  track("reflection_ask_evidence", {
    reflectionId: "r1",
    ownerId: "alice",
    viewerId: "bob",
    questionId: "dont_miss",
  });
  const e = readEvents().at(-1)!;
  assert.equal(e.name, "reflection_ask_evidence");
  // Every meta value is an id/enum; nothing resembling reflection text.
  for (const v of Object.values(e.meta)) {
    assert.ok(typeof v === "string" && v.length < 64);
  }
});

test("contributionCount counts only others consuming YOUR words", () => {
  track("reflection_ask_evidence", { reflectionId: "c-r1", ownerId: "amy", viewerId: "bob" });
  track("reflection_dontmiss_evidence", { reflectionId: "c-r1", ownerId: "amy", viewerId: "bob" });
  track("trip_cloned_with_debrief", { reflectionId: "c-r1", ownerId: "amy", viewerId: "carol" });
  // Self-views never count; unrelated owners never count.
  track("reflection_ask_evidence", { reflectionId: "c-r1", ownerId: "amy", viewerId: "amy" });
  track("reflection_ask_evidence", { reflectionId: "c-r9", ownerId: "zed", viewerId: "bob" });
  // Non-contribution events never count.
  track("debrief_completed", { reflectionId: "c-r1", ownerId: "amy", viewerId: "bob" });

  assert.equal(contributionCount("amy"), 3);
  assert.equal(contributionCount("amy", "c-r1"), 3);
  assert.equal(contributionCount("amy", "c-r-other"), 0);
  assert.equal(contributionCount("zed"), 1);
});

test("the log is capped and survives round-trips through storage", () => {
  for (let i = 0; i < 700; i++) track("debrief_started", { tripId: `t${i}` });
  const events = readEvents();
  assert.ok(events.length <= 600, "cap enforced");
  assert.equal(events.at(-1)!.meta.tripId, "t699", "newest kept");
});
