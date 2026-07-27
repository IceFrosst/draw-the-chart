import type { ScoringVariant } from '../types.js';
import type { LogReturnPath } from '../../types.js';

/**
 * Turning Point variant: Sliding-window cross-correlation.
 *
 * Computes the first derivative of both paths (smoothed), then uses
 * sliding-window cross-correlation to measure how well the predicted
 * path's turning pattern aligns with the actual path's turns.
 */

function gaussianSmooth(path: number[], sigma: number): number[] {
  const N = path.length;
  const smoothed = new Array<number>(N);
  const kernelRadius = Math.ceil(3 * sigma);

  for (let i = 0; i < N; i++) {
    let weightSum = 0;
    let valueSum = 0;
    const jStart = Math.max(0, i - kernelRadius);
    const jEnd = Math.min(N - 1, i + kernelRadius);

    for (let j = jStart; j <= jEnd; j++) {
      const dist = (j - i) / sigma;
      const w = Math.exp(-0.5 * dist * dist);
      weightSum += w;
      valueSum += w * path[j]!;
    }

    smoothed[i] = valueSum / weightSum;
  }

  return smoothed;
}

function derivative(path: number[]): number[] {
  const d = new Array<number>(path.length - 1);
  for (let i = 0; i < path.length - 1; i++) {
    d[i] = path[i + 1]! - path[i]!;
  }
  return d;
}

function compute(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  params: Record<string, number>,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 4) return 0;

  const smoothingFraction = params['smoothingFraction'] ?? 0.05;
  const windowFraction = params['windowFraction'] ?? 0.1;
  const numWindows = Math.round(params['numWindows'] ?? 6);

  // Smooth both paths
  const smoothingSigma = smoothingFraction * N;
  const smoothedPred = gaussianSmooth(predicted, Math.max(1, smoothingSigma));
  const smoothedActual = gaussianSmooth(actual, Math.max(1, smoothingSigma));

  // Compute derivatives (turning signals)
  const dPred = derivative(smoothedPred);
  const dActual = derivative(smoothedActual);

  if (dPred.length < 2 || dActual.length < 2) return 0;

  const M = dPred.length;
  const windowSize = Math.max(2, Math.round(windowFraction * M));

  // Compute windowed cross-correlation at evenly spaced windows
  let totalCorrelation = 0;
  let validWindows = 0;

  for (let w = 0; w < numWindows; w++) {
    const center = Math.round((w + 0.5) * M / numWindows);
    const start = Math.max(0, center - Math.floor(windowSize / 2));
    const end = Math.min(M, start + windowSize);
    const len = end - start;
    if (len < 2) continue;

    // Pearson correlation in this window
    let meanP = 0;
    let meanA = 0;
    for (let i = start; i < end; i++) {
      meanP += dPred[i]!;
      meanA += dActual[i]!;
    }
    meanP /= len;
    meanA /= len;

    let cov = 0;
    let varP = 0;
    let varA = 0;
    for (let i = start; i < end; i++) {
      const dp = dPred[i]! - meanP;
      const da = dActual[i]! - meanA;
      cov += dp * da;
      varP += dp * dp;
      varA += da * da;
    }

    let corr: number;
    if (varP < 1e-16 || varA < 1e-16) {
      corr = varP < 1e-16 && varA < 1e-16 ? 1.0 : 0.0;
    } else {
      corr = cov / Math.sqrt(varP * varA);
    }

    totalCorrelation += corr;
    validWindows++;
  }

  if (validWindows === 0) return 0.5;

  const avgCorrelation = totalCorrelation / validWindows;
  // Map [-1, 1] → [0, 1]
  return Math.max(0, Math.min(1, (avgCorrelation + 1) / 2));
}

export const crossCorrelationTurningPoints: ScoringVariant = {
  id: 'turningPoints.crossCorrelation',
  component: 'turningPoints',
  name: 'Cross-Correlation',
  parameterDefs: [
    { name: 'smoothingFraction', min: 0.02, max: 0.1, default: 0.05 },
    { name: 'windowFraction', min: 0.05, max: 0.3, default: 0.1 },
    { name: 'numWindows', min: 3, max: 12, default: 6, integer: true },
  ],
  compute,
};
