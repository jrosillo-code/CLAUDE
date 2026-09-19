import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateRules, EXPIRED_AFTER_DAYS, daysSinceVerified, cityNotesFor, countriesByTier } from "../lib/fieldbrief/rules";
import { RULE_FILES } from "../lib/fieldbrief/rules/index";
import { authorityFor } from "../lib/fieldbrief/rules";
import authorityRows from "../lib/fieldbrief/authorities.json";

// Every curated country file must parse, match the schema, cite at least one
// source, have been verified within a year, and be named after its code.
// The registry and the folder must agree, so no file is silently unbundled.

const DIR = join(__dirname, "..", "lib", "fieldbrief", "rules");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));

test("the template itself matches the schema (so copies start valid)", () => {
  const tpl = JSON.parse(readFileSync(join(DIR, "_template.json"), "utf8"));
  assert.deepEqual(validateRules(tpl), []);
});

for (const file of files) {
  test(`${file}: parses, validates, is sourced, fresh, and named by its code`, () => {
    const raw = JSON.parse(readFileSync(join(DIR, file), "utf8"));
    assert.deepEqual(validateRules(raw), [], "schema problems");
    assert.ok(raw.sourceUrls.length >= 1, "at least one source URL");
    assert.ok(daysSinceVerified(raw) <= EXPIRED_AFTER_DAYS, `lastVerifiedOn older than ${EXPIRED_AFTER_DAYS} days`);
    assert.equal(file, `${raw.countryCode.toLowerCase()}.json`, "filename must be the lower-case country code");
    assert.ok(RULE_FILES[raw.countryCode], `${raw.countryCode} must be registered in rules/index.ts`);
  });
}

test("every registered country has a file in the folder", () => {
  for (const cc of Object.keys(RULE_FILES)) {
    assert.ok(files.includes(`${cc.toLowerCase()}.json`), `${cc} registered but ${cc.toLowerCase()}.json missing`);
  }
});

test("validation rejects a record without sources or with a bad date", () => {
  const tpl = JSON.parse(readFileSync(join(DIR, "_template.json"), "utf8"));
  assert.ok(validateRules({ ...tpl, sourceUrls: [] }).some((p) => p.startsWith("sourceUrls")));
  assert.ok(validateRules({ ...tpl, lastVerifiedOn: "yesterday" }).some((p) => p.startsWith("lastVerifiedOn")));
  assert.ok(validateRules({ ...tpl, countryCode: "prt" }).some((p) => p.startsWith("countryCode")));
});

test("every desk-review record is labelled as such and never attributed to a person", () => {
  for (const cc of Object.keys(RULE_FILES)) {
    const r = RULE_FILES[cc];
    if (r.reviewTier === "desk-review") {
      assert.equal(r.verifiedBy, "codex-source-review", `${cc}: desk reviews carry the review's own tag, not a handle`);
    }
  }
});

test("every unverified record says so in its notes and is never attributed to a person", () => {
  for (const cc of Object.keys(RULE_FILES)) {
    const r = RULE_FILES[cc];
    if (r.reviewTier === "unverified") {
      assert.equal(r.verifiedBy, "claude-general-knowledge", `${cc}: unverified records carry the generator's tag, not a handle`);
      assert.match(r.notes, /not verified/i, `${cc}: notes must say the record is not verified`);
      for (const n of r.cityNotes ?? []) assert.equal(n.reviewTier ?? "unverified", "unverified", `${cc}/${n.city}: a city note inside an unverified record cannot claim a higher tier`);
    }
  }
});

test("city notes validate and match a place name loosely", () => {
  const tpl = JSON.parse(readFileSync(join(DIR, "_template.json"), "utf8"));
  assert.deepEqual(validateRules({ ...tpl, cityNotes: [] }), []);
  assert.deepEqual(validateRules({ ...tpl, cityNotes: [{ city: "Lisbon", note: "Old town is a no-fly zone." }] }), []);
  assert.ok(validateRules({ ...tpl, cityNotes: [{ city: "", note: "x" }] }).some((p) => p.startsWith("cityNotes")));
  assert.ok(validateRules({ ...tpl, cityNotes: [{ city: "Lisbon", note: "x", reviewTier: "guess" }] }).some((p) => p.startsWith("cityNotes")));
  const r = { reviewTier: "desk-review" as const, cityNotes: [{ city: "Lisbon", note: "a" }, { city: "Porto", note: "b", reviewTier: "unverified" as const }] };
  assert.deepEqual(cityNotesFor(r, "Lisbon, Portugal").map((n) => [n.city, n.reviewTier]), [["Lisbon", "desk-review"]]);
  assert.deepEqual(cityNotesFor(r, "Porto").map((n) => n.reviewTier), ["unverified"]);
  assert.deepEqual(cityNotesFor(r, "Faro"), []);
  assert.deepEqual(cityNotesFor(null, "Lisbon"), []);
});

test("countries group by tier and every record lands in exactly one group", () => {
  const g = countriesByTier();
  const total = g.verified.length + g["desk-review"].length + g.unverified.length;
  assert.equal(total, Object.keys(RULE_FILES).length);
});

test("authority links: every entry has a code, a name and an https URL; rules and authorities agree", () => {
  for (const a of authorityRows as { countryCode: string; name: string; authorityName: string; authorityUrl: string }[]) {
    assert.match(a.countryCode, /^[A-Z]{2}$/);
    assert.ok(a.name && a.authorityName);
    assert.ok(a.authorityUrl.startsWith("https://"), `${a.countryCode} authority URL must be https`);
  }
  for (const cc of Object.keys(RULE_FILES)) {
    assert.ok(authorityFor(cc), `${cc} has rules but no authority entry`);
  }
});

test("unknown is distinct from false: a null flag needs its condition in the note", () => {
  const tpl = JSON.parse(readFileSync(join(DIR, "_template.json"), "utf8"));
  assert.deepEqual(validateRules({ ...tpl, registrationRequired: { value: null, note: "Depends on class and camera." }, maxAltitudeM: null, altitudeNote: "No ceiling verified." }), []);
  assert.ok(validateRules({ ...tpl, registrationRequired: { value: null, note: "" } }).some((p) => p.startsWith("registrationRequired")));
  assert.ok(validateRules({ ...tpl, maxAltitudeM: null }).some((p) => p.startsWith("altitudeNote")));
});
