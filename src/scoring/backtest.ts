/**
 * Comprehensive scoring engine audit and backtesting harness.
 *
 * Generates 10,000+ synthetic strategies across all timeframes,
 * runs them against historical BTC data, and produces a full
 * statistical report including:
 * - Score distribution analysis per strategy type
 * - Component independence (correlation matrix)
 * - Monotonicity / ordering tests
 * - Edge case stress tests
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeScore, computeScoreFromLogReturns, pricesToLogReturns, resamplePath } from './score.js';
import { DEFAULT_CONFIG } from './config.js';
import type { ScoringConfig, ScoreBreakdown } from './types.js';

// ─── PRNG ────────────────────────────────────────────────────────

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

// ─── DATA LOADING ────────────────────────────────────────────────

export function loadExpandedData(dataDir?: string): number[][] {
  const dir = dataDir ?? path.join(process.cwd(), 'data');

  // Try loading chunked files first
  const indexPath = path.join(dir, 'chunks_index.json');
  if (fs.existsSync(indexPath)) {
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as Array<{
      year: number;
      file: string;
    }>;
    let allCandles: number[][] = [];
    for (const entry of index) {
      const filePath = path.join(dir, entry.file);
      if (fs.existsSync(filePath)) {
        const chunk = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as number[][];
        allCandles = allCandles.concat(chunk);
      }
    }
    if (allCandles.length > 0) {
      // Sort by timestamp and deduplicate
      allCandles.sort((a, b) => a[0]! - b[0]!);
      return dedup(allCandles);
    }
  }

  // Fall back to single file
  const singlePath = path.join(dir, 'btc_1m_candles.json');
  if (fs.existsSync(singlePath)) {
    return JSON.parse(fs.readFileSync(singlePath, 'utf-8')) as number[][];
  }

  throw new Error(`No price data found in ${dir}`);
}

function dedup(sorted: number[][]): number[][] {
  if (sorted.length === 0) return sorted;
  const result = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]![0] !== sorted[i - 1]![0]) {
      result.push(sorted[i]!);
    }
  }
  return result;
}

// ─── STRATEGY GENERATORS ─────────────────────────────────────────

export type StrategyFn = (
  actualPrices: number[],
  lookbackPrices: number[],
  rng: () => number,
) => number[];

/** Flat line - predict no change */
export function flatLineStrategy(actual: number[]): number[] {
  return new Array(actual.length).fill(actual[0]!);
}

/** Random walk with matched volatility */
export function randomWalkStrategy(actual: number[], rng: () => number): number[] {
  const N = actual.length;
  const p0 = actual[0]!;

  // Compute per-step vol from actual
  let sumSq = 0;
  for (let i = 1; i < N; i++) {
    const lr = Math.log(actual[i]! / actual[i - 1]!);
    sumSq += lr * lr;
  }
  const stepVol = Math.sqrt(sumSq / Math.max(N - 1, 1));

  const predicted = [p0];
  for (let i = 1; i < N; i++) {
    const step = gaussianRandom(rng) * stepVol;
    predicted.push(predicted[i - 1]! * Math.exp(step));
  }
  return predicted;
}

/** Perfect prediction - exact copy of actual */
export function perfectStrategy(actual: number[]): number[] {
  return [...actual];
}

/** Inverse prediction - mirror around starting price */
export function inverseStrategy(actual: number[]): number[] {
  const p0 = actual[0]!;
  return actual.map((p) => p0 * Math.exp(-Math.log(p / p0)));
}

/** Naive trend extrapolation from lookback */
export function trendStrategy(actual: number[], lookback: number[]): number[] {
  const N = actual.length;
  const p0 = actual[0]!;
  if (lookback.length < 2) return new Array(N).fill(p0);

  const logTrendPerStep = Math.log(lookback[lookback.length - 1]! / lookback[0]!) / lookback.length;
  const predicted = [p0];
  for (let i = 1; i < N; i++) {
    predicted.push(predicted[i - 1]! * Math.exp(logTrendPerStep));
  }
  return predicted;
}

/** Mean reversion: linear interpolation to lookback mean */
export function meanReversionStrategy(actual: number[], lookback: number[]): number[] {
  const N = actual.length;
  const p0 = actual[0]!;
  if (lookback.length < 2) return new Array(N).fill(p0);

  const mean = lookback.reduce((s, p) => s + p, 0) / lookback.length;
  return Array.from({ length: N }, (_, i) => p0 + (i / (N - 1)) * (mean - p0));
}

