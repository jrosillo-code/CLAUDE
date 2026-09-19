// Validate world-list files: schema, size, and a geometry sanity check —
// every place must fall inside (or within ~150 km of) its country's outline
// from the bundled 110m atlas. Usage: npx tsx scripts/lists/validate.ts [files…]
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validateList, LIST_MIN_PLACES, type WorldList } from "../../lib/lists/schema";
import { geoProblems } from "../../lib/lists/geo";

const root = join(__dirname, "..", "..");
const dir = join(root, "lib", "lists", "data");
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => join(dir, f));
let bad = 0;
for (const f of files) {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(f, "utf8"));
  } catch (e) {
    console.log(`✗ ${f}: not JSON (${(e as Error).message})`);
    bad++;
    continue;
  }
  const problems = validateList(raw);
  const list = raw as WorldList;
  if (!problems.length && list.places.length < LIST_MIN_PLACES) problems.push(`only ${list.places.length} places; need at least ${LIST_MIN_PLACES}`);
  if (!problems.length) problems.push(...geoProblems(list, root));
  if (problems.length) {
    bad++;
    console.log(`✗ ${f}: ${problems.length} problem(s)`);
    for (const p of problems.slice(0, 40)) console.log(`   - ${p}`);
    if (problems.length > 40) console.log(`   … ${problems.length - 40} more`);
  } else {
    console.log(`✓ ${f}: ${list.places.length} places`);
  }
}
process.exit(bad ? 1 : 0);
