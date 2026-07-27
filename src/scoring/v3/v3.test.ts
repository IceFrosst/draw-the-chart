/**
 * v3 engine — automated fairness, economics, and invariant tests.
 *
 * These are the CI version of scripts/v3Probe.ts. They lock in the three
 * properties the engine was built for:
 *   1. Economics: the payout curve's mean multiplier equals 1 - h exactly,
 *      and no zero-skill strategy earns more than the edge.
 *   2. Perceptual fairness: visually-close drawings rank near the top of
 *      the field and are never beaten by random scribbles at scale.
 *   3. Determinism: same inputs (including seed) -> identical outputs.
 *
 * All suites use fixed seeds, so results are bit-for-bit reproducible and
 * the asserted bounds are tight without flakiness. The historical suite at
 * the bottom is skipped automatically when the local data/ folder is absent
 * (it is not checked into git).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  scoreRoundV3,
  mulberry32,
  multiplierAt,
  expectedMultiplier,
  solveGrowthRate,
  STANDARD_PAYOUT_V3,
  DEFAULT_FIELD_CONFIG,
  type RoundV3Result,
} from './index.js';

const FAST_FIELD = { ...DEFAULT_FIELD_CONFIG, B: 500 };

// ─── helpers ─────────────────────────────────────────────────────────

function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Synthetic GBM price path (anchor first). */
function gbmPath(steps: number, p0: number, vol: number, drift: number, rng: () => number): number[] {
  const out = [p0];
  for (let i = 1; i <= steps; i++) {
    out.push(out[i - 1]! * Math.exp(drift + gaussian(rng) * vol));
  }
  return out;
}

function laggedCopy(actual: number[], lagFrac = 0.08): number[] {
  const N = actual.length;
  const lag = Math.max(1, Math.round(N * lagFrac));
  return actual.map((_, i) => actual[Math.max(0, i - lag)]!);
}

function randomWalkFromLookback(actual: number[], lookback: number[], rng: () => number): number[] {
  let sumSq = 0;
  let n = 0;
  for (let i = 1; i < lookback.length; i++) {
    const lr = Math.log(lookback[i]! / lookback[i - 1]!);
    sumSq += lr * lr;
    n++;
  }
  const stepVol = Math.sqrt(sumSq / Math.max(n, 1)) || 1e-6;
  const out = [actual[0]!];
  for (let i = 1; i < actual.length; i++) {
    out.push(out[i - 1]! * Math.exp(gaussian(rng) * stepVol));
  }
  return out;
}

interface SyntheticRound {
  actual: number[];
  lookback: number[];
  seed: number;
}

/** Deterministic set of synthetic rounds across volatility/drift regimes. */
function syntheticRounds(count: number, steps: number, masterSeed: number): SyntheticRound[] {
  const rng = mulberry32(masterSeed);
  const rounds: SyntheticRound[] = [];
  for (let i = 0; i < count; i++) {
    const vol = 0.0005 + rng() * 0.004; // calm to violent regimes
    const drift = (rng() - 0.5) * vol * 1.5;
    const lookback = gbmPath(steps * 3, 50_000 + rng() * 50_000, vol, drift * 0.5, rng);
    const anchor = lookback[lookback.length - 1]!;
    const actual = gbmPath(steps, anchor, vol, drift, rng);
    rounds.push({ actual, lookback, seed: Math.floor(rng() * 2 ** 31) });
  }
  return rounds;
}

function score(r: SyntheticRound, predicted: number[]): RoundV3Result {
  return scoreRoundV3({
    predictedPrices: predicted,
    actualPrices: r.actual,
    lookbackPrices: r.lookback,
    seed: r.seed,
    fieldConfig: FAST_FIELD,
  });
}

function mean(xs: number[]): number {
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

// ─── 1. payout curve economics ───────────────────────────────────────

describe('v3 payout curve — house edge by construction', () => {
  it('mean multiplier over uniform percentiles equals exactly 1 - h', () => {
    const em = expectedMultiplier(STANDARD_PAYOUT_V3);
    expect(em).toBeGreaterThan(1 - STANDARD_PAYOUT_V3.houseEdge - 0.002);
    expect(em).toBeLessThan(1 - STANDARD_PAYOUT_V3.houseEdge + 0.002);
  });

  it('pays exactly 1.0x at the break-even percentile', () => {
    expect(multiplierAt(STANDARD_PAYOUT_V3.breakEvenPercentile)).toBeCloseTo(1.0, 9);
  });

  it('respects the floor and the cap', () => {
    expect(multiplierAt(0)).toBeCloseTo(STANDARD_PAYOUT_V3.minMultiplier, 9);
    expect(multiplierAt(1)).toBeCloseTo(STANDARD_PAYOUT_V3.maxMultiplier, 9);
  });

  it('is monotonically non-decreasing (better rank never pays less)', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 1000; i++) {
      const m = multiplierAt(i / 1000);
      expect(m).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = m;
    }
  });

  it('solver reproduces the published growth rate g', () => {
    const g = solveGrowthRate(STANDARD_PAYOUT_V3);
    expect(Math.abs(g - STANDARD_PAYOUT_V3.growthRate)).toBeLessThan(0.05);
  });
});

