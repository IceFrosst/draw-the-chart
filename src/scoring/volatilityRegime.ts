import type { LogReturnPath, ScoringConfig } from './types.js';

/**
 * Component D: Volatility Regime (0–10 points)
 *
 * Split horizon into quarters. Compare realized vol in each quarter
 * between predicted and actual.
 *
 * ShapeScore = 10 × exp(-μ × mean(|vol_pred_q − vol_actual_q| / vol_actual_q))
 */
export function computeVolatilityScore(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  config: ScoringConfig,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < config.volatilityQuarters * 2) return 0;

  const numQuarters = config.volatilityQuarters;
  const quarterSize = Math.floor(N / numQuarters);

  let totalRelError = 0;

  for (let q = 0; q < numQuarters; q++) {
    const start = q * quarterSize;
    const end = q === numQuarters - 1 ? N : (q + 1) * quarterSize;
    const len = end - start;

    if (len < 2) continue;

    // Compute volatility as std of consecutive differences in each quarter
    const predDiffs: number[] = [];
    const actualDiffs: number[] = [];

    for (let i = start + 1; i < end; i++) {
      predDiffs.push(predicted[i]! - predicted[i - 1]!);
      actualDiffs.push(actual[i]! - actual[i - 1]!);
    }

    const predVol = std(predDiffs);
    const actualVol = std(actualDiffs);

    // Relative error, with floor to prevent division by zero
    const flooredActualVol = Math.max(actualVol, config.volatilityFloor);
    const relError = Math.abs(predVol - actualVol) / flooredActualVol;

    totalRelError += relError;
  }

  const meanRelError = totalRelError / numQuarters;
  return 5 * Math.exp(-config.volatilityMu * meanRelError);
}

function std(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
