import type { ScoringVariant } from '../types.js';
import type { LogReturnPath } from '../../types.js';

/**
 * Direction variant: Pearson correlation at multiple time scales.
 *
 * At each scale level, downsample both paths and compute Pearson correlation.
 * Weight coarser scales more heavily (geometric decay).
 * Map correlation from [-1, 1] to [0, 1].
 */
function compute(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  params: Record<string, number>,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 2) return 0;

  const maxScaleLevel = Math.round(params['maxScaleLevel'] ?? 3);
  const decayBase = params['decayBase'] ?? 2.0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (let level = 1; level <= maxScaleLevel; level++) {
    const numBins = Math.pow(2, level);
    const binSize = N / numBins;
    const weight = Math.pow(decayBase, maxScaleLevel - level);

    // Downsample: average value in each bin
    const predBins: number[] = [];
    const actBins: number[] = [];

    for (let b = 0; b < numBins; b++) {
      const start = Math.round(b * binSize);
      const end = Math.round((b + 1) * binSize);
      let predSum = 0;
      let actSum = 0;
      let count = 0;

      for (let i = start; i < end && i < N; i++) {
        predSum += predicted[i]!;
        actSum += actual[i]!;
        count++;
      }

      if (count > 0) {
        predBins.push(predSum / count);
        actBins.push(actSum / count);
      }
    }

    if (predBins.length < 2) continue;

    // Pearson correlation
    const n = predBins.length;
    const meanP = predBins.reduce((s, v) => s + v, 0) / n;
    const meanA = actBins.reduce((s, v) => s + v, 0) / n;

    let cov = 0;
    let varP = 0;
    let varA = 0;

    for (let i = 0; i < n; i++) {
      const dP = predBins[i]! - meanP;
      const dA = actBins[i]! - meanA;
      cov += dP * dA;
      varP += dP * dP;
      varA += dA * dA;
    }

    let corr: number;
    if (varP < 1e-16 || varA < 1e-16) {
      corr = varP < 1e-16 && varA < 1e-16 ? 1.0 : 0.0;
    } else {
      corr = cov / Math.sqrt(varP * varA);
    }

    // Map [-1, 1] → [0, 1]
    const score = (corr + 1) / 2;
    weightedSum += weight * score;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

export const correlationBasedDirection: ScoringVariant = {
  id: 'direction.correlationBased',
  component: 'direction',
  name: 'Multi-Scale Correlation',
  parameterDefs: [
    { name: 'maxScaleLevel', min: 2, max: 6, default: 3, integer: true },
    { name: 'decayBase', min: 1.0, max: 5.0, default: 2.0 },
  ],
  compute,
};
