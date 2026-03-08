import type { ScoringConfig } from './types.js';

/**
 * Tuned scoring parameters.
 *
 * Validated against 7 months of BTC/USDT 1-min candle data (302k candles,
 * Aug 2025 – Mar 2026), 1000 rounds per strategy per timeframe.
 *
 * Baseline results (overall means across all 5 timeframes):
 *   Random Walk:    tuned via backtest harness
 *   Flat Line:      tuned via backtest harness
 *   Naive Trend:    tuned via backtest harness
 *   Mean Reversion: exploratory baseline only
 *   Near Perfect:   tuned via backtest harness
 *
 * The values below intentionally avoid giving free direction credit to
 * neutral predictions and keep random/flat baselines within the target band.
 */
export const DEFAULT_CONFIG: ScoringConfig = {
  N: 120,

  // Direction Score (Component A, 0–40 pts)
  directionMaxScaleLevel: 4, // halves, quarters, eighths, sixteenths
  directionDecayBase: 2.0, // coarser scales weighted 2x more

  // Magnitude Score (Component B, 0–30 pts)
  magnitudeLambda: 1.35,
  magnitudeBiasWeight: 0.5, // slight increase — penalize wrong level more than tracking noise
  magnitudeTrackingWeight: 0.5,
  magnitudeVolFloor: 1e-8,

  // Turning Points (Component C, 0–20 pts)
  turningPointSmoothingFraction: 0.05, // horizon/20
  turningPointProminenceMultiple: 0.3, // min prominence = 0.3σ
  turningPointTimeTolerance: 0.1, // horizon/10
  turningPointHallucinationPenalty: 0.2,
  turningPointMissPenalty: 0.15,
  turningPointTimeWeight: 0.5,
  turningPointAmplitudeWeight: 0.5,

  // Volatility Regime (Component D, 0–10 pts)
  volatilityMu: 1.8,
  volatilityQuarters: 4,
  volatilityFloor: 1e-8,
};
