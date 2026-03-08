import type { LogReturnPath, ScoringConfig } from './types.js';

/**
 * Component B: Magnitude Accuracy (0–30 points)
 *
 * Decompose error into bias (mean signed error) and tracking error
 * (RMSE after removing bias). Both normalized by realized volatility σ.
 *
 * MagnitudeScore = 30 × exp(-λ × (w_b × |bias|/σ + w_t × RMSE_debiased/σ))
 */
export function computeMagnitudeScore(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  config: ScoringConfig,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 2) return 0;

  // Compute errors: e_i = predicted_i - actual_i
  const errors: number[] = [];
  for (let i = 0; i < N; i++) {
    errors.push(predicted[i]! - actual[i]!);
  }

  // Bias = mean signed error
  const bias = errors.reduce((sum, e) => sum + e, 0) / N;

  // Debiased RMSE
  const debiasedSquaredSum = errors.reduce(
    (sum, e) => sum + (e - bias) ** 2,
    0,
  );
  const rmseDebiased = Math.sqrt(debiasedSquaredSum / N);

  // Realized volatility σ = std(actual path values)
  const actualMean = actual.reduce((sum, v) => sum + v, 0) / N;
  const actualVariance =
    actual.reduce((sum, v) => sum + (v - actualMean) ** 2, 0) / N;
  const sigma = Math.max(Math.sqrt(actualVariance), config.magnitudeVolFloor);

  // Normalized penalty
  const normalizedBias = Math.abs(bias) / sigma;
  const normalizedRmse = rmseDebiased / sigma;

  const penalty =
    config.magnitudeBiasWeight * normalizedBias +
    config.magnitudeTrackingWeight * normalizedRmse;

  return 30 * Math.exp(-config.magnitudeLambda * penalty);
}
