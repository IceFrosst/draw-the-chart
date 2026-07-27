/** Benchmark scoreRoundV3 across field sizes. Usage: npx tsx scripts/benchV3.ts */
import { loadExpandedData } from '../src/scoring/backtest.js';
import { scoreRoundV3, DEFAULT_FIELD_CONFIG } from '../src/scoring/v3/index.js';

const candles = loadExpandedData();
const closes = candles.map((c) => c[1]!);
const TFS = [
  { name: '15m', stepMin: 1, steps: 15 },
  { name: '1h', stepMin: 1, steps: 60 },
  { name: '7d', stepMin: 60, steps: 168 },
];
for (const B of [1500, 3000, 5000, 10000]) {
  for (const tf of TFS) {
    const lb = tf.steps * 3 * tf.stepMin;
    const start = 1_000_000;
    const actual: number[] = [];
    for (let i = 0; i <= tf.steps; i++) actual.push(closes[start + i * tf.stepMin]!);
    const lookback = closes.slice(start - lb, start).filter((_, i) => i % tf.stepMin === 0);
    const t0 = performance.now();
    const runs = 3;
    for (let r = 0; r < runs; r++) {
      scoreRoundV3({ predictedPrices: actual, actualPrices: actual, lookbackPrices: lookback, seed: 42 + r, fieldConfig: { ...DEFAULT_FIELD_CONFIG, B } });
    }
    console.log(`B=${B.toString().padStart(5)}  ${tf.name.padEnd(4)} ${((performance.now() - t0) / runs).toFixed(0)}ms/round`);
  }
}
