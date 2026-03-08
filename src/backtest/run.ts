import { runPayoutEconomicsAnalysis } from './economics.js';
import { BACKTEST_TIMEFRAMES, runBacktestSuite } from './harness.js';

const result = runBacktestSuite();

console.log(`Loaded ${result.loadedCandles} candles.`);
console.log(
  `Running ${result.roundsPerStrategy} rounds per strategy per timeframe.\n`,
);

for (const [timeframeName, timeframeMinutes] of Object.entries(
  BACKTEST_TIMEFRAMES,
)) {
  const timeframeStats = result.perTimeframe[timeframeName];
  if (!timeframeStats) {
    continue;
  }

  console.log(`=== Timeframe: ${timeframeName} (${timeframeMinutes} minutes) ===`);

  for (const [strategyName, stats] of Object.entries(timeframeStats)) {
    console.log(`  ${strategyName}:`);
    console.log(
      `    Total:     mean=${stats.total.mean.toFixed(1)}, median=${stats.total.median.toFixed(1)}, std=${stats.total.std.toFixed(1)}, [${stats.total.min.toFixed(1)}, ${stats.total.max.toFixed(1)}], p10=${stats.total.p10.toFixed(1)}, p90=${stats.total.p90.toFixed(1)}`,
    );
    console.log(
      `    Direction: mean=${stats.direction.mean.toFixed(1)}, Magnitude: mean=${stats.magnitude.mean.toFixed(1)}, TurningPt: mean=${stats.turningPoints.mean.toFixed(1)}, Vol: mean=${stats.volatility.mean.toFixed(1)}`,
    );
  }

  console.log();
}

console.log('\n=== SUMMARY ===');
console.log('Strategy         | 15m   | 1h    | 6h    | 24h   | 7d');
console.log('-'.repeat(65));

const strategyNames = [
  'Random Walk',
  'Flat Line',
  'Naive Trend',
  'Mean Reversion',
  'Near Perfect',
];

for (const strategyName of strategyNames) {
  const row = [strategyName.padEnd(17)];
  for (const timeframeName of Object.keys(BACKTEST_TIMEFRAMES)) {
    const timeframeStats = result.perTimeframe[timeframeName]?.[strategyName];
    row.push(
      timeframeStats
        ? timeframeStats.total.mean.toFixed(1).padStart(5)
        : '  N/A',
    );
  }
  console.log(row.join(' | '));
}

console.log('\n=== BASELINE TARGET CHECK ===');
console.log('Target ranges from CLAUDE.md:');
console.log('  Random Walk:   30–35');
console.log('  Flat Line:     25–35');
console.log('  Naive Trend:   35–50');
console.log('  Near Perfect:  ~100');
console.log();

for (const strategyName of strategyNames) {
  const overallMean = result.overallMeans[strategyName];
  if (overallMean == null) {
    continue;
  }
  console.log(`  ${strategyName}: overall mean = ${overallMean.toFixed(1)}`);
}

const economics = runPayoutEconomicsAnalysis();

console.log('\n=== PAYOUT ECONOMICS ===');
console.log('Strategy         | Mean x | Win % | p99 x | Max x');
console.log('-'.repeat(60));

for (const strategyName of strategyNames) {
  const stats = economics.strategies[strategyName];
  if (!stats) {
    continue;
  }
  console.log(
    [
      strategyName.padEnd(17),
      stats.meanMultiplier.toFixed(2).padStart(6),
      `${(stats.profitableRate * 100).toFixed(1)}%`.padStart(6),
      stats.p99Multiplier.toFixed(2).padStart(6),
      stats.maxMultiplier.toFixed(2).padStart(6),
    ].join(' | '),
  );
}

console.log('\n=== STRATEGY BLENDS ===');
for (const blend of economics.blends) {
  console.log(
    `  ${blend.name}: mean multiplier = ${blend.meanMultiplier.toFixed(2)}, mean profit per $100 stake = ${blend.meanProfitPer100Stake.toFixed(2)}`,
  );
}
