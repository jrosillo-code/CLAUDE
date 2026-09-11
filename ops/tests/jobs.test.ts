import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { MemoryStore } from "../lib/store";
import { DemoExtractor, DemoDrafter, DemoSettlementExtractor } from "../lib/demo";
import { receiveDocument } from "../lib/pipeline";
import { enqueue, runJobs, isTransient, backoffMs, MAX_ATTEMPTS } from "../lib/jobs";
import { BudgetExceeded } from "../lib/budget";
import type { Firm } from "../lib/types";
import type { Extractor } from "../lib/claude";
import { nowIso } from "../lib/ids";

const firm: Firm = { id: "f1", name: "Correduría Test", kind: "correduria", monthlyTokenBudget: 1_000_000, createdAt: nowIso() };

class FlakyExtractor implements Extractor {
  calls = 0;
  constructor(private failTimes: number, private inner = new DemoExtractor()) {}
  async extract(input: Parameters<Extractor["extract"]>[0]) {
    this.calls++;
    if (this.calls <= this.failTimes) throw new Anthropic.RateLimitError(429, { error: { message: "rate" } }, "rate limited", new Headers());
    return this.inner.extract(input);
  }
}

test("transient classification and backoff", () => {
  assert.equal(isTransient(new Anthropic.RateLimitError(429, {}, "x", new Headers())), true);
  assert.equal(isTransient(new BudgetExceeded("f", 1, 1)), false);
  assert.equal(isTransient(new Error("bad schema")), false);
  assert.equal(backoffMs(1), 30_000);
  assert.equal(backoffMs(3), 120_000);
});

test("a job retries on a transient error, then succeeds when due", async () => {
  const store = new MemoryStore();
  await store.firms.upsert(firm);
  const extractor = new FlakyExtractor(1);
  const deps = { store, extractor, drafter: new DemoDrafter(), settlementExtractor: new DemoSettlementExtractor() };
  const doc = await receiveDocument(deps, { firm, fileName: "factura.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1]) });
  const job = await enqueue(store, firm.id, "process_document", { documentId: doc.id });

  const t0 = new Date("2026-09-12T10:00:00Z");
  const first = await runJobs(deps, 10, () => t0);
  assert.deepEqual(first, { claimed: 1, done: 0, retried: 1, failed: 0 });
  const after = (await store.jobs.get(job.id))!;
  assert.equal(after.status, "queued");
  assert.equal(after.attempts, 1);
  assert.equal(after.runAfter, new Date(t0.getTime() + 30_000).toISOString());

  // Not due yet: the in-memory claim compares with the real clock, so set runAfter to the past to simulate time passing.
  await store.jobs.fail(job.id, "simulate elapsed", new Date(Date.now() - 1000).toISOString());
  const second = await runJobs(deps, 10);
  assert.deepEqual(second, { claimed: 1, done: 1, retried: 0, failed: 0 });
  assert.equal((await store.jobs.get(job.id))!.status, "done");
  assert.equal((await store.documents.get(doc.id))!.status, "awaiting_approval");
  assert.ok((await store.activity.list(firm.id)).some((e) => e.action === "job.retry"));
});

test("a non-transient error fails the job and the document immediately", async () => {
  const store = new MemoryStore();
  const tiny: Firm = { ...firm, monthlyTokenBudget: 1 };
  await store.firms.upsert(tiny);
  await store.usage.add(tiny.id, new Date().toISOString().slice(0, 7), 5, 0);
  const deps = { store, extractor: new DemoExtractor(), drafter: new DemoDrafter(), settlementExtractor: new DemoSettlementExtractor() };
  const doc = await receiveDocument(deps, { firm: tiny, fileName: "factura.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1]) });
  const job = await enqueue(store, tiny.id, "process_document", { documentId: doc.id });
  const r = await runJobs(deps, 10);
  assert.deepEqual(r, { claimed: 1, done: 0, retried: 0, failed: 1 });
  assert.equal((await store.jobs.get(job.id))!.status, "failed");
  assert.equal((await store.documents.get(doc.id))!.status, "failed");
  assert.ok((await store.activity.list(tiny.id)).some((e) => e.action === "job.failed"));
});

test("after the maximum attempts a transient error becomes a failure", async () => {
  const store = new MemoryStore();
  await store.firms.upsert(firm);
  const deps = { store, extractor: new FlakyExtractor(99), drafter: new DemoDrafter(), settlementExtractor: new DemoSettlementExtractor() };
  const doc = await receiveDocument(deps, { firm, fileName: "factura.pdf", mediaType: "application/pdf", bytes: new Uint8Array([1]) });
  const job = await enqueue(store, firm.id, "process_document", { documentId: doc.id });
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await runJobs(deps, 10);
    await store.jobs.fail(job.id, "elapsed", (await store.jobs.get(job.id))!.status === "queued" ? new Date(Date.now() - 1000).toISOString() : null);
  }
  assert.equal((await store.jobs.get(job.id))!.status, "failed");
  assert.equal((await store.jobs.get(job.id))!.attempts, MAX_ATTEMPTS);
});

test("claimed jobs are not claimed twice", async () => {
  const store = new MemoryStore();
  await enqueue(store, firm.id, "process_document", { documentId: "x" });
  assert.equal((await store.jobs.claim(5)).length, 1);
  assert.equal((await store.jobs.claim(5)).length, 0);
});
