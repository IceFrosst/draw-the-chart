import { describe, it, expect } from 'vitest';
import { computeDirectionScore } from './directionScore.js';
import { computeMagnitudeScore } from './magnitudeScore.js';
import { computeTurningPointScore } from './turningPoints.js';
import { computeVolatilityScore } from './volatilityRegime.js';
import {
  computeScore,
  computeScoreFromLogReturns,
  pricesToLogReturns,
  resamplePath,
} from './score.js';
import { DEFAULT_CONFIG } from './config.js';
import { computePayoutMultiplier, computePayout, DEFAULT_PAYOUT_CONFIG } from './payout.js';
import type { ScoringConfig } from './types.js';

const N = DEFAULT_CONFIG.N; // 120

// Helper: generate a linear path from 0 to endValue
function linearPath(endValue: number, length: number = N): number[] {
  return Array.from({ length }, (_, i) => (endValue * i) / (length - 1));
}

// Helper: generate a sine wave path
function sinePath(
  amplitude: number,
  periods: number,
  length: number = N,
): number[] {
  return Array.from(
    { length },
    (_, i) =>
      amplitude * Math.sin((2 * Math.PI * periods * i) / (length - 1)),
  );
}

// Helper: generate random walk (seeded for reproducibility)
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function randomWalk(
  length: number = N,
  stepSize: number = 0.001,
  seed: number = 42,
): number[] {
  const rng = seededRandom(seed);
  const path = [0];
  for (let i = 1; i < length; i++) {
    path.push(path[i - 1]! + (rng() - 0.5) * stepSize);
  }
  return path;
}

// Helper: convert price paths to log-return paths for direct component testing
function makePricePath(logReturns: number[], p0: number = 100): number[] {
  return logReturns.map((lr) => p0 * Math.exp(lr));
}

describe('pricesToLogReturns', () => {
  it('converts prices to log-return space anchored at 0', () => {
    const prices = [100, 110, 105, 120];
    const lr = pricesToLogReturns(prices);
    expect(lr[0]).toBeCloseTo(0);
    expect(lr[1]).toBeCloseTo(Math.log(110 / 100));
    expect(lr[2]).toBeCloseTo(Math.log(105 / 100));
    expect(lr[3]).toBeCloseTo(Math.log(120 / 100));
  });

  it('handles empty array', () => {
    expect(pricesToLogReturns([])).toEqual([]);
  });
});

describe('resamplePath', () => {
  it('resamples to exact N points', () => {
    const path = [0, 1, 2, 3, 4];
    const resampled = resamplePath(path, 9);
    expect(resampled.length).toBe(9);
    expect(resampled[0]).toBeCloseTo(0);
    expect(resampled[8]).toBeCloseTo(4);
    expect(resampled[4]).toBeCloseTo(2);
  });

  it('handles single-element path', () => {
    const result = resamplePath([5], 10);
    expect(result.length).toBe(10);
    result.forEach((v) => expect(v).toBe(5));
  });
});

describe('Direction Score', () => {
  it('identical paths → 40 (perfect direction)', () => {
    const path = linearPath(0.05);
    const score = computeDirectionScore(path, path, DEFAULT_CONFIG);
    expect(score).toBeCloseTo(40, 0);
  });

  it('inverted path → 0 (worst direction)', () => {
    const up = linearPath(0.05);
    const down = linearPath(-0.05);
    const score = computeDirectionScore(up, down, DEFAULT_CONFIG);
    expect(score).toBeCloseTo(0, 0);
  });

  it('flat prediction vs strong trend → low score', () => {
    const flat = new Array(N).fill(0);
    const trend = linearPath(0.1);
    const score = computeDirectionScore(flat, trend, DEFAULT_CONFIG);
    // Flat predicts no direction — gets only a minimal abstention credit.
    expect(score).toBeCloseTo(2, 0);
  });

  it('same direction but different magnitudes → high score', () => {
    const small = linearPath(0.01);
    const big = linearPath(0.1);
    const score = computeDirectionScore(small, big, DEFAULT_CONFIG);
    expect(score).toBeCloseTo(40, 0);
  });
});

describe('Magnitude Score', () => {
  it('identical paths → 30 (perfect magnitude)', () => {
    const path = randomWalk(N, 0.002, 42);
    const score = computeMagnitudeScore(path, path, DEFAULT_CONFIG);
    expect(score).toBeCloseTo(30, 0);
  });

  it('constant offset → moderate score (high bias, low tracking error)', () => {
    const actual = randomWalk(N, 0.002, 42);
    // Use a small offset (~0.3σ of the path) to get moderate penalty
    const predicted = actual.map((v) => v + 0.003);
    const score = computeMagnitudeScore(predicted, actual, DEFAULT_CONFIG);
    // Should be penalized for bias but not tracking error
    expect(score).toBeGreaterThan(2);
    expect(score).toBeLessThan(30);
  });

  it('completely wrong magnitude → low score', () => {
    const actual = randomWalk(N, 0.002, 42);
    const predicted = actual.map((v) => v * 5);
    const score = computeMagnitudeScore(predicted, actual, DEFAULT_CONFIG);
    expect(score).toBeLessThan(10);
  });

  it('flat prediction vs volatile actual → low score', () => {
    const flat = new Array(N).fill(0);
    const volatile = randomWalk(N, 0.01, 42);
    const score = computeMagnitudeScore(flat, volatile, DEFAULT_CONFIG);
    expect(score).toBeLessThan(25);
  });
});

