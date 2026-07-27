/**
 * v3 engine validation probe.
 *
 * Checks, against historical BTC data:
 *  1. Zero-skill neutrality: naive strategies earn E[U] near 0.5 and E[M] near 1-h
 *  2. Perceptual fairness: visually-close drawings rank near the top of the field,
 *     and the random-walk-beats-close inversion rate collapses vs the v0.2 engine
 *  3. Skill responsiveness: perfect/near-perfect predictions earn top percentiles
 *
 * Usage: npx tsx scripts/v3Probe.ts [roundsPerTimeframe] [fieldB]
 */

import { loadExpandedData } from '../src/scoring/backtest.js';
import { scoreRoundV3, mulberry32, STANDARD_PAYOUT_V3, DEFAULT_FIELD_CONFIG } from '../src/scoring/v3/index.js';

const FIELD_B = Number(process.argv[3] ?? DEFAULT_FIELD_CONFIG.B);

// ─── strategy generators (price paths, anchor first) ────────────────

function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function laggedCopy(actual: number[], lagFrac = 0.08): number[] {
  const N = actual.length;
  const lag = Math.max(1, Math.round(N * lagFrac));
  return actual.map((_, i) => actual[Math.max(0, i - lag)]!);
}

function dampedCopy(actual: number[], factor = 0.7): number[] {
  const p0 = actual[0]!;
  return actual.map((p) => p0 * Math.exp(factor * Math.log(p / p0)));
}

function timeWarpCopy(actual: number[], amp: number, rng: () => number): number[] {
  const N = actual.length;
  const phase = rng() * 2 * Math.PI;
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const warped = t + amp * Math.sin(Math.PI * t + phase) * Math.sin(Math.PI * t);
    const x = Math.min(1, Math.max(0, warped)) * (N - 1);
    const lo = Math.floor(x);
    const hi = Math.min(lo + 1, N - 1);
    const f = x - lo;
    out.push(actual[lo]! * (1 - f) + actual[hi]! * f);
  }
  out[0] = actual[0]!;
  return out;
}

function randomWalk(actual: number[], lookback: number[], rng: () => number): number[] {
  const N = actual.length;
  let sumSq = 0;
  let n = 0;
  for (let i = 1; i < lookback.length; i++) {
    const lr = Math.log(lookback[i]! / lookback[i - 1]!);
    sumSq += lr * lr;
    n++;
  }
  const stepVol = Math.sqrt(sumSq / Math.max(n, 1)) || 1e-6;
  const out = [actual[0]!];
  for (let i = 1; i < N; i++) out.push(out[i - 1]! * Math.exp(gaussian(rng) * stepVol));
  return out;
}

function flatLine(actual: number[]): number[] {
  return new Array(actual.length).fill(actual[0]!);
}

function trendExtrap(actual: number[], lookback: number[]): number[] {
  const N = actual.length;
  const p0 = actual[0]!;
  const n = lookback.length;
  if (n < 2) return flatLine(actual);
  const drift = Math.log(lookback[n - 1]! / lookback[0]!) / n;
  const out = [p0];
  for (let i = 1; i < N; i++) out.push(out[i - 1]! * Math.exp(drift));
  return out;
}

function nearPerfect(actual: number[], noiseFrac: number, rng: () => number): number[] {
  const p0 = actual[0]!;
  const lr = actual.map((p) => Math.log(p / p0));
  const mean = lr.reduce((s, v) => s + v, 0) / lr.length;
  const sigma = Math.sqrt(lr.reduce((s, v) => s + (v - mean) ** 2, 0) / lr.length) || 1e-6;
  return lr.map((r, i) => (i === 0 ? p0 : p0 * Math.exp(r + gaussian(rng) * sigma * noiseFrac)));
}

// ─── experiment ──────────────────────────────────────────────────────

const TIMEFRAMES: Record<string, { stepMin: number; steps: number }> = {
  '15m': { stepMin: 1, steps: 15 },
  '1h': { stepMin: 1, steps: 60 },
  '6h': { stepMin: 5, steps: 72 },
  '24h': { stepMin: 15, steps: 96 },
  '7d': { stepMin: 60, steps: 168 },
};

const ROUNDS_PER_TF = Number(process.argv[2] ?? 40);

