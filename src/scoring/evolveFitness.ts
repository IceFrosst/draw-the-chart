/**
 * Fitness evaluation for the evolutionary optimizer.
 *
 * Wraps the backtest harness to evaluate genomes against historical data.
 * Uses a reduced strategy set for speed during GA search.
 */

import { pricesToLogReturns, resamplePath } from './score.js';
import { computeVariantScoreFromLogReturns } from './scoreVariant.js';
import type { Genome, FitnessResult } from './evolveTypes.js';
import type { VariantScoreBreakdown } from './scoreVariant.js';

// ─── PRNG ────────────────────────────────────────────────────

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

function gaussianRandom(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─── STRATEGIES ──────────────────────────────────────────────

// Reduced strategy set for speed (7 instead of 12)
type StrategyFn = (actual: number[], rng: () => number) => number[];

function flatLineStrategy(actual: number[]): number[] {
  return new Array(actual.length).fill(actual[0]!);
}

function randomWalkStrategy(actual: number[], rng: () => number): number[] {
  const N = actual.length;
  if (N < 2) return [...actual];

  // Compute per-step volatility from actual
  const logReturns: number[] = [];
  for (let i = 1; i < N; i++) {
    logReturns.push(Math.log(actual[i]! / actual[i - 1]!));
  }
  const mean = logReturns.reduce((s, v) => s + v, 0) / logReturns.length;
  const variance = logReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / logReturns.length;
  const stepSigma = Math.sqrt(variance);

  const path = [actual[0]!];
  for (let i = 1; i < N; i++) {
    const step = gaussianRandom(rng) * stepSigma;
    path.push(path[i - 1]! * Math.exp(step));
  }
  return path;
}

function perfectStrategy(actual: number[]): number[] {
  return [...actual];
}

function inverseStrategy(actual: number[]): number[] {
  const p0 = actual[0]!;
  return actual.map((p) => p0 * Math.exp(-Math.log(p / p0)));
}

function trendStrategy(actual: number[], rng: () => number): number[] {
  const N = actual.length;
  if (N < 2) return [...actual];

  // Use a lookback period to extrapolate trend
  const lookback = Math.min(60, Math.floor(N * 0.3));
  const startIdx = Math.max(0, N - lookback - 1);
  const logReturn = Math.log(actual[0]! / actual[startIdx]!) / lookback;

  const path = [actual[0]!];
  for (let i = 1; i < N; i++) {
    path.push(path[i - 1]! * Math.exp(logReturn));
  }
  return path;
}

function nearPerfectStrategy(actual: number[], rng: () => number): number[] {
  const N = actual.length;
  const noiseFrac = 0.05;

  const logReturns: number[] = [];
  for (let i = 1; i < N; i++) {
    logReturns.push(Math.log(actual[i]! / actual[i - 1]!));
  }
  const mean = logReturns.reduce((s, v) => s + v, 0) / logReturns.length;
  const variance = logReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / logReturns.length;
  const sigma = Math.sqrt(variance);

  return actual.map((p, i) => {
    if (i === 0) return p;
    const noise = gaussianRandom(rng) * sigma * noiseFrac * Math.sqrt(i);
    return p * Math.exp(noise);
  });
}

function driftedCopyStrategy(actual: number[], rng: () => number): number[] {
  const N = actual.length;
  const driftScale = 1.0;

  const logReturns: number[] = [];
  for (let i = 1; i < N; i++) {
    logReturns.push(Math.log(actual[i]! / actual[i - 1]!));
  }
  const variance = logReturns.reduce((s, v) => s + v * v, 0) / logReturns.length;
  const sigma = Math.sqrt(variance);

  const driftDir = rng() > 0.5 ? 1 : -1;
  const driftRate = driftDir * sigma * driftScale;

  return actual.map((p, i) => {
    const drift = driftRate * (i / N);
    return p * Math.exp(drift);
  });
}

const STRATEGIES: Array<{ name: string; fn: StrategyFn }> = [
  { name: 'Perfect', fn: (a) => perfectStrategy(a) },
  { name: 'Near Perfect', fn: (a, r) => nearPerfectStrategy(a, r) },
  { name: 'Drifted Copy', fn: (a, r) => driftedCopyStrategy(a, r) },
  { name: 'Naive Trend', fn: (a, r) => trendStrategy(a, r) },
  { name: 'Random Walk', fn: (a, r) => randomWalkStrategy(a, r) },
  { name: 'Flat Line', fn: (a) => flatLineStrategy(a) },
  { name: 'Inverse', fn: (a) => inverseStrategy(a) },
];

// ─── TIMEFRAMES ──────────────────────────────────────────────

const TIMEFRAME_MINUTES: Record<string, number> = {
  '15m': 15,
  '1h': 60,
  '6h': 360,
  '24h': 1440,
  '7d': 10080,
};

// ─── EVALUATION ──────────────────────────────────────────────

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;

  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let vx = 0;
  let vy = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }

  if (vx < 1e-16 || vy < 1e-16) return 0;
  return cov / Math.sqrt(vx * vy);
}

/**
 * Evaluate a genome's fitness against historical candle data.
 */
