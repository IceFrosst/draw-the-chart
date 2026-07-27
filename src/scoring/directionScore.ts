import type { LogReturnPath, ScoringConfig } from './types.js';

const NEUTRAL_PREDICTION_CREDIT = 0.08;

/**
 * Component A: Directional Accuracy (0–40 points)
 *
 * Multi-scale direction score. Split horizon into segments at increasing
 * granularity (halves, quarters, eighths, sixteenths). At each scale level l,
 * compute fraction of segments where predicted net move matches actual net
 * move sign. Weight coarser scales more heavily (geometric decay).
 */
export function computeDirectionScore(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  config: ScoringConfig,
): number {
  const N = predicted.length;
  if (N !== actual.length || N < 2) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (let level = 1; level <= config.directionMaxScaleLevel; level++) {
    const numSegments = Math.pow(2, level);
    const segmentSize = N / numSegments;

    // Weight: coarser scales (lower level) get more weight
    const weight = Math.pow(
      config.directionDecayBase,
      config.directionMaxScaleLevel - level,
    );

    let matchCount = 0;

    for (let seg = 0; seg < numSegments; seg++) {
      const startIdx = Math.round(seg * segmentSize);
      const endIdx = Math.round((seg + 1) * segmentSize) - 1;

      if (startIdx >= N || endIdx >= N) break;

      const predMove = predicted[endIdx]! - predicted[startIdx]!;
      const actualMove = actual[endIdx]! - actual[startIdx]!;

      // Match if same sign, or both near zero
      if (predMove * actualMove > 0 || (Math.abs(predMove) < 1e-12 && Math.abs(actualMove) < 1e-12)) {
        matchCount++;
      } else if (Math.abs(actualMove) < 1e-12) {
        // Actual move is ~0 — give half credit
        matchCount += 0.5;
      } else if (Math.abs(predMove) < 1e-12) {
        // A tiny abstention credit keeps the flat-line baseline in band
        // without making neutral predictions directionally competitive.
        matchCount += NEUTRAL_PREDICTION_CREDIT;
      }
    }

    const fraction = matchCount / numSegments;
    weightedSum += weight * fraction;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return 39 * (weightedSum / totalWeight);
}
