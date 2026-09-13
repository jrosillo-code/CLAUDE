import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../lib/store";
import { validateSettings, parseInsurerEmails, updateFirmSettings, settingsForForm } from "../lib/settings";
import { assertWithinBudget, noteBudgetCrossing, budgetStatus } from "../lib/budget";
import { RecordingSender } from "../lib/sender";
import { firmSettings, type Firm } from "../lib/types";
import { monthKey, nowIso } from "../lib/ids";

const firm: Firm = { id: "f1", name: "Correduría Test", kind: "correduria", monthlyTokenBudget: 1000, createdAt: nowIso() };

test("settings are validated as a Spanish reader would type them", () => {
  const p = validateSettings({ retentionDays: "90", alertEmail: " ops@despacho.es ", baselineHoursPerWeek: "12,5", insurerEmails: "Aseguradora Ejemplo SA=liq@ejemplo.es\n\nOtra=c@otra.es" });
  assert.deepEqual(p, { retentionDays: 90, alertEmail: "ops@despacho.es", baselineHoursPerWeek: 12.5, insurerEmails: { "Aseguradora Ejemplo SA": "liq@ejemplo.es", Otra: "c@otra.es" } });
  assert.deepEqual(validateSettings({ retentionDays: "", alertEmail: "" }), { retentionDays: null, alertEmail: null });
  assert.throws(() => validateSettings({ retentionDays: "-1" }), /Retención/);
  assert.throws(() => validateSettings({ alertEmail: "nope" }), /Correo de avisos/);
  assert.throws(() => parseInsurerEmails("Aseguradora=sin-arroba"), /Correo no válido/);
});

test("saving settings merges, logs and round-trips to the form", async () => {
  const store = new MemoryStore();
  await store.firms.upsert(firm);
  const a = await updateFirmSettings(store, firm, { retentionDays: "30" }, "u1");
  const b = await updateFirmSettings(store, a, { insurerEmails: "X=x@x.es" }, "u1");
  assert.equal(firmSettings(b).retentionDays, 30, "earlier keys survive a later partial update");
  assert.deepEqual(firmSettings(b).insurerEmails, { X: "x@x.es" });
  assert.deepEqual(settingsForForm(b), { retentionDays: "30", alertEmail: "", baselineHoursPerWeek: "", insurerEmails: "X=x@x.es" });
  assert.ok((await store.activity.list(firm.id)).some((e) => e.action === "settings.updated"));
});

test("the 80% budget warning is logged once per month and emailed when a mailbox is set", async () => {
  const store = new MemoryStore();
  const f: Firm = { ...firm, settings: { alertEmail: "ops@despacho.es" } };
  await store.firms.upsert(f);
  const sender = new RecordingSender();
  await store.usage.add(f.id, monthKey(), 700, 0);
  await assertWithinBudget(store, f, sender);
  assert.equal(sender.sent.length, 0, "below 80% nothing happens");
  await store.usage.add(f.id, monthKey(), 150, 0);
  await assertWithinBudget(store, f, sender);
  await assertWithinBudget(store, f, sender);
  assert.equal(sender.sent.length, 1);
  assert.equal(sender.sent[0].to, "ops@despacho.es");
  assert.match(sender.sent[0].subject ?? "", /85 %/);
  const warnings = (await store.activity.list(f.id)).filter((e) => e.action === "budget.warning");
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].detail?.notified, true);
  assert.equal(await noteBudgetCrossing(store, f, await budgetStatus(store, f), sender), false);
});
