import { runFairnessStudy } from './fairness.js';

const result = runFairnessStudy();

console.log(`Loaded ${result.loadedCandles} candles.`);
console.log(
  `Running ${result.roundsPerTimeframe} fairness rounds per timeframe.\n`,
);

console.log('=== PROFILE SCORES ===');
console.log('Profile         | Mean  | Median | p10   | p90');
console.log('-'.repeat(54));

for (const name of result.ladderOrder) {
  const stats = result.profiles[name]!;
  console.log(
    [
      name.padEnd(15),
      stats.mean.toFixed(1).padStart(5),
      stats.median.toFixed(1).padStart(6),
      stats.p10.toFixed(1).padStart(5),
      stats.p90.toFixed(1).padStart(5),
    ].join(' | '),
  );
}

console.log('\n=== PAIRWISE RANKING ===');
console.log('Expected better | Expected worse | Win % | Mean Δ | p10 Δ | p90 Δ');
console.log('-'.repeat(72));

for (const pair of result.pairwise) {
  console.log(
    [
      pair.better.padEnd(15),
      pair.worse.padEnd(14),
      `${(pair.winRate * 100).toFixed(1)}%`.padStart(5),
      pair.meanDelta.toFixed(1).padStart(6),
      pair.p10Delta.toFixed(1).padStart(5),
      pair.p90Delta.toFixed(1).padStart(5),
    ].join(' | '),
  );
}

console.log('\n=== LADDER CONSISTENCY ===');
console.log(
  `Strict monotonic ordering (${result.ladderOrder.join(' > ')}): ${(result.ladderPassRate * 100).toFixed(1)}%`,
);
