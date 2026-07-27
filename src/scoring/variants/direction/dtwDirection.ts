import type { ScoringVariant } from '../types.js';
import type { LogReturnPath } from '../../types.js';
import { dtwWarpingPath } from '../dtw.js';

/**
 * Direction variant: DTW-aligned direction matching.
 *
 * Use DTW to find optimal alignment between predicted and actual paths,
 * then check direction match on aligned segments.
 */
function compute(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  params: Record<string, number>,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 2) return 0;

  const bandFraction = params['dtwBandFraction'] ?? 0.1;
  const segmentSize = Math.round(params['segmentSize'] ?? 8);

  // Get DTW warping path
  const warpPath = dtwWarpingPath(predicted, actual, bandFraction);
  if (warpPath.length < 2) return 0;

  // Group warping path into segments and check direction
  const numSegments = Math.max(1, Math.floor(warpPath.length / segmentSize));
  let matches = 0;

  for (let s = 0; s < numSegments; s++) {
    const startWarp = Math.round((s * warpPath.length) / numSegments);
    const endWarp = Math.round(((s + 1) * warpPath.length) / numSegments) - 1;

    if (startWarp >= warpPath.length || endWarp >= warpPath.length) break;

    const [predStart] = warpPath[startWarp]!;
    const [predEnd] = warpPath[endWarp]!;
    const [, actStart] = warpPath[startWarp]!;
    const [, actEnd] = warpPath[endWarp]!;

    const predMove = predicted[predEnd]! - predicted[predStart]!;
    const actualMove = actual[actEnd]! - actual[actStart]!;

    if (predMove * actualMove > 0) {
      matches++;
    } else if (Math.abs(predMove) < 1e-12 && Math.abs(actualMove) < 1e-12) {
      matches++;
    } else if (Math.abs(actualMove) < 1e-12 || Math.abs(predMove) < 1e-12) {
      matches += 0.3; // partial credit for near-zero
    }
  }

  return numSegments > 0 ? matches / numSegments : 0;
}

export const dtwDirection: ScoringVariant = {
  id: 'direction.dtwDirection',
  component: 'direction',
  name: 'DTW-Aligned Direction',
  parameterDefs: [
    { name: 'dtwBandFraction', min: 0.05, max: 0.3, default: 0.1 },
    { name: 'segmentSize', min: 3, max: 20, default: 8, integer: true },
  ],
  compute,
};
