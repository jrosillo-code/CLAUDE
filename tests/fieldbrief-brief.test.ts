import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleBrief, sanitizeNearby } from "../lib/fieldbrief/assemble";
import { narrativeFor, candidateSentences } from "../lib/fieldbrief/narrative";
import { calmWindows, fetchWind, _clearWindCache } from "../lib/fieldbrief/wind";
import type { CountryRules } from "../lib/fieldbrief/rules";

// The assembler with a stubbed rules lookup and a mocked wind fetch — no
// network, no key. The narrative path must be skipped without a key.

const rules: CountryRules = {
  countryCode: "XX",
  countryName: "Testland",
  regime: "national",
  authorityName: "Testland CAA",
  authorityUrl: "https://caa.test/drones",
  registrationRequired: { value: true, note: "over 250 g" },
  pilotCertRequired: { value: false, note: "" },
  weightClasses: [{ maxGrams: 250, summary: "no cert" }],
  maxAltitudeM: 120,
  maxDistanceRule: "VLOS",
  insuranceRequired: { value: false, note: "" },
  importRestriction: { value: "none", note: "" },
  noFlyHighlights: ["the capital"],
  permitProcess: null,
  nationalApp: { name: "Testland map", url: "https://map.test" },
  sourceUrls: ["https://caa.test/drones"],
  lastVerifiedOn: "2026-06-01",
  verifiedBy: "tester",
  notes: "",
};

const windHours = Array.from({ length: 24 }, (_, i) => ({
  time: `2026-07-01T${String(i).padStart(2, "0")}:00:00Z`,
  wind10m: 10,
  wind120m: 18,
  gust10m: i >= 6 && i <= 9 ? 12 : 40,
}));

test("assembles legality, light, wind and nearby from data alone", async () => {
  const brief = await assembleBrief(
    { lat: 38.72, lng: -9.14, date: "2026-07-01", countryCode: "xx", nearby: { scoutPins: [], reports: [] } },
    {
      rulesFor: (cc) => (cc === "XX" ? rules : null),
      fetchWind: async () => ({ source: "open-meteo", unit: "km/h", hours: windHours }),
      now: () => new Date("2026-07-01T00:00:00Z"),
    }
  );
  assert.equal(brief.source, "live");
  assert.equal(brief.narrative, undefined);
  assert.ok(brief.legality.covered);
  if (brief.legality.covered) {
    assert.equal(brief.legality.asOf, "as of 2026-06-01, per caa.test");
    assert.equal(brief.legality.stale, false);
    assert.equal(brief.legality.flyPath, "/fly/xx");
  }
  assert.ok(brief.light.sunrise && brief.light.sunset);
  assert.ok(!("unavailable" in brief.wind) && brief.wind.hours.length === 24);
  const calm = calmWindows(windHours);
  assert.deepEqual(calm.map((c) => c.hours), [4]);
});

test("an uncovered country is reported as such — never guessed", async () => {
  const brief = await assembleBrief(
    { lat: 1, lng: 1, date: "2026-07-01", countryCode: "ZZ" },
    { rulesFor: () => null, fetchWind: async () => ({ unavailable: true, reason: "mocked" }) }
  );
  assert.deepEqual(brief.legality, { covered: false, countryCode: "ZZ" });
  assert.ok("unavailable" in brief.wind);
});

test("a stale record is flagged, not hidden", async () => {
  const brief = await assembleBrief(
    { lat: 1, lng: 1, date: "2026-07-01", countryCode: "XX" },
    { rulesFor: () => rules, fetchWind: async () => ({ unavailable: true, reason: "mocked" }), now: () => new Date("2027-03-01T00:00:00Z") }
  );
  assert.ok(brief.legality.covered && brief.legality.stale);
});

test("the narrative path is skipped without a key and never called", async () => {
  const brief = await assembleBrief(
    { lat: 1, lng: 1, date: "2026-07-01", countryCode: "XX" },
    { rulesFor: () => rules, fetchWind: async () => ({ unavailable: true, reason: "mocked" }) }
  );
  let called = false;
  const text = await narrativeFor(brief, { apiKey: undefined, complete: async () => { called = true; return "x"; } });
  assert.equal(text, undefined);
  assert.equal(called, false);
});

