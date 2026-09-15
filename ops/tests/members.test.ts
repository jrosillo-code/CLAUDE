import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../lib/store";
import { inviteMember, listMembers, canManage } from "../lib/members";
import type { Firm } from "../lib/types";
import { nowIso } from "../lib/ids";

const firm: Firm = { id: "f1", name: "Correduría Test", kind: "correduria", monthlyTokenBudget: 1_000_000, createdAt: nowIso() };

test("an owner invites a person, who then sees the firm; duplicates and bad input are refused", async () => {
  const store = new MemoryStore();
  await store.firms.upsert(firm);
  await store.memberships.add({ firmId: firm.id, userId: "owner-1", role: "owner" });
  assert.equal(await canManage(store, firm.id, "owner-1", false), true);
  assert.equal(await canManage(store, firm.id, "nobody", false), false);
  assert.equal(await canManage(store, firm.id, "nobody", true), true, "the machine key may manage");

  const { member } = await inviteMember(store, { firm, email: " Ana@Despacho.es ", role: "staff", actorId: "owner-1" });
  assert.equal(member.email, "ana@despacho.es");
  assert.equal(await store.memberships.isMember(firm.id, member.userId), true);
  assert.equal(await store.memberships.roleOf(firm.id, member.userId), "staff");
  assert.equal(await canManage(store, firm.id, member.userId, false), false, "staff cannot invite");
  await assert.rejects(inviteMember(store, { firm, email: "ana@despacho.es", role: "staff", actorId: "owner-1" }), /ya pertenece/);
  await assert.rejects(inviteMember(store, { firm, email: "no-es-correo", role: "staff", actorId: "owner-1" }), /correo válido/);
  const list = await listMembers(store, firm.id);
  assert.deepEqual(list.map((m) => m.role), ["owner", "staff"]);
  const log = await store.activity.list(firm.id);
  const entry = log.find((e) => e.action === "member.added");
  assert.ok(entry && !JSON.stringify(entry.detail).includes("ana@despacho.es"), "the log carries a hash, not the address");
});
