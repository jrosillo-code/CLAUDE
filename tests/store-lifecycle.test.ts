import { test } from "node:test";
import assert from "node:assert/strict";
import { useStore } from "../lib/store";
import { askFriends } from "../lib/askFriends";
import { CURRENT_USER_ID, seedLikeCounts } from "../lib/seed";

// The full client-side debrief lifecycle against the real store (in-memory
// demo path — the write-through calls are gated off). This is the state
// machine the UI drives: create → save partially → resume → complete → edit
// → change visibility → delete, with evidence checked downstream at each end.

const s = () => useStore.getState();

function askAbout(place: string, viewerId: string) {
  const st = s();
  return askFriends({
    question: `What should I know about ${place}?`,
    viewerId,
    users: st.users,
    pins: st.pins,
    friendships: st.friendships,
    follows: st.follows,
    topPlaces: st.topPlaces,
    trips: st.trips,
    likeCounts: seedLikeCounts,
    reflections: st.reflections,
  });
}

test("debrief lifecycle: create → partial → resume → complete → edit → visibility → delete", () => {
  // The demo viewer owns trip-1 (Atlantic Coast Roadtrip), not yet completed.
  assert.equal(s().trips.find((t) => t.id === "trip-1")!.completedOn, undefined);

  // Mark complete.
  s().completeTrip("trip-1");
  assert.ok(s().trips.find((t) => t.id === "trip-1")!.completedOn);

  // Create a draft and save partial progress.
  const id = s().startReflection("trip-1")!;
  assert.ok(id);
  s().saveReflectionAnswer(id, {
    questionId: "dont_miss",
    prompt: "What would you tell a friend not to miss?",
    text: "Figueira's long empty sand at sunset.",
    pinId: null,
    source: "text",
  });
  let r = s().reflections.find((x) => x.id === id)!;
  assert.equal(r.status, "draft");
  assert.equal(r.answers.length, 1);

  // Resume later: startReflection returns the SAME draft, answers intact.
  assert.equal(s().startReflection("trip-1"), id);
  assert.equal(s().reflections.find((x) => x.id === id)!.answers.length, 1);

  // A draft is not evidence — even the author's friends can't retrieve it.
  // (Maria is friends with the viewer in the seed.)
  const before = askAbout("Figueira", "u-maria");
  assert.equal(before.quotes.length, 0, "draft answers never surface");

  // Complete it → evidence appears for friends, verbatim.
  s().completeReflection(id);
  const after = askAbout("Figueira", "u-maria");
  assert.equal(after.quotes.length, 1);
  assert.equal(after.quotes[0].answer.text, "Figueira's long empty sand at sunset.");

  // Edit a completed answer → the evidence is replaced, no stale quotes.
  s().saveReflectionAnswer(id, {
    questionId: "dont_miss",
    prompt: "What would you tell a friend not to miss?",
    text: "Figueira's beach — and the fish market before noon.",
    pinId: null,
    source: "text",
  });
  const edited = askAbout("Figueira", "u-maria");
  assert.equal(edited.quotes.length, 1);
  assert.ok(edited.quotes[0].answer.text.includes("fish market"));
  assert.ok(!edited.quotes.some((q) => q.answer.text.includes("empty sand at sunset")));

  // Visibility change takes effect immediately.
  s().setReflectionVisibility(id, "private");
  assert.equal(askAbout("Figueira", "u-maria").quotes.length, 0, "private hides instantly");
  s().setReflectionVisibility(id, "friends");
  assert.equal(askAbout("Figueira", "u-maria").quotes.length, 1, "restoring shows instantly");

  // Remove one answer (edit flow's delete) → gone downstream.
  s().removeReflectionAnswer(id, "dont_miss");
  assert.equal(askAbout("Figueira", "u-maria").quotes.length, 0);

  // Delete the whole debrief.
  s().saveReflectionAnswer(id, {
    questionId: "surprise",
    prompt: "What surprised you?",
    text: "How cold the Atlantic stays in July.",
    pinId: null,
    source: "text",
  });
  s().deleteReflection(id);
  assert.equal(
    s().reflections.find((x) => x.id === id),
    undefined
  );
});

test("only the trip owner can start or mutate a debrief", () => {
  // trip-2 belongs to Maria; the demo viewer cannot debrief it.
  assert.equal(s().viewerId, CURRENT_USER_ID);
  assert.equal(s().startReflection("trip-2"), null);

  // Nor can the viewer mutate Maria's seeded reflection.
  const maria = s().reflections.find((r) => r.id === "refl-trip-2-u-maria")!;
  const originalText = maria.answers[0].text;
  s().saveReflectionAnswer(maria.id, {
    questionId: "dont_miss",
    prompt: "x",
    text: "vandalized",
    pinId: null,
    source: "text",
  });
  s().setReflectionVisibility(maria.id, "public");
  s().deleteReflection(maria.id);
  const after = s().reflections.find((r) => r.id === "refl-trip-2-u-maria")!;
  assert.ok(after, "another user's reflection survives deletion attempts");
  assert.equal(after.visibility, "friends");
  assert.equal(after.answers[0].text, originalText);
});

test("completing someone else's trip is a no-op", () => {
  const before = s().trips.find((t) => t.id === "trip-2")!.completedOn;
  s().completeTrip("trip-2");
  assert.equal(s().trips.find((t) => t.id === "trip-2")!.completedOn, before);
});
