/**
 * Generates pairs of synthetic predictions for human scoring validation.
 * Each pair uses the same historical BTC segment but two different strategies.
 * Both predictions are scored algorithmically, then humans compare them.
 */

import {
  randomWalkStrategy,
  flatLineStrategy,
  naiveTrendStrategy,
  meanReversionStrategy,
  nearPerfectStrategy,
} from '../../backtest/strategies.js';
import { computeScore, type ScoreBreakdown } from '../../scoring/index.js';
import { loadRawData, seedToUnitFloat } from '../hooks/usePriceData.js';

export interface ValidationPrediction {
  strategyName: string;
  strategyLabel: string;
  prices: number[];
  score: ScoreBreakdown;
}

export interface ValidationPair {
  pairId: string;
  /** Index of the pair in the sequence */
  index: number;
  /** Historical prices shown as context (lookback) */
  historyPrices: number[];
  /** Actual future prices (revealed after voting) */
  actualPrices: number[];
  /** The two predictions to compare */
  predictionA: ValidationPrediction;
  predictionB: ValidationPrediction;
  /** Display order randomized — if true, A/B are swapped visually */
  swapped: boolean;
}

/** Strategy registry with labels */
const STRATEGIES = [
  { name: 'randomWalk', label: 'Random Walk' },
  { name: 'flatLine', label: 'Flat Line' },
  { name: 'naiveTrend', label: 'Naive Trend' },
  { name: 'meanReversion', label: 'Mean Reversion' },
  { name: 'nearPerfect', label: 'Near Perfect' },
] as const;

type StrategyName = (typeof STRATEGIES)[number]['name'];

/** Seeded PRNG (mulberry32) */
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

/** Generate a prediction using the named strategy */
function generatePrediction(
  strategyName: StrategyName,
  actualPrices: number[],
  lookbackPrices: number[],
  seed: number,
): number[] {
  switch (strategyName) {
    case 'randomWalk':
      return randomWalkStrategy(actualPrices, seed);
    case 'flatLine':
      return flatLineStrategy(actualPrices);
    case 'naiveTrend':
      return naiveTrendStrategy(actualPrices, lookbackPrices);
    case 'meanReversion':
      return meanReversionStrategy(actualPrices, lookbackPrices);
    case 'nearPerfect':
      return nearPerfectStrategy(actualPrices, seed, 0.05 + seedToUnitFloat(seed + 99) * 0.15);
  }
}

/**
 * Generate a validation pair deterministically from a global seed + pair index.
 * Returns null if there isn't enough data.
 */
export async function generateValidationPair(
  globalSeed: number,
  pairIndex: number,
): Promise<ValidationPair | null> {
  const rawData = await loadRawData();

  // Derive all randomness from seed
  const pairSeed = globalSeed * 1000 + pairIndex;
  const rng = mulberry32(pairSeed);

  // Horizon: 60-minute window (1h timeframe — good balance of structure)
  const horizonMinutes = 60;
  const lookbackMinutes = 120;
  const totalMinutes = lookbackMinutes + horizonMinutes;

  if (rawData.length < totalMinutes + 200) return null;

  // Pick random segment
  const maxStart = rawData.length - totalMinutes - 100;
  const startIdx = Math.floor(rng() * maxStart);

  // Extract prices (index 1 is close price in the raw data)
  const lookbackPrices: number[] = [];
  for (let i = startIdx; i < startIdx + lookbackMinutes; i++) {
    lookbackPrices.push(rawData[i]![1]!);
  }
  const actualPrices: number[] = [];
  for (let i = startIdx + lookbackMinutes; i < startIdx + totalMinutes; i++) {
    actualPrices.push(rawData[i]![1]!);
  }

  // Pick 2 distinct strategies
  const stratIdxA = Math.floor(rng() * STRATEGIES.length);
  let stratIdxB = Math.floor(rng() * (STRATEGIES.length - 1));
  if (stratIdxB >= stratIdxA) stratIdxB++;

  const stratA = STRATEGIES[stratIdxA]!;
  const stratB = STRATEGIES[stratIdxB]!;

  // Generate predictions
  const seedA = Math.floor(rng() * 1_000_000);
  const seedB = Math.floor(rng() * 1_000_000);

  const pricesA = generatePrediction(stratA.name, actualPrices, lookbackPrices, seedA);
  const pricesB = generatePrediction(stratB.name, actualPrices, lookbackPrices, seedB);

  // Score both
  const scoreA = computeScore(pricesA, actualPrices);
  const scoreB = computeScore(pricesB, actualPrices);

  // Randomize display order
  const swapped = rng() > 0.5;

  return {
    pairId: `${globalSeed}-${pairIndex}`,
    index: pairIndex,
    historyPrices: lookbackPrices,
    actualPrices,
    predictionA: {
      strategyName: stratA.name,
      strategyLabel: stratA.label,
      prices: pricesA,
      score: scoreA,
    },
    predictionB: {
      strategyName: stratB.name,
      strategyLabel: stratB.label,
      prices: pricesB,
      score: scoreB,
    },
    swapped,
  };
}

/** Convenience: get the "displayed" A and B accounting for swap */
export function getDisplayOrder(pair: ValidationPair) {
  if (pair.swapped) {
    return { displayA: pair.predictionB, displayB: pair.predictionA };
  }
  return { displayA: pair.predictionA, displayB: pair.predictionB };
}
