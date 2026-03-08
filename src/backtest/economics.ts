import { computePayout, type PayoutConfig, DEFAULT_PAYOUT_CONFIG } from '../scoring/payout.js';
import { computeScore } from '../scoring/score.js';
import {
  BACKTEST_TIMEFRAMES,
  loadBacktestPriceData,
  type BacktestOptions,
} from './harness.js';
import {
  flatLineStrategy,
  meanReversionStrategy,
  naiveTrendStrategy,
  nearPerfectStrategy,
  randomWalkStrategy,
} from './strategies.js';

const LOOKBACK_MINUTES = 30;
const DEFAULT_ROUNDS_PER_STRATEGY = 250;
const DEFAULT_SEED = 12345;

export interface PayoutEconomicsStats {
  meanScore: number;
  meanMultiplier: number;
  meanProfitPer100Stake: number;
  profitableRate: number;
  p95Multiplier: number;
  p99Multiplier: number;
  maxMultiplier: number;
}

export interface StrategyBlend {
  name: string;
  weights: Partial<Record<string, number>>;
}

export interface StrategyBlendStats {
  name: string;
  meanMultiplier: number;
  meanProfitPer100Stake: number;
}

export interface PayoutEconomicsResult {
  roundsPerStrategy: number;
  strategies: Record<string, PayoutEconomicsStats>;
  blends: StrategyBlendStats[];
}

interface SampleResult {
  score: number;
  multiplier: number;
  profit: number;
}

type StrategyFn = (actualPrices: number[], lookbackPrices: number[], seed: number) => number[];

const STRATEGIES: Record<string, StrategyFn> = {
  'Random Walk': (actual, _lookback, seed) => randomWalkStrategy(actual, seed),
  'Flat Line': (actual) => flatLineStrategy(actual),
  'Naive Trend': (actual, lookback) => naiveTrendStrategy(actual, lookback),
  'Mean Reversion': (actual, lookback) => meanReversionStrategy(actual, lookback),
  'Near Perfect': (actual, _lookback, seed) => nearPerfectStrategy(actual, seed, 0.05),
};

export const DEFAULT_STRATEGY_BLENDS: StrategyBlend[] = [
  {
    name: 'Casual Blend',
    weights: {
      'Flat Line': 0.45,
      'Random Walk': 0.35,
      'Naive Trend': 0.2,
    },
  },
  {
    name: 'Engaged Blend',
    weights: {
      'Random Walk': 0.35,
      'Naive Trend': 0.35,
      'Mean Reversion': 0.3,
    },
  },
];

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(values: number[], q: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]!;
}

function computeStrategyStats(samples: SampleResult[]): PayoutEconomicsStats {
  const meanScore =
    samples.reduce((sum, sample) => sum + sample.score, 0) / samples.length;
  const meanMultiplier =
    samples.reduce((sum, sample) => sum + sample.multiplier, 0) / samples.length;
  const meanProfitPer100Stake =
    samples.reduce((sum, sample) => sum + sample.profit, 0) / samples.length;
  const profitableRate =
    samples.filter((sample) => sample.multiplier >= 1).length / samples.length;
  const multipliers = samples.map((sample) => sample.multiplier);

  return {
    meanScore,
    meanMultiplier,
    meanProfitPer100Stake,
    profitableRate,
    p95Multiplier: percentile(multipliers, 0.95),
    p99Multiplier: percentile(multipliers, 0.99),
    maxMultiplier: Math.max(...multipliers),
  };
}

function computeBlendStats(
  name: string,
  weights: Partial<Record<string, number>>,
  strategies: Record<string, PayoutEconomicsStats>,
): StrategyBlendStats {
  const entries = Object.entries(weights).filter(
    ([strategyName, weight]) =>
      weight != null && weight > 0 && strategies[strategyName] != null,
  );
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight!, 0);

  if (totalWeight <= 0) {
    return {
      name,
      meanMultiplier: 0,
      meanProfitPer100Stake: 0,
    };
  }

  let meanMultiplier = 0;
  let meanProfitPer100Stake = 0;

  for (const [strategyName, weight] of entries) {
    const normalizedWeight = weight! / totalWeight;
    meanMultiplier += strategies[strategyName]!.meanMultiplier * normalizedWeight;
    meanProfitPer100Stake +=
      strategies[strategyName]!.meanProfitPer100Stake * normalizedWeight;
  }

  return {
    name,
    meanMultiplier,
    meanProfitPer100Stake,
  };
}

export function runPayoutEconomicsAnalysis({
  dataPath,
  roundsPerStrategy = DEFAULT_ROUNDS_PER_STRATEGY,
  seed = DEFAULT_SEED,
}: BacktestOptions = {}, payoutConfig: PayoutConfig = DEFAULT_PAYOUT_CONFIG): PayoutEconomicsResult {
  const data = loadBacktestPriceData(dataPath);
  const prices = data.map((entry) => entry[1]!);
  const rng = mulberry32(seed);
  const samplesByStrategy: Record<string, SampleResult[]> = Object.fromEntries(
    Object.keys(STRATEGIES).map((strategyName) => [strategyName, []]),
  );

  for (const timeframeMinutes of Object.values(BACKTEST_TIMEFRAMES)) {
    const minStart = LOOKBACK_MINUTES;
    const maxStart = prices.length - timeframeMinutes - 1;

    if (maxStart <= minStart) {
      continue;
    }

    const startIndices: number[] = [];
    for (let i = 0; i < roundsPerStrategy; i++) {
      startIndices.push(Math.floor(rng() * (maxStart - minStart)) + minStart);
    }

    for (const [strategyName, strategyFn] of Object.entries(STRATEGIES)) {
      const samples = samplesByStrategy[strategyName]!;

      for (let round = 0; round < roundsPerStrategy; round++) {
        const startIndex = startIndices[round]!;
        const endIndex = startIndex + timeframeMinutes;
        const actualPrices = prices.slice(startIndex, endIndex + 1);
        const lookbackStart = Math.max(0, startIndex - LOOKBACK_MINUTES);
        const lookbackPrices = prices.slice(lookbackStart, startIndex + 1);
        const predictedPrices = strategyFn(
          actualPrices,
          lookbackPrices,
          round * 31337 + startIndex,
        );
        const score = computeScore(predictedPrices, actualPrices);
        const payout = computePayout(score.total, 100, payoutConfig);

        samples.push({
          score: score.total,
          multiplier: payout.multiplier,
          profit: payout.profit,
        });
      }
    }
  }

  const strategies = Object.fromEntries(
    Object.entries(samplesByStrategy).map(([strategyName, samples]) => [
      strategyName,
      computeStrategyStats(samples),
    ]),
  );

  return {
    roundsPerStrategy,
    strategies,
    blends: DEFAULT_STRATEGY_BLENDS.map((blend) =>
      computeBlendStats(blend.name, blend.weights, strategies),
    ),
  };
}
