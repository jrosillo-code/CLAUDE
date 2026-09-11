import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyChallenge, verifySignature, parseWebhook } from "../lib/intake/whatsapp";
import { parseEmail, verifySecret } from "../lib/intake/email";

test("WhatsApp verification handshake", () => {
  const q = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "t", "hub.challenge": "123" });
  assert.equal(verifyChallenge(q, "t"), "123");
  assert.equal(verifyChallenge(q, "other"), null);
});

test("WhatsApp signature is checked with the app secret", () => {
  const body = JSON.stringify({ a: 1 });
  const sig = "sha256=" + createHmac("sha256", "secret").update(body).digest("hex");
  assert.equal(verifySignature(body, sig, "secret"), true);
  assert.equal(verifySignature(body, sig, "wrong"), false);
  assert.equal(verifySignature(body, null, "secret"), false);
});

test("WhatsApp payload parses documents and images into inbound messages with media", () => {
  const payload = { entry: [{ changes: [{ value: { messages: [
    { id: "wamid.1", from: "34600000000", timestamp: "1757600000", type: "document", document: { id: "m1", mime_type: "application/pdf", filename: "parte.pdf", caption: "el parte" } },
    { id: "wamid.2", from: "34600000000", timestamp: "1757600001", type: "image", image: { id: "m2", mime_type: "image/jpeg" } },
    { id: "wamid.3", from: "34600000000", timestamp: "1757600002", type: "text", text: { body: "hola" } },
  ] } }] }] };
  const out = parseWebhook("f", payload);
  assert.equal(out.length, 3);
  assert.equal(out[0].media[0].fileName, "parte.pdf");
  assert.equal(out[0].message.text, "el parte");
  assert.equal(out[1].media[0].fileName, "imagen-wamid.2.jpeg");
  assert.equal(out[2].media.length, 0);
  assert.equal(out[2].message.externalId, "wamid.3");
});

test("email payload parses attachments", () => {
  const { message, files } = parseEmail("f", { from: "cliente@example.com", subject: "Factura", attachments: [{ filename: "f.pdf", contentType: "application/pdf", contentBase64: Buffer.from("hi").toString("base64") }] });
  assert.equal(message.channel, "email");
  assert.equal(files[0].bytes.length, 2);
  assert.equal(verifySecret("abc", "abc"), true);
  assert.equal(verifySecret("abd", "abc"), false);
});
