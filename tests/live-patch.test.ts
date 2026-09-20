import "./helpers/browser-globals";
import { test } from "node:test";
import assert from "node:assert/strict";
import { useStore } from "../lib/store";
import type { Pin } from "../lib/types";

// Realtime patches applied to the store: pins upserted or removed, like
// counts merged, notifications deduped and newest first.

const pin = (id: string, title = id): Pin => ({ id, userId: "u-maria", lng: 0, lat: 0, placeName: id, countryCode: "PT", title, note: "", visibility: "friends", media: [], createdAt: "2026-01-01T00:00:00Z" });

test("an upsert replaces a known pin and adds an unknown one; a removal drops it and closes its sheet", () => {
  const s = useStore.getState();
  const before = s.pins.length;
  const known = s.pins[0];
  useStore.setState({ selectedPinId: known.id });
  s.applyLivePatch({ upsertPins: [{ ...known, title: "renamed" }, pin("new-1")] });
  const after = useStore.getState();
  assert.equal(after.pins.length, before + 1);
  assert.equal(after.pins.find((p) => p.id === known.id)?.title, "renamed");
  s.applyLivePatch({ removePinIds: [known.id, "new-1"] });
  const gone = useStore.getState();
  assert.equal(gone.pins.length, before - 1);
  assert.equal(gone.selectedPinId, null, "the open pin closed when it vanished");
});

test("like counts merge; notifications dedupe by id and sort newest first", () => {
  const s = useStore.getState();
  s.applyLivePatch({ likeCounts: { x: 3 } });
  s.applyLivePatch({ likeCounts: { y: 1 } });
  assert.equal(useStore.getState().likeCounts.x, 3);
  assert.equal(useStore.getState().likeCounts.y, 1);
  const n = { id: "n-live", type: "like" as const, actorId: "u-leo", read: false, createdAt: "2030-01-01T00:00:00Z" };
  s.applyLivePatch({ notifications: [n] });
  s.applyLivePatch({ notifications: [{ ...n, read: true }] });
  const notes = useStore.getState().notifications;
  assert.equal(notes.filter((x) => x.id === "n-live").length, 1);
  assert.equal(notes[0].id, "n-live", "newest first");
  assert.equal(notes[0].read, true, "the later copy wins");
});
