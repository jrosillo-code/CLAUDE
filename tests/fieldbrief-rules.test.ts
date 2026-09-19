import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateRules, EXPIRED_AFTER_DAYS, daysSinceVerified } from "../lib/fieldbrief/rules";
import { RULE_FILES } from "../lib/fieldbrief/rules/index";

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

test("research drafts are never registered or loaded", () => {
  const draftDir = join(DIR, "drafts");
  const drafts = readdirSync(draftDir).filter((f) => /^[a-z]{2}\.json$/.test(f));
  assert.ok(drafts.length > 0, "drafts folder holds the desk-review files");
  for (const f of drafts) {
    const cc = f.slice(0, 2).toUpperCase();
    assert.ok(!(cc in RULE_FILES) || files.includes(f), `${cc} is registered but only exists as a draft`);
  }
  const registry = readFileSync(join(DIR, "index.ts"), "utf8");
  assert.ok(!/drafts\//.test(registry), "rules/index.ts must not import from drafts/");
});

test("unknown is distinct from false: a null flag needs its condition in the note", () => {
  const tpl = JSON.parse(readFileSync(join(DIR, "_template.json"), "utf8"));
  assert.deepEqual(validateRules({ ...tpl, registrationRequired: { value: null, note: "Depends on class and camera." }, maxAltitudeM: null, altitudeNote: "No ceiling verified." }), []);
  assert.ok(validateRules({ ...tpl, registrationRequired: { value: null, note: "" } }).some((p) => p.startsWith("registrationRequired")));
  assert.ok(validateRules({ ...tpl, maxAltitudeM: null }).some((p) => p.startsWith("altitudeNote")));
});
