import type { ScoringVariant } from '../types.js';
import type { LogReturnPath } from '../../types.js';

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
  const numQuarters = Math.round(params['quarters'] ?? 4);
  const mu = params['mu'] ?? 1.0;
  const volFloor = params['volFloor'] ?? 1e-8;

  if (N !== actual.length || N < numQuarters * 2) return 0;

  const quarterSize = Math.floor(N / numQuarters);
  let totalRelError = 0;

  for (let q = 0; q < numQuarters; q++) {
    const start = q * quarterSize;
    const end = q === numQuarters - 1 ? N : (q + 1) * quarterSize;
    const len = end - start;
    if (len < 2) continue;

    const predDiffs: number[] = [];
    const actualDiffs: number[] = [];

    for (let i = start + 1; i < end; i++) {
      predDiffs.push(predicted[i]! - predicted[i - 1]!);
      actualDiffs.push(actual[i]! - actual[i - 1]!);
    }

    const predVol = std(predDiffs);
    const actualVol = std(actualDiffs);
    const flooredActualVol = Math.max(actualVol, volFloor);
    const relError = Math.abs(predVol - actualVol) / flooredActualVol;
    totalRelError += relError;
  }

  const meanRelError = totalRelError / numQuarters;
  return Math.exp(-mu * meanRelError); // normalized 0-1
}

export const quarterBasedVolatility: ScoringVariant = {
  id: 'volatility.quarterBased',
  component: 'volatility',
  name: 'Quarter-Based Vol Comparison',
  parameterDefs: [
    { name: 'mu', min: 0.3, max: 3.0, default: 1.0 },
    { name: 'quarters', min: 2, max: 8, default: 4, integer: true },
    { name: 'volFloor', min: 1e-10, max: 1e-6, default: 1e-8 },
  ],
  compute,
};