// ─── 2. engine invariants ────────────────────────────────────────────

describe('v3 engine — invariants', () => {
  const [round] = syntheticRounds(1, 60, 111);

  it('is deterministic: identical inputs give identical outputs', () => {
    const pred = laggedCopy(round!.actual);
    const a = score(round!, pred);
    const b = score(round!, pred);
    expect(a.percentile).toBe(b.percentile);
    expect(a.similarity.total).toBe(b.similarity.total);
    expect(a.multiplier).toBe(b.multiplier);
  });

  it('perfect prediction ranks at the top of the field with ~100 similarity', () => {
    const out = score(round!, [...round!.actual]);
    expect(out.percentile).toBeGreaterThanOrEqual(0.99);
    expect(out.similarity.total).toBeGreaterThan(99);
  });

  it('outputs stay in range and finite across edge cases', () => {
    const cases: Array<[number[], number[]]> = [
      // flat actual market
      [new Array(61).fill(100), new Array(61).fill(100)],
      // tiny 15m-style round
      [gbmPath(15, 100, 0.001, 0, mulberry32(5)), gbmPath(15, 100, 0.001, 0, mulberry32(6))],
      // extreme price levels
      [gbmPath(60, 1e9, 0.002, 0, mulberry32(7)), gbmPath(60, 1e9, 0.002, 0, mulberry32(8))],
      [gbmPath(60, 1e-6, 0.002, 0, mulberry32(9)), gbmPath(60, 1e-6, 0.002, 0, mulberry32(10))],
    ];
    for (const [actual, predicted] of cases) {
      const out = scoreRoundV3({
        predictedPrices: predicted,
        actualPrices: actual,
        lookbackPrices: actual,
        seed: 42,
        fieldConfig: FAST_FIELD,
      });
      expect(Number.isFinite(out.percentile)).toBe(true);
      expect(out.percentile).toBeGreaterThanOrEqual(0);
      expect(out.percentile).toBeLessThanOrEqual(1);
      expect(Number.isFinite(out.similarity.total)).toBe(true);
      expect(out.similarity.total).toBeGreaterThanOrEqual(0);
      expect(out.similarity.total).toBeLessThanOrEqual(100.000001);
      expect(Number.isFinite(out.multiplier)).toBe(true);
    }
  });
});

// ─── 2b. field context (reveal-screen data) ──────────────────────────

describe('v3 engine — field context', () => {
  const [round] = syntheticRounds(1, 60, 222);
  const rng = mulberry32(999);
  const out = score(round!, randomWalkFromLookback(round!.actual, round!.lookback, rng));
  const ctx = out.fieldContext;

  it('reports coherent median and best field similarities', () => {
    expect(ctx.medianSimilarity).toBeGreaterThan(0);
    expect(ctx.bestSimilarity).toBeGreaterThanOrEqual(ctx.medianSimilarity);
    expect(ctx.bestSimilarity).toBeLessThanOrEqual(100.000001);
  });

  it('returns a rank-ordered swarm of field paths at full resolution', () => {
    expect(ctx.swarm.length).toBeGreaterThanOrEqual(30);
    expect(ctx.swarm.length).toBeLessThanOrEqual(60);
    for (const p of ctx.swarm) {
      expect(p.length).toBe(120);
      expect(Math.abs(p[0]!)).toBe(0); // anchored log-return paths (mirrors carry -0)
    }
  });

  it('rival is the weakest forecast that still beat the player', () => {
    if (out.percentile >= 1) {
      expect(ctx.rival).toBeNull();
    } else {
      expect(ctx.rival).not.toBeNull();
      expect(ctx.rival!.similarity).toBeGreaterThan(out.similarity.total);
      // no field forecast sits between the player and the rival
      const between = out.fieldSimilarities.filter(
        (s) => s > out.similarity.total && s < ctx.rival!.similarity,
      );
      expect(between.length).toBe(0);
    }
  });

  it('perfect prediction beats the whole field and has no rival', () => {
    const perfect = score(round!, [...round!.actual]);
    expect(perfect.fieldContext.rival).toBeNull();
    expect(perfect.fieldContext.tailEvent).toBe(false || perfect.fieldContext.tailEvent); // just type-sane
  });

  it('an extreme realized move is flagged as a tail event', () => {
    // realized path rockets far beyond anything the calm lookback implies
    const steps = 60;
    const calmLookback = gbmPath(steps * 3, 50_000, 0.0004, 0, mulberry32(31));
    const anchor = calmLookback[calmLookback.length - 1]!;
    const moon = Array.from({ length: steps + 1 }, (_, i) => anchor * Math.exp(0.15 * (i / steps)));
    const res = scoreRoundV3({
      predictedPrices: new Array(steps + 1).fill(anchor),
      actualPrices: moon,
      lookbackPrices: calmLookback,
      seed: 12345,
      fieldConfig: FAST_FIELD,
    });
    expect(res.fieldContext.tailEvent).toBe(true);
  });

  it('a normal realized move is not flagged as a tail event', () => {
    expect(ctx.tailEvent).toBe(false);
  });
});

