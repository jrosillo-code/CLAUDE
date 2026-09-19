import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/field-brief/route";
import { _clearWindCache } from "../lib/fieldbrief/wind";
import { selectNarrative } from "../lib/fieldbrief/narrative";

// HTTP contract of POST /api/field-brief: validation, the privacy boundary
// (never cacheable — the payload carries the viewer's own scouting), the
// no-key path, concurrency and graceful degradation. Network is stubbed.

const realFetch = globalThis.fetch;
const realKey = process.env.ANTHROPIC_API_KEY;
const calls: string[] = [];

function stubFetch(handler: (url: string) => Promise<Response> | Response) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return handler(url);
  }) as typeof fetch;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const post = (body: unknown) => POST(new Request("http://test/api/field-brief", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  _clearWindCache();
  calls.length = 0;
  delete process.env.ANTHROPIC_API_KEY;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey) process.env.ANTHROPIC_API_KEY = realKey;
});

test("rejects malformed JSON and bad coordinates with 400, never cacheable", async () => {
  const a = await post("{not json");
  assert.equal(a.status, 400);
  assert.equal(a.headers.get("cache-control"), "private, no-store");
  const b = await post({ lat: 999, lng: 0 });
  assert.equal(b.status, 400);
  const c = await post({ lat: "x", lng: 1 });
  assert.equal(c.status, 400);
  const d = await post([1, 2]);
  assert.equal(d.status, 400);
});

test("no key: a live brief with no narrative, light computed, wind from the stub", async () => {
  stubFetch((url) =>
    /open-meteo/.test(url)
      ? json({ hourly: { time: ["2026-09-21T06:00", "2026-09-21T07:00"], wind_speed_10m: [5, 6], wind_speed_120m: [9, 10], wind_gusts_10m: [11, 12] } })
      : json({ address: { country_code: "pt" } })
  );
  const res = await post({ lat: 38.7223, lng: -9.1393, date: "2026-09-21" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  const b = await res.json();
  assert.equal(b.source, "live");
  assert.equal(b.narrative, undefined);
  assert.equal(b.place.countryCode, "PT", "reverse geocoded when the client sends no code");
  assert.equal(b.legality.covered, true, "Portugal has a desk-reviewed record");
  assert.equal(b.legality.reviewTier, "desk-review");
  assert.ok(b.legality.tierLabel.length > 0);
  assert.ok(b.light.sunrise);
  assert.equal(b.wind.hours.length, 2);
  assert.ok(Array.isArray(b.airfields) && b.airfields.length >= 1, "nearest airfield from the bundled overlay");
  assert.equal(b.airfields[0].iata, "LIS");
  assert.ok(calls.some((u) => /nominatim/.test(u)) && calls.some((u) => /open-meteo/.test(u)));
});

test("country lookup and wind run concurrently, not back to back", async () => {
  const order: string[] = [];
  stubFetch(async (url) => {
    order.push(`start:${/open-meteo/.test(url) ? "wind" : "country"}`);
    await new Promise((r) => setTimeout(r, 40));
    order.push(`end:${/open-meteo/.test(url) ? "wind" : "country"}`);
    return /open-meteo/.test(url) ? json({ hourly: { time: ["2026-09-21T06:00"], wind_speed_10m: [5], wind_speed_120m: [9], wind_gusts_10m: [11] } }) : json({ address: { country_code: "es" } });
  });
  const res = await post({ lat: 40.4, lng: -3.7, date: "2026-09-21" });
  assert.equal(res.status, 200);
  assert.deepEqual(order.slice(0, 2).sort(), ["start:country", "start:wind"], `both requests start before either ends: ${order.join(",")}`);
});

test("a failed country lookup and a failed forecast keep the remaining cards", async () => {
  stubFetch(async () => {
    throw new Error("network down");
  });
  const res = await post({ lat: 47.3, lng: 8.5, date: "2026-09-21" });
  assert.equal(res.status, 200);
  const b = await res.json();
  assert.equal(b.place.countryCode, null);
  assert.equal(b.legality.covered, false);
  assert.ok(b.light.sunrise, "light still computed");
  assert.equal(b.wind.unavailable, true);
});

test("malformed forecast hours and negative speeds are dropped, never shown as calm", async () => {
  stubFetch((url) =>
    /open-meteo/.test(url)
      ? json({ hourly: { time: ["2026-09-21T06:00", "garbage", "2026-09-21T08:00", "2026-09-21T09:00"], wind_speed_10m: [5, 5, -3, 4], wind_speed_120m: [9, 9, 9, null], wind_gusts_10m: [11, 11, 11, "x"] } })
      : json({ address: { country_code: "pt" } })
  );
  const res = await post({ lat: 38.7, lng: -9.1, date: "2026-09-21", countryCode: "PT" });
  const b = await res.json();
  assert.deepEqual(b.wind.hours.map((h: { time: string }) => h.time), ["2026-09-21T06:00:00.000Z"]);
  assert.ok(!calls.some((u) => /nominatim/.test(u)), "a client-supplied country code skips the reverse lookup");
});

test("the client's nearby summary is echoed back clipped; a stranger's data can't be injected as facts", async () => {
  stubFetch((url) => (/open-meteo/.test(url) ? json({ hourly: { time: [], wind_speed_10m: [] } }) : json({})));
  const res = await post({ lat: 1, lng: 1, date: "2026-09-21", countryCode: "PT", nearby: { scoutPins: [{ pinId: "p", placeName: "x".repeat(300), ownerName: "o", distanceKm: 2, note: "n" }], reports: [] } });
  const b = await res.json();
  assert.equal(b.nearby.scoutPins.length, 1);
  assert.equal(b.nearby.scoutPins[0].placeName.length, 120);
  assert.equal(b.wind.unavailable, true, "an empty forecast is unavailable, not calm");
});

test("selection: only a valid index array is accepted; generated advice and malformed output are rejected", () => {
  const s = ["Rules are shown as of 2026-06-01, per caa.test.", "Sunrise is at 06:12 UTC.", "Wind is unavailable."];
  assert.equal(selectNarrative("[1,0]", s), `${s[1]} ${s[0]}`);
  assert.equal(selectNarrative("```json\n[2]\n```", s), s[2], "fenced answers are tolerated");
  assert.equal(selectNarrative("[0,0,0]", s), s[0], "duplicates collapse");
  assert.equal(selectNarrative("You are allowed to fly here up to 120 m.", s), undefined, "prose is not a pick");
  assert.equal(selectNarrative("[3]", s), undefined, "out of range");
  assert.equal(selectNarrative("[-1]", s), undefined);
  assert.equal(selectNarrative("[0.5]", s), undefined);
  assert.equal(selectNarrative("[]", s), undefined);
  assert.equal(selectNarrative("[0,1,2,0,1]", s), undefined, "more picks than allowed");
  assert.equal(selectNarrative('{"pick":[0]}', s), undefined, "wrong shape");
  assert.equal(selectNarrative(42, s), undefined);
});
