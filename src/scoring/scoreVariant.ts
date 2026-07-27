/**
 * Variant-aware score computation.
 *
 * Replaces the fixed computeScore() for the evolutionary optimizer.
 * Each component uses a pluggable variant with its own params,
 * and component weights are genome-defined (not fixed 40/30/20/10).
 */

import type { LogReturnPath } from './types.js';
import type { Genome } from './evolveTypes.js';
import { getVariantById } from './variants/registry.js';
import { resamplePath, pricesToLogReturns } from './score.js';

// Ensure all variants are registered
import './variants/direction/index.js';
import './variants/magnitude/index.js';
import './variants/turningPoints/index.js';
import './variants/volatility/index.js';

export interface VariantScoreBreakdown {
  direction: number;
  magnitude: number;
  turningPoints: number;
  volatility: number;
  total: number;
  /** Normalized scores (0-1) before weighting */
  normalized: {
    direction: number;
    magnitude: number;
    turningPoints: number;
    volatility: number;
  };
}

const COMPONENTS = ['direction', 'magnitude', 'turningPoints', 'volatility'] as const;

/**
 * Extract variant-specific params from the genome's flat param dictionary.
 */
function extractVariantParams(genome: Genome, variantId: string): Record<string, number> {
  const variant = getVariantById(variantId);
  if (!variant) return {};

  const params: Record<string, number> = {};
  for (const pDef of variant.parameterDefs) {
    const key = `${variantId}:${pDef.name}`;
    params[pDef.name] = genome.variantParams[key] ?? pDef.default;
  }
  return params;
}

/**
 * Compute score from raw price arrays using a genome's variant config.
 */
export function computeVariantScore(
  predictedPrices: number[],
  actualPrices: number[],
  genome: Genome,
  N: number = 120,
): VariantScoreBreakdown {
  const predLR = resamplePath(pricesToLogReturns(predictedPrices), N);
  const actLR = resamplePath(pricesToLogReturns(actualPrices), N);
  return computeVariantScoreFromLogReturns(predLR, actLR, genome);
}

/**
 * Compute score from log-return paths (already resampled).
 */
export function computeVariantScoreFromLogReturns(
  predicted: LogReturnPath,
  actual: LogReturnPath,
  genome: Genome,
): VariantScoreBreakdown {
  const normalized: Record<string, number> = {};

  for (const comp of COMPONENTS) {
    const variantId = genome.variantSelection[comp];
    const variant = getVariantById(variantId);
    if (!variant) {
      throw new Error(`Unknown variant: ${variantId}`);
    }

    const params = extractVariantParams(genome, variantId);

    // Variant compute returns 0-1 normalized score
    const raw = variant.compute(predicted, actual, params);
    normalized[comp] = Math.max(0, Math.min(1, raw));
  }

  const weights = genome.componentWeights;

  const direction = weights.direction * normalized['direction']!;
  const magnitude = weights.magnitude * normalized['magnitude']!;
  const turningPoints = weights.turningPoints * normalized['turningPoints']!;
  const volatility = weights.volatility * normalized['volatility']!;

  return {
    direction,
    magnitude,
    turningPoints,
    volatility,
    total: direction + magnitude + turningPoints + volatility,
    normalized: {
      direction: normalized['direction']!,
      magnitude: normalized['magnitude']!,
      turningPoints: normalized['turningPoints']!,
      volatility: normalized['volatility']!,
    },
  };
}
