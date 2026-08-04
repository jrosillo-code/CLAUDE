import { test } from "node:test";
import assert from "node:assert/strict";
import { dontMissPicks } from "../lib/regret";
import * as fx from "./fixtures";
import type { TripReflection } from "../lib/types";

const LISBON = { lat: 38.7223, lng: -9.1393 };

const base = {
  anchor: LISBON,
  viewerId: fx.VIEWER,
  users: fx.users,
  pins: fx.pins,
  friendships: fx.friendships,
  follows: fx.follows,
  topPlaces: fx.topPlaces,
  trips: fx.trips,
};

test("a 'don't miss' quote endorses a place even below the rating bar", () => {
  // Sintra is rated 5 — invisible to the rating rule — but the friend's
  // debrief explicitly says don't miss it.
  const r = dontMissPicks({ ...base, reflections: fx.reflections });
  const sintra = r.picks.find((p) => p.pin.placeName === "Sintra");
  assert.ok(sintra, "Sintra surfaces on the strength of the quote");
  assert.ok(sintra!.fromDebrief);
  assert.ok(
    sintra!.reason.includes("The sea mist over Sintra at dawn"),
    "the reason is the friend's verbatim quote"
  );
  assert.ok(sintra!.reason.includes("Frida"), "the quote is attributed");
});

test("without the debrief, the same place stays invisible", () => {
  const r = dontMissPicks({ ...base, reflections: [] });
  assert.ok(!r.picks.some((p) => p.pin.placeName === "Sintra"));
});

test("an explicit 'skip' removes a place whose only endorsement is a rating", () => {
  // Peniche is rated 8 (rating-endorsed) and the debrief says skip it.
  const withSkip = dontMissPicks({ ...base, reflections: fx.reflections });
  assert.ok(!withSkip.picks.some((p) => p.pin.placeName === "Peniche"));
  const withoutSkip = dontMissPicks({ ...base, reflections: [] });
  assert.ok(
    withoutSkip.picks.some((p) => p.pin.placeName === "Peniche"),
    "Peniche is a normal rating-endorsed pick when no one said skip"
  );
});

test("skip never silently hides an explicitly endorsed place", () => {
  // Same place carries BOTH a skip quote and a don't-miss quote from the
  // debrief: the positive wins and the place stays visible with its quote.
  const contested: TripReflection[] = [
    {
      ...fx.reflections[0],
      answers: [
        ...fx.reflections[0].answers,
        {
          questionId: "dont_miss",
          prompt: "What would you tell a friend not to miss?",
          text: "Supertubos on a clean day is worth any crowd.",
          pinId: "p-friend-peniche",
          source: "text",
        },
      ],
    },
  ];
  // Note: fixtures' skip is also anchored to Peniche, so this is a direct
  // conflict — but the dont_miss anchored to Sintra earlier in the answers
  // array must not be displaced. Build a fresh reflection to keep both.
  const r = dontMissPicks({ ...base, reflections: contested });
  const peniche = r.picks.find((p) => p.pin.placeName === "Peniche");
  assert.ok(peniche, "the contested place stays visible");
  assert.ok(peniche!.reason.includes("Supertubos"), "shown with the endorser's words");
});

test("quote-endorsed picks outrank rating-endorsed ones", () => {
  const r = dontMissPicks({ ...base, reflections: fx.reflections });
  assert.ok(r.picks.length >= 2);
  assert.equal(r.picks[0].pin.placeName, "Sintra", "the verbatim endorsement leads");
});

test("private debriefs contribute nothing to picks", () => {
  const rs = fx.reflections.map((r) => ({ ...r, visibility: "private" as const }));
  const r = dontMissPicks({ ...base, reflections: rs });
  assert.ok(!r.picks.some((p) => p.pin.placeName === "Sintra"));
  // ...and the rating-only Peniche is back, since the private skip is unseen.
  assert.ok(r.picks.some((p) => p.pin.placeName === "Peniche"));
});

test("places the viewer already visited stay excluded, quotes or not", () => {
  // Give the viewer a pin in Sintra — the quote should no longer surface it.
  const pins = [
    ...fx.pins,
    {
      ...fx.pins.find((p) => p.id === "p-friend-sintra")!,
      id: "p-viewer-sintra",
      userId: fx.VIEWER,
    },
  ];
  const r = dontMissPicks({ ...base, pins, reflections: fx.reflections });
  assert.ok(!r.picks.some((p) => p.pin.placeName === "Sintra"));
});
