import type { ScoringVariant } from '../types.js';
import type { LogReturnPath } from '../../types.js';

interface TurningPoint {
  index: number;
  value: number;
  type: 'min' | 'max';
}

function gaussianSmooth(path: LogReturnPath, sigma: number): number[] {
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

function computeProminence(path: number[], tp: TurningPoint): number {
  const N = path.length;

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
    return tp.value - Math.max(leftMin, rightMin);
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
    return Math.min(leftMax, rightMax) - tp.value;
  }
}

function findExtrema(path: number[], minProminence: number): TurningPoint[] {
  const N = path.length;
  if (N < 3) return [];

  const candidates: TurningPoint[] = [];
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

  return candidates.filter((tp) => computeProminence(path, tp) >= minProminence);
}

function pathCorrelation(a: number[], b: number[]): number {
  const N = a.length;
  if (N === 0) return 0;

  const meanA = a.reduce((s, v) => s + v, 0) / N;
  const meanB = b.reduce((s, v) => s + v, 0) / N;

  let cov = 0;
  let varA = 0;
  let varB = 0;

  for (let i = 0; i < N; i++) {
    const dA = a[i]! - meanA;
    const dB = b[i]! - meanB;
    cov += dA * dB;
    varA += dA * dA;
    varB += dB * dB;
  }

  if (varA < 1e-16 || varB < 1e-16) {
    return varA < 1e-16 && varB < 1e-16 ? 1.0 : 0.0;
  }

  return cov / Math.sqrt(varA * varB);
}

function hungarianAssignment(costMatrix: number[][]): [number, number][] {
  const nRows = costMatrix.length;
  if (nRows === 0) return [];
  const nCols = costMatrix[0]!.length;
  if (nCols === 0) return [];

  const n = Math.max(nRows, nCols);
  const cost: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i < nRows && j < nCols ? costMatrix[i]![j]! : 0)),
  );

  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0);
  const way = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = Infinity;
      let j1 = -1;

      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }

      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]!] = u[p[j]!]! + delta;
          v[j] = v[j]! - delta;
        } else {
          minv[j] = minv[j]! - delta;
        }
      }

      j0 = j1;
    } while (p[j0]! !== 0);

    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0 !== 0);
  }

  const result: [number, number][] = [];
  for (let j = 1; j <= n; j++) {
    if (p[j]! > 0 && p[j]! <= nRows && j <= nCols) {
      result.push([p[j]! - 1, j - 1]);
    }
  }

  return result;
}

function compute(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  params: Record<string, number>,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 4) return 0;

  const smoothingFraction = params['smoothingFraction'] ?? 0.046667;
  const prominenceMultiple = params['prominenceMultiple'] ?? 0.3;
  const timeTolerance = params['timeTolerance'] ?? 0.05;
  const hallucinationPenalty = params['hallucinationPenalty'] ?? 0.35;
  const missPenalty = params['missPenalty'] ?? 0.08;
  const timeWeight = params['timeWeight'] ?? 0.5;
  const amplitudeWeight = params['amplitudeWeight'] ?? 0.5;

  const actualMean = actual.reduce((s, v) => s + v, 0) / N;
  const actualVar = actual.reduce((s, v) => s + (v - actualMean) ** 2, 0) / N;
  const sigma = Math.sqrt(actualVar);

  if (sigma < 1e-10) {
    const predMean = predicted.reduce((s, v) => s + v, 0) / N;
    const predVar = predicted.reduce((s, v) => s + (v - predMean) ** 2, 0) / N;
    return Math.sqrt(predVar) < 1e-10 ? 1.0 : 0.5;
  }

  const smoothingSigma = smoothingFraction * N;
  const smoothedPred = gaussianSmooth(predicted, smoothingSigma);
  const smoothedActual = gaussianSmooth(actual, smoothingSigma);

  const minProminence = prominenceMultiple * sigma;
  const predExtrema = findExtrema(smoothedPred, minProminence);
  const actualExtrema = findExtrema(smoothedActual, minProminence);

  if (actualExtrema.length === 0) {
    if (predExtrema.length === 0) {
      const similarity = pathCorrelation(smoothedPred, smoothedActual);
      return Math.max(0, Math.min(1, 0.5 + 0.5 * similarity));
    }
    const penalty = predExtrema.length * hallucinationPenalty;
    return Math.max(0, 0.5 * (1 - penalty));
  }

  if (predExtrema.length === 0) {
    const penalty = actualExtrema.length * missPenalty;
    return Math.max(0, 1.0 * (1 - penalty));
  }

  const timeToleranceN = timeTolerance * N;
  const costMatrix: number[][] = [];

  for (let i = 0; i < predExtrema.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < actualExtrema.length; j++) {
      const pred = predExtrema[i]!;
      const act = actualExtrema[j]!;

      if (pred.type !== act.type) {
        row.push(1e6);
        continue;
      }

      const timeDist = Math.abs(pred.index - act.index) / timeToleranceN;
      const timeCost = Math.min(timeDist, 2.0);
      const ampDist = Math.abs(pred.value - act.value) / sigma;
      const ampCost = Math.min(ampDist, 2.0);
      const totalCost = timeWeight * timeCost + amplitudeWeight * ampCost;
      row.push(totalCost);
    }
    costMatrix.push(row);
  }

  const assignments = hungarianAssignment(costMatrix);

  let matchedScore = 0;
  const matchedPred = new Set<number>();
  const matchedActual = new Set<number>();

  for (const [predIdx, actIdx] of assignments) {
    const cost = costMatrix[predIdx]![actIdx]!;
    if (cost >= 1e6) continue;
    if (cost > 2.0) continue;
    matchedPred.add(predIdx);
    matchedActual.add(actIdx);
    const quality = Math.exp(-cost);
    matchedScore += quality;
  }

  const maxPossibleMatches = Math.max(actualExtrema.length, 1);
  const matchQuality = matchedScore / maxPossibleMatches;

  const hallucinated = predExtrema.length - matchedPred.size;
  const missed = actualExtrema.length - matchedActual.size;

  const hPenalty = hallucinated * hallucinationPenalty;
  const mPenalty = missed * missPenalty;

  return Math.min(1, Math.max(0, matchQuality - hPenalty - mPenalty));
}

export const hungarianMatchTurningPoints: ScoringVariant = {
  id: 'turningPoints.hungarianMatch',
  component: 'turningPoints',
  name: 'Hungarian Matching',
  parameterDefs: [
    { name: 'smoothingFraction', min: 0.02, max: 0.1, default: 0.046667 },
    { name: 'prominenceMultiple', min: 0.1, max: 0.6, default: 0.3 },
    { name: 'timeTolerance', min: 0.02, max: 0.2, default: 0.05 },
    { name: 'hallucinationPenalty', min: 0.05, max: 0.5, default: 0.35 },
    { name: 'missPenalty', min: 0.02, max: 0.3, default: 0.08 },
    { name: 'timeWeight', min: 0.2, max: 0.8, default: 0.5 },
    { name: 'amplitudeWeight', min: 0.2, max: 0.8, default: 0.5 },
  ],
  compute,
};
