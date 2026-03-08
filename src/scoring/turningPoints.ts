import type { LogReturnPath, ScoringConfig } from './types.js';

interface TurningPoint {
  index: number;
  value: number;
  type: 'min' | 'max';
}

/**
 * Apply Gaussian smoothing to a path.
 * Kernel width is specified as number of samples (sigma in index space).
 */
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

/**
 * Find local extrema with minimum prominence.
 */
function findExtrema(
  path: number[],
  minProminence: number,
): TurningPoint[] {
  const N = path.length;
  if (N < 3) return [];

  // Find all local maxima and minima
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

  // Filter by prominence
  return candidates.filter((tp) => {
    const prominence = computeProminence(path, tp);
    return prominence >= minProminence;
  });
}

/**
 * Compute prominence of a turning point.
 * For a max: how far it rises above the higher of the two neighboring valleys.
 * For a min: how far it drops below the lower of the two neighboring peaks.
 */
function computeProminence(path: number[], tp: TurningPoint): number {
  const N = path.length;

  if (tp.type === 'max') {
    // Find the lowest point on each side before hitting a higher peak
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
    // min
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

/**
 * Hungarian algorithm for optimal assignment (minimization).
 * Simple O(n^3) implementation for small matrices.
 */
function hungarianAssignment(costMatrix: number[][]): [number, number][] {
  const nRows = costMatrix.length;
  if (nRows === 0) return [];
  const nCols = costMatrix[0]!.length;
  if (nCols === 0) return [];

  // Pad to square matrix
  const n = Math.max(nRows, nCols);
  const cost: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      i < nRows && j < nCols ? costMatrix[i]![j]! : 0,
    ),
  );

  // Hungarian algorithm
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
      let i0 = p[j0]!;
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

  // Extract assignments
  const result: [number, number][] = [];
  for (let j = 1; j <= n; j++) {
    if (p[j]! > 0 && p[j]! <= nRows && j <= nCols) {
      result.push([p[j]! - 1, j - 1]);
    }
  }

  return result;
}

/**
 * Component C: Turning Points (0–20 points)
 *
 * 1. Smooth both series with Gaussian kernel
 * 2. Find local extrema with prominence > 0.3σ
 * 3. Hungarian algorithm to match predicted to actual extrema
 * 4. Score based on time offset and amplitude similarity
 * 5. Penalize unmatched predicted (hallucinated) and unmatched actual (missed)
 */
export function computeTurningPointScore(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  config: ScoringConfig,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 4) return 0;

  // Realized volatility for prominence threshold
  const actualMean = actual.reduce((s, v) => s + v, 0) / N;
  const actualVar = actual.reduce((s, v) => s + (v - actualMean) ** 2, 0) / N;
  const sigma = Math.sqrt(actualVar);

  // If path is essentially flat, give full marks if predicted is also flat
  if (sigma < 1e-10) {
    const predMean = predicted.reduce((s, v) => s + v, 0) / N;
    const predVar =
      predicted.reduce((s, v) => s + (v - predMean) ** 2, 0) / N;
    return Math.sqrt(predVar) < 1e-10 ? 20 : 10;
  }

  // Gaussian smoothing
  const smoothingSigma = config.turningPointSmoothingFraction * N;
  const smoothedPred = gaussianSmooth(predicted, smoothingSigma);
  const smoothedActual = gaussianSmooth(actual, smoothingSigma);

  // Find extrema
  const minProminence = config.turningPointProminenceMultiple * sigma;
  const predExtrema = findExtrema(smoothedPred, minProminence);
  const actualExtrema = findExtrema(smoothedActual, minProminence);

  // If no actual turning points, reward if predicted also has few
  if (actualExtrema.length === 0) {
    const penalty = predExtrema.length * config.turningPointHallucinationPenalty;
    return Math.max(0, 20 * (1 - penalty));
  }

  // If no predicted turning points, penalize for missing all actual
  if (predExtrema.length === 0) {
    const penalty = actualExtrema.length * config.turningPointMissPenalty;
    return Math.max(0, 20 * (1 - penalty));
  }

  // Build cost matrix for Hungarian matching
  const timeTolerance = config.turningPointTimeTolerance * N;
  const costMatrix: number[][] = [];

  for (let i = 0; i < predExtrema.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < actualExtrema.length; j++) {
      const pred = predExtrema[i]!;
      const act = actualExtrema[j]!;

      // Type mismatch → high cost
      if (pred.type !== act.type) {
        row.push(1e6);
        continue;
      }

      // Time offset cost
      const timeDist = Math.abs(pred.index - act.index) / timeTolerance;
      const timeCost = Math.min(timeDist, 2.0); // cap at 2

      // Amplitude similarity cost
      const ampDist = Math.abs(pred.value - act.value) / sigma;
      const ampCost = Math.min(ampDist, 2.0);

      const totalCost =
        config.turningPointTimeWeight * timeCost +
        config.turningPointAmplitudeWeight * ampCost;

      row.push(totalCost);
    }
    costMatrix.push(row);
  }

  // Run Hungarian matching
  const assignments = hungarianAssignment(costMatrix);

  // Score matched pairs
  let matchedScore = 0;
  let matchedCount = 0;
  const matchedPred = new Set<number>();
  const matchedActual = new Set<number>();

  for (const [predIdx, actIdx] of assignments) {
    const cost = costMatrix[predIdx]![actIdx]!;
    if (cost >= 1e6) continue; // type mismatch, skip
    if (cost > 2.0) continue; // too far apart

    matchedPred.add(predIdx);
    matchedActual.add(actIdx);
    matchedCount++;

    // Quality score for this match: 1.0 for perfect, decays with cost
    const quality = Math.exp(-cost);
    matchedScore += quality;
  }

  // Normalize matched score
  const maxPossibleMatches = Math.max(actualExtrema.length, 1);
  const matchQuality = matchedScore / maxPossibleMatches;

  // Penalties for unmatched
  const hallucinated = predExtrema.length - matchedPred.size;
  const missed = actualExtrema.length - matchedActual.size;

  const hallucinationPenalty =
    hallucinated * config.turningPointHallucinationPenalty;
  const missPenalty = missed * config.turningPointMissPenalty;

  const score = 20 * Math.max(0, matchQuality - hallucinationPenalty - missPenalty);
  return Math.min(20, Math.max(0, score));
}
