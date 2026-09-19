import { test } from "node:test";
import assert from "node:assert/strict";
import { skyFor, weatherSummary, isWetHour } from "../lib/fieldbrief/weather";
import { fetchWind, _clearWindCache, type WindHour } from "../lib/fieldbrief/wind";
import { nearestAirfields, loadAirfields, _resetAirfields, AIRFIELD_NEAR_KM } from "../lib/fieldbrief/airfields";

// Sky conditions ride along with the wind forecast; airfields are a
// distance from the bundled overlay. Both must degrade to nothing, never to
// an invented value.

const H = (i: number, extra: Partial<WindHour> = {}): WindHour => ({ time: `2026-09-21T${String(i).padStart(2, "0")}:00:00.000Z`, wind10m: 5, wind120m: 8, gust10m: 10, ...extra });

test("WMO codes map to a label and a wet flag; unknown codes stay unknown", () => {
  assert.deepEqual(skyFor(0), { label: "Clear", glyph: "☀", wet: false });
  assert.equal(skyFor(2).label, "Partly cloudy");
  assert.equal(skyFor(61).wet, true);
  assert.equal(skyFor(95).label, "Thunderstorm");
  assert.equal(skyFor(42).label, "Unknown");
  assert.equal(skyFor(undefined).label, "Unknown");
});

test("an hour is wet when its code is wet or rain is at least as likely as not", () => {
  assert.equal(isWetHour(H(1, { weatherCode: 3, precipProb: 20 })), false);
  assert.equal(isWetHour(H(1, { weatherCode: 3, precipProb: 50 })), true);
  assert.equal(isWetHour(H(1, { weatherCode: 80, precipProb: 10 })), true);
});

test("the day summarises to a dominant sky, wet hours, dry windows and a temperature range", () => {
  const hours = [
    H(6, { weatherCode: 0, precipProb: 0, tempC: 12 }),
    H(7, { weatherCode: 1, precipProb: 5, tempC: 14 }),
    H(8, { weatherCode: 61, precipProb: 80, tempC: 13 }),
    H(9, { weatherCode: 2, precipProb: 10, tempC: 16 }),
    H(10, { weatherCode: 2, precipProb: 10, tempC: 18 }),
  ];
  const w = weatherSummary(hours)!;
  assert.equal(w.dominant.label, "Partly cloudy");
  assert.equal(w.rainHours, 1);
  assert.equal(w.totalHours, 5);
  assert.deepEqual(w.dryWindows.map((d) => d.hours), [2, 2]);
  assert.equal(w.tempMinC, 12);
  assert.equal(w.tempMaxC, 18);
  assert.equal(weatherSummary([H(1)]), null, "no codes, no summary");
});

test("fetchWind carries sky, rain and temperature through and drops malformed readings", async () => {
  _clearWindCache();
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      timezone: "Europe/Lisbon",
      utc_offset_seconds: 3600,
      hourly: {
        time: ["2026-09-21T06:00", "2026-09-21T07:00"],
        wind_speed_10m: [5, 6],
        wind_speed_120m: [9, 10],
        wind_gusts_10m: [11, 12],
        weather_code: [2, 999],
        precipitation_probability: [30, 140],
        precipitation: [0, -1],
        temperature_2m: [18.4, "hot"],
        cloud_cover: [40, null],
      },
    }),
  });
  const r = await fetchWind(38.7, -9.1, "2026-09-21", { fetchImpl });
  assert.ok(!("unavailable" in r));
  if ("unavailable" in r) return;
  assert.equal(r.hours.length, 2);
  assert.deepEqual({ ...r.hours[0] }, { time: "2026-09-21T05:00:00.000Z", wind10m: 5, wind120m: 9, gust10m: 11, weatherCode: 2, precipProb: 30, precipMm: 0, tempC: 18.4, cloudCover: 40 });
  assert.equal(r.hours[1].weatherCode, undefined);
  assert.equal(r.hours[1].precipProb, undefined);
  assert.equal(r.hours[1].precipMm, undefined);
  assert.equal(r.hours[1].tempC, undefined);
  assert.equal(r.hours[1].cloudCover, undefined);
});

test("airfields: nearest first, within range or the single nearest, from a stub list", () => {
  const fields = [
    { name: "Far Field", iata: "FAR", big: false, lat: 40, lng: 0 },
    { name: "Near Field", iata: "NER", big: true, lat: 38.78, lng: -9.13 },
    { name: "Mid Field", iata: "", big: false, lat: 38.9, lng: -9.0 },
  ];
  const near = nearestAirfields(38.7, -9.1, fields);
  assert.deepEqual(near.map((a) => a.iata), ["NER", ""]);
  assert.ok(near[0].distanceKm < 10 && near[0].distanceKm > 0);
  assert.ok(near.every((a) => a.distanceKm <= AIRFIELD_NEAR_KM));
  assert.ok(near[0].bearingDeg >= 0 && near[0].bearingDeg < 360);
  const only = nearestAirfields(0, 0, [fields[0]]);
  assert.equal(only.length, 1, "always at least the nearest one");
  assert.deepEqual(nearestAirfields(0, 0, []), []);
});

test("airfields: the bundled overlay loads, a broken file reads as none", () => {
  _resetAirfields();
  assert.deepEqual(loadAirfields(() => "{not json"), []);
  _resetAirfields();
  const all = loadAirfields();
  assert.ok(all.length > 1000, "bundled OurAirports overlay");
  const lisbon = nearestAirfields(38.72, -9.14, all);
  assert.ok(lisbon.some((a) => a.iata === "LIS"), `LIS near Lisbon, got ${lisbon.map((a) => a.iata).join(",")}`);
  _resetAirfields();
});