test("with a key the model only picks from sentences composed by code", async () => {
  const brief = await assembleBrief(
    { lat: 1, lng: 1, date: "2026-07-01", countryCode: "XX" },
    { rulesFor: () => rules, fetchWind: async () => ({ unavailable: true, reason: "mocked" }) }
  );
  const sentences = candidateSentences(brief);
  assert.ok(sentences[0].includes("as of 2026-06-01, per caa.test"));
  let prompt = "";
  const text = await narrativeFor(brief, { apiKey: "k", complete: async (_s, u) => { prompt = u; return " [1, 0, 1] "; } });
  assert.equal(text, `${sentences[1]} ${sentences[0]}`, "picked, de-duplicated, in the model's order");
  assert.ok(prompt.startsWith("0. "), "the model sees the numbered candidates, not free text to rewrite");
  // Prose from the model, however plausible, is never displayed.
  assert.equal(await narrativeFor(brief, { apiKey: "k", complete: async () => "You are allowed to fly at 150 m here." }), undefined);
});

test("wind: timeouts and errors degrade to unavailable, successes are cached", async () => {
  _clearWindCache();
  let calls = 0;
  const ok = async () => {
    calls++;
    return { ok: true, status: 200, json: async () => ({ hourly: { time: ["2026-07-01T00:00"], wind_speed_10m: [5], wind_speed_120m: [9], wind_gusts_10m: [11] } }) };
  };
  const a = await fetchWind(38.72, -9.14, "2026-07-01", { fetchImpl: ok });
  const b = await fetchWind(38.72, -9.14, "2026-07-01", { fetchImpl: ok });
  assert.ok(!("unavailable" in a) && a.hours[0].time === "2026-07-01T00:00:00Z");
  assert.deepEqual(a, b);
  assert.equal(calls, 1, "second call served from cache");
  const bad = await fetchWind(0, 0, "2026-07-01", { fetchImpl: async () => { const e = new Error("t"); e.name = "TimeoutError"; throw e; } });
  assert.ok("unavailable" in bad && /timed out/.test(bad.reason));
  const four = await fetchWind(2, 2, "2026-07-01", { fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({}) }) });
  assert.ok("unavailable" in four && /no forecast/.test(four.reason));
});

test("nearby summaries are clipped to shape and size", () => {
  const n = sanitizeNearby({
    scoutPins: Array.from({ length: 20 }, (_, i) => ({ pinId: `p${i}`, placeName: "x".repeat(500), ownerName: "o", distanceKm: 1.23456, note: "n" })),
    reports: [{ id: "r", ownerHandle: "h", outcome: "flew", flownOn: "2026-01-01", droneClass: "", quote: "q".repeat(5000) }],
  });
  assert.equal(n.scoutPins.length, 12);
  assert.equal(n.scoutPins[0].placeName.length, 120);
  assert.equal(n.scoutPins[0].distanceKm, 1.2);
  assert.equal(n.reports[0].quote.length, 1000);
});

test("wind cache: expires after an hour, isolates dates, and retries after a failure", async () => {
  _clearWindCache();
  let now = 1_000_000;
  let calls = 0;
  const ok = async () => {
    calls++;
    return { ok: true, status: 200, json: async () => ({ hourly: { time: ["2026-07-01T00:00"], wind_speed_10m: [5], wind_speed_120m: [9], wind_gusts_10m: [11] } }) };
  };
  await fetchWind(10, 10, "2026-07-01", { fetchImpl: ok, now: () => now });
  await fetchWind(10, 10, "2026-07-01", { fetchImpl: ok, now: () => now });
  assert.equal(calls, 1, "same place, same date: cached");
  await fetchWind(10, 10, "2026-07-02", { fetchImpl: ok, now: () => now });
  assert.equal(calls, 2, "another date is another entry");
  now += 61 * 60 * 1000;
  await fetchWind(10, 10, "2026-07-01", { fetchImpl: ok, now: () => now });
  assert.equal(calls, 3, "an hour later the entry has expired");
  let failing = true;
  const flaky = async () => {
    if (failing) throw new Error("boom");
    return ok();
  };
  const first = await fetchWind(20, 20, "2026-07-01", { fetchImpl: flaky, now: () => now });
  assert.ok("unavailable" in first);
  failing = false;
  const second = await fetchWind(20, 20, "2026-07-01", { fetchImpl: flaky, now: () => now });
  assert.ok(!("unavailable" in second), "a failure is not cached: the next call retries");
});

test("a negative or non-numeric reading is never a calm hour", () => {
  const hours = [
    { time: "2026-07-01T00:00:00Z", wind10m: 5, wind120m: 8, gust10m: 10 },
    { time: "2026-07-01T01:00:00Z", wind10m: 5, wind120m: 8, gust10m: -1 },
    { time: "2026-07-01T02:00:00Z", wind10m: 5, wind120m: 8, gust10m: Number.NaN },
    { time: "2026-07-01T03:00:00Z", wind10m: 5, wind120m: 8, gust10m: 12 },
  ];
  assert.deepEqual(calmWindows(hours).map((c) => c.hours), [1, 1]);
});
