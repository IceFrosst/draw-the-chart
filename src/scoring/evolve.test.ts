import { describe, expect, it } from 'vitest';

// Import variant system
import './variants/direction/index.js';
import './variants/magnitude/index.js';
import './variants/turningPoints/index.js';
import './variants/volatility/index.js';

import { getVariantsForComponent, getVariantById, getAllVariants } from './variants/registry.js';
import { dtwDistance } from './variants/dtw.js';
import { createSeedGenome, createRandomGenome } from './evolve.js';
import { computeVariantScoreFromLogReturns } from './scoreVariant.js';
import { computeScore, pricesToLogReturns, resamplePath } from './score.js';
import { analyzeFeedback, computeFeedbackAlignment } from './feedbackLearning.js';
import type { FeedbackRound } from './feedbackLearning.js';

// ─── Helpers ─────────────────────────────────────────────────

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

function linearPath(start: number, end: number, N: number): number[] {
  const path: number[] = [];
  for (let i = 0; i < N; i++) {
    path.push(start + ((end - start) * i) / (N - 1));
  }
  return path;
}

function sinePath(N: number, amplitude: number, frequency: number): number[] {
  return Array.from({ length: N }, (_, i) =>
    amplitude * Math.sin((2 * Math.PI * frequency * i) / N),
  );
}

// ─── Variant Registry ────────────────────────────────────────

describe('Variant Registry', () => {
  it('has 3 direction variants', () => {
    const variants = getVariantsForComponent('direction');
    expect(variants.length).toBe(3);
    expect(variants.map((v) => v.id)).toContain('direction.multiScale');
    expect(variants.map((v) => v.id)).toContain('direction.correlationBased');
    expect(variants.map((v) => v.id)).toContain('direction.dtwDirection');
  });

  it('has 3 magnitude variants', () => {
    const variants = getVariantsForComponent('magnitude');
    expect(variants.length).toBe(3);
  });

  it('has 3 turning point variants', () => {
    const variants = getVariantsForComponent('turningPoints');
    expect(variants.length).toBe(3);
  });

  it('has 3 volatility variants', () => {
    const variants = getVariantsForComponent('volatility');
    expect(variants.length).toBe(3);
  });

  it('has 12 variants total', () => {
    expect(getAllVariants().length).toBe(12);
  });

  it('can look up variants by id', () => {
    const v = getVariantById('direction.multiScale');
    expect(v).toBeDefined();
    expect(v!.component).toBe('direction');
  });
});

// ─── DTW ─────────────────────────────────────────────────────

describe('DTW', () => {
  it('returns 0 distance for identical paths', () => {
    const path = [0, 0.1, 0.2, 0.3, 0.2, 0.1, 0];
    const result = dtwDistance(path, path);
    expect(result.distance).toBe(0);
    expect(result.path.length).toBeGreaterThan(0);
  });

  it('returns small distance for similar paths', () => {
    const a = [0, 0.1, 0.2, 0.3, 0.2, 0.1, 0];
    const b = [0, 0.12, 0.21, 0.28, 0.19, 0.08, 0.01];
    const result = dtwDistance(a, b);
    expect(result.distance).toBeGreaterThan(0);
    expect(result.distance).toBeLessThan(0.1);
  });

  it('returns larger distance for different paths', () => {
    const a = [0, 0.1, 0.2, 0.3, 0.2, 0.1, 0];
    const b = [0, -0.1, -0.2, -0.3, -0.2, -0.1, 0];
    const result = dtwDistance(a, b);
    expect(result.distance).toBeGreaterThan(0.1);
  });

  it('handles empty paths', () => {
    const result = dtwDistance([], []);
    expect(result.distance).toBe(0);
    expect(result.path.length).toBe(0);
  });
});

// ─── Variant Scoring ─────────────────────────────────────────