console.log('Loading candle data...');
const candles = loadExpandedData();
const closes1m = candles.map((c) => c[1]!);
console.log(`Loaded ${closes1m.length.toLocaleString()} 1m closes. Rounds/TF: ${ROUNDS_PER_TF}\n`);

const rng = mulberry32(987654321);

type Res = { u: number[]; m: number[] };
const strategies = [
  'laggedCopy', 'dampedCopy', 'timeWarpCopy', 'randomWalk', 'flatLine',
  'trendExtrap', 'nearPerfect20', 'perfect',
] as const;
const results: Record<string, Res> = {};
for (const s of strategies) results[s] = { u: [], m: [] };
let rwBeatsLagged = 0;
let nRounds = 0;
const t0 = Date.now();

for (const [, tf] of Object.entries(TIMEFRAMES)) {
  const horizon1m = tf.stepMin * tf.steps;
  const lookbackSteps = tf.steps * 3;
  const lookback1m = tf.stepMin * lookbackSteps;

  for (let r = 0; r < ROUNDS_PER_TF; r++) {
    const start = lookback1m + Math.floor(rng() * (closes1m.length - horizon1m - lookback1m - 1));
    // subsample to the timeframe's step resolution
    const actual: number[] = [];
    for (let i = 0; i <= tf.steps; i++) actual.push(closes1m[start + i * tf.stepMin]!);
    const lookback: number[] = [];
    for (let i = lookbackSteps; i >= 1; i--) lookback.push(closes1m[start - i * tf.stepMin]!);
    if (actual.some((p) => !p) || lookback.some((p) => !p)) continue;

    const seed = Math.floor(rng() * 2 ** 31);
    const preds: Record<string, number[]> = {
      laggedCopy: laggedCopy(actual),
      dampedCopy: dampedCopy(actual),
      timeWarpCopy: timeWarpCopy(actual, 0.07, rng),
      randomWalk: randomWalk(actual, lookback, rng),
      flatLine: flatLine(actual),
      trendExtrap: trendExtrap(actual, lookback),
      nearPerfect20: nearPerfect(actual, 0.2, rng),
      perfect: [...actual],
    };

    const roundRes: Record<string, number> = {};
    for (const s of strategies) {
      const out = scoreRoundV3({
        predictedPrices: preds[s]!,
        actualPrices: actual,
        lookbackPrices: lookback,
        seed,
        fieldConfig: { ...DEFAULT_FIELD_CONFIG, B: FIELD_B },
      });
      results[s]!.u.push(out.percentile);
      results[s]!.m.push(out.multiplier);
      roundRes[s] = out.percentile;
    }
    if (roundRes.randomWalk! > roundRes.laggedCopy!) rwBeatsLagged++;
    nRounds++;
  }
}

function mean(xs: number[]): number {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}
function pct(xs: number[], p: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(p * (sorted.length - 1))]!;
}

const h = STANDARD_PAYOUT_V3.houseEdge;
console.log(`Scored ${nRounds} rounds x ${strategies.length} strategies in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
console.log('strategy        |  E[U]  | U p5  | U p50 | U p95 |  E[M]  | verdict');
console.log('----------------|--------|-------|-------|-------|--------|--------');
for (const s of strategies) {
  const r = results[s]!;
  const eu = mean(r.u);
  const em = mean(r.m);
  const naive = ['randomWalk', 'flatLine', 'trendExtrap'].includes(s);
  const verdict = naive
    ? (eu >= 0.45 && eu <= 0.55 && em <= 1 - h / 2 + 0.03 ? 'NEUTRAL ok' : 'CHECK')
    : '';
  console.log(
    `${s.padEnd(15)} | ${eu.toFixed(3).padStart(6)} | ${pct(r.u, 0.05).toFixed(2)} | ${pct(r.u, 0.5)
      .toFixed(2)} | ${pct(r.u, 0.95).toFixed(2)} | ${em.toFixed(3).padStart(6)} | ${verdict}`,
  );
}
console.log(`\nRandom walk beats lagged copy (percentile): ${((100 * rwBeatsLagged) / nRounds).toFixed(1)}%  (v0.2 engine: 6.9%)`);
console.log(`Target E[M] for zero-skill strategies: ${(1 - h).toFixed(2)}`);
