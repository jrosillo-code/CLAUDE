import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDigest, digestWindow, digestSeenKey, homeOf, isEvening } from "../lib/digest";
import type { PinWithOwner, User } from "../lib/types";

const user = (id: string, name: string): User => ({ id, handle: id, displayName: name, avatarUrl: "", bio: "", homeCity: "", color: "#000", defaultPinVisibility: "friends" });
const me = user("me", "Me"), ana = user("ana", "Ana Ruiz"), bo = user("bo", "Bo Lee");
const now = new Date("2026-09-20T20:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

function pin(p: Partial<PinWithOwner> & { id: string; owner: User; lat: number; lng: number; countryCode: string; placeName: string }): PinWithOwner {
  return { userId: p.owner.id, title: p.placeName, note: "", visibility: "friends", media: [], createdAt: ago(3), ...p } as PinWithOwner;
}

const madrid = { lat: 40.4, lng: -3.7 };
const mine = [pin({ id: "m1", owner: me, ...madrid, countryCode: "ES", placeName: "Madrid" }), pin({ id: "m2", owner: me, lat: 41.4, lng: 2.2, countryCode: "ES", placeName: "Barcelona" })];

test("home is the median of my own pins", () => {
  assert.deepEqual(homeOf(mine, "me"), { lat: 41.4, lng: 2.2 });
  assert.equal(homeOf([], "me"), null);
});

test("the window narrows to today when friends were busy, widens when they were not", () => {
  const busy = [...mine, pin({ id: "a", owner: ana, lat: 0, lng: 0, countryCode: "GA", placeName: "x", createdAt: ago(2) }), pin({ id: "b", owner: bo, lat: 0, lng: 1, countryCode: "GA", placeName: "y", createdAt: ago(5) })];
  assert.equal(digestWindow(busy, "me", now).span, "today");
  const quiet = [...mine, pin({ id: "a", owner: ana, lat: 0, lng: 0, countryCode: "GA", placeName: "x", createdAt: ago(30) }), pin({ id: "b", owner: bo, lat: 0, lng: 1, countryCode: "GA", placeName: "y", createdAt: ago(100) })];
  assert.equal(digestWindow(quiet, "me", now).span, "week");
  const dead = [...mine, pin({ id: "a", owner: ana, lat: 0, lng: 0, countryCode: "GA", placeName: "x", createdAt: ago(24 * 40) })];
  assert.equal(digestWindow(dead, "me", now).span, "lately");
});

test("far, first-in-country, listed and liked places rank above the corner café", () => {
  const pins = [
    ...mine,
    pin({ id: "cafe", owner: ana, lat: 40.42, lng: -3.69, countryCode: "ES", placeName: "Café Madrid", createdAt: ago(1) }),
    pin({ id: "bhutan", owner: bo, lat: 27.5, lng: 89.6, countryCode: "BT", placeName: "Paro", createdAt: ago(6), rating: 9, note: "Prayer flags on every ridge and a monastery hanging off a cliff. Go at dawn.", media: [{ id: "x", kind: "photo", url: "u" }] }),
    pin({ id: "lisbon", owner: ana, lat: 38.7, lng: -9.1, countryCode: "PT", placeName: "Lisbon", createdAt: ago(4) }),
  ];
  const { window, picks } = buildDigest({ pins, viewerId: "me", likeCounts: { lisbon: 3 }, now, listNear: (lat) => (lat > 27 && lat < 28 ? { name: "Tiger's Nest", list: "Hikes" } : null) });
  assert.equal(window.span, "today");
  assert.equal(picks[0].pin.id, "bhutan");
  assert.ok(picks[0].reasons.some((r) => /first of your friends in Bhutan/.test(r)), picks[0].reasons.join(" | "));
  assert.ok(picks[0].reasons.some((r) => /Hikes list/.test(r)));
  assert.equal(picks[1].pin.id, "lisbon");
  assert.ok(picks[1].reasons.some((r) => /3 friends like it/.test(r)));
  assert.equal(picks[picks.length - 1].pin.id, "cafe");
  assert.ok(picks.every((p) => p.pin.userId !== "me"), "never my own pins");
});

test("at most two picks per friend and one per place", () => {
  const pins = [...mine, ...[1, 2, 3, 4].map((i) => pin({ id: `a${i}`, owner: ana, lat: -30 - i, lng: 150, countryCode: "AU", placeName: `Spot ${i}`, createdAt: ago(i) })), pin({ id: "dup", owner: bo, lat: -31, lng: 150, countryCode: "AU", placeName: "Spot 1", createdAt: ago(1) })];
  const { picks } = buildDigest({ pins, viewerId: "me", likeCounts: {}, now });
  assert.equal(picks.filter((p) => p.pin.userId === "ana").length, 2);
  assert.equal(new Set(picks.map((p) => p.pin.placeName.toLowerCase())).size, picks.length);
});

test("evening is after five and before four; the seen-key rolls at four in the morning", () => {
  assert.equal(isEvening(new Date(2026, 8, 20, 18)), true);
  assert.equal(isEvening(new Date(2026, 8, 20, 2)), true);
  assert.equal(isEvening(new Date(2026, 8, 20, 11)), false);
  assert.equal(digestSeenKey(new Date(2026, 8, 20, 21)), "wp-digest-2026-09-20");
  assert.equal(digestSeenKey(new Date(2026, 8, 21, 1)), "wp-digest-2026-09-20");
});
