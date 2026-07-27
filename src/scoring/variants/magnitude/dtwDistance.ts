import type { ScoringVariant } from '../types.js';
import type { LogReturnPath } from '../../types.js';
import { dtwDistance } from '../dtw.js';

/**
 * Magnitude variant: DTW distance normalized by volatility.
 *
 * Uses dynamic time warping distance instead of point-wise RMSE.
 * More forgiving of slight timing offsets while still penalizing shape mismatches.
 */
function compute(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  params: Record<string, number>,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 2) return 0;

  const lambda = params['lambda'] ?? 1.0;
  const bandFraction = params['dtwBandFraction'] ?? 0.1;

  // Realized volatility for normalization
  const actualMean = actual.reduce((s, v) => s + v, 0) / N;
  const actualVariance = actual.reduce((s, v) => s + (v - actualMean) ** 2, 0) / N;
  const sigma = Math.max(Math.sqrt(actualVariance), 1e-8);

  const result = dtwDistance(predicted, actual, bandFraction);

  // Normalize DTW distance by volatility
  const normalizedDist = result.distance / sigma;

  return Math.exp(-lambda * normalizedDist);
}

export const dtwDistanceMagnitude: ScoringVariant = {
  id: 'magnitude.dtwDistance',
  component: 'magnitude',
  name: 'DTW Distance',
  parameterDefs: [
    { name: 'lambda', min: 0.3, max: 3.0, default: 1.0 },
    { name: 'dtwBandFraction', min: 0.05, max: 0.3, default: 0.1 },
  ],
  compute,
};
