import type { ScoringVariant } from '../types.js';
import type { LogReturnPath } from '../../types.js';

const NEUTRAL_PREDICTION_CREDIT = 0.08;

function compute(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  params: Record<string, number>,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 2) return 0;

  const maxScaleLevel = Math.round(params['maxScaleLevel'] ?? 3);
  const decayBase = params['decayBase'] ?? 3.0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (let level = 1; level <= maxScaleLevel; level++) {
    const numSegments = Math.pow(2, level);
    const segmentSize = N / numSegments;
    const weight = Math.pow(decayBase, maxScaleLevel - level);

    let matchCount = 0;

    for (let seg = 0; seg < numSegments; seg++) {
      const startIdx = Math.round(seg * segmentSize);
      const endIdx = Math.round((seg + 1) * segmentSize) - 1;
      if (startIdx >= N || endIdx >= N) break;

      const predMove = predicted[endIdx]! - predicted[startIdx]!;
      const actualMove = actual[endIdx]! - actual[startIdx]!;

      if (predMove * actualMove > 0 || (Math.abs(predMove) < 1e-12 && Math.abs(actualMove) < 1e-12)) {
        matchCount++;
      } else if (Math.abs(actualMove) < 1e-12) {
        matchCount += 0.5;
      } else if (Math.abs(predMove) < 1e-12) {
        matchCount += NEUTRAL_PREDICTION_CREDIT;
      }
    }

    const fraction = matchCount / numSegments;
    weightedSum += weight * fraction;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight; // normalized 0-1
}

export const multiScaleDirection: ScoringVariant = {
  id: 'direction.multiScale',
  component: 'direction',
  name: 'Multi-Scale Segment Matching',
  parameterDefs: [
    { name: 'maxScaleLevel', min: 2, max: 6, default: 3, integer: true },
    { name: 'decayBase', min: 1.0, max: 5.0, default: 3.0 },
  ],
  compute,
};