describe('Variant Scoring', () => {
  const N = 120;
  const identicalPath = linearPath(0, 0.05, N);
  const invertedPath = linearPath(0, -0.05, N);
  const flatPath = new Array(N).fill(0);
  const wavyPath = sinePath(N, 0.03, 3);

  describe('All variants produce valid scores', () => {
    const variants = getAllVariants();

    for (const variant of variants) {
      it(`${variant.id} returns [0,1] for normal input`, () => {
        const defaultParams: Record<string, number> = {};
        for (const p of variant.parameterDefs) {
          defaultParams[p.name] = p.default;
        }

        const score = variant.compute(identicalPath, identicalPath, defaultParams);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });

      it(`${variant.id} scores perfect match highly`, () => {
        const defaultParams: Record<string, number> = {};
        for (const p of variant.parameterDefs) {
          defaultParams[p.name] = p.default;
        }

        const score = variant.compute(wavyPath, wavyPath, defaultParams);
        expect(score).toBeGreaterThan(0.7);
      });
    }
  });

  describe('Variant-aware scorer', () => {
    it('produces valid total in [0, 100]', () => {
      const genome = createSeedGenome();
      const result = computeVariantScoreFromLogReturns(wavyPath, wavyPath, genome);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('perfect prediction scores high', () => {
      const genome = createSeedGenome();
      const result = computeVariantScoreFromLogReturns(wavyPath, wavyPath, genome);
      expect(result.total).toBeGreaterThan(80);
    });

    it('inverse prediction scores low', () => {
      const genome = createSeedGenome();
      const result = computeVariantScoreFromLogReturns(invertedPath, wavyPath, genome);
      expect(result.total).toBeLessThan(50);
    });
  });
});

// ─── Parity Check ────────────────────────────────────────────

describe('Parity with existing scorer', () => {
  it('seed genome produces similar scores to computeScore for identical paths', () => {
    const prices = Array.from({ length: 120 }, (_, i) => 50000 * Math.exp(0.001 * i));
    const genome = createSeedGenome();

    const original = computeScore(prices, prices);
    const variant = computeVariantScoreFromLogReturns(
      resamplePath(pricesToLogReturns(prices), 120),
      resamplePath(pricesToLogReturns(prices), 120),
      genome,
    );

    // Both should be very high for perfect prediction
    expect(original.total).toBeGreaterThan(90);
    expect(variant.total).toBeGreaterThan(90);
  });

  it('seed genome preserves ranking: perfect > random > flat', () => {
    const rng = mulberry32(123);
    const actual = Array.from({ length: 120 }, (_, i) => {
      const lr = (i === 0) ? 0 : 0.001 * Math.sin(i / 10);
      return lr;
    });

    const perfect = [...actual];
    const flat = new Array(120).fill(0);
    const random = Array.from({ length: 120 }, () => (rng() - 0.5) * 0.1);

    const genome = createSeedGenome();

    const perfectScore = computeVariantScoreFromLogReturns(perfect, actual, genome);
    const randomScore = computeVariantScoreFromLogReturns(random, actual, genome);
    const flatScore = computeVariantScoreFromLogReturns(flat, actual, genome);

    expect(perfectScore.total).toBeGreaterThan(randomScore.total);
    expect(perfectScore.total).toBeGreaterThan(flatScore.total);
  });
});

// ─── Genome Operations ───────────────────────────────────────

describe('Genome Operations', () => {
  it('seed genome has valid weights', () => {
    const genome = createSeedGenome();
    const sum =
      genome.componentWeights.direction +
      genome.componentWeights.magnitude +
      genome.componentWeights.turningPoints +
      genome.componentWeights.volatility;
    expect(sum).toBeCloseTo(100, 0);
    expect(genome.componentWeights.direction).toBeGreaterThanOrEqual(5);
    expect(genome.componentWeights.magnitude).toBeGreaterThanOrEqual(5);
    expect(genome.componentWeights.turningPoints).toBeGreaterThanOrEqual(5);
    expect(genome.componentWeights.volatility).toBeGreaterThanOrEqual(5);
  });

  it('random genome has valid weights', () => {
    const rng = mulberry32(42);
    const genome = createRandomGenome('test', 0, rng);
    const sum =
      genome.componentWeights.direction +
      genome.componentWeights.magnitude +
      genome.componentWeights.turningPoints +
      genome.componentWeights.volatility;
    expect(sum).toBeCloseTo(100, 0);
  });

  it('random genome has valid variant selections', () => {
    const rng = mulberry32(42);
    const genome = createRandomGenome('test', 0, rng);

    const dirVariants = getVariantsForComponent('direction').map((v) => v.id);
    const magVariants = getVariantsForComponent('magnitude').map((v) => v.id);
    const tpVariants = getVariantsForComponent('turningPoints').map((v) => v.id);
    const volVariants = getVariantsForComponent('volatility').map((v) => v.id);

    expect(dirVariants).toContain(genome.variantSelection.direction);
    expect(magVariants).toContain(genome.variantSelection.magnitude);
    expect(tpVariants).toContain(genome.variantSelection.turningPoints);
    expect(volVariants).toContain(genome.variantSelection.volatility);
  });

  it('random genome has params within bounds', () => {
    const rng = mulberry32(42);
    const genome = createRandomGenome('test', 0, rng);

    for (const variant of getAllVariants()) {
      for (const pDef of variant.parameterDefs) {
        const key = `${variant.id}:${pDef.name}`;
        const value = genome.variantParams[key];
        expect(value).toBeDefined();
        expect(value).toBeGreaterThanOrEqual(pDef.min);
        expect(value).toBeLessThanOrEqual(pDef.max);
        if (pDef.integer) {
          expect(value).toBe(Math.round(value!));
        }
      }
    }
  });
});

// ─── Feedback Learning ───────────────────────────────────────

describe('Feedback Learning', () => {
  const mockRounds: FeedbackRound[] = [
    {
      roundId: 'r1',
      predictedPrices: [100, 101],
      actualPrices: [100, 102],
      algoScore: { direction: 35, magnitude: 20, turningPoints: 10, volatility: 5, total: 70 },
      feedback: {
        fairnessVote: 'about_right',
        selfAssessedScore: 65,
        confidence: 4,
        wrongComponents: [],
        difficultyPerception: 'medium',
        wouldBetRealMoney: true,
        comment: null,
      },
    },
    {
      roundId: 'r2',
      predictedPrices: [100, 99],
      actualPrices: [100, 105],
      algoScore: { direction: 5, magnitude: 5, turningPoints: 5, volatility: 3, total: 18 },
      feedback: {
        fairnessVote: 'too_low',
        selfAssessedScore: 30,
        confidence: 3,
        wrongComponents: ['direction', 'magnitude'],
        difficultyPerception: 'hard',
        wouldBetRealMoney: false,
        comment: null,
      },
    },
  ];

  it('computes basic analysis metrics', () => {
    const analysis = analyzeFeedback(mockRounds);
    expect(analysis.sampleSize).toBe(2);
    expect(analysis.confidence).toBe('low');
    expect(analysis.fairnessDistribution.aboutRight).toBe(1);
    expect(analysis.fairnessDistribution.tooLow).toBe(1);
    expect(analysis.componentComplaints['direction']).toBe(1);
    expect(analysis.componentComplaints['magnitude']).toBe(1);
  });

  it('computes feedback alignment', () => {
    const alignment = computeFeedbackAlignment(
      [70, 18],
      [65, 30],
      ['about_right', 'too_low'],
    );
    expect(alignment).toBeGreaterThan(0);
    expect(alignment).toBeLessThanOrEqual(1);
  });
});
