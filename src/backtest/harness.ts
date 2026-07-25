import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeScore } from '../scoring/score.js';
import { DEFAULT_CONFIG } from '../scoring/config.js';
import type { ScoringConfig, ScoreBreakdown } from '../scoring/types.js';
import {
  randomWalkStrategy,
  flatLineStrategy,
  naiveTrendStrategy,
  meanReversionStrategy,
  nearPerfectStrategy,
} from './strategies.js';

export const BACKTEST_TIMEFRAMES: Record<string, number> = {
  '15m': 15,
  '1h': 60,
  '6h': 360,
  '24h': 1440,
  '7d': 10080,
};

const LOOKBACK_MINUTES = 30;
const DEFAULT_ROUNDS_PER_STRATEGY = 1000;
const DEFAULT_SEED = 12345;
// `data/` is gitignored, so a fresh clone only has the copy shipped in `public/`.
const CANDIDATE_DATA_PATHS = [
  path.join(process.cwd(), 'data', 'btc_1m_candles.json'),
  path.join(process.cwd(), 'public', 'btc_1m_candles.json'),
];

const DEFAULT_DATA_PATH =
  CANDIDATE_DATA_PATHS.find((candidate) => fs.existsSync(candidate)) ?? CANDIDATE_DATA_PATHS[0]!;

export interface Stats {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  p10: number;
  p90: number;
}

export interface StrategyStats {
  total: Stats;
  direction: Stats;
  magnitude: Stats;
  turningPoints: Stats;
  volatility: Stats;
}

export interface BacktestResult {
  loadedCandles: number;
  roundsPerStrategy: number;
  perTimeframe: Record<string, Record<string, StrategyStats>>;
  overallMeans: Record<string, number>;
}

export interface BacktestOptions {
  config?: ScoringConfig;
  dataPath?: string;
  roundsPerStrategy?: number;
  seed?: number;
}

interface RoundResult {
  strategy: string;
  timeframe: string;
  score: ScoreBreakdown;
}

type StrategyFn = (actualPrices: number[], lookback: number[], seed: number) => number[];

const STRATEGIES: Record<string, StrategyFn> = {
  'Random Walk': (actual, _lookback, seed) => randomWalkStrategy(actual, seed),
  'Flat Line': (actual) => flatLineStrategy(actual),
  'Naive Trend': (actual, lookback) => naiveTrendStrategy(actual, lookback),
  'Mean Reversion': (actual, lookback) =>
    meanReversionStrategy(actual, lookback),
  'Near Perfect': (actual, _lookback, seed) =>
    nearPerfectStrategy(actual, seed, 0.05),
};

export function computeStats(values: number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
  const variance =
    sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n;

  return {
    mean,
    median: sorted[Math.floor(n / 2)]!,
    std: Math.sqrt(variance),
    min: sorted[0]!,
    max: sorted[n - 1]!,
    p10: sorted[Math.floor(n * 0.1)]!,
    p90: sorted[Math.floor(n * 0.9)]!,
  };
}

export function loadBacktestPriceData(
  dataPath: string = DEFAULT_DATA_PATH,
): number[][] {
  if (!fs.existsSync(dataPath)) {
    throw new Error(
      `Data file not found: ${dataPath}\nExpected a local BTC 1m candle file for sandbox backtesting.`,
    );
  }

  return JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as number[][];
}

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

export function runBacktestSuite({
  config = DEFAULT_CONFIG,
  dataPath = DEFAULT_DATA_PATH,
  roundsPerStrategy = DEFAULT_ROUNDS_PER_STRATEGY,
  seed = DEFAULT_SEED,
}: BacktestOptions = {}): BacktestResult {
  const data = loadBacktestPriceData(dataPath);
  const prices = data.map((entry) => entry[1]!);
  const totalCandles = prices.length;
  const rng = mulberry32(seed);
  const allResults: RoundResult[] = [];
  const perTimeframe: Record<string, Record<string, StrategyStats>> = {};

  for (const [timeframeName, timeframeMinutes] of Object.entries(
    BACKTEST_TIMEFRAMES,
  )) {
    const minStart = LOOKBACK_MINUTES;
    const maxStart = totalCandles - timeframeMinutes - 1;

    if (maxStart <= minStart) {
      continue;
    }

    const startIndices: number[] = [];
    for (let i = 0; i < roundsPerStrategy; i++) {
      const index = Math.floor(rng() * (maxStart - minStart)) + minStart;
      startIndices.push(index);
    }

    perTimeframe[timeframeName] = {};

    for (const [strategyName, strategyFn] of Object.entries(STRATEGIES)) {
      const breakdowns: ScoreBreakdown[] = [];

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
        const score = computeScore(predictedPrices, actualPrices, config);

        breakdowns.push(score);
        allResults.push({
          strategy: strategyName,
          timeframe: timeframeName,
          score,
        });
      }

      perTimeframe[timeframeName]![strategyName] = {
        total: computeStats(breakdowns.map((result) => result.total)),
        direction: computeStats(breakdowns.map((result) => result.direction)),
        magnitude: computeStats(breakdowns.map((result) => result.magnitude)),
        turningPoints: computeStats(
          breakdowns.map((result) => result.turningPoints),
        ),
        volatility: computeStats(
          breakdowns.map((result) => result.volatility),
        ),
      };
    }
  }

  const overallMeans: Record<string, number> = {};
  for (const strategyName of Object.keys(STRATEGIES)) {
    const matching = allResults.filter((result) => result.strategy === strategyName);
    if (matching.length === 0) {
      continue;
    }

    overallMeans[strategyName] =
      matching.reduce((sum, result) => sum + result.score.total, 0) /
      matching.length;
  }

  return {
    loadedCandles: totalCandles,
    roundsPerStrategy,
    perTimeframe,
    overallMeans,
  };
}