/** Extreme spike: flat then sharp jump at the end */
export function extremeSpikeStrategy(actual: number[], rng: () => number): number[] {
  const N = actual.length;
  const p0 = actual[0]!;

  // Compute actual per-step vol for a reasonable spike magnitude
  let sumSq = 0;
  for (let i = 1; i < N; i++) {
    const lr = Math.log(actual[i]! / actual[i - 1]!);
    sumSq += lr * lr;
  }
  const stepVol = Math.sqrt(sumSq / Math.max(N - 1, 1));

  const spikeDirection = rng() > 0.5 ? 1 : -1;
  // Spike magnitude: ~5x the total expected move, capped to avoid overflow
  const spikeSize = Math.min(Math.max(stepVol * Math.sqrt(N) * 5, 0.01), 0.5) * spikeDirection;

  const predicted = new Array(N).fill(p0);
  // Spike in the last 5% of the path
  const spikeStart = Math.floor(N * 0.95);
  for (let i = spikeStart; i < N; i++) {
    const progress = (i - spikeStart) / Math.max(N - 1 - spikeStart, 1);
    predicted[i] = p0 * Math.exp(spikeSize * progress);
  }
  return predicted;
}

/** Drifted copy: actual path with a growing bias (drift) over the horizon */
export function driftedCopyStrategy(
  actual: number[],
  rng: () => number,
  driftMultiple: number = 1.0,
): number[] {
  const N = actual.length;
  const p0 = actual[0]!;
  const logReturns = actual.map((p) => Math.log(p / p0));
  const sigma = std(logReturns);
  const driftPerStep = (gaussianRandom(rng) * sigma * driftMultiple) / N;

  return actual.map((p, i) => p * Math.exp(driftPerStep * i));
}

/** Random noise: uncorrelated random values with matched range */
export function randomNoiseStrategy(actual: number[], rng: () => number): number[] {
  const N = actual.length;
  const p0 = actual[0]!;
  const logRange = Math.log(Math.max(...actual) / Math.min(...actual));
  const noiseScale = logRange * 0.5;

  return Array.from({ length: N }, () => p0 * Math.exp((rng() - 0.5) * noiseScale * 2));
}

/** Near-perfect: actual with small noise */
export function nearPerfectStrategy(
  actual: number[],
  rng: () => number,
  noiseFraction: number = 0.05,
): number[] {
  let sumSq = 0;
  for (let i = 1; i < actual.length; i++) {
    const lr = Math.log(actual[i]! / actual[i - 1]!);
    sumSq += lr * lr;
  }
  const stepVol = Math.sqrt(sumSq / Math.max(actual.length - 1, 1));
  const noiseLevel = stepVol * noiseFraction;

  return actual.map((p) => p * Math.exp(gaussianRandom(rng) * noiseLevel));
}

/** Lagged copy: actual shifted forward in time */
export function laggedCopyStrategy(actual: number[]): number[] {
  const N = actual.length;
  const lag = Math.max(2, Math.floor(N * 0.08));
  const logReturns = actual.map((p) => Math.log(p / actual[0]!));
  const laggedReturns = logReturns.map((_, i) => logReturns[Math.max(0, i - lag)]!);
  return laggedReturns.map((lr) => actual[0]! * Math.exp(lr));
}

// ─── STATISTICS ──────────────────────────────────────────────────

function std(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

export interface ExtendedStats {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
}

export function computeExtendedStats(values: number[]): ExtendedStats {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) {
    return { mean: 0, median: 0, std: 0, min: 0, max: 0, p5: 0, p25: 0, p75: 0, p95: 0 };
  }
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;

  return {
    mean,
    median: sorted[Math.floor(n / 2)]!,
    std: Math.sqrt(variance),
    min: sorted[0]!,
    max: sorted[n - 1]!,
    p5: sorted[Math.floor(n * 0.05)]!,
    p25: sorted[Math.floor(n * 0.25)]!,
    p75: sorted[Math.floor(n * 0.75)]!,
    p95: sorted[Math.floor(n * 0.95)]!,
  };
}

