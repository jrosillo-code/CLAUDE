import { test } from "node:test";
import assert from "node:assert/strict";
import { askFriends, evidenceForApi } from "../lib/askFriends";
import * as fx from "./fixtures";
import type { TripReflection } from "../lib/types";

const base = {
  viewerId: fx.VIEWER,
  users: fx.users,
  pins: fx.pins,
  friendships: fx.friendships,
  follows: fx.follows,
  topPlaces: fx.topPlaces,
  trips: fx.trips,
  likeCounts: fx.likeCounts,
  reflections: fx.reflections,
};

test("a place question surfaces the matching debrief quote verbatim", () => {
  const a = askFriends({ question: "What should I know about Sintra?", ...base });
  const quote = a.quotes.find((q) => q.answer.questionId === "dont_miss");
  assert.ok(quote, "the Sintra 'don't miss' quote surfaces");
  assert.equal(
    quote!.answer.text,
    "The sea mist over Sintra at dawn — skip the palace queue, walk the Moorish wall.",
    "the quote is the author's exact words"
  );
  assert.equal(quote!.owner.id, fx.FRIEND);
  assert.equal(quote!.pin?.placeName, "Sintra");
});

test("a country question reaches trip-level quotes via stop countries", () => {
  const a = askFriends({ question: "What would you skip in Portugal?", ...base });
  assert.ok(
    a.quotes.some((q) => q.answer.questionId === "skip"),
    "the Peniche 'skip' answer matches a Portugal question"
  );
});

test("skip-intent questions rank skip answers first", () => {
  const a = askFriends({ question: "anything to skip in Portugal?", ...base });
  assert.ok(a.quotes.length >= 1);
  assert.equal(a.quotes[0].answer.questionId, "skip");
});

test("quotes never come from an unrelated part of the world", () => {
  const a = askFriends({ question: "Who's been to Japan?", ...base });
  // The friend's debrief is all Portugal — a Japan question keeps pins
  // evidence (Tokyo) but must not drag in Portugal quotes.
  assert.ok(a.evidence.some((e) => e.pin.placeName === "Tokyo"));
  assert.equal(a.quotes.length, 0);
});

test("private and draft debriefs never leak into answers", () => {
  for (const patch of [{ visibility: "private" as const }, { status: "draft" as const }]) {
    const rs: TripReflection[] = fx.reflections.map((r) => ({ ...r, ...patch }));
    const a = askFriends({ question: "What should I know about Sintra?", ...base, reflections: rs });
    assert.equal(a.quotes.length, 0);
  }
});

test("Ask stays a trust surface: strangers' public debriefs are excluded", () => {
  const rs: TripReflection[] = fx.reflections.map((r) => ({
    ...r,
    userId: fx.STRANGER,
    visibility: "public" as const,
  }));
  const a = askFriends({ question: "What should I know about Sintra?", ...base, reflections: rs });
  assert.equal(a.quotes.length, 0);
});

test("the composed answer quotes the friend's words unchanged", () => {
  const a = askFriends({ question: "What should I know about Sintra?", ...base });
  assert.ok(
    a.text.includes("The sea mist over Sintra at dawn"),
    "composed text carries the verbatim quote"
  );
});

test("evidenceForApi ships quotes verbatim for the AI narrative", () => {
  const a = askFriends({ question: "What should I know about Sintra?", ...base });
  const api = evidenceForApi(a);
  const q = api.quotes.find((x) => x.about === "Sintra");
  assert.ok(q);
  assert.equal(q!.answer, "The sea mist over Sintra at dawn — skip the palace queue, walk the Moorish wall.");
  assert.equal(q!.friend, "Frida Friend");
});

test("scale-only answers ('return: yes') carry their structure", () => {
  const a = askFriends({ question: "Would anyone go back to the Silver Coast run?", ...base });
  const ret = a.quotes.find((q) => q.answer.questionId === "return");
  assert.ok(ret, "the return answer surfaces for a trip-title question");
  assert.equal(ret!.answer.scale, "yes");
});
