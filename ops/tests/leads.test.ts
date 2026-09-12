import { test } from "node:test";
import assert from "node:assert/strict";
import { validateLead, saveLead } from "../lib/leads";
import { MemoryStore } from "../lib/store";
import { RecordingSender } from "../lib/sender";

test("lead validation: honeypot, email, message length, kind default", () => {
  assert.deepEqual(validateLead({ name: "Ana", email: "a@b.es", message: "Tenemos 40 liquidaciones al mes", website: "http://spam" }), { ok: false, error: "spam" });
  assert.equal(validateLead({ name: "A", email: "a@b.es", message: "Tenemos 40 liquidaciones al mes" }).ok, false);
  assert.equal(validateLead({ name: "Ana", email: "nope", message: "Tenemos 40 liquidaciones al mes" }).ok, false);
  assert.equal(validateLead({ name: "Ana", email: "a@b.es", message: "corto" }).ok, false);
  const ok = validateLead({ name: " Ana ", email: "A@B.es", message: "Tenemos 40 liquidaciones al mes", kind: "banco", ip: "1.2.3.4" });
  assert.equal(ok.ok, true);
  if (ok.ok) { assert.equal(ok.lead.name, "Ana"); assert.equal(ok.lead.email, "a@b.es"); assert.equal(ok.lead.kind, "otro"); assert.equal(ok.lead.ipHash!.length, 16); }
});

test("saving a lead stores it and notifies when a recipient is configured", async () => {
  const store = new MemoryStore();
  const sender = new RecordingSender();
  const v = validateLead({ name: "Ana", email: "a@b.es", message: "Tenemos 40 liquidaciones al mes", firm: "Correduría X", kind: "correduria" });
  assert.ok(v.ok);
  if (!v.ok) return;
  const r1 = await saveLead(store, v.lead, { sender, to: null, from: null });
  assert.equal(r1.notified, false);
  const r2 = await saveLead(store, v.lead, { sender, to: "founder@x.es", from: "web@x.es" });
  assert.equal(r2.notified, true);
  assert.equal(sender.sent[0].to, "founder@x.es");
  assert.match(sender.sent[0].subject!, /Correduría X/);
  assert.equal((await store.leads.list()).length, 2);
});
