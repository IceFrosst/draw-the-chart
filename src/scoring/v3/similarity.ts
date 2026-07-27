/**
 * v3 Layer 1 — Perceptual similarity.
 *
 * S = S1 (shape & timing, 0-50) + S2 (direction, 0-30) + S3 (level, 0-20)
 *
 * Design rules (WHITEPAPER_v3.md §5):
 *  - no hard thresholds: every penalty is a smooth function of error
 *  - no double counting: timing/shape, direction, and level are penalized
 *    in exactly one component each
 *  - Layer 1 has no economic role; money flows through the field percentile
 */

import { pricesToLogReturns, resamplePath } from '../score.js';

export interface SimilarityConfig {
  N: number;
  dtwBand: number; // Sakoe-Chiba band in samples
  lambdaShape: number;
  directionLevels: number;
  directionDecay: number;
  lambdaLevel: number;
  weightShape: number;
  weightDirection: number;
  weightLevel: number;
}

export const DEFAULT_SIMILARITY_CONFIG: SimilarityConfig = {
  N: 120,
  dtwBand: 12, // 10% of horizon
  lambdaShape: 2.2,
  directionLevels: 3,
  directionDecay: 2.5,
  lambdaLevel: 1.2,
  weightShape: 50,
  weightDirection: 30,
  weightLevel: 20,
};

export interface SimilarityBreakdown {
  shape: number;
  direction: number;
  level: number;
  total: number;
}

/**
 * Banded DTW distance (L1 ground cost) between two equal-length paths.
 * Returns mean cost per step along the horizon (D / N).
 */
export function bandedDtwDistance(a: number[], b: number[], band: number): number {
  const n = a.length;
  if (n === 0) return 0;
  const INF = Number.POSITIVE_INFINITY;
  // rolling rows of the cumulative cost matrix
  let prev = new Array<number>(n).fill(INF);
  let curr = new Array<number>(n).fill(INF);

  for (let i = 0; i < n; i++) {
    const jStart = Math.max(0, i - band);
    const jEnd = Math.min(n - 1, i + band);
    for (let j = jStart; j <= jEnd; j++) {
      const cost = Math.abs(a[i]! - b[j]!);
      if (i === 0 && j === 0) {
        curr[j] = cost;
        continue;
      }
      let best = INF;
      if (i > 0 && prev[j]! < best) best = prev[j]!; // insertion
      if (j > jStart && curr[j - 1]! < best) best = curr[j - 1]!; // deletion
      if (i > 0 && j > 0 && prev[j - 1]! < best) best = prev[j - 1]!; // match
      curr[j] = cost + best;
    }
    [prev, curr] = [curr, prev];
    curr.fill(INF);
  }
  return prev[n - 1]! / n;
}

/** Effective sigma: realized path std with a floor from typical conditions. */
export function effectiveSigma(actual: number[], sigmaTypical: number): number {
  const n = actual.length;
  const mean = actual.reduce((s, v) => s + v, 0) / n;
  const variance = actual.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const realized = Math.sqrt(variance);
  return Math.max(realized, 0.5 * sigmaTypical, 1e-8);
}

function shapeScore(
  pred: number[],
  actual: number[],
  sigmaEff: number,
  cfg: SimilarityConfig,
): number {
  const d = bandedDtwDistance(pred, actual, cfg.dtwBand) / sigmaEff;
  return cfg.weightShape * Math.exp(-cfg.lambdaShape * d);
}

function directionScore(pred: number[], actual: number[], cfg: SimilarityConfig): number {
  const n = pred.length;
  let weightedSum = 0;
  let totalWeight = 0;

  for (let level = 1; level <= cfg.directionLevels; level++) {
    const numSegments = 2 ** level;
    const levelWeight = cfg.directionDecay ** (cfg.directionLevels - level);

    let agree = 0;
    let mass = 0;
    for (let seg = 0; seg < numSegments; seg++) {
      const startIdx = Math.round((seg * (n - 1)) / numSegments);
      const endIdx = Math.round(((seg + 1) * (n - 1)) / numSegments);
      const dp = pred[endIdx]! - pred[startIdx]!;
      const da = actual[endIdx]! - actual[startIdx]!;
      const w = Math.abs(da); // segments where the market barely moved barely count
      mass += w;
      if (dp * da > 0) agree += w;
    }
    const h = mass > 1e-12 ? agree / mass : 0.5; // dead-flat market: neutral
    weightedSum += levelWeight * h;
    totalWeight += levelWeight;
  }

  return cfg.weightDirection * (weightedSum / totalWeight);
}

function levelScore(
  pred: number[],
  actual: number[],
  sigmaEff: number,
  cfg: SimilarityConfig,
): number {
  const n = pred.length;
  let biasSum = 0;
  for (let i = 0; i < n; i++) biasSum += pred[i]! - actual[i]!;
  const bias = Math.abs(biasSum / n) / sigmaEff;
  const end = Math.abs(pred[n - 1]! - actual[n - 1]!) / sigmaEff;
  return cfg.weightLevel * Math.exp(-cfg.lambdaLevel * (0.5 * bias + 0.5 * end));
}

/**
 * Similarity between two log-return paths already resampled to N points.
 */
export function computeSimilarityFromLogReturns(
  pred: number[],
  actual: number[],
  sigmaTypical: number,
  cfg: SimilarityConfig = DEFAULT_SIMILARITY_CONFIG,
): SimilarityBreakdown {
  const sigmaEff = effectiveSigma(actual, sigmaTypical);
  const shape = shapeScore(pred, actual, sigmaEff, cfg);
  const direction = directionScore(pred, actual, cfg);
  const level = levelScore(pred, actual, sigmaEff, cfg);
  return { shape, direction, level, total: shape + direction + level };
}

/**
 * Similarity between raw price paths (converted + resampled internally).
 */
export function computeSimilarity(
  predictedPrices: number[],
  actualPrices: number[],
  sigmaTypical: number,
  cfg: SimilarityConfig = DEFAULT_SIMILARITY_CONFIG,
): SimilarityBreakdown {
  const pred = resamplePath(pricesToLogReturns(predictedPrices), cfg.N);
  const actual = resamplePath(pricesToLogReturns(actualPrices), cfg.N);
  return computeSimilarityFromLogReturns(pred, actual, sigmaTypical, cfg);
}
