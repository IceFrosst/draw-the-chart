/**
 * v3 Layer 3 — Percentile payout with exact house edge.
 *
 * Three zones (WHITEPAPER_v3.md §7):
 *   refund  (u < uBe):       M = mMin + (1 - mMin) * (u/uBe)^alpha
 *   profit  (uBe <= u < uJ): M = exp(g * (u - uBe))
 *   jackpot (u >= uJ):       linear ramp from M(uJ) to mMax
 *
 * g is solved so that the mean of M over u in [0,1] equals exactly 1 - h.
 * Under the zero-skill null, U is uniform, so E[M] = 1 - h by construction.
 */

export interface PayoutV3Config {
  houseEdge: number;
  breakEvenPercentile: number;
  minMultiplier: number;
  refundExponent: number;
  jackpotStart: number;
  maxMultiplier: number;
  /** solved numerically; see solveGrowthRate() */
  growthRate: number;
}

/** "Standard" profile: h=4%, break-even at the 80th percentile, cap 12x. */
export const STANDARD_PAYOUT_V3: PayoutV3Config = {
  houseEdge: 0.04,
  breakEvenPercentile: 0.8,
  minMultiplier: 0.15,
  refundExponent: 1.8,
  jackpotStart: 0.99,
  maxMultiplier: 12,
  growthRate: 9.0944,
};

export function multiplierAt(u: number, cfg: PayoutV3Config = STANDARD_PAYOUT_V3): number {
  const x = Math.max(0, Math.min(1, u));
  const { breakEvenPercentile: uBe, minMultiplier: mMin, refundExponent: alpha,
    jackpotStart: uJ, maxMultiplier: mMax, growthRate: g } = cfg;
  if (x < uBe) return mMin + (1 - mMin) * (x / uBe) ** alpha;
  if (x < uJ) return Math.exp(g * (x - uBe));
  const mAtUJ = Math.exp(g * (uJ - uBe));
  return mAtUJ + ((x - uJ) / (1 - uJ)) * (mMax - mAtUJ);
}

export function expectedMultiplier(cfg: PayoutV3Config, n = 200_000): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += multiplierAt((i + 0.5) / n, cfg);
  return s / n;
}

/** Re-solve g for a (possibly modified) profile so that E[M] = 1 - h. */
export function solveGrowthRate(cfg: Omit<PayoutV3Config, 'growthRate'>): number {
  let lo = 0.01;
  let hi = 60;
  for (let iter = 0; iter < 80; iter++) {
    const mid = (lo + hi) / 2;
    const em = expectedMultiplier({ ...cfg, growthRate: mid }, 50_000);
    if (em > 1 - cfg.houseEdge) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export function computePayoutV3(
  percentile: number,
  stake: number,
  cfg: PayoutV3Config = STANDARD_PAYOUT_V3,
): { multiplier: number; payout: number; profit: number } {
  const multiplier = multiplierAt(percentile, cfg);
  const payout = stake * multiplier;
  return { multiplier, payout, profit: payout - stake };
}
