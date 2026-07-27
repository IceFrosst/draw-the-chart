import { describe, it, expect } from 'vitest';
import {
  computeExtendedStats,
  pearsonCorrelation,
  computeCorrelationMatrix,
  runEdgeCaseTests,
  testMonotonicity,
  runFullAudit,
  flatLineStrategy,
  randomWalkStrategy,
  perfectStrategy,
  inverseStrategy,
  nearPerfectStrategy,
} from './backtest.js';
import { computeScore, computeScoreFromLogReturns } from './score.js';
import { DEFAULT_CONFIG } from './config.js';
import type { ScoreBreakdown } from './types.js';

// ─── Helper: generate a deterministic PRNG ───
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Helper: generate a realistic price path ───
function generatePricePath(length: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const prices = [50000];
  for (let i = 1; i < length; i++) {
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    prices.push(prices[i - 1]! * Math.exp(z * 0.002));
  }
  return prices;
}

describe('computeExtendedStats', () => {
  it('computes correct statistics', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const stats = computeExtendedStats(values);

    expect(stats.mean).toBeCloseTo(5.5, 1);
    expect(stats.median).toBe(6); // floor(10/2) = index 5 = 6
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(10);
    expect(stats.std).toBeGreaterThan(2.5);
    expect(stats.std).toBeLessThan(3.5);
  });

  it('handles empty array', () => {
    const stats = computeExtendedStats([]);
    expect(stats.mean).toBe(0);
    expect(stats.std).toBe(0);
  });
});

describe('pearsonCorrelation', () => {
  it('returns 1 for identical arrays', () => {
    const x = [1, 2, 3, 4, 5];
    expect(pearsonCorrelation(x, x)).toBeCloseTo(1, 5);
  });

  it('returns -1 for perfectly inversely correlated', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [5, 4, 3, 2, 1];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(-1, 5);
  });

  it('returns 0 for uncorrelated', () => {
    const x = [1, 0, -1, 0];
    const y = [0, 1, 0, -1];
    expect(Math.abs(pearsonCorrelation(x, y))).toBeLessThan(0.1);
  });
});

describe('Edge Case Stress Tests', () => {
  it('all edge cases produce valid scores (no crashes, no NaN, 0-100)', () => {
    const results = runEdgeCaseTests();

    for (const result of results) {
      if (!result.passed) {
        console.log(`  FAILED: ${result.name} — ${result.error}`);
      }
    }

    // Allow empty/single-point paths to "fail" gracefully (score 0 or catch)
    // but all others must pass
    const criticalResults = results.filter(
      (r) => !r.name.includes('Empty') && !r.name.includes('Single-point'),
    );

    for (const r of criticalResults) {
      expect(r.passed, `Edge case "${r.name}" failed: ${r.error}`).toBe(true);
    }
  });
});

describe('Strategy sanity checks', () => {
  const actual = generatePricePath(200, 12345);
  const rng = mulberry32(99999);

  it('perfect strategy scores ~100', () => {
    const pred = perfectStrategy(actual);
    const score = computeScore(pred, actual);
    expect(score.total).toBeGreaterThan(95);
  });

  it('inverse strategy scores low', () => {
    const pred = inverseStrategy(actual);
    const score = computeScore(pred, actual);
    expect(score.total).toBeLessThan(30);
  });

  it('flat line scores lower than near-perfect', () => {
    const flat = flatLineStrategy(actual);
    const np = nearPerfectStrategy(actual, rng, 0.05);
    const flatScore = computeScore(flat, actual);
    const npScore = computeScore(np, actual);
    expect(npScore.total).toBeGreaterThan(flatScore.total);
  });

  it('random walk scores in expected range', () => {
    // Run 50 rounds for more stable average
    let sum = 0;
    for (let i = 0; i < 50; i++) {
      const pathActual = generatePricePath(200, i * 7777);
      const r = mulberry32(i * 3333);
      const pred = randomWalkStrategy(pathActual, r);
      sum += computeScore(pred, pathActual).total;
    }
    const avg = sum / 50;
    // Looser bounds for unit test (backtesting with real data is more precise)
    expect(avg).toBeGreaterThan(20);
    expect(avg).toBeLessThan(50);
  });
});

describe('Monotonicity', () => {
  it('lower noise predictions generally score higher', () => {
    const prices = generatePricePath(500, 54321);

    // Test 50 pairs
    const result = testMonotonicity(prices, 50, 11111);

    // Allow some violations (turning points are noisy) but < 30%
    expect(result.violationRate).toBeLessThan(0.30);
  });
});

describe('Score bounds', () => {
  it('score is always in 0-100 for realistic inputs', () => {
    for (let seed = 0; seed < 20; seed++) {
      const actual = generatePricePath(200, seed * 1111);
      const rng = mulberry32(seed * 2222);
      const pred = randomWalkStrategy(actual, rng);
      const score = computeScore(pred, actual);

      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
      expect(score.direction).toBeGreaterThanOrEqual(0);
      expect(score.direction).toBeLessThanOrEqual(39);
      expect(score.magnitude).toBeGreaterThanOrEqual(0);
      expect(score.magnitude).toBeLessThanOrEqual(22);
      expect(score.turningPoints).toBeGreaterThanOrEqual(0);
      expect(score.turningPoints).toBeLessThanOrEqual(34);
      expect(score.volatility).toBeGreaterThanOrEqual(0);
      expect(score.volatility).toBeLessThanOrEqual(5);
    }
  });
});
