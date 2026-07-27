import type { ScoringVariant } from '../types.js';
import type { LogReturnPath } from '../../types.js';

/**
 * Volatility variant: Multi-scale vol comparison.
 *
 * At multiple time scales (2, 4, 8, ... sub-windows), compute vol ratio
 * between predicted and actual. Weight finer scales less (geometric decay).
 */

function std(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function compute(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  params: Record<string, number>,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 4) return 0;

  const maxScaleLevel = Math.round(params['maxScaleLevel'] ?? 3);
  const decayBase = params['decayBase'] ?? 2.0;
  const mu = params['mu'] ?? 1.0;

  let weightedError = 0;
  let totalWeight = 0;

  for (let level = 1; level <= maxScaleLevel; level++) {
    const numBins = Math.pow(2, level);
    const binSize = Math.floor(N / numBins);
    if (binSize < 2) continue;

    const weight = Math.pow(decayBase, maxScaleLevel - level);
    let levelError = 0;
    let levelCount = 0;

    for (let b = 0; b < numBins; b++) {
      const start = b * binSize;
      const end = b === numBins - 1 ? N : (b + 1) * binSize;

      // Compute vol as std of consecutive diffs
      const predDiffs: number[] = [];
      const actualDiffs: number[] = [];

      for (let i = start + 1; i < end; i++) {
        predDiffs.push(predicted[i]! - predicted[i - 1]!);
        actualDiffs.push(actual[i]! - actual[i - 1]!);
      }

      const predVol = std(predDiffs);
      const actualVol = std(actualDiffs);
      const flooredVol = Math.max(actualVol, 1e-10);

      levelError += Math.abs(predVol - actualVol) / flooredVol;
      levelCount++;
    }

    if (levelCount > 0) {
      weightedError += weight * (levelError / levelCount);
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return 0.5;

  const normalizedError = weightedError / totalWeight;
  return Math.exp(-mu * normalizedError);
}

export const multiScaleVolatility: ScoringVariant = {
  id: 'volatility.multiScaleVol',
  component: 'volatility',
  name: 'Multi-Scale Vol',
  parameterDefs: [
    { name: 'maxScaleLevel', min: 1, max: 5, default: 3, integer: true },
    { name: 'decayBase', min: 1.0, max: 4.0, default: 2.0 },
    { name: 'mu', min: 0.3, max: 3.0, default: 1.0 },
  ],
  compute,
};
