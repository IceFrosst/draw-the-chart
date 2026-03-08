/**
 * Payout curve: two-zone multiplier function.
 *
 * Refund zone (x < x_be):
 *   M(x) = M_min + (1 - h - M_min) * (x / x_be)^alpha
 *
 * Profit zone (x >= x_be):
 *   M(x) = min(M_max, (1 - h) * exp(k * (x - x_be) / (1 - x_be)))
 */

export interface PayoutConfig {
  /** House edge */
  houseEdge: number;
  /** Break-even score (0-1 normalized) */
  breakEvenScore: number;
  /** Minimum multiplier */
  minMultiplier: number;
  /** Refund zone exponent */
  refundExponent: number;
  /** Hard cap on multiplier */
  maxMultiplier: number;
  /** Profit zone growth rate */
  profitGrowthK: number;
}

export const DEFAULT_PAYOUT_CONFIG: PayoutConfig = {
  houseEdge: 0.02,
  breakEvenScore: 0.60,
  minMultiplier: 0.40,
  refundExponent: 1.45,
  maxMultiplier: 25,
  profitGrowthK: 3.25,
};

export function getBreakEvenScore(
  config: PayoutConfig = DEFAULT_PAYOUT_CONFIG,
): number {
  return config.breakEvenScore * 100;
}

/**
 * Compute the payout multiplier for a given normalized score (0-1).
 * Returns the multiplier: < 1 means loss, 1 = break-even, > 1 = profit.
 */
export function computePayoutMultiplier(
  normalizedScore: number,
  config: PayoutConfig = DEFAULT_PAYOUT_CONFIG,
): number {
  const { houseEdge: h, breakEvenScore: xBe, minMultiplier: mMin, refundExponent: alpha, maxMultiplier: mMax, profitGrowthK: k } = config;
  const x = Math.max(0, Math.min(1, normalizedScore));

  if (x < xBe) {
    // Refund zone
    return mMin + (1 - h - mMin) * Math.pow(x / xBe, alpha);
  }
  // Profit zone
  return Math.min(mMax, (1 - h) * Math.exp(k * (x - xBe) / (1 - xBe)));
}

/**
 * Compute payout from a score (0-100) and wager amount.
 */
export function computePayout(
  score: number,
  wager: number,
  config: PayoutConfig = DEFAULT_PAYOUT_CONFIG,
): { multiplier: number; payout: number; profit: number } {
  const multiplier = computePayoutMultiplier(score / 100, config);
  const payout = wager * multiplier;
  return { multiplier, payout, profit: payout - wager };
}

/**
 * Generate payout curve data points for visualization.
 */
export function generatePayoutCurve(
  config: PayoutConfig = DEFAULT_PAYOUT_CONFIG,
  numPoints: number = 200,
): { score: number; multiplier: number }[] {
  const points: { score: number; multiplier: number }[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const score = (i / numPoints) * 100;
    const multiplier = computePayoutMultiplier(score / 100, config);
    points.push({ score, multiplier });
  }
  return points;
}
