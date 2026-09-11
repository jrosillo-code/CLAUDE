// Writes the fixture PDFs to tests/fixtures/. npm run fixtures
import { mkdirSync, writeFileSync } from "node:fs";
import { FIXTURES } from "../lib/eval/fixtures";
mkdirSync("tests/fixtures", { recursive: true });
for (const fx of FIXTURES) {
  writeFileSync(`tests/fixtures/${fx.fileName}`, fx.pdf());
  console.log(`wrote tests/fixtures/${fx.fileName}`);
}