// ─── CORRELATION ─────────────────────────────────────────────────

export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;

  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let cov = 0, varX = 0, varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX;
    const dy = y[i]! - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  if (varX < 1e-16 || varY < 1e-16) return 0;
  return cov / Math.sqrt(varX * varY);
}

export interface CorrelationMatrix {
  labels: string[];
  matrix: number[][];
}

export function computeCorrelationMatrix(
  breakdowns: ScoreBreakdown[],
): CorrelationMatrix {
  // Filter out any breakdowns with NaN values
  const clean = breakdowns.filter(
    (b) =>
      isFinite(b.direction) && isFinite(b.magnitude) &&
      isFinite(b.turningPoints) && isFinite(b.volatility),
  );

  const direction = clean.map((b) => b.direction);
  const magnitude = clean.map((b) => b.magnitude);
  const turningPoints = clean.map((b) => b.turningPoints);
  const volatility = clean.map((b) => b.volatility);

  const components = [direction, magnitude, turningPoints, volatility];
  const labels = ['Direction', 'Magnitude', 'TurningPoints', 'Volatility'];

  const matrix = components.map((a) =>
    components.map((b) => pearsonCorrelation(a, b)),
  );

  return { labels, matrix };
}

// ─── MONOTONICITY ────────────────────────────────────────────────

export interface MonotonicityResult {
  totalPairs: number;
  violations: number;
  violationRate: number;
  worstViolation: {
    closerScore: number;
    fartherScore: number;
    delta: number;
  } | null;
}

/**
 * Test monotonicity: a prediction closer to actual should score >= one farther away.
 * Generate paired comparisons by perturbing the actual at varying noise levels.
 */
export function testMonotonicity(
  prices: number[],
  numPairs: number,
  seed: number,
  config: ScoringConfig = DEFAULT_CONFIG,
): MonotonicityResult {
  const rng = mulberry32(seed);
  let violations = 0;
  let worstViolation: MonotonicityResult['worstViolation'] = null;

  const totalCandles = prices.length;

  for (let i = 0; i < numPairs; i++) {
    // Pick a random window
    const windowSize = 60 + Math.floor(rng() * 300); // 60-360 candles
    const maxStart = totalCandles - windowSize - 1;
    if (maxStart < 1) continue;

    const startIdx = Math.floor(rng() * maxStart);
    const actual = prices.slice(startIdx, startIdx + windowSize);

    // Compute per-step vol for noise calibration
    let sumSq = 0;
    for (let j = 1; j < actual.length; j++) {
      const lr = Math.log(actual[j]! / actual[j - 1]!);
      sumSq += lr * lr;
    }
    const stepVol = Math.sqrt(sumSq / Math.max(actual.length - 1, 1));

    // Generate "closer" (low noise) and "farther" (high noise) predictions
    const lowNoise = 0.02 + rng() * 0.08; // 2-10% noise
    const highNoise = lowNoise + 0.15 + rng() * 0.3; // significantly more noise

    const closerPred = actual.map(
      (p) => p * Math.exp(gaussianRandom(rng) * stepVol * lowNoise),
    );
    const fartherPred = actual.map(
      (p) => p * Math.exp(gaussianRandom(rng) * stepVol * highNoise),
    );

    const closerScore = computeScore(closerPred, actual, config);
    const fartherScore = computeScore(fartherPred, actual, config);

    if (fartherScore.total > closerScore.total) {
      violations++;
      const delta = fartherScore.total - closerScore.total;
      if (worstViolation === null || delta > worstViolation.delta) {
        worstViolation = {
          closerScore: closerScore.total,
          fartherScore: fartherScore.total,
          delta,
        };
      }
    }
  }

  return {
    totalPairs: numPairs,
    violations,
    violationRate: violations / Math.max(numPairs, 1),
    worstViolation,
  };
}

// ─── EDGE CASES ──────────────────────────────────────────────────

export interface EdgeCaseResult {
  name: string;
  passed: boolean;
  score: ScoreBreakdown | null;
  error: string | null;
}

