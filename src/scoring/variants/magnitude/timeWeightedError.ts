import type { ScoringVariant } from '../types.js';
import type { LogReturnPath } from '../../types.js';

/**
 * Magnitude variant: RMSE with exponential temporal weighting.
 *
 * decayDirection > 0: recent predictions matter more
 * decayDirection < 0: early predictions matter more
 * decayDirection = 0: uniform (equivalent to standard RMSE)
 */
function compute(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  params: Record<string, number>,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 2) return 0;

  const lambda = params['lambda'] ?? 1.4;
  const decayDirection = params['decayDirection'] ?? 0.5;
  const volFloor = params['volFloor'] ?? 1e-8;

  // Compute temporal weights
  const weights = new Array<number>(N);
  let weightSum = 0;

  for (let i = 0; i < N; i++) {
    const t = i / (N - 1); // 0 to 1
    weights[i] = Math.exp(decayDirection * (t - 0.5));
    weightSum += weights[i]!;
  }

  // Normalize weights
  for (let i = 0; i < N; i++) {
    weights[i] = weights[i]! / weightSum;
  }

  // Weighted RMSE
  let weightedSquaredError = 0;
  for (let i = 0; i < N; i++) {
    const error = predicted[i]! - actual[i]!;
    weightedSquaredError += weights[i]! * error * error;
  }
  const wrmse = Math.sqrt(weightedSquaredError);

  // Realized volatility for normalization
  const actualMean = actual.reduce((s, v) => s + v, 0) / N;
  const actualVariance = actual.reduce((s, v) => s + (v - actualMean) ** 2, 0) / N;
  const sigma = Math.max(Math.sqrt(actualVariance), volFloor);

  const normalizedError = wrmse / sigma;
  return Math.exp(-lambda * normalizedError);
}

export const timeWeightedMagnitude: ScoringVariant = {
  id: 'magnitude.timeWeightedError',
  component: 'magnitude',
  name: 'Time-Weighted Error',
  parameterDefs: [
    { name: 'lambda', min: 0.5, max: 3.0, default: 1.4 },
    { name: 'decayDirection', min: -2.0, max: 2.0, default: 0.5 },
    { name: 'volFloor', min: 1e-10, max: 1e-6, default: 1e-8 },
  ],
  compute,
};