export function evaluateGenome(
  genome: Genome,
  candles: number[][],
  roundsPerStratPerTf: number,
  rngSeed: number,
): FitnessResult {
  const startTime = Date.now();
  const rng = mulberry32(rngSeed);

  const allScores: VariantScoreBreakdown[] = [];
  const strategyMeans: Record<string, number> = {};

  for (const strat of STRATEGIES) {
    const stratScores: VariantScoreBreakdown[] = [];

    for (const [tfName, tfMinutes] of Object.entries(TIMEFRAME_MINUTES)) {
      const windowSize = tfMinutes + 1;

      for (let r = 0; r < roundsPerStratPerTf; r++) {
        // Pick random window from candle data
        const maxStart = candles.length - windowSize;
        if (maxStart <= 0) continue;

        const startIdx = Math.floor(rng() * maxStart);
        const window = candles.slice(startIdx, startIdx + windowSize);

        // Extract close prices
        const actualPrices = window.map((c) => c[1]!);
        if (actualPrices.length < 2) continue;

        // Generate predicted path
        const predictedPrices = strat.fn(actualPrices, rng);

        // Convert to log-returns and resample
        const predLR = resamplePath(pricesToLogReturns(predictedPrices), 120);
        const actLR = resamplePath(pricesToLogReturns(actualPrices), 120);

        // Score using variant system
        const breakdown = computeVariantScoreFromLogReturns(predLR, actLR, genome);
        stratScores.push(breakdown);
        allScores.push(breakdown);
      }
    }

    const totals = stratScores.map((s) => s.total);
    strategyMeans[strat.name] =
      totals.length > 0 ? totals.reduce((s, v) => s + v, 0) / totals.length : 0;
  }

  // Compute metrics
  const rwMean = strategyMeans['Random Walk'] ?? 0;
  const flatMean = strategyMeans['Flat Line'] ?? 0;
  const trendMean = strategyMeans['Naive Trend'] ?? 0;
  const perfectMean = strategyMeans['Perfect'] ?? 0;
  const inverseMean = strategyMeans['Inverse'] ?? 0;

  // Score spread
  const allMeans = Object.values(strategyMeans);
  const scoreSpread = allMeans.length > 0
    ? Math.max(...allMeans) - Math.min(...allMeans)
    : 0;

  // Dir x Mag correlation
  const dirMagCorrelation = pearsonCorrelation(
    allScores.map((s) => s.normalized.direction),
    allScores.map((s) => s.normalized.magnitude),
  );

  // Monotonicity: quick sample test
  let violations = 0;
  let monotonicityTests = 0;
  const monSampleSize = 50;

  for (let t = 0; t < monSampleSize; t++) {
    const maxStart = candles.length - 120;
    if (maxStart <= 0) break;

    const startIdx = Math.floor(rng() * maxStart);
    const window = candles.slice(startIdx, startIdx + 120);
    const actualPrices = window.map((c) => c[1]!);
    if (actualPrices.length < 2) continue;

    const actLR = resamplePath(pricesToLogReturns(actualPrices), 120);

    // Close prediction (2% noise)
    const closePred = actualPrices.map((p, i) => {
      if (i === 0) return p;
      return p * Math.exp(gaussianRandom(rng) * 0.02);
    });
    const closeLR = resamplePath(pricesToLogReturns(closePred), 120);

    // Far prediction (15% noise)
    const farPred = actualPrices.map((p, i) => {
      if (i === 0) return p;
      return p * Math.exp(gaussianRandom(rng) * 0.15);
    });
    const farLR = resamplePath(pricesToLogReturns(farPred), 120);

    const closeScore = computeVariantScoreFromLogReturns(closeLR, actLR, genome);
    const farScore = computeVariantScoreFromLogReturns(farLR, actLR, genome);

    monotonicityTests++;
    if (farScore.total > closeScore.total) violations++;
  }

  const monotonicity = monotonicityTests > 0 ? violations / monotonicityTests : 0;

  // Baseline compliance
  const baselinesPassed =
    rwMean >= 30 && rwMean <= 35 &&
    flatMean >= 25 && flatMean <= 35 &&
    trendMean >= 35 && trendMean <= 50 &&
    perfectMean >= 99;

  // Composite fitness score
  const compositeScore = computeCompositeFitness({
    baselinesPassed,
    rwMean,
    flatMean,
    trendMean,
    perfectMean,
    inverseMean,
    scoreSpread,
    monotonicity,
    dirMagCorrelation,
  });

  return {
    compositeScore,
    baselinesPassed,
    rwMean,
    flatMean,
    trendMean,
    perfectMean,
    inverseMean,
    scoreSpread,
    monotonicity,
    dirMagCorrelation,
    evaluationTimeMs: Date.now() - startTime,
  };
}

function computeCompositeFitness(metrics: {
  baselinesPassed: boolean;
  rwMean: number;
  flatMean: number;
  trendMean: number;
  perfectMean: number;
  inverseMean: number;
  scoreSpread: number;
  monotonicity: number;
  dirMagCorrelation: number;
}): number {
  let score = 0;

  // 1. Baseline compliance (40 points max)
  if (metrics.baselinesPassed) {
    score += 25;
    score += 5 * Math.exp(-Math.pow((metrics.rwMean - 32.5) / 2.5, 2));
    score += 5 * Math.exp(-Math.pow((metrics.flatMean - 30) / 5, 2));
    score += 5 * Math.exp(-Math.pow((metrics.trendMean - 42.5) / 7.5, 2));
  }

  // 2. Score spread (15 points max) — wider is better
  score += 15 * Math.min(1, metrics.scoreSpread / 86);

  // 3. Monotonicity (20 points max) — lower violation rate is better
  score += 20 * Math.exp(-10 * metrics.monotonicity);

  // 4. Dir x Mag independence (15 points max)
  const corr = Math.abs(metrics.dirMagCorrelation);
  if (corr < 0.6) {
    score += 15;
  } else if (corr < 0.8) {
    score += 15 * (0.8 - corr) / 0.2;
  }

  // 5. Inverse should score low (10 points max)
  if (metrics.inverseMean < 15) {
    score += 10;
  } else if (metrics.inverseMean < 20) {
    score += 10 * (20 - metrics.inverseMean) / 5;
  }

  return +score.toFixed(3);
}
