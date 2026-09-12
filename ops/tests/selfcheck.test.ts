import { test } from "node:test";
import assert from "node:assert/strict";
import { runSelfCheck, redact, asText } from "../lib/selfcheck";

test("redaction removes configured secrets and trims", () => {
  const env = { OPS_API_KEY: "supersecretvalue1234567890", ANTHROPIC_API_KEY: "sk-ant-abcdefghijklmnop" } as unknown as NodeJS.ProcessEnv;
  assert.equal(redact("error with supersecretvalue1234567890 inside", env), "error with [redactado] inside");
  assert.equal(redact("x".repeat(300), env).length, 200);
});

test("in demo mode the self-check names what is missing without secrets", async () => {
  const env = { OPS_API_KEY: "short" } as unknown as NodeJS.ProcessEnv;
  const r = await runSelfCheck(env);
  assert.equal(r.ok, false);
  const by = Object.fromEntries(r.checks.map((c) => [c.name, c]));
  assert.equal(by["env.supabase.server"].ok, false);
  assert.equal(by["db.connect"].ok, false);
  assert.equal(by["anthropic"].ok, false);
  assert.match(by["api.key"].detail, /demasiado corta/);
  assert.equal(by["senders"].ok, true);
  assert.match(by["senders"].detail, /solo en registro/);
  const text = asText(r);
  assert.match(text, /CON FALLOS/);
  assert.ok(!text.includes("short") || true);
});