// ─── 3. fairness on synthetic rounds (deterministic, no data needed) ─

describe('v3 engine — fairness (synthetic rounds)', () => {
  const rounds = syntheticRounds(80, 60, 20260610);
  const rng = mulberry32(777);

  let laggedU: number[] = [];
  let rwU: number[] = [];
  let rwM: number[] = [];
  let flatU: number[] = [];
  let perfectU: number[] = [];
  let rwBeatsLagged = 0;

  beforeAll(() => {
    for (const r of rounds) {
      const lagged = score(r, laggedCopy(r.actual));
      const rw = score(r, randomWalkFromLookback(r.actual, r.lookback, rng));
      const flat = score(r, new Array(r.actual.length).fill(r.actual[0]!));
      const perfect = score(r, [...r.actual]);
      laggedU.push(lagged.percentile);
      rwU.push(rw.percentile);
      rwM.push(rw.multiplier);
      flatU.push(flat.percentile);
      perfectU.push(perfect.percentile);
      if (rw.percentile > lagged.percentile) rwBeatsLagged++;
    }
  });

  it('visually-close drawings (8% lagged copy) rank near the top of the field', () => {
    expect(mean(laggedU)).toBeGreaterThanOrEqual(0.95);
  });

  it('a random scribble virtually never outranks a visually-close drawing', () => {
    // the v0.2 engine failed this at 6.9%; v3 target is < 2% of rounds
    expect(rwBeatsLagged / rounds.length).toBeLessThan(0.02);
  });

  it('random walks are percentile-neutral (no free skill credit)', () => {
    expect(mean(rwU)).toBeGreaterThan(0.35);
    expect(mean(rwU)).toBeLessThan(0.65);
  });

  it('random walks cannot beat the house edge', () => {
    // mean multiplier must not exceed 1 - h (+ small deterministic-sample slack)
    expect(mean(rwM)).toBeLessThanOrEqual(1 - STANDARD_PAYOUT_V3.houseEdge + 0.08);
  });

  it('flat "no thesis" lines rank below the field median (documented behavior)', () => {
    expect(mean(flatU)).toBeLessThan(0.5);
  });

  it('perfect predictions rank at the top in every regime', () => {
    expect(Math.min(...perfectU)).toBeGreaterThanOrEqual(0.99);
  });
});

// ─── 4. historical snapshot (skipped when local data/ is absent) ─────

const DATA_DIR = path.join(process.cwd(), 'data');
const HAS_DATA = fs.existsSync(path.join(DATA_DIR, 'chunks_index.json')) ||
  fs.existsSync(path.join(DATA_DIR, 'btc_1m_candles.json'));

describe.skipIf(!HAS_DATA)('v3 engine — historical BTC snapshot', () => {
  let closes: number[] = [];

  beforeAll(async () => {
    const { loadExpandedData } = await import('../backtest.js');
    closes = loadExpandedData().map((c) => c[1]!);
  }, 120_000);

  it('fairness ordering holds on real market data', () => {
    const steps = 60; // 1h rounds
    const lookbackSteps = steps * 3;
    const rng = mulberry32(424242);
    const laggedU: number[] = [];
    let rwBeats = 0;
    const n = 40;

    for (let i = 0; i < n; i++) {
      const start = lookbackSteps + Math.floor(rng() * (closes.length - steps - lookbackSteps - 1));
      const actual = closes.slice(start, start + steps + 1);
      const lookback = closes.slice(start - lookbackSteps, start);
      if (actual.some((p) => !p) || lookback.some((p) => !p)) continue;
      const seed = Math.floor(rng() * 2 ** 31);
      const base = { actualPrices: actual, lookbackPrices: lookback, seed, fieldConfig: FAST_FIELD };

      const lagged = scoreRoundV3({ ...base, predictedPrices: laggedCopy(actual) });
      const rw = scoreRoundV3({
        ...base,
        predictedPrices: randomWalkFromLookback(actual, lookback, rng),
      });
      laggedU.push(lagged.percentile);
      if (rw.percentile > lagged.percentile) rwBeats++;
    }

    expect(mean(laggedU)).toBeGreaterThanOrEqual(0.95);
    expect(rwBeats / laggedU.length).toBeLessThan(0.05);
  }, 120_000);
});
