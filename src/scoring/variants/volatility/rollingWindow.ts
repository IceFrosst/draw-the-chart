import type { ScoringVariant } from '../types.js';
import type { LogReturnPath } from '../../types.js';

/**
 * Volatility variant: Rolling window volatility correlation.
 *
 * Compute rolling-window vol for both paths and compare via
 * mean absolute relative error (penalized with exp decay).
 */

function rollingVol(path: number[], windowSize: number): number[] {
  const N = path.length;
  const vols: number[] = [];

  for (let i = windowSize; i < N; i++) {
    const window = path.slice(i - windowSize, i);
    // Vol = std of consecutive differences
    const diffs: number[] = [];
    for (let j = 1; j < window.length; j++) {
      diffs.push(window[j]! - window[j - 1]!);
    }
    if (diffs.length === 0) {
      vols.push(0);
      continue;
    }
    const mean = diffs.reduce((s, v) => s + v, 0) / diffs.length;
    const variance = diffs.reduce((s, v) => s + (v - mean) ** 2, 0) / diffs.length;
    vols.push(Math.sqrt(variance));
  }

  return vols;
}

function compute(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  params: Record<string, number>,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 4) return 0;

  const windowFraction = params['windowFraction'] ?? 0.1;
  const mu = params['mu'] ?? 1.0;

  const windowSize = Math.max(2, Math.round(windowFraction * N));

  const predVols = rollingVol(predicted, windowSize);
  const actualVols = rollingVol(actual, windowSize);

  if (predVols.length === 0 || actualVols.length === 0) return 0;

  const M = Math.min(predVols.length, actualVols.length);

  // Mean absolute relative error
  let totalRelError = 0;
  let count = 0;

  for (let i = 0; i < M; i++) {
    const actualV = Math.max(actualVols[i]!, 1e-10);
    const relError = Math.abs(predVols[i]! - actualVols[i]!) / actualV;
    totalRelError += relError;
    count++;
  }

  if (count === 0) return 0.5;

  const meanRelError = totalRelError / count;
  return Math.exp(-mu * meanRelError);
}

export const rollingWindowVolatility: ScoringVariant = {
  id: 'volatility.rollingWindow',
  component: 'volatility',
  name: 'Rolling Window Vol',
  parameterDefs: [
    { name: 'windowFraction', min: 0.05, max: 0.25, default: 0.1 },
    { name: 'mu', min: 0.3, max: 3.0, default: 1.0 },
  ],
  compute,
};
