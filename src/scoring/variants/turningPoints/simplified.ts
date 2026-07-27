import type { ScoringVariant } from '../types.js';
import type { LogReturnPath } from '../../types.js';

/**
 * Turning Point variant: Simplified count-based matching.
 *
 * No Hungarian algorithm — just check if each actual extremum has
 * a same-type extremum in the predicted path within a time window.
 * Much faster than O(n^3) Hungarian for same-quality results.
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

interface Extremum {
  index: number;
  value: number;
  type: 'min' | 'max';
}

function findExtrema(path: number[], minProminence: number): Extremum[] {
  const N = path.length;
  if (N < 3) return [];

  const candidates: Extremum[] = [];
  for (let i = 1; i < N - 1; i++) {
    const prev = path[i - 1]!;
    const curr = path[i]!;
    const next = path[i + 1]!;
    if (curr > prev && curr > next) {
      candidates.push({ index: i, value: curr, type: 'max' });
    } else if (curr < prev && curr < next) {
      candidates.push({ index: i, value: curr, type: 'min' });
    }
  }

  // Simple prominence filter: height above nearest neighbor of opposite type
  return candidates.filter((tp) => {
    if (tp.type === 'max') {
      let leftMin = tp.value;
      for (let i = tp.index - 1; i >= 0; i--) {
        leftMin = Math.min(leftMin, path[i]!);
        if (path[i]! > tp.value) break;
      }
      let rightMin = tp.value;
      for (let i = tp.index + 1; i < N; i++) {
        rightMin = Math.min(rightMin, path[i]!);
        if (path[i]! > tp.value) break;
      }
      return tp.value - Math.max(leftMin, rightMin) >= minProminence;
    } else {
      let leftMax = tp.value;
      for (let i = tp.index - 1; i >= 0; i--) {
        leftMax = Math.max(leftMax, path[i]!);
        if (path[i]! < tp.value) break;
      }
      let rightMax = tp.value;
      for (let i = tp.index + 1; i < N; i++) {
        rightMax = Math.max(rightMax, path[i]!);
        if (path[i]! < tp.value) break;
      }
      return Math.min(leftMax, rightMax) - tp.value >= minProminence;
    }
  });
}

function compute(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  params: Record<string, number>,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 4) return 0;

  const smoothingFraction = params['smoothingFraction'] ?? 0.05;
  const prominenceMultiple = params['prominenceMultiple'] ?? 0.3;
  const timeTolerance = params['timeTolerance'] ?? 0.1;
  const hallucinationPenalty = params['hallucinationPenalty'] ?? 0.2;

  const actualMean = actual.reduce((s, v) => s + v, 0) / N;
  const actualVar = actual.reduce((s, v) => s + (v - actualMean) ** 2, 0) / N;
  const sigma = Math.sqrt(actualVar);

  if (sigma < 1e-10) {
    const predMean = predicted.reduce((s, v) => s + v, 0) / N;
    const predVar = predicted.reduce((s, v) => s + (v - predMean) ** 2, 0) / N;
    return Math.sqrt(predVar) < 1e-10 ? 1.0 : 0.5;
  }

  const smoothingSigma = smoothingFraction * N;
  const smoothedPred = gaussianSmooth(predicted, Math.max(1, smoothingSigma));
  const smoothedActual = gaussianSmooth(actual, Math.max(1, smoothingSigma));

  const minProminence = prominenceMultiple * sigma;
  const predExtrema = findExtrema(smoothedPred, minProminence);
  const actualExtrema = findExtrema(smoothedActual, minProminence);

  // No actual turns — score based on whether prediction also has no turns
  if (actualExtrema.length === 0) {
    return predExtrema.length === 0 ? 1.0 : Math.max(0, 0.5 - predExtrema.length * hallucinationPenalty);
  }

  // Count how many actual turns have a same-type predicted turn within tolerance
  const timeWindow = timeTolerance * N;
  const matchedPred = new Set<number>();
  let matched = 0;

  for (const act of actualExtrema) {
    let bestDist = Infinity;
    let bestIdx = -1;

    for (let p = 0; p < predExtrema.length; p++) {
      if (matchedPred.has(p)) continue;
      const pred = predExtrema[p]!;
      if (pred.type !== act.type) continue;
      const dist = Math.abs(pred.index - act.index);
      if (dist <= timeWindow && dist < bestDist) {
        bestDist = dist;
        bestIdx = p;
      }
    }

    if (bestIdx >= 0) {
      matchedPred.add(bestIdx);
      // Quality based on time distance
      const quality = 1.0 - (bestDist / timeWindow) * 0.5;
      matched += quality;
    }
  }

  const matchRate = matched / actualExtrema.length;

  // Penalty for hallucinated turns
  const hallucinated = predExtrema.length - matchedPred.size;
  const hPenalty = hallucinated * hallucinationPenalty;

  return Math.max(0, Math.min(1, matchRate - hPenalty));
}

export const simplifiedTurningPoints: ScoringVariant = {
  id: 'turningPoints.simplified',
  component: 'turningPoints',
  name: 'Simplified Count-Based',
  parameterDefs: [
    { name: 'smoothingFraction', min: 0.02, max: 0.1, default: 0.05 },
    { name: 'prominenceMultiple', min: 0.1, max: 0.6, default: 0.3 },
    { name: 'timeTolerance', min: 0.03, max: 0.2, default: 0.1 },
    { name: 'hallucinationPenalty', min: 0.05, max: 0.4, default: 0.2 },
  ],
  compute,
};
