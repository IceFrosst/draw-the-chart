/**
 * Fairness probe: quantifies how often a RANDOM drawing outscores a
 * VISUALLY CLOSE drawing under the current deployed scoring config.
 *
 * "Visually close" archetypes (what a good human drawing looks like):
 *   - laggedCopy:    actual path shifted right by 8% of horizon
 *   - dampedCopy:    actual path with 70% of the amplitude (conservative draw)
 *   - timeWarpCopy:  actual path with turns mistimed by up to ±7% of horizon
 *   - smoothCopy:    heavily smoothed actual (right macro shape, no micro noise)
 *
 * Usage: npx tsx scripts/fairnessProbe.ts
 */

import { computeScore } from '../src/scoring/score.js';
import { loadExpandedData, randomWalkStrategy } from '../src/scoring/backtest.js';

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── visually-close generators ──────────────────────────────────

function laggedCopy(actual: number[], lagFrac = 0.08): number[] {
  const N = actual.length;
  const lag = Math.max(1, Math.round(N * lagFrac));
  const out: number[] = [];
  for (let i = 0; i < N; i++) out.push(actual[Math.max(0, i - lag)]!);
  return out;
}

function dampedCopy(actual: number[], factor = 0.7): number[] {
  const p0 = actual[0]!;
  return actual.map((p) => p0 * Math.exp(factor * Math.log(p / p0)));
}

function timeWarpCopy(actual: number[], amp = 0.07, rng: () => number): number[] {
  const N = actual.length;
  const phase = rng() * 2 * Math.PI;
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    // smooth monotone-ish warp, endpoints fixed
    const warped = t + amp * Math.sin(Math.PI * t + phase) * Math.sin(Math.PI * t);
    const tc = Math.min(1, Math.max(0, warped));
    const x = tc * (N - 1);
    const lo = Math.floor(x);
    const hi = Math.min(lo + 1, N - 1);
    const f = x - lo;
    out.push(actual[lo]! * (1 - f) + actual[hi]! * f);
  }
  out[0] = actual[0]!;
  return out;
}

function smoothCopy(actual: number[], windowFrac = 0.08): number[] {
  const N = actual.length;
  const w = Math.max(2, Math.round(N * windowFrac));
  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(N - 1, i + w); j++) {
      s += actual[j]!;
      c++;
    }
    out.push(s / c);
  }
  // re-anchor at p0
  const shift = actual[0]! / out[0]!;
  return out.map((p) => p * shift);
}

// ─── experiment ──────────────────────────────────────────────────

const TIMEFRAMES: Record<string, number> = {
  '15m': 15,
  '1h': 60,
  '6h': 360,
  '24h': 1440,
  '7d': 10080,
};

const ROUNDS_PER_TF = 300;

console.log('Loading candle data...');
const candles = loadExpandedData();
const closes = candles.map((c) => c[1]!);
console.log(`Loaded ${closes.length.toLocaleString()} closes.`);

const rng = mulberry32(20260609);

interface Tally {
  closeScores: number[];
  rwScores: number[];
  rwWins: number;
  n: number;
}

const archetypes = ['laggedCopy', 'dampedCopy', 'timeWarpCopy', 'smoothCopy'] as const;
const results: Record<string, Tally> = {};
for (const a of archetypes) results[a] = { closeScores: [], rwScores: [], rwWins: 0, n: 0 };

// also track raw baseline means under current config
const baseline: Record<string, number[]> = { randomWalk: [], flat: [] };

for (const [, horizon] of Object.entries(TIMEFRAMES)) {
  for (let r = 0; r < ROUNDS_PER_TF; r++) {
    const start = Math.floor(rng() * (closes.length - horizon - 1));
    const actual = closes.slice(start, start + horizon + 1);
    if (actual.length < horizon + 1) continue;

    const rw = randomWalkStrategy(actual, rng);
    const rwScore = computeScore(rw, actual).total;
    baseline.randomWalk!.push(rwScore);
    baseline.flat!.push(computeScore(new Array(actual.length).fill(actual[0]!), actual).total);

    const closeDrawings: Record<string, number[]> = {
      laggedCopy: laggedCopy(actual),
      dampedCopy: dampedCopy(actual),
      timeWarpCopy: timeWarpCopy(actual, 0.07, rng),
      smoothCopy: smoothCopy(actual),
    };

    for (const a of archetypes) {
      const s = computeScore(closeDrawings[a]!, actual).total;
      const t = results[a]!;
      t.closeScores.push(s);
      t.rwScores.push(rwScore);
      if (rwScore > s) t.rwWins++;
      t.n++;
    }
  }
}

function stats(xs: number[]) {
  const sorted = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
  const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))]!;
  return { mean, p5: q(0.05), p50: q(0.5), p95: q(0.95) };
}

console.log('\n=== Current config: visually-close vs random walk ===\n');
console.log(
  'archetype      | close mean | close p5 | close p50 | RW-beats-close %',
);
for (const a of archetypes) {
  const t = results[a]!;
  const s = stats(t.closeScores);
  console.log(
    `${a.padEnd(14)} | ${s.mean.toFixed(1).padStart(10)} | ${s.p5.toFixed(1).padStart(8)} | ${s.p50
      .toFixed(1)
      .padStart(9)} | ${((100 * t.rwWins) / t.n).toFixed(1).padStart(5)}%`,
  );
}

const rwStats = stats(baseline.randomWalk!);
const flatStats = stats(baseline.flat!);
console.log(
  `\nrandom walk baseline: mean ${rwStats.mean.toFixed(1)}, p5 ${rwStats.p5.toFixed(1)}, p50 ${rwStats.p50.toFixed(
    1,
  )}, p95 ${rwStats.p95.toFixed(1)}`,
);
console.log(
  `flat line baseline:   mean ${flatStats.mean.toFixed(1)}, p5 ${flatStats.p5.toFixed(1)}, p50 ${flatStats.p50.toFixed(
    1,
  )}, p95 ${flatStats.p95.toFixed(1)}`,
);
