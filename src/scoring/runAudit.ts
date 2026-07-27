/**
 * Run the comprehensive scoring engine audit.
 * Usage: npx tsx src/scoring/runAudit.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { runFullAudit, generateReport } from './backtest.js';

console.log('Starting comprehensive scoring engine audit...\n');

const audit = runFullAudit({
  roundsPerStrategyPerTimeframe: 400,
  seed: 42424242,
});

const report = generateReport(audit);

// Write report to file
const reportPath = path.join(process.cwd(), 'SCORING_AUDIT_REPORT.md');
fs.writeFileSync(reportPath, report);
console.log(`\nReport written to ${reportPath}`);

// Also print summary to console
console.log('\n' + '='.repeat(60));
console.log('AUDIT SUMMARY');
console.log('='.repeat(60));

console.log(`\nTotal runs: ${audit.totalRuns}`);
console.log(`Candles loaded: ${audit.candlesLoaded.toLocaleString()}`);

console.log('\n--- Baseline Check ---');
if (audit.baselineViolations.length === 0) {
  console.log('All baselines within target ranges.');
} else {
  console.log('VIOLATIONS:');
  for (const v of audit.baselineViolations) {
    console.log(`  ${v}`);
  }
}

console.log('\n--- Correlation Matrix ---');
const { labels, matrix } = audit.correlationMatrix;
console.log('        ' + labels.map((l) => l.slice(0, 8).padEnd(10)).join(''));
for (let i = 0; i < labels.length; i++) {
  const row = labels[i]!.slice(0, 8).padEnd(10) +
    matrix[i]!.map((v) => v.toFixed(3).padStart(8) + '  ').join('');
  console.log(row);
}

console.log(`\n--- Monotonicity ---`);
console.log(
  `Violations: ${audit.monotonicity.violations}/${audit.monotonicity.totalPairs} (${(audit.monotonicity.violationRate * 100).toFixed(1)}%)`,
);

console.log(`\n--- Edge Cases ---`);
const passed = audit.edgeCases.filter((e) => e.passed).length;
const total = audit.edgeCases.length;
console.log(`Passed: ${passed}/${total}`);

const failed = audit.edgeCases.filter((e) => !e.passed);
for (const f of failed) {
  console.log(`  FAILED: ${f.name} — ${f.error}`);
}

console.log('\n--- Strategy Scores (mean ± std) ---');
const stratOrder = [
  'Perfect', 'Near Perfect (5%)', 'Near Perfect (20%)', 'Lagged Copy',
  'Slight Offset', 'Naive Trend', 'Mean Reversion', 'Random Walk',
  'Flat Line', 'Random Noise', 'Extreme Spike', 'Inverse',
];

for (const name of stratOrder) {
  const s = audit.strategies[name];
  if (!s) continue;
  console.log(
    `  ${name.padEnd(22)} ${s.stats.mean.toFixed(1).padStart(5)} ± ${s.stats.std.toFixed(1).padStart(4)}  [${s.stats.min.toFixed(0)}-${s.stats.max.toFixed(0)}]`,
  );
}
