import "./helpers/browser-globals";
import { test } from "node:test";
import assert from "node:assert/strict";

import { fakeStorage as store } from "./helpers/browser-globals";
import { defineOp, drain, isTransient, pendingWrites, _resetOutbox } from "../lib/backend/outbox";

test("transient failures are the network's; refusals are the server's", () => {
  assert.equal(isTransient(new TypeError("Failed to fetch")), true);
  assert.equal(isTransient({ message: "TypeError: fetch failed", code: "" }), true);
  assert.equal(isTransient({ message: "upstream", status: 503 }), true);
  assert.equal(isTransient({ code: "08006", message: "connection failure" }), true);
  assert.equal(isTransient({ code: "42501", message: "new row violates row-level security policy" }), false);
  assert.equal(isTransient({ code: "23505", message: "duplicate key" }), false);
  assert.equal(isTransient({ code: "PGRST116", message: "JSON object requested" }), false);
});

test("a write that fails on the network is queued, then drained once the network is back", async () => {
  _resetOutbox();
  let online = false;
  const landed: string[] = [];
  const save = defineOp<{ id: string }>("test:save", async ({ id }) => {
    if (!online) throw new TypeError("Failed to fetch");
    landed.push(id);
  });
  save({ id: "a" });
  save({ id: "b" });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(landed, []);
  assert.equal(pendingWrites(), 2, "both wait");
  assert.ok(store.get("wp-outbox")?.includes('"a"'), "persisted for a reload");
  online = true;
  await drain();
  assert.deepEqual(landed, ["a", "b"], "oldest first");
  assert.equal(pendingWrites(), 0);
  assert.equal(store.get("wp-outbox"), undefined);
});

test("a refused write is not queued; the refusal handler hears about it", async () => {
  _resetOutbox();
  const refused: unknown[] = [];
  const save = defineOp<{ id: string }>("test:refused", async () => {
    throw { code: "42501", message: "row-level security" };
  }, (e) => refused.push(e));
  save({ id: "x" });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(pendingWrites(), 0);
  assert.equal(refused.length, 1);
});

test("a queued write survives a reload of the module state", async () => {
  _resetOutbox();
  const seen: string[] = [];
  const save = defineOp<{ id: string }>("test:reload", async ({ id }) => {
    if (seen.length === 0) { seen.push("attempt"); throw new TypeError("Failed to fetch"); }
    seen.push(id);
  });
  save({ id: "z" });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(pendingWrites(), 1);
  // "reload": forget the in-memory queue, keep storage
  const kept = store.get("wp-outbox")!;
  _resetOutbox();
  store.set("wp-outbox", kept);
  await drain();
  assert.deepEqual(seen, ["attempt", "z"]);
});
