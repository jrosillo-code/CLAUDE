import { test } from "node:test";
import assert from "node:assert/strict";
import { isLiveDispatch, liveDispatchesByUser, agoLabel, suggestHereNow, DISPATCH_TTL_MS } from "../lib/dispatches";
import type { PinWithOwner, User } from "../lib/types";

const now = new Date("2026-09-20T12:00:00Z");
const user = (id: string): User => ({ id, handle: id, displayName: id, avatarUrl: "", bio: "", homeBase: "", defaultPinVisibility: "friends" } as unknown as User);
const pin = (id: string, userId: string, hoursAgo: number, hereNow = true): PinWithOwner =>
  ({ id, userId, owner: user(userId), lng: 0, lat: 0, placeName: id, countryCode: "PT", title: id, note: "", visibility: "friends", media: [], hereNow, createdAt: new Date(now.getTime() - hoursAgo * 3600_000).toISOString() } as unknown as PinWithOwner);

test("a dispatch is live for 72 hours, only when flagged", () => {
  assert.equal(isLiveDispatch(pin("a", "u1", 1), now), true);
  assert.equal(isLiveDispatch(pin("a", "u1", 71), now), true);
  assert.equal(isLiveDispatch(pin("a", "u1", 73), now), false);
  assert.equal(isLiveDispatch(pin("a", "u1", 1, false), now), false);
  assert.equal(DISPATCH_TTL_MS, 72 * 3600 * 1000);
});

test("grouped by traveler, latest first, the viewer's own group first", () => {
  const groups = liveDispatchesByUser([pin("a", "u2", 5), pin("b", "u2", 1), pin("c", "u3", 2), pin("d", "me", 40), pin("old", "u4", 100)], "me", now);
  assert.deepEqual(groups.map((g) => g.owner.id), ["me", "u2", "u3"]);
  assert.deepEqual(groups[1].pins.map((p) => p.id), ["b", "a"]);
});

test("ago labels and the here-now suggestion", () => {
  assert.equal(agoLabel(new Date(now.getTime() - 30_000).toISOString(), now), "just now");
  assert.equal(agoLabel(new Date(now.getTime() - 3 * 3600_000).toISOString(), now), "3h ago");
  assert.equal(agoLabel(new Date(now.getTime() - 50 * 3600_000).toISOString(), now), "2d ago");
  const lisbon = { lat: 38.72, lng: -9.14 };
  assert.equal(suggestHereNow(lisbon, { lat: 38.73, lng: -9.15 }, undefined, now), true);
  assert.equal(suggestHereNow(lisbon, { lat: 41.15, lng: -8.61 }, undefined, now), false, "Porto is too far");
  assert.equal(suggestHereNow(lisbon, { lat: 38.73, lng: -9.15 }, "2026-08-01", now), false, "a past date is not now");
  assert.equal(suggestHereNow(lisbon, null, undefined, now), false);
});
