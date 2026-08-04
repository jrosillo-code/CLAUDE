import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createProvider } from '../../index';
import { runEvaluation, formatEvaluationReport } from '../evaluate';

/** CLI entry: `npm run evaluate` — writes JSON + Markdown reports. */
async function main() {
  const root = resolve(process.cwd());
  const fixturesRoot = join(root, 'fixtures');
  const provider = createProvider();
  const runAt = new Date().toISOString();

  console.log(`Running synthetic evaluation with provider "${provider.name}" (${provider.model})...`);
  const result = await runEvaluation(provider, fixturesRoot);

  const outDir = join(root, 'evaluation-reports');
  mkdirSync(outDir, { recursive: true });
  const stamp = runAt.replace(/[:.]/g, '-');
  writeFileSync(join(outDir, `evaluation-${stamp}.json`), JSON.stringify({ runAt, ...result }, null, 2));
  writeFileSync(join(outDir, `evaluation-${stamp}.md`), formatEvaluationReport(result, runAt));

  const m = result.metrics;
  console.log(formatEvaluationReport(result, runAt));
  console.log(`\nReports written to evaluation-reports/evaluation-${stamp}.{json,md}`);

  const gatesOk =
    m.schemaValidity >= 0.98 &&
    m.workflowAccuracy >= 0.9 &&
    m.missingInfoRecall >= 0.85 &&
    m.unsupportedInferenceRate < 0.02 &&
    m.prohibitedActionCompliance === 1;
  if (!gatesOk) {
    console.error('\n❌ Quality gates NOT met.');
    process.exit(1);
  }
  console.log('\n✅ Quality gates met.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
