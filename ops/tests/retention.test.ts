import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../lib/store";
import { DemoExtractor, DemoDrafter } from "../lib/demo";
import { receiveDocument, processDocument } from "../lib/pipeline";
import { purgeExpired } from "../lib/retention";
import type { Firm } from "../lib/types";
import { nowIso } from "../lib/ids";

const firm: Firm = { id: "f1", name: "Correduría Test", kind: "correduria", monthlyTokenBudget: 1_000_000, createdAt: nowIso(), settings: { retentionDays: 30 } };

async function seed(store: MemoryStore, status: "approved" | "awaiting_approval", ageDays: number) {
  const deps = { store, extractor: new DemoExtractor(), drafter: new DemoDrafter() };
  const doc = await receiveDocument(deps, { firm, fileName: "parte-siniestro.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1, 2, 3]) });
  await processDocument(deps, firm, doc.id);
  const updatedAt = new Date(Date.now() - ageDays * 86_400_000).toISOString();
  // Backdate directly: the store stamps updatedAt on every update.
  const rec = (await store.documents.get(doc.id))!;
  await store.documents.insert({ ...rec, status, updatedAt });
  return doc.id;
}

test("documents past the firm's retention lose their file, data, drafts and corrections; the log stays", async () => {
  const store = new MemoryStore();
  await store.firms.upsert(firm);
  const old = await seed(store, "approved", 45);
  const young = await seed(store, "approved", 5);
  const pending = await seed(store, "awaiting_approval", 90);
  assert.ok(await store.files.get((await store.documents.get(old))!.storagePath));

  const s = await purgeExpired(store);
  assert.deepEqual(s, { firms: 1, purged: 1, errors: 0 });
  assert.equal((await store.documents.get(old))!.status, "purged");
  assert.equal(await store.files.get((await store.documents.get(old))!.storagePath), null);
  assert.equal(await store.extractions.latestForDocument(old), null);
  assert.equal((await store.documents.get(young))!.status, "approved");
  assert.ok(await store.extractions.latestForDocument(young));
  assert.equal((await store.documents.get(pending))!.status, "awaiting_approval", "documents still in review are never purged");
  const log = await store.activity.list(firm.id, 500);
  assert.ok(log.some((e) => e.action === "document.purged" && e.entity.id === old));
  assert.ok(log.some((e) => e.action === "document.received" && e.entity.id === old), "audit trail outlives the data");
  // Idempotent: a second run finds nothing.
  assert.equal((await purgeExpired(store)).purged, 0);
});

test("a firm without a retention period keeps everything", async () => {
  const store = new MemoryStore();
  await store.firms.upsert({ ...firm, settings: {} });
  await seed(store, "approved", 400);
  const s = await purgeExpired(store);
  assert.deepEqual(s, { firms: 0, purged: 0, errors: 0 });
});
