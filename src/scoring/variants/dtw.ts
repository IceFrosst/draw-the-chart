/**
 * Dynamic Time Warping with Sakoe-Chiba band constraint.
 *
 * O(N * bandWidth) instead of O(N^2) for full DTW.
 * N=120 with band=0.1 → bandWidth=12, so ~120*24 = 2,880 operations.
 */

export interface DtwResult {
  /** Normalized DTW distance (divided by path length) */
  distance: number;
  /** Warping path: pairs of [indexA, indexB] */
  path: [number, number][];
}

/**
 * Compute banded DTW distance between two paths.
 * @param a First path (log-return values)
 * @param b Second path (log-return values)
 * @param bandFraction Sakoe-Chiba band as fraction of path length (0.05–0.3)
 * @returns Normalized distance and warping path
 */
export function dtwDistance(
  a: number[],
  b: number[],
  bandFraction: number = 0.1,
): DtwResult {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return { distance: 0, path: [] };

  const band = Math.max(1, Math.ceil(Math.max(n, m) * bandFraction));

  // Cost matrix — use Infinity for out-of-band cells
  const dtw: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(Infinity),
  );
  dtw[0]![0] = 0;

  for (let i = 1; i <= n; i++) {
    const jStart = Math.max(1, i - band);
    const jEnd = Math.min(m, i + band);

    for (let j = jStart; j <= jEnd; j++) {
      const cost = (a[i - 1]! - b[j - 1]!) ** 2;
      dtw[i]![j] = cost + Math.min(
        dtw[i - 1]![j]!,     // insertion
        dtw[i]![j - 1]!,     // deletion
        dtw[i - 1]![j - 1]!, // match
      );
    }
  }

  const totalCost = dtw[n]![m]!;

  // Traceback for warping path
  const path: [number, number][] = [];
  let i = n;
  let j = m;

  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const diag = dtw[i - 1]![j - 1]!;
    const left = dtw[i]![j - 1]!;
    const up = dtw[i - 1]![j]!;

    if (diag <= left && diag <= up) {
      i--;
      j--;
    } else if (up <= left) {
      i--;
    } else {
      j--;
    }
  }

  path.reverse();

  // Normalize by path length
  const normalizedDistance = path.length > 0
    ? Math.sqrt(totalCost / path.length)
    : 0;

  return { distance: normalizedDistance, path };
}

/**
 * Get just the warping path (faster if you don't need the distance).
 */
export function dtwWarpingPath(
  a: number[],
  b: number[],
  bandFraction: number = 0.1,
): [number, number][] {
  return dtwDistance(a, b, bandFraction).path;
}
