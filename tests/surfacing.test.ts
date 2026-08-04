import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quoteStance,
  quotesFor,
  quotesNearPlace,
  rewardLines,
  sortQuotesByPriority,
} from "../lib/interview";
import { dontMissPicks } from "../lib/regret";
import { askFriends } from "../lib/askFriends";
import * as fx from "./fixtures";
import type { Pin, TripReflection } from "../lib/types";

// ── Stance classification (endorsement / warning / neutral) ─────────────────

test("stances: don't-miss and favorite endorse, skip warns, surprise is neutral", () => {
  const mk = (questionId: never, scale?: never) =>
    ({ questionId, prompt: "", text: "x", pinId: null, scale, source: "text" }) as never;
  assert.equal(quoteStance(mk("dont_miss" as never)), "endorsement");
  assert.equal(quoteStance(mk("favorite" as never)), "endorsement");
  assert.equal(quoteStance(mk("skip" as never)), "warning");
  assert.equal(quoteStance(mk("surprise" as never)), "neutral");
  assert.equal(quoteStance(mk("return" as never, "yes" as never)), "endorsement");
  assert.equal(quoteStance(mk("return" as never, "no" as never)), "warning");
  assert.equal(quoteStance(mk("return" as never, "maybe" as never)), "neutral");
});

test("conflicting stances about one place stay visible side by side", () => {
  // Frida endorses Sintra; a second answer warns about it. Both must appear —
  // no consensus, no averaging.
  const contested: TripReflection[] = [
    {
      ...fx.reflections[0],
      answers: [
        fx.reflections[0].answers[0], // dont_miss @ Sintra
        {
          questionId: "skip",
          prompt: "What would you skip next time?",
          text: "Sintra on a Saturday. The queue eats the morning.",
          pinId: "p-friend-sintra",
          source: "text",
        },
      ],
    },
  ];
  const near = quotesNearPlace(
    quotesFor(contested, fx.friendships, fx.VIEWER, fx.users, fx.trips, fx.pins),
    { lat: 38.7979, lng: -9.3902 }
  );
  const stances = near.map((q) => quoteStance(q.answer)).sort();
  assert.deepEqual(stances, ["endorsement", "warning"]);
});

// ── Geography beats names: duplicated place names ───────────────────────────

