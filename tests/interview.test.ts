import { test } from "node:test";
import assert from "node:assert/strict";
import { attachOptions, questionsForTrip, visibleReflections } from "../lib/interview";
import * as fx from "./fixtures";
import {
  friendships as seedFriendships,
  pins as seedPins,
  seedReflections,
  seedTrips,
  topPlaces as seedTopPlaces,
} from "../lib/seed";
import type { TripReflection } from "../lib/types";

// ── Adaptive question selection ─────────────────────────────────────────────

test("skips 'favorite' and 'return' when a route pin sits in the Top 5", () => {
  // Seed: Cervinia is #3 in Maria's Top 5 and a stop on her Alps trip.
  const trip = seedTrips.find((t) => t.id === "trip-2")!;
  const qs = questionsForTrip({ trip, pins: seedPins, topPlaces: seedTopPlaces });
  const ids = qs.map((q) => q.id);
  assert.deepEqual(ids, ["dont_miss", "skip", "surprise"]);
});

test("skips 'favorite' but keeps 'return' for a 9+/10 route pin outside the Top 5", () => {
  const trip = fx.trips[0]; // stops at Ericeira & Peniche
  const pins = fx.pins.map((p) =>
    p.id === "p-friend-ericeira" ? { ...p, rating: 9 } : p
  );
  const ids = questionsForTrip({ trip, pins, topPlaces: [] }).map((q) => q.id);
  assert.deepEqual(ids, ["dont_miss", "skip", "surprise", "return"]);
});

test("asks all five when nothing is inferable from the route", () => {
  const trip = fx.trips[0];
  const pins = fx.pins.filter((p) => p.userId !== fx.FRIEND); // no owner pins on route
  const ids = questionsForTrip({ trip, pins, topPlaces: [] }).map((q) => q.id);
  assert.deepEqual(ids, ["favorite", "dont_miss", "skip", "surprise", "return"]);
});

test("attach options offer the whole trip plus the owner's on-route pins", () => {
  const opts = attachOptions(fx.trips[0], fx.pins);
  assert.equal(opts[0].pinId, null);
  const labels = opts.map((o) => o.label);
  assert.ok(labels.includes("Ericeira"));
  assert.ok(labels.includes("Peniche"));
  // Tokyo is the friend's pin but nowhere near the route.
  assert.ok(!labels.includes("Tokyo"));
});

// ── Visibility ──────────────────────────────────────────────────────────────

function withVisibility(v: TripReflection["visibility"], status: TripReflection["status"] = "complete") {
  return fx.reflections.map((r) => ({ ...r, visibility: v, status }));
}

test("drafts are never evidence, not even at public visibility", () => {
  const rs = withVisibility("public", "draft");
  assert.equal(visibleReflections(rs, fx.friendships, fx.VIEWER).length, 0);
});

test("friends-visibility reflections reach friends but not strangers", () => {
  const rs = withVisibility("friends");
  assert.equal(visibleReflections(rs, fx.friendships, fx.VIEWER).length, 1);
  assert.equal(visibleReflections(rs, fx.friendships, fx.STRANGER).length, 0);
});

test("private reflections stay with their owner", () => {
  const rs = withVisibility("private");
  assert.equal(visibleReflections(rs, fx.friendships, fx.VIEWER).length, 0);
  assert.equal(visibleReflections(rs, fx.friendships, fx.FRIEND).length, 1);
});

test("public reflections are readable by anyone", () => {
  const rs = withVisibility("public");
  assert.equal(visibleReflections(rs, fx.friendships, fx.STRANGER).length, 1);
});

// ── Seed sanity ─────────────────────────────────────────────────────────────

test("seed reflections only answer questions their trip would actually ask", () => {
  for (const r of seedReflections) {
    const trip = seedTrips.find((t) => t.id === r.tripId)!;
    assert.ok(trip.completedOn, `${trip.id} must be completed to carry a debrief`);
    const asked = new Set(
      questionsForTrip({ trip, pins: seedPins, topPlaces: seedTopPlaces }).map((q) => q.id)
    );
    for (const a of r.answers) {
      assert.ok(asked.has(a.questionId), `${r.id}: '${a.questionId}' should not have been asked`);
    }
  }
});

test("seed reflection pin anchors point at real pins owned by the author", () => {
  for (const r of seedReflections) {
    for (const a of r.answers) {
      if (!a.pinId) continue;
      const pin = seedPins.find((p) => p.id === a.pinId);
      assert.ok(pin, `${r.id}: anchored pin ${a.pinId} exists`);
      assert.equal(pin!.userId, r.userId, `${r.id}: anchored pin belongs to the author`);
    }
  }
});

test("seed friendships make the debrief authors visible to the demo viewer", () => {
  const authors = new Set(seedReflections.map((r) => r.userId));
  for (const author of authors) {
    const edge = seedFriendships.find(
      (f) =>
        f.status === "accepted" &&
        ((f.userA === "u-you" && f.userB === author) || (f.userB === "u-you" && f.userA === author))
    );
    assert.ok(edge, `author ${author} is friends with the demo viewer`);
  }
});
