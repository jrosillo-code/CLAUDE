import { test } from "node:test";
import assert from "node:assert/strict";
import { WhatsAppSender } from "../lib/senders/whatsapp";
import { RoutingSender, RecordingSender } from "../lib/sender";
import type { Draft } from "../lib/types";

const draft = (channel: "email" | "whatsapp"): Draft => ({ id: "d", firmId: "f", documentId: "x", channel, to: channel === "email" ? "a@b.c" : "+34 600 000 000", subject: "s", body: "b", usage: null, createdAt: "" });

test("WhatsApp sender posts to the Graph API and reports the 24-hour window", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  const fake = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body) });
    return new Response(JSON.stringify({ messages: [{ id: "wamid.9" }] }), { status: 200 });
  }) as typeof fetch;
  const ok = await new WhatsAppSender("123", "tok", "v21.0", fake).send(draft("whatsapp"));
  assert.deepEqual(ok, { ok: true, externalId: "wamid.9" });
  assert.match(calls[0].url, /\/v21\.0\/123\/messages$/);
  assert.match(calls[0].body, /"to":"34600000000"/);

  const closed = (async () => new Response(JSON.stringify({ error: { code: 131047, message: "window" } }), { status: 400 })) as unknown as typeof fetch;
  const r = await new WhatsAppSender("123", "tok", "v21.0", closed).send(draft("whatsapp"));
  assert.equal(r.ok, false);
  assert.equal(r.needsTemplate, true);
  const wrong = await new WhatsAppSender("123", "tok", "v21.0", fake).send(draft("email"));
  assert.equal(wrong.ok, false);
});

test("routing sender picks by channel and falls back", async () => {
  const email = new RecordingSender();
  const wa = new RecordingSender();
  const fallback = new RecordingSender();
  const r = new RoutingSender(email, null, fallback);
  await r.send(draft("email"));
  await r.send(draft("whatsapp"));
  assert.equal(email.sent.length, 1);
  assert.equal(wa.sent.length, 0);
  assert.equal(fallback.sent.length, 1);
});
