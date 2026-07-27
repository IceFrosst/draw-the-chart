import type { ScoringVariant } from '../types.js';
import type { LogReturnPath } from '../../types.js';

function compute(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  params: Record<string, number>,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 2) return 0;

  const lambda = params['lambda'] ?? 1.4;
  const biasWeight = params['biasWeight'] ?? 0.3;
  const trackingWeight = 1.0 - biasWeight;
  const volFloor = params['volFloor'] ?? 1e-8;

  // Compute errors
  const errors: number[] = [];
  for (let i = 0; i < N; i++) {
    errors.push(predicted[i]! - actual[i]!);
  }

  // Bias = mean signed error
  const bias = errors.reduce((sum, e) => sum + e, 0) / N;

  // Debiased RMSE
  const debiasedSquaredSum = errors.reduce((sum, e) => sum + (e - bias) ** 2, 0);
  const rmseDebiased = Math.sqrt(debiasedSquaredSum / N);

  // Realized volatility
  const actualMean = actual.reduce((sum, v) => sum + v, 0) / N;
  const actualVariance = actual.reduce((sum, v) => sum + (v - actualMean) ** 2, 0) / N;
  const sigma = Math.max(Math.sqrt(actualVariance), volFloor);

  // Normalized penalty
  const normalizedBias = Math.abs(bias) / sigma;
  const normalizedRmse = rmseDebiased / sigma;
  const penalty = biasWeight * normalizedBias + trackingWeight * normalizedRmse;

  return Math.exp(-lambda * penalty); // normalized 0-1
}

export const biasRmseMagnitude: ScoringVariant = {
  id: 'magnitude.biasRmse',
  component: 'magnitude',
  name: 'Bias + RMSE Decomposition',
  parameterDefs: [
    { name: 'lambda', min: 0.5, max: 3.0, default: 1.4 },
    { name: 'biasWeight', min: 0.1, max: 0.9, default: 0.3 },
    { name: 'volFloor', min: 1e-10, max: 1e-6, default: 1e-8 },
  ],
  compute,
};