const springfieldUS: Pin = {
  id: "p-friend-springfield-us",
  userId: fx.FRIEND,
  lat: 39.7817,
  lng: -89.6501,
  placeName: "Springfield",
  countryCode: "US",
  title: "Springfield",
  note: "",
  visibility: "friends",
  media: [],
  rating: 8,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const springfieldAU: Pin = {
  id: "p-friend-springfield-au",
  userId: fx.FRIEND,
  lat: -27.6659,
  lng: 152.9169,
  placeName: "Springfield",
  countryCode: "AU",
  title: "Springfield",
  note: "",
  visibility: "friends",
  media: [],
  rating: 8,
  createdAt: "2026-01-01T00:00:00.000Z",
};

test("a 'skip' about one Springfield never demotes the other Springfield", () => {
  const pins = [...fx.pins, springfieldUS, springfieldAU];
  const skipUS: TripReflection[] = [
    {
      ...fx.reflections[0],
      answers: [
        {
          questionId: "skip",
          prompt: "What would you skip next time?",
          text: "Springfield was a detour I regretted.",
          pinId: "p-friend-springfield-us",
          source: "text",
        },
      ],
    },
  ];
  // Around the US Springfield: demoted (rating-only endorsement + explicit skip).
  const us = dontMissPicks({
    anchor: { lat: 39.7817, lng: -89.6501 },
    viewerId: fx.VIEWER,
    users: fx.users,
    pins,
    friendships: fx.friendships,
    follows: fx.follows,
    topPlaces: [],
    reflections: skipUS,
    trips: fx.trips,
  });
  assert.ok(!us.picks.some((p) => p.pin.id === "p-friend-springfield-us"));
  // Around the Australian namesake: untouched by the US warning.
  const au = dontMissPicks({
    anchor: { lat: -27.6659, lng: 152.9169 },
    viewerId: fx.VIEWER,
    users: fx.users,
    pins,
    friendships: fx.friendships,
    follows: fx.follows,
    topPlaces: [],
    reflections: skipUS,
    trips: fx.trips,
  });
  assert.ok(au.picks.some((p) => p.pin.id === "p-friend-springfield-au"));
});

test("pin-anchored quotes resolve by their own pin's geography, not its name", () => {
  const pins = [...fx.pins, springfieldUS, springfieldAU];
  const praiseUS: TripReflection[] = [
    {
      ...fx.reflections[0],
      answers: [
        {
          questionId: "dont_miss",
          prompt: "What would you tell a friend not to miss?",
          text: "The Lincoln museum is genuinely great.",
          pinId: "p-friend-springfield-us",
          source: "text",
        },
      ],
    },
  ];
  const all = quotesFor(praiseUS, fx.friendships, fx.VIEWER, fx.users, fx.trips, pins);
  assert.equal(quotesNearPlace(all, { lat: 39.7817, lng: -89.6501 }).length, 1);
  assert.equal(quotesNearPlace(all, { lat: -27.6659, lng: 152.9169 }).length, 0);
});

// ── Whole-trip answers inherit destination context ──────────────────────────

test("trip-level quotes attach to every stop's area, and only those", () => {
  const all = quotesFor(fx.reflections, fx.friendships, fx.VIEWER, fx.users, fx.trips, fx.pins);
  const tripLevel = all.filter((q) => !q.pin);
  assert.ok(tripLevel.length >= 1, "fixture has a trip-level answer (return)");
  // Near a stop (Ericeira) → present. Near Tokyo → absent.
  const nearStop = quotesNearPlace(tripLevel, { lat: 38.9636, lng: -9.4175 });
  assert.ok(nearStop.length >= 1);
  assert.equal(quotesNearPlace(tripLevel, { lat: 35.6762, lng: 139.6503 }).length, 0);
});

// ── Deleted answers vanish from regret evidence too ─────────────────────────

test("removing the endorsing answer removes the Don't-miss pick it created", () => {
  const without: TripReflection[] = fx.reflections.map((r) => ({
    ...r,
    answers: r.answers.filter((a) => a.questionId !== "dont_miss"),
  }));
  const r = dontMissPicks({
    anchor: { lat: 38.7223, lng: -9.1393 },
    viewerId: fx.VIEWER,
    users: fx.users,
    pins: fx.pins,
    friendships: fx.friendships,
    follows: fx.follows,
    topPlaces: fx.topPlaces,
    reflections: without,
    trips: fx.trips,
  });
  assert.ok(!r.picks.some((p) => p.pin.placeName === "Sintra"));
});

// ── Unfriending revokes app-layer access (mirrors the RLS test) ─────────────

test("a removed friend loses friends-only quotes in Ask immediately", () => {
  const a = askFriends({
    question: "What should I know about Sintra?",
    viewerId: fx.VIEWER,
    users: fx.users,
    pins: fx.pins,
    friendships: [], // friendship removed
    follows: fx.follows,
    topPlaces: fx.topPlaces,
    trips: fx.trips,
    likeCounts: fx.likeCounts,
    reflections: fx.reflections,
  });
  assert.equal(a.quotes.length, 0);
});

// ── The author's reward is honest ───────────────────────────────────────────

test("reward lines promise only what retrieval actually does", () => {
  const lines = rewardLines({
    answers: fx.reflections[0].answers,
    visibility: "friends",
    trip: fx.trips[0],
    pins: fx.pins,
  });
  // Pin-anchored dont_miss → Don't-leave-without + country claim.
  assert.ok(lines.some((l) => l.includes("Sintra") && l.includes("Don't leave without")));
  // Pin-anchored skip → steering claim, no reach inflation.
  assert.ok(lines.some((l) => l.includes("Peniche") && l.includes("warning")));
  // Trip-level (return) → surfaces via the trip's stops.
  assert.ok(lines.some((l) => l.includes("Silver Coast run")));
});

test("a private debrief promises privacy, not exposure", () => {
  const lines = rewardLines({
    answers: fx.reflections[0].answers,
    visibility: "private",
    trip: fx.trips[0],
    pins: fx.pins,
  });
  assert.equal(lines.length, 1);
  assert.ok(lines[0].includes("privately"));
  assert.ok(!lines.some((l) => l.includes("Don't leave without")));
});

// ── Collapsed-card ordering ─────────────────────────────────────────────────

test("quote priority: don't-miss, then skip, then surprise, favorite, return", () => {
  const all = quotesFor(fx.reflections, fx.friendships, fx.VIEWER, fx.users, fx.trips, fx.pins);
  const sorted = sortQuotesByPriority(all);
  const ids = sorted.map((q) => q.answer.questionId);
  assert.deepEqual(ids, ["dont_miss", "skip", "return"]);
});
