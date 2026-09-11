// Extraction evaluation. With ANTHROPIC_API_KEY it measures the real reader
// on the fixture PDFs; without, it runs the demo reader (which classifies by
// file name) so the harness itself is exercised. npm run eval
import { FIXTURES } from "../lib/eval/fixtures";
import { scoreFixture, summarize, type FixtureScore } from "../lib/eval/score";
import { ClaudeExtractor, ClaudeSettlementExtractor, MODEL } from "../lib/claude";
import { DemoExtractor, DemoSettlementExtractor } from "../lib/demo";

async function main() {
  const real = !!process.env.ANTHROPIC_API_KEY;
  const extractor = real ? new ClaudeExtractor() : new DemoExtractor();
  const settlements = real ? new ClaudeSettlementExtractor() : new DemoSettlementExtractor();
  console.log(`reader: ${real ? MODEL : "demo"} · ${FIXTURES.length} fixtures\n`);
  const scores: FixtureScore[] = [];
  let costUsd = 0;
  for (const fx of FIXTURES) {
    const bytes = fx.pdf();
    let score: FixtureScore;
    if (fx.kind === "liquidacion") {
      const r = await settlements.extractSettlement({ mediaType: "application/pdf", bytes, fileName: fx.fileName });
      costUsd += r.usage.costUsd;
      const { lineas, ...head } = r.data;
      score = scoreFixture(fx, "liquidacion", head as unknown as Record<string, unknown>, lineas);
    } else {
      const r = await extractor.extract({ mediaType: "application/pdf", bytes, fileName: fx.fileName });
      costUsd += r.usage.costUsd;
      const section = (r.data as unknown as Record<string, unknown>)[r.data.kind] as Record<string, unknown> | null;
      score = scoreFixture(fx, r.data.kind, section);
    }
    scores.push(score);
    console.log(`${score.kindOk ? "✓" : "✗"} ${fx.name}: ${score.correct} correct, ${score.wrong} wrong, ${score.missed} missed, ${score.invented} invented${score.linesOk != null ? `, lines ${score.linesOk ? "ok" : "off"}` : ""}`);
    for (const f of score.fields) if (f.status !== "correct" && f.status !== "true_null") console.log(`    ${f.status.padEnd(8)} ${f.field}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.got)}${f.quoteFound === false ? " (quote not in document)" : ""}`);
  }
  const s = summarize(scores);
  console.log(`\nfields ${s.fieldsScored} · correct ${s.correct} · wrong ${s.wrong} · missed ${s.missed} · invented ${s.invented} · accuracy ${s.accuracyPct}% · kinds ${s.kindsOk}/${s.fixtures} · cost $${costUsd.toFixed(4)}`);
  if (s.invented > 0) { console.error("\nINVENTED VALUES FOUND: the reader produced values without a real quote. Do not ship."); process.exit(2); }
}
main().catch((e) => { console.error(e); process.exit(1); });
