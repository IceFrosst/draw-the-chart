/**
 * v3 field-relative scoring — public API.
 *
 * scoreRoundV3() runs all three layers for one round:
 *   1. perceptual similarity of the player's drawing
 *   2. percentile vs. a deterministic synthetic field
 *   3. percentile payout with exact house edge
 */

import { pricesToLogReturns, resamplePath } from '../score.js';
import {
  computeSimilarityFromLogReturns,
  DEFAULT_SIMILARITY_CONFIG,
  type SimilarityBreakdown,
  type SimilarityConfig,
} from './similarity.js';
import {
  computeAnchorState,
  DEFAULT_FIELD_CONFIG,
  generateField,
  rankAgainstField,
  FIELD_VERSION,
  type FieldConfig,
} from './field.js';
import { computePayoutV3, STANDARD_PAYOUT_V3, type PayoutV3Config } from './payout.js';

export * from './similarity.js';
export * from './field.js';
export * from './payout.js';

export interface RoundV3Input {
  /** player's predicted prices, anchor first */
  predictedPrices: number[];
  /** realized prices, anchor first, same resolution as the field steps */
  actualPrices: number[];
  /** lookback prices before the anchor, same resolution */
  lookbackPrices: number[];
  /** deterministic round seed (live: derived from the commitment hash) */
  seed: number;
  stake?: number;
  similarityConfig?: SimilarityConfig;
  fieldConfig?: FieldConfig;
  payoutConfig?: PayoutV3Config;
}

export interface FieldContext {
  /** similarity of the median field forecast this round */
  medianSimilarity: number;
  /** similarity of the best field forecast this round */
  bestSimilarity: number;
  /** ~swarmSize field paths (log-return, N points), evenly spaced by rank worst -> best */
  swarm: number[][];
  /** the field forecast that ranked immediately above the player (null if player beat the whole field) */
  rival: { logReturns: number[]; similarity: number } | null;
  /** true when the realized path ended outside virtually the entire field (top/bottom 0.5%) */
  tailEvent: boolean;
}

export interface RoundV3Result {
  similarity: SimilarityBreakdown;
  percentile: number;
  fieldSize: number;
  beaten: number;
  multiplier: number;
  payout: number;
  profit: number;
  fieldVersion: string;
  /** field similarity totals, for histogram display */
  fieldSimilarities: number[];
  /** context for the reveal screen: swarm, rival, difficulty */
  fieldContext: FieldContext;
}

export function scoreRoundV3(input: RoundV3Input): RoundV3Result {
  const simCfg = input.similarityConfig ?? DEFAULT_SIMILARITY_CONFIG;
  const fieldCfg = input.fieldConfig ?? DEFAULT_FIELD_CONFIG;
  const payoutCfg = input.payoutConfig ?? STANDARD_PAYOUT_V3;
  const stake = input.stake ?? 100;

  const horizonSteps = input.actualPrices.length - 1;
  const anchorPrice = input.actualPrices[0]!;

  const actual = resamplePath(pricesToLogReturns(input.actualPrices), simCfg.N);
  const pred = resamplePath(pricesToLogReturns(input.predictedPrices), simCfg.N);

  const state = computeAnchorState(
    input.lookbackPrices.length >= 2 ? input.lookbackPrices : input.actualPrices,
    anchorPrice,
    horizonSteps,
    fieldCfg.ewmaLambda,
    simCfg.N,
  );

  const similarity = computeSimilarityFromLogReturns(pred, actual, state.sigmaTypical, simCfg);

  const field = generateField(state, horizonSteps, input.seed, fieldCfg, simCfg.N);
  const ranked = rankAgainstField(similarity.total, field, actual, state.sigmaTypical, simCfg);

  const { multiplier, payout, profit } = computePayoutV3(ranked.percentile, stake, payoutCfg);

  const fieldContext = buildFieldContext(
    field,
    ranked.fieldSimilarities,
    similarity.total,
    actual,
  );

  return {
    similarity,
    percentile: ranked.percentile,
    fieldSize: ranked.fieldSize,
    beaten: ranked.beaten,
    multiplier,
    payout,
    profit,
    fieldVersion: FIELD_VERSION,
    fieldSimilarities: ranked.fieldSimilarities,
    fieldContext,
  };
}

const SWARM_SIZE = 60;

function buildFieldContext(
  field: number[][],
  sims: number[],
  playerSimilarity: number,
  actual: number[],
): FieldContext {
  const B = field.length;
  // rank order, worst -> best
  const order = Array.from({ length: B }, (_, i) => i).sort((a, b) => sims[a]! - sims[b]!);

  const medianSimilarity = sims[order[Math.floor(B / 2)]!]!;
  const bestSimilarity = sims[order[B - 1]!]!;

  // rival: the weakest field forecast that still beat the player
  let rival: FieldContext['rival'] = null;
  for (let i = 0; i < B; i++) {
    const idx = order[i]!;
    if (sims[idx]! > playerSimilarity) {
      rival = { logReturns: field[idx]!, similarity: sims[idx]! };
      break;
    }
  }

  // swarm: evenly spaced ranks, so the render shows the full spread
  const swarm: number[][] = [];
  const stride = Math.max(1, Math.floor(B / SWARM_SIZE));
  for (let i = 0; i < B && swarm.length < SWARM_SIZE; i += stride) {
    swarm.push(field[order[i]!]!);
  }

  // tail event: realized end return lands outside virtually all field ends
  const ends = field.map((p) => p[p.length - 1]!).sort((a, b) => a - b);
  const lo = ends[Math.max(0, Math.floor(0.005 * (B - 1)))]!;
  const hi = ends[Math.min(B - 1, Math.ceil(0.995 * (B - 1)))]!;
  const actualEnd = actual[actual.length - 1]!;
  const tailEvent = actualEnd < lo || actualEnd > hi;

  return { medianSimilarity, bestSimilarity, swarm, rival, tailEvent };
}