describe('Turning Point Score', () => {
  it('identical sine waves → high score', () => {
    const path = sinePath(0.05, 3);
    const score = computeTurningPointScore(path, path, DEFAULT_CONFIG);
    expect(score).toBeGreaterThan(15);
  });

  it('inverted sine → low score (wrong turn directions)', () => {
    const path = sinePath(0.05, 3);
    const inverted = path.map((v) => -v);
    const score = computeTurningPointScore(path, inverted, DEFAULT_CONFIG);
    expect(score).toBeLessThan(10);
  });

  it('flat predicted vs sine actual → penalized for missed turns', () => {
    const flat = new Array(N).fill(0);
    const sine = sinePath(0.05, 3);
    const score = computeTurningPointScore(flat, sine, DEFAULT_CONFIG);
    expect(score).toBeLessThan(15);
  });

  it('both flat → full score (no turns to match)', () => {
    const flat = new Array(N).fill(0);
    const score = computeTurningPointScore(flat, flat, DEFAULT_CONFIG);
    expect(score).toBe(20);
  });
});

describe('Volatility Score', () => {
  it('identical paths → 10 (perfect vol match)', () => {
    const path = randomWalk(N, 0.002, 42);
    const score = computeVolatilityScore(path, path, DEFAULT_CONFIG);
    expect(score).toBeCloseTo(10, 0);
  });

  it('very different volatilities → low score', () => {
    const calm = randomWalk(N, 0.001, 42);
    const wild = randomWalk(N, 0.01, 42);
    const score = computeVolatilityScore(calm, wild, DEFAULT_CONFIG);
    expect(score).toBeLessThan(7);
  });

  it('flat prediction vs volatile actual → low score', () => {
    const flat = new Array(N).fill(0);
    const volatile = randomWalk(N, 0.005, 42);
    const score = computeVolatilityScore(flat, volatile, DEFAULT_CONFIG);
    expect(score).toBeLessThan(5);
  });
});

describe('Combined Score', () => {
  it('identical price paths → score ~100', () => {
    // Generate a realistic price path
    const p0 = 50000;
    const logReturns = randomWalk(200, 0.002, 123);
    const prices = logReturns.map((lr) => p0 * Math.exp(lr));

    const result = computeScore(prices, prices);
    expect(result.total).toBeGreaterThan(95);
    expect(result.direction).toBeCloseTo(40, 0);
    expect(result.magnitude).toBeCloseTo(30, 0);
    expect(result.turningPoints).toBeGreaterThan(15);
    expect(result.volatility).toBeCloseTo(10, 0);
  });

  it('inverted path → very low score', () => {
    const p0 = 50000;
    const logReturns = randomWalk(200, 0.003, 99);
    const actualPrices = logReturns.map((lr) => p0 * Math.exp(lr));
    const invertedLogReturns = logReturns.map((lr) => -lr);
    const invertedPrices = invertedLogReturns.map((lr) => p0 * Math.exp(lr));

    const result = computeScore(invertedPrices, actualPrices);
    expect(result.total).toBeLessThan(30);
  });

  it('flat line prediction → low-moderate score', () => {
    const p0 = 50000;
    const logReturns = randomWalk(200, 0.003, 55);
    const actualPrices = logReturns.map((lr) => p0 * Math.exp(lr));
    const flatPrices = new Array(200).fill(p0);

    const result = computeScore(flatPrices, actualPrices);
    expect(result.total).toBeGreaterThan(10);
    expect(result.total).toBeLessThan(55);
  });

  it('predicted = actual + small constant offset → high direction, moderate magnitude', () => {
    const p0 = 50000;
    const logReturns = randomWalk(200, 0.002, 77);
    const actualPrices = logReturns.map((lr) => p0 * Math.exp(lr));
    // Shift by a small constant in log-return space
    const shiftedLogReturns = logReturns.map((lr) => lr + 0.01);
    const shiftedPrices = shiftedLogReturns.map((lr) => p0 * Math.exp(lr));

    const result = computeScore(shiftedPrices, actualPrices);
    expect(result.direction).toBeGreaterThan(35); // should be near-perfect direction
    expect(result.magnitude).toBeLessThan(30); // penalized for bias
    expect(result.magnitude).toBeGreaterThan(10); // but not too much
  });
});

describe('Payout Curve', () => {
  it('score 0 → minimum multiplier', () => {
    const mult = computePayoutMultiplier(0);
    expect(mult).toBeCloseTo(DEFAULT_PAYOUT_CONFIG.minMultiplier, 2);
  });

  it('break-even score → ~1x multiplier (minus house edge)', () => {
    const mult = computePayoutMultiplier(DEFAULT_PAYOUT_CONFIG.breakEvenScore);
    expect(mult).toBeCloseTo(1 - DEFAULT_PAYOUT_CONFIG.houseEdge, 2);
  });

  it('perfect score → high multiplier capped at maxMultiplier', () => {
    const mult = computePayoutMultiplier(1);
    expect(mult).toBeLessThanOrEqual(DEFAULT_PAYOUT_CONFIG.maxMultiplier);
    expect(mult).toBeGreaterThan(5);
  });

  it('multiplier is monotonically increasing', () => {
    let prev = computePayoutMultiplier(0);
    for (let s = 0.01; s <= 1; s += 0.01) {
      const curr = computePayoutMultiplier(s);
      expect(curr).toBeGreaterThanOrEqual(prev - 1e-10);
      prev = curr;
    }
  });

  it('computePayout returns correct values', () => {
    const result = computePayout(
      DEFAULT_PAYOUT_CONFIG.breakEvenScore * 100,
      100,
    );
    expect(result.multiplier).toBeCloseTo(1 - DEFAULT_PAYOUT_CONFIG.houseEdge, 1);
    expect(result.payout).toBeCloseTo(100 * result.multiplier);
    expect(result.profit).toBeCloseTo(result.payout - 100);
  });
});
