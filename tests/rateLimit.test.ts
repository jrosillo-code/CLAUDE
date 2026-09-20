import { test } from "node:test";
import assert from "node:assert/strict";
import { withinRateLimit, resetRateLimits, clientIp } from "../lib/rateLimit";

const req = (ip: string) => new Request("http://x/api", { headers: { "x-forwarded-for": ip } });

test("the budget is per scope and per address", () => {
  resetRateLimits();
  for (let i = 0; i < 3; i++) assert.equal(withinRateLimit(req("1.1.1.1"), "a", 3), true);
  assert.equal(withinRateLimit(req("1.1.1.1"), "a", 3), false, "fourth hit is refused");
  assert.equal(withinRateLimit(req("1.1.1.1"), "b", 3), true, "another scope has its own budget");
  assert.equal(withinRateLimit(req("2.2.2.2"), "a", 3), true, "another address has its own budget");
});

test("the window slides", () => {
  resetRateLimits();
  assert.equal(withinRateLimit(req("3.3.3.3"), "a", 1, 1), true);
  assert.equal(withinRateLimit(req("3.3.3.3"), "a", 1, 1), false);
  const until = Date.now() + 5;
  while (Date.now() < until) { /* spin past the window */ }
  assert.equal(withinRateLimit(req("3.3.3.3"), "a", 1, 1), true);
});

test("the first forwarded address wins; none means local", () => {
  assert.equal(clientIp(req("9.9.9.9, 10.0.0.1")), "9.9.9.9");
  assert.equal(clientIp(new Request("http://x/")), "local");
});
