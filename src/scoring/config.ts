import type { ScoringConfig } from './types.js';

/**
 * Tuned scoring parameters.
 *
 * Optimized via 560-config parameter sweep + evolutionary optimizer
 * (191 generations, 19,200 evaluations) across 5 years of BTC/USDT
 * 1-min candle data (2.7M candles, Jan 2021 – Mar 2026).
 *
 * Component weights rebalanced per evolution results:
 *   Direction:      39 pts (was 40) — most important
 *   Magnitude:      22 pts (was 30) — less weight on exact levels
 *   Turning Points: 34 pts (was 20) — much more weight on shape
 *   Volatility:      5 pts (was 10) — barely matters
 *
 * Reports: PARAMETER_SWEEP_REPORT.md, EVOLUTION_REPORT.md
 */
export const DEFAULT_CONFIG: ScoringConfig = {
  N: 120,

  // Direction Score (Component A, 0–39 pts)
  directionMaxScaleLevel: 3, // halves, quarters, eighths
  directionDecayBase: 3.0, // coarser scales weighted 3x more

  // Magnitude Score (Component B, 0–22 pts)
  magnitudeLambda: 1.4,
  magnitudeBiasWeight: 0.3, // reduced — less penalty for level bias, more for tracking
  magnitudeTrackingWeight: 0.7,
  magnitudeVolFloor: 1e-8,

  // Turning Points (Component C, 0–34 pts)
  turningPointSmoothingFraction: 0.046667, // slightly tighter smoothing
  turningPointProminenceMultiple: 0.3, // min prominence = 0.3σ
  turningPointTimeTolerance: 0.05, // tighter time matching window
  turningPointHallucinationPenalty: 0.35, // stronger penalty for hallucinated turns
  turningPointMissPenalty: 0.16, // missed turns should materially reduce shape credit
  turningPointTimeWeight: 0.5,
  turningPointAmplitudeWeight: 0.5,

  // Volatility Regime (Component D, 0–5 pts)
  volatilityMu: 1.0, // more lenient vol matching
  volatilityQuarters: 4,
  volatilityFloor: 1e-8,
};
