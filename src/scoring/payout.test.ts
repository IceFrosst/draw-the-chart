import { describe, expect, it } from 'vitest';
import {
  computePayout,
  computePayoutMultiplier,
  DEFAULT_PAYOUT_CONFIG,
  generatePayoutCurve,
  getBreakEvenScore,
} from './payout.js';

describe('payout invariants', () => {
  it('clamps normalized scores outside 0..1', () => {
    expect(computePayoutMultiplier(-1)).toBeCloseTo(
      DEFAULT_PAYOUT_CONFIG.minMultiplier,
      8,
    );
    expect(computePayoutMultiplier(2)).toBeCloseTo(
      computePayoutMultiplier(1),
      8,
    );
  });

  it('returns the expected break-even multiplier', () => {
    const multiplier = computePayoutMultiplier(DEFAULT_PAYOUT_CONFIG.breakEvenScore);
    expect(multiplier).toBeCloseTo(1 - DEFAULT_PAYOUT_CONFIG.houseEdge, 8);
  });

  it('exposes the display-scale break-even score', () => {
    expect(getBreakEvenScore()).toBeCloseTo(
      DEFAULT_PAYOUT_CONFIG.breakEvenScore * 100,
      8,
    );
  });

  it('is monotonic across the full generated curve', () => {
    const curve = generatePayoutCurve(DEFAULT_PAYOUT_CONFIG, 500);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!.score).toBeGreaterThan(curve[i - 1]!.score);
      expect(curve[i]!.multiplier).toBeGreaterThanOrEqual(
        curve[i - 1]!.multiplier - 1e-10,
      );
    }
  });

  it('never drops below min or above max multiplier', () => {
    const curve = generatePayoutCurve(DEFAULT_PAYOUT_CONFIG, 500);
    for (const point of curve) {
      expect(point.multiplier).toBeGreaterThanOrEqual(
        DEFAULT_PAYOUT_CONFIG.minMultiplier - 1e-10,
      );
      expect(point.multiplier).toBeLessThanOrEqual(
        DEFAULT_PAYOUT_CONFIG.maxMultiplier + 1e-10,
      );
    }
  });

  it('computes payout and profit consistently', () => {
    const result = computePayout(80, 125);
    expect(result.payout).toBeCloseTo(result.multiplier * 125, 8);
    expect(result.profit).toBeCloseTo(result.payout - 125, 8);
  });
});
