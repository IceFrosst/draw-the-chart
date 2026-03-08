import type { LogReturnPath, ScoringConfig, ScoreBreakdown } from './types.js';
import { DEFAULT_CONFIG } from './config.js';
import { computeDirectionScore } from './directionScore.js';
import { computeMagnitudeScore } from './magnitudeScore.js';
import { computeTurningPointScore } from './turningPoints.js';
import { computeVolatilityScore } from './volatilityRegime.js';

/**
 * Convert a raw price path to log-return space, anchored at r(T0) = 0.
 */
export function pricesToLogReturns(prices: number[]): LogReturnPath {
  if (prices.length === 0) return [];
  const p0 = prices[0]!;
  return prices.map((p) => Math.log(p / p0));
}

/**
 * Resample a path to exactly N evenly-spaced points using linear interpolation.
 */
export function resamplePath(path: number[], N: number): number[] {
  if (path.length === 0) return new Array(N).fill(0);
  if (path.length === 1) return new Array(N).fill(path[0]!);

  const result = new Array<number>(N);
  const srcLen = path.length;

  for (let i = 0; i < N; i++) {
    const t = (i / (N - 1)) * (srcLen - 1);
    const lo = Math.floor(t);
    const hi = Math.min(lo + 1, srcLen - 1);
    const frac = t - lo;
    result[i] = path[lo]! * (1 - frac) + path[hi]! * frac;
  }

  return result;
}

/**
 * Compute the full score breakdown for a predicted vs actual path.
 * Paths should be raw price arrays. They will be converted to log-returns
 * and resampled to N points internally.
 */
export function computeScore(
  predictedPrices: number[],
  actualPrices: number[],
  config: ScoringConfig = DEFAULT_CONFIG,
): ScoreBreakdown {
  // Convert to log-return space
  const predLogReturns = pricesToLogReturns(predictedPrices);
  const actualLogReturns = pricesToLogReturns(actualPrices);

  // Resample to N points
  const predicted = resamplePath(predLogReturns, config.N);
  const actual = resamplePath(actualLogReturns, config.N);

  const direction = computeDirectionScore(predicted, actual, config);
  const magnitude = computeMagnitudeScore(predicted, actual, config);
  const turningPoints = computeTurningPointScore(predicted, actual, config);
  const volatility = computeVolatilityScore(predicted, actual, config);

  return {
    direction,
    magnitude,
    turningPoints,
    volatility,
    total: direction + magnitude + turningPoints + volatility,
  };
}

/**
 * Compute score directly from log-return paths (already resampled to N points).
 * Use this when you've already done the conversion.
 */
export function computeScoreFromLogReturns(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  config: ScoringConfig = DEFAULT_CONFIG,
): ScoreBreakdown {
  const direction = computeDirectionScore(predicted, actual, config);
  const magnitude = computeMagnitudeScore(predicted, actual, config);
  const turningPoints = computeTurningPointScore(predicted, actual, config);
  const volatility = computeVolatilityScore(predicted, actual, config);

  return {
    direction,
    magnitude,
    turningPoints,
    volatility,
    total: direction + magnitude + turningPoints + volatility,
  };
}
