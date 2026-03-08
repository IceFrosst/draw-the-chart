/** A resampled path of N log-return values, anchored at r(T0) = 0 */
export type LogReturnPath = number[];

/** Configuration for the scoring algorithm */
export interface ScoringConfig {
  /** Number of resample points per round */
  N: number;

  // --- Direction Score (Component A) ---
  /** Maximum scale level (segments = 2^l for l=1..maxScaleLevel) */
  directionMaxScaleLevel: number;
  /** Geometric decay base for scale weights: w_l = decayBase^(maxLevel - l) */
  directionDecayBase: number;

  // --- Magnitude Score (Component B) ---
  /** Overall decay rate for magnitude penalty */
  magnitudeLambda: number;
  /** Weight for bias component */
  magnitudeBiasWeight: number;
  /** Weight for tracking error component */
  magnitudeTrackingWeight: number;
  /** Minimum volatility floor (prevents division by near-zero) */
  magnitudeVolFloor: number;

  // --- Turning Points (Component C) ---
  /** Gaussian kernel width as fraction of horizon (width = horizon * this) */
  turningPointSmoothingFraction: number;
  /** Minimum prominence for extrema as multiple of σ */
  turningPointProminenceMultiple: number;
  /** Time tolerance for matching as fraction of horizon */
  turningPointTimeTolerance: number;
  /** Penalty per hallucinated (unmatched predicted) turning point */
  turningPointHallucinationPenalty: number;
  /** Penalty per missed (unmatched actual) turning point */
  turningPointMissPenalty: number;
  /** Weight for time offset in match quality (vs amplitude) */
  turningPointTimeWeight: number;
  /** Weight for amplitude similarity in match quality */
  turningPointAmplitudeWeight: number;

  // --- Volatility Regime (Component D) ---
  /** Decay rate for vol regime penalty */
  volatilityMu: number;
  /** Number of quarters to split horizon into */
  volatilityQuarters: number;
  /** Minimum vol floor for each quarter */
  volatilityFloor: number;
}

export interface ScoreBreakdown {
  direction: number;
  magnitude: number;
  turningPoints: number;
  volatility: number;
  total: number;
}