export function runEdgeCaseTests(
  config: ScoringConfig = DEFAULT_CONFIG,
): EdgeCaseResult[] {
  const results: EdgeCaseResult[] = [];

  function testCase(
    name: string,
    predictedPrices: number[],
    actualPrices: number[],
  ) {
    try {
      const score = computeScore(predictedPrices, actualPrices, config);
      const valid =
        !isNaN(score.total) &&
        isFinite(score.total) &&
        score.total >= 0 &&
        score.total <= 100 &&
        !isNaN(score.direction) &&
        !isNaN(score.magnitude) &&
        !isNaN(score.turningPoints) &&
        !isNaN(score.volatility);

      results.push({
        name,
        passed: valid,
        score,
        error: valid ? null : `Score out of range or NaN: ${JSON.stringify(score)}`,
      });
    } catch (e) {
      results.push({
        name,
        passed: false,
        score: null,
        error: `Threw exception: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  // 1. Empty paths
  testCase('Empty paths', [], []);

  // 2. Single-point paths
  testCase('Single-point paths', [100], [100]);

  // 3. Two-point paths
  testCase('Two-point paths', [100, 110], [100, 105]);

  // 4. Very short paths
  testCase('Three-point paths', [100, 110, 105], [100, 102, 108]);

  // 5. Identical constant paths
  testCase(
    'All-same prices',
    new Array(200).fill(50000),
    new Array(200).fill(50000),
  );

  // 6. Predicted constant, actual volatile
  const volatileActual = Array.from({ length: 200 }, (_, i) => 50000 + Math.sin(i * 0.1) * 500);
  testCase(
    'Flat predicted vs volatile actual',
    new Array(200).fill(50000),
    volatileActual,
  );

  // 7. Very large prices
  testCase(
    'Very large prices',
    Array.from({ length: 120 }, (_, i) => 1e15 * (1 + i * 0.001)),
    Array.from({ length: 120 }, (_, i) => 1e15 * (1 + i * 0.0012)),
  );

  // 8. Very small prices
  testCase(
    'Very small prices',
    Array.from({ length: 120 }, (_, i) => 1e-8 * (1 + i * 0.001)),
    Array.from({ length: 120 }, (_, i) => 1e-8 * (1 + i * 0.0012)),
  );

  // 9. Negative-ish (near zero) prices - shouldn't happen but test robustness
  testCase(
    'Near-zero prices',
    Array.from({ length: 120 }, (_, i) => 0.001 + i * 0.0001),
    Array.from({ length: 120 }, (_, i) => 0.001 + i * 0.00012),
  );

  // 10. Flat then spike at last point
  const flatThenSpike = new Array(200).fill(50000);
  flatThenSpike[199] = 100000;
  testCase(
    'Flat then spike at last point',
    flatThenSpike,
    Array.from({ length: 200 }, (_, i) => 50000 + i * 10),
  );

  // 11. Spike at first point then flat
  const spikeFirst = new Array(200).fill(50000);
  spikeFirst[0] = 100000;
  testCase(
    'Spike at first point then flat (predicted)',
    spikeFirst,
    Array.from({ length: 200 }, (_, i) => 50000 + i * 10),
  );

  // 12. Identical paths of length 120 (exactly N)
  const exactN = Array.from({ length: config.N }, (_, i) => 50000 * Math.exp(i * 0.001));
  testCase('Exact N-length identical paths', exactN, exactN);

  // 13. Very long paths (10000 points)
  const longPath = Array.from({ length: 10000 }, (_, i) => 50000 * Math.exp(i * 0.0001));
  testCase(
    'Very long paths (10000 points)',
    longPath.map((p) => p * 1.001),
    longPath,
  );

  // 14. Alternating up-down (high frequency)
  const zigzagPred = Array.from({ length: 200 }, (_, i) => 50000 * (1 + 0.01 * (i % 2 === 0 ? 1 : -1)));
  const zigzagActual = Array.from({ length: 200 }, (_, i) => 50000 * (1 + 0.005 * i / 200));
  testCase('High-frequency zigzag', zigzagPred, zigzagActual);

  // 15. All prices are the same except one
  const oneOff = new Array(200).fill(50000);
  oneOff[100] = 55000;
  testCase(
    'One different price in path',
    oneOff,
    new Array(200).fill(50000),
  );

  // 16. Exponential growth vs exponential decay
  const expGrowth = Array.from({ length: 200 }, (_, i) => 50000 * Math.exp(i * 0.005));
  const expDecay = Array.from({ length: 200 }, (_, i) => 50000 * Math.exp(-i * 0.005));
  testCase('Exponential growth vs decay', expGrowth, expDecay);

  // 17. Duplicate timestamps don't apply here since we use arrays, but test identical adjacent values
  const dupeValues = Array.from({ length: 200 }, (_, i) => {
    const step = Math.floor(i / 10);
    return 50000 + step * 100;
  });
  testCase(
    'Staircase (duplicate adjacent values)',
    dupeValues,
    Array.from({ length: 200 }, (_, i) => 50000 + i * 10),
  );

  // 18. Extreme values
  testCase(
    'Extreme price values',
    [1e-15, ...Array.from({ length: 118 }, () => 1e10), 1e20],
    Array.from({ length: 120 }, () => 50000),
  );

  // 19. Monotonically increasing predicted vs decreasing actual
  testCase(
    'Strictly increasing vs strictly decreasing',
    Array.from({ length: 200 }, (_, i) => 50000 + i * 100),
    Array.from({ length: 200 }, (_, i) => 70000 - i * 100),
  );

  // 20. Test with log-return space directly
  try {
    const predLR = Array.from({ length: config.N }, (_, i) => 0.001 * i);
    const actLR = Array.from({ length: config.N }, (_, i) => 0.0012 * i);
    const score = computeScoreFromLogReturns(predLR, actLR, config);
    const valid =
      !isNaN(score.total) && isFinite(score.total) &&
      score.total >= 0 && score.total <= 100;
    results.push({
      name: 'Direct log-return scoring',
      passed: valid,
      score,
      error: valid ? null : `Invalid score: ${JSON.stringify(score)}`,
    });
  } catch (e) {
    results.push({
      name: 'Direct log-return scoring',
      passed: false,
      score: null,
      error: `Threw: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  return results;
}

// ─── FULL AUDIT ──────────────────────────────────────────────────

export const BACKTEST_TIMEFRAMES: Record<string, number> = {
  '15m': 15,
  '1h': 60,
  '6h': 360,
  '24h': 1440,
  '7d': 10080,
};

const LOOKBACK_MINUTES = 60;

export interface StrategyAuditResult {
  name: string;
  stats: ExtendedStats;
  componentStats: {
    direction: ExtendedStats;
    magnitude: ExtendedStats;
    turningPoints: ExtendedStats;
    volatility: ExtendedStats;
  };
  breakdowns: ScoreBreakdown[];
}

export interface AuditReport {
  totalRuns: number;
  candlesLoaded: number;
  strategies: Record<string, StrategyAuditResult>;
  correlationMatrix: CorrelationMatrix;
  monotonicity: MonotonicityResult;
  edgeCases: EdgeCaseResult[];
  baselineViolations: string[];
}

export interface AuditOptions {
  roundsPerStrategyPerTimeframe?: number;
  seed?: number;
  dataDir?: string;
  config?: ScoringConfig;
}

export function runFullAudit({
  roundsPerStrategyPerTimeframe = 400,
  seed = 42424242,
  dataDir,
  config = DEFAULT_CONFIG,
}: AuditOptions = {}): AuditReport {
  const data = loadExpandedData(dataDir);
  const prices = data.map((entry) => entry[1]!);
  const totalCandles = prices.length;
  const rng = mulberry32(seed);

  console.log(`Loaded ${totalCandles} candles for audit.`);

  // ─── Strategy definitions ───
  const strategyDefs: Record<string, StrategyFn> = {
    'Flat Line': (actual) => flatLineStrategy(actual),
    'Random Walk': (actual, _lb, r) => randomWalkStrategy(actual, r),
    'Perfect': (actual) => perfectStrategy(actual),
    'Inverse': (actual) => inverseStrategy(actual),
    'Naive Trend': (actual, lb) => trendStrategy(actual, lb),
    'Mean Reversion': (actual, lb) => meanReversionStrategy(actual, lb),
    'Extreme Spike': (actual, _lb, r) => extremeSpikeStrategy(actual, r),
    'Drifted Copy': (actual, _lb, r) => driftedCopyStrategy(actual, r),
    'Random Noise': (actual, _lb, r) => randomNoiseStrategy(actual, r),
    'Near Perfect (5%)': (actual, _lb, r) => nearPerfectStrategy(actual, r, 0.05),
    'Near Perfect (20%)': (actual, _lb, r) => nearPerfectStrategy(actual, r, 0.20),
    'Lagged Copy': (actual) => laggedCopyStrategy(actual),
  };

  // ─── Run all strategies across all timeframes ───
  const allBreakdowns: ScoreBreakdown[] = [];
  const strategyBreakdowns: Record<string, ScoreBreakdown[]> = {};

  for (const name of Object.keys(strategyDefs)) {
    strategyBreakdowns[name] = [];
  }

  let totalRuns = 0;

  for (const [tfName, tfMinutes] of Object.entries(BACKTEST_TIMEFRAMES)) {
    const minStart = LOOKBACK_MINUTES;
    const maxStart = totalCandles - tfMinutes - 1;

    if (maxStart <= minStart) {
      console.log(`  Skipping ${tfName}: not enough data`);
      continue;
    }

    // Pre-generate random start indices
    const startIndices: number[] = [];
    for (let i = 0; i < roundsPerStrategyPerTimeframe; i++) {
      startIndices.push(Math.floor(rng() * (maxStart - minStart)) + minStart);
    }

    console.log(`  Running ${tfName} (${roundsPerStrategyPerTimeframe} rounds per strategy)...`);

    for (const [stratName, stratFn] of Object.entries(strategyDefs)) {
      for (let round = 0; round < roundsPerStrategyPerTimeframe; round++) {
        const startIdx = startIndices[round]!;
        const actual = prices.slice(startIdx, startIdx + tfMinutes + 1);
        const lookbackStart = Math.max(0, startIdx - LOOKBACK_MINUTES);
        const lookback = prices.slice(lookbackStart, startIdx + 1);

        const stratRng = mulberry32(round * 31337 + startIdx + seed);
        const predicted = stratFn(actual, lookback, stratRng);
        const score = computeScore(predicted, actual, config);

        strategyBreakdowns[stratName]!.push(score);
        allBreakdowns.push(score);
        totalRuns++;
      }
    }
  }

  console.log(`  Total runs: ${totalRuns}`);

  // ─── Compute per-strategy statistics ───
  const strategies: Record<string, StrategyAuditResult> = {};
  for (const [name, breakdowns] of Object.entries(strategyBreakdowns)) {
    if (breakdowns.length === 0) continue;
    strategies[name] = {
      name,
      stats: computeExtendedStats(breakdowns.map((b) => b.total)),
      componentStats: {
        direction: computeExtendedStats(breakdowns.map((b) => b.direction)),
        magnitude: computeExtendedStats(breakdowns.map((b) => b.magnitude)),
        turningPoints: computeExtendedStats(breakdowns.map((b) => b.turningPoints)),
        volatility: computeExtendedStats(breakdowns.map((b) => b.volatility)),
      },
      breakdowns,
    };
  }

  // ─── Correlation matrix ───
  console.log('  Computing correlation matrix...');
  const correlationMatrix = computeCorrelationMatrix(allBreakdowns);

  // ─── Monotonicity test ───
  console.log('  Running monotonicity test (500 pairs)...');
  const monotonicity = testMonotonicity(prices, 500, seed + 99, config);

  // ─── Edge cases ───
  console.log('  Running edge case stress tests...');
  const edgeCases = runEdgeCaseTests(config);

  // ─── Baseline checks ───
  const baselineViolations: string[] = [];
  const check = (name: string, expected: [number, number]) => {
    const s = strategies[name];
    if (!s) {
      baselineViolations.push(`${name}: no data collected`);
      return;
    }
    if (s.stats.mean < expected[0]) {
      baselineViolations.push(
        `${name}: mean ${s.stats.mean.toFixed(1)} below target ${expected[0]}`,
      );
    }
    if (s.stats.mean > expected[1]) {
      baselineViolations.push(
        `${name}: mean ${s.stats.mean.toFixed(1)} above target ${expected[1]}`,
      );
    }
  };

  check('Random Walk', [30, 35]);
  check('Flat Line', [25, 35]);
  check('Naive Trend', [35, 50]);
  check('Perfect', [99.5, 100]);

  return {
    totalRuns,
    candlesLoaded: totalCandles,
    strategies,
    correlationMatrix,
    monotonicity,
    edgeCases,
    baselineViolations,
  };
}

// ─── REPORT GENERATION ───────────────────────────────────────────

export function generateReport(audit: AuditReport): string {
  const lines: string[] = [];
  const w = (s: string) => lines.push(s);

  w('# Scoring Engine Audit Report');
  w('');
  w(`**Generated**: ${new Date().toISOString()}`);
  w(`**Total runs**: ${audit.totalRuns}`);
  w(`**Candles loaded**: ${audit.candlesLoaded.toLocaleString()}`);
  w('');

  // ─── 1. Score Distribution Analysis ───
  w('## 1. Score Distribution Analysis');
  w('');
  w('| Strategy | Mean | Median | Std | Min | Max | p5 | p25 | p75 | p95 |');
  w('|----------|------|--------|-----|-----|-----|-----|-----|-----|-----|');

  const stratOrder = [
    'Perfect', 'Near Perfect (5%)', 'Near Perfect (20%)', 'Lagged Copy',
    'Drifted Copy', 'Naive Trend', 'Mean Reversion', 'Random Walk',
    'Flat Line', 'Random Noise', 'Extreme Spike', 'Inverse',
  ];

  for (const name of stratOrder) {
    const s = audit.strategies[name];
    if (!s) continue;
    const st = s.stats;
    w(
      `| ${name} | ${st.mean.toFixed(1)} | ${st.median.toFixed(1)} | ${st.std.toFixed(1)} | ${st.min.toFixed(1)} | ${st.max.toFixed(1)} | ${st.p5.toFixed(1)} | ${st.p25.toFixed(1)} | ${st.p75.toFixed(1)} | ${st.p95.toFixed(1)} |`,
    );
  }
  w('');

  // Component breakdown
  w('### Component Breakdown (Means)');
  w('');
  w('| Strategy | Direction (0-40) | Magnitude (0-30) | Turning Pts (0-20) | Volatility (0-10) |');
  w('|----------|-----------------|-----------------|-------------------|------------------|');

  for (const name of stratOrder) {
    const s = audit.strategies[name];
    if (!s) continue;
    const c = s.componentStats;
    w(
      `| ${name} | ${c.direction.mean.toFixed(1)} | ${c.magnitude.mean.toFixed(1)} | ${c.turningPoints.mean.toFixed(1)} | ${c.volatility.mean.toFixed(1)} |`,
    );
  }
  w('');

  // ─── 2. Baseline Target Check ───
  w('## 2. Baseline Target Check');
  w('');
  w('Target ranges from CLAUDE.md:');
  w('- Random Walk: 30-35');
  w('- Flat Line: 25-35');
  w('- Naive Trend: 35-50');
  w('- Perfect: 100');
  w('');

  if (audit.baselineViolations.length === 0) {
    w('**All baselines within target ranges.**');
  } else {
    w('**VIOLATIONS FOUND:**');
    for (const v of audit.baselineViolations) {
      w(`- ${v}`);
    }
  }
  w('');

  // ─── 3. Component Independence ───
  w('## 3. Component Independence (Correlation Matrix)');
  w('');
  w('Correlations > 0.7 would indicate redundancy.');
  w('');

  const labels = audit.correlationMatrix.labels;
  w('| | ' + labels.join(' | ') + ' |');
  w('|' + labels.map(() => '---').join('|') + '|' + '---|');

  for (let i = 0; i < labels.length; i++) {
    const row = labels[i]! + ' | ' +
      audit.correlationMatrix.matrix[i]!.map((v) => v.toFixed(3)).join(' | ');
    w('| ' + row + ' |');
  }
  w('');

  const highCorrs: string[] = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const corr = Math.abs(audit.correlationMatrix.matrix[i]![j]!);
      if (corr > 0.7) {
        highCorrs.push(
          `${labels[i]} x ${labels[j]}: r = ${audit.correlationMatrix.matrix[i]![j]!.toFixed(3)}`,
        );
      }
    }
  }

  if (highCorrs.length === 0) {
    w('**No high correlations (> 0.7) found. Components are sufficiently independent.**');
  } else {
    w('**HIGH CORRELATIONS FOUND (potential redundancy):**');
    for (const c of highCorrs) {
      w(`- ${c}`);
    }
  }
  w('');

  // ─── 4. Monotonicity Test ───
  w('## 4. Monotonicity / Ordering Test');
  w('');
  w(`Tested ${audit.monotonicity.totalPairs} paired comparisons.`);
  w(`Violations: ${audit.monotonicity.violations} (${(audit.monotonicity.violationRate * 100).toFixed(1)}%)`);
  w('');

  if (audit.monotonicity.violationRate < 0.10) {
    w(`**Monotonicity is acceptable** (< 10% violation rate).`);
  } else {
    w(`**WARNING: High violation rate.** Closer predictions sometimes score lower than farther ones.`);
  }

  if (audit.monotonicity.worstViolation) {
    const wv = audit.monotonicity.worstViolation;
    w(`Worst violation: closer scored ${wv.closerScore.toFixed(1)}, farther scored ${wv.fartherScore.toFixed(1)} (delta = ${wv.delta.toFixed(1)})`);
  }
  w('');

  // ─── 5. Edge Case Stress Tests ───
  w('## 5. Edge Case Stress Tests');
  w('');

  const passed = audit.edgeCases.filter((e) => e.passed);
  const failed = audit.edgeCases.filter((e) => !e.passed);

  w(`Passed: ${passed.length}/${audit.edgeCases.length}`);
  w('');

  if (failed.length > 0) {
    w('**FAILURES:**');
    for (const f of failed) {
      w(`- **${f.name}**: ${f.error}`);
    }
    w('');
  }

  w('| Test Case | Pass | Score |');
  w('|-----------|------|-------|');
  for (const e of audit.edgeCases) {
    const scoreStr = e.score ? e.score.total.toFixed(1) : 'N/A';
    w(`| ${e.name} | ${e.passed ? 'PASS' : 'FAIL'} | ${scoreStr} |`);
  }
  w('');

  // ─── 6. Recommendations ───
  w('## 6. Parameter Change Recommendations');
  w('');

  const recs: string[] = [];

  // Check if random walk is too high or low
  const rw = audit.strategies['Random Walk'];
  if (rw && rw.stats.mean > 35) {
    recs.push(
      `- **Random Walk scores too high** (mean ${rw.stats.mean.toFixed(1)}). Consider increasing magnitudeLambda or reducing directionDecayBase to reduce credit for uncorrelated predictions.`,
    );
  }
  if (rw && rw.stats.mean < 30) {
    recs.push(
      `- **Random Walk scores too low** (mean ${rw.stats.mean.toFixed(1)}). Consider decreasing magnitudeLambda slightly.`,
    );
  }

  // Check flat line
  const fl = audit.strategies['Flat Line'];
  if (fl && fl.stats.mean > 35) {
    recs.push(
      `- **Flat Line scores too high** (mean ${fl.stats.mean.toFixed(1)}). The volatility component may be too generous for flat predictions.`,
    );
  }
  if (fl && fl.stats.mean < 25) {
    recs.push(
      `- **Flat Line scores too low** (mean ${fl.stats.mean.toFixed(1)}). Direction score neutral credit might be too low.`,
    );
  }

  // Check turning points redundancy
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const corr = Math.abs(audit.correlationMatrix.matrix[i]![j]!);
      if (corr > 0.7) {
        recs.push(
          `- **${labels[i]} and ${labels[j]} are highly correlated** (r=${corr.toFixed(3)}). Consider adjusting parameters to make these components more independent, or reducing the weight of one.`,
        );
      }
    }
  }

  // Monotonicity recs
  if (audit.monotonicity.violationRate > 0.15) {
    recs.push(
      `- **High monotonicity violation rate** (${(audit.monotonicity.violationRate * 100).toFixed(1)}%). The scoring function sometimes ranks worse predictions higher. This is likely due to turning point or volatility component noise. Consider increasing the smoothing fraction or reducing turning point weight.`,
    );
  }

  // Edge case recs
  if (failed.length > 0) {
    recs.push(
      `- **${failed.length} edge case(s) failed.** Add guards for degenerate inputs (empty paths, single points, extreme values).`,
    );
  }

  if (recs.length === 0) {
    w('No parameter changes recommended. All baselines, independence, monotonicity, and edge cases are within acceptable bounds.');
  } else {
    for (const r of recs) {
      w(r);
    }
  }
  w('');

  return lines.join('\n');
}
