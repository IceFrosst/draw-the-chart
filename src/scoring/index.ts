export { computeScore, computeScoreFromLogReturns, pricesToLogReturns, resamplePath } from './score.js';
export { computeDirectionScore } from './directionScore.js';
export { computeMagnitudeScore } from './magnitudeScore.js';
export { computeTurningPointScore } from './turningPoints.js';
export { computeVolatilityScore } from './volatilityRegime.js';
export { DEFAULT_CONFIG } from './config.js';
export {
  computePayoutMultiplier,
  computePayout,
  generatePayoutCurve,
  getBreakEvenScore,
  DEFAULT_PAYOUT_CONFIG,
} from './payout.js';
export type { ScoringConfig, ScoreBreakdown, LogReturnPath } from './types.js';
export type { PayoutConfig } from './payout.js';
