import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateList, LIST_IDS, LIST_META, LIST_MIN_PLACES } from "../lib/lists/schema";
import { geoProblems } from "../lib/lists/geo";
import { LIST_FILES } from "../lib/lists/data/index";
import { listPlacesNear, monthsLabel, allListPlaces, listPlaceById } from "../lib/lists";

// The bundled world lists: every file validates, is big enough, sits on the
// right patch of the planet, is registered, and carries a source — the same
// bar as the country rules. Ids are unique across all lists.

const root = join(__dirname, "..");
const dir = join(root, "lib", "lists", "data");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

for (const file of files) {
  test(`${file}: validates, has ${LIST_MIN_PLACES}+ places, and every place is in or near its country`, () => {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    assert.deepEqual(validateList(raw), []);
    assert.ok(raw.places.length >= LIST_MIN_PLACES, `${raw.places.length} places`);
    assert.equal(file, `${raw.id}.json`);
    assert.deepEqual(geoProblems(raw, root), []);
  });
}

test("every list file is registered and every registered list has a file", () => {
  assert.deepEqual(LIST_FILES.map((l) => `${l.id}.json`).sort(), files.sort());
  for (const l of LIST_FILES) assert.ok(LIST_META[l.id], `${l.id} has meta`);
});

test("all ten lists are present", () => {
  assert.deepEqual(LIST_FILES.map((l) => l.id).sort(), [...LIST_IDS].sort());
});

test("place ids are unique across lists and every place resolves", () => {
  const all = allListPlaces();
  const ids = new Set(all.map((p) => p.id));
  assert.equal(ids.size, all.length);
  assert.ok(all.length >= LIST_MIN_PLACES * LIST_IDS.length, `${all.length} places in total`);
  const first = all[0];
  assert.equal(listPlaceById(first.id)?.name, first.name);
  assert.equal(listPlaceById("nope"), null);
});

test("nearest places and month labels", () => {
  const near = listPlacesNear(38.72, -9.14, 400, 5);
  assert.ok(near.length > 0, "something within 400 km of Lisbon");
  for (let i = 1; i < near.length; i++) assert.ok(near[i].distanceKm >= near[i - 1].distanceKm);
  assert.equal(monthsLabel([]), "All year");
  assert.equal(monthsLabel([5, 6, 7, 8, 9, 10]), "May–Oct");
  assert.equal(monthsLabel([12, 1, 2, 3]), "Dec–Mar");
  assert.equal(monthsLabel([1, 6]), "Jan, Jun");
});

test("the validator rejects the classic mistakes", () => {
  const ok = { id: "beaches", label: "Beaches", blurb: "x", sources: ["s"], compiledOn: "2026-09-19", places: [{ id: "beaches-a", name: "A", lat: 1, lng: 2, countryCode: "PT", region: "r", why: "w", bestMonths: [1], tags: ["swim"], source: "s" }] };
  assert.deepEqual(validateList(ok), []);
  assert.ok(validateList({ ...ok, places: [{ ...ok.places[0], id: "hikes-a" }] }).some((p) => /\.id/.test(p)), "id must carry the list prefix");
  assert.ok(validateList({ ...ok, places: [{ ...ok.places[0], tags: ["powder"] }] }).some((p) => /tags/.test(p)), "tags from the list's vocabulary");
  assert.ok(validateList({ ...ok, places: [{ ...ok.places[0], lat: 0, lng: 0 }] }).some((p) => /null island/.test(p)));
  assert.ok(validateList({ ...ok, places: [ok.places[0], ok.places[0]] }).some((p) => /duplicate/.test(p)));
  assert.ok(validateList({ ...ok, places: [{ ...ok.places[0], countryCode: "uk" }] }).some((p) => /countryCode/.test(p)));
});
