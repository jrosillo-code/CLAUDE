import { test } from "node:test";
import assert from "node:assert/strict";
import { sameOrigin, safeBack, allowedOrigins } from "../lib/runtime";

const mk = (method: string, headers: Record<string, string> = {}, url = "https://ops.example.com/api/tasks/1") => new Request(url, { method, headers });

test("mutations from our own origin pass; reads are never gated", () => {
  assert.equal(sameOrigin(mk("POST", { origin: "https://ops.example.com" })), true);
  assert.equal(sameOrigin(mk("GET")), true);
  assert.equal(sameOrigin(mk("POST", { referer: "https://ops.example.com/app/demo/revisar" })), true);
});

test("a foreign origin, a foreign referer, or no header at all is refused on a mutation", () => {
  assert.equal(sameOrigin(mk("POST", { origin: "https://evil.example" })), false);
  assert.equal(sameOrigin(mk("POST", { referer: "https://evil.example/x" })), false);
  assert.equal(sameOrigin(mk("POST")), false);
  assert.equal(sameOrigin(mk("DELETE", { origin: "null" })), false);
});

test("the public site URL and the forwarded host count as ours", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.empresa.es";
  try {
    assert.equal(sameOrigin(mk("POST", { origin: "https://www.empresa.es" })), true);
    assert.equal(sameOrigin(mk("PATCH", { origin: "https://alias.vercel.app", "x-forwarded-host": "alias.vercel.app", "x-forwarded-proto": "https" })), true);
    assert.ok(allowedOrigins(mk("GET")).has("https://www.empresa.es"));
  } finally { delete process.env.NEXT_PUBLIC_SITE_URL; }
});

test("form posts go back to our own pages only", () => {
  assert.equal(safeBack(mk("POST", { referer: "https://ops.example.com/app/demo/liquidaciones?id=1" })).toString(), "https://ops.example.com/app/demo/liquidaciones?id=1");
  assert.equal(safeBack(mk("POST", { referer: "https://evil.example/phish" })).toString(), "https://ops.example.com/app");
  assert.equal(safeBack(mk("POST", {}), "/contacto").toString(), "https://ops.example.com/contacto");
  assert.equal(safeBack(mk("POST", { referer: "not a url" })).pathname, "/app");
});
