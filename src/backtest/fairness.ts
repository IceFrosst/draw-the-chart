import { computeScore } from '../scoring/score.js';
import { BACKTEST_TIMEFRAMES, computeStats, loadBacktestPriceData, type Stats } from './harness.js';

const LOOKBACK_MINUTES = 30;
const DEFAULT_ROUNDS_PER_TIMEFRAME = 250;
const DEFAULT_SEED = 24680;

export interface FairnessOptions {
  roundsPerTimeframe?: number;
  seed?: number;
  dataPath?: string;
}

export interface FairnessProfileSummary {
  mean: number;
  median: number;
  p10: number;
  p90: number;
}

export interface FairnessPairwiseSummary {
  better: string;
  worse: string;
  winRate: number;
  meanDelta: number;
  p10Delta: number;
  p90Delta: number;
}

export interface FairnessResult {
  roundsPerTimeframe: number;
  loadedCandles: number;
  ladderOrder: string[];
  ladderPassRate: number;
  profiles: Record<string, FairnessProfileSummary>;
  pairwise: FairnessPairwiseSummary[];
}

type ProfileGenerator = (actualPrices: number[], rng: () => number) => number[];

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

function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function std(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function smooth(values: number[], radius: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(values.length, index + radius + 1);
    const slice = values.slice(start, end);
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

function toLogReturns(prices: number[]): number[] {
  const base = prices[0]!;
  return prices.map((price) => Math.log(price / base));
}

function fromLogReturns(basePrice: number, returns: number[]): number[] {
  return returns.map((value) => basePrice * Math.exp(value));
}

function perturbActualPath(
  actualPrices: number[],
  rng: () => number,
  noiseMultiplier: number,
  driftMultiplier = 0,
): number[] {
  const basePrice = actualPrices[0]!;
  const actualReturns = toLogReturns(actualPrices);
  const span =
    Math.max(...actualReturns) - Math.min(...actualReturns);
  const scale = Math.max(std(actualReturns), span * 0.3, 0.001);
  const drift = gaussian(rng) * scale * driftMultiplier;
  const smoothedNoise = smooth(
    actualReturns.map(() => gaussian(rng) * scale * noiseMultiplier),
    3,
  );

  const perturbedReturns = actualReturns.map((value, index) => {
    const progress = actualReturns.length <= 1 ? 0 : index / (actualReturns.length - 1);
    return value + smoothedNoise[index]! + drift * progress;
  });

  return fromLogReturns(basePrice, perturbedReturns);
}

function flatPath(actualPrices: number[]): number[] {
  return actualPrices.map(() => actualPrices[0]!);
}

function invertedPath(actualPrices: number[]): number[] {
  const basePrice = actualPrices[0]!;
  return fromLogReturns(
    basePrice,
    toLogReturns(actualPrices).map((value) => -value),
  );
}

function laggedTurnPath(actualPrices: number[]): number[] {
  const basePrice = actualPrices[0]!;
  const actualReturns = toLogReturns(actualPrices);
  const lag = Math.max(2, Math.floor(actualReturns.length * 0.08));
  const laggedReturns = actualReturns.map((_, index) =>
    actualReturns[Math.max(0, index - lag)]!,
  );
  return fromLogReturns(basePrice, laggedReturns);
}

const FAIRNESS_PROFILES: Record<string, ProfileGenerator> = {
  Perfect: (actualPrices) => actualPrices,
  'Tight Noise': (actualPrices, rng) => perturbActualPath(actualPrices, rng, 0.08),
  'Medium Noise': (actualPrices, rng) => perturbActualPath(actualPrices, rng, 0.2),
  'Lagged Turns': (actualPrices) => laggedTurnPath(actualPrices),
  Flat: (actualPrices) => flatPath(actualPrices),
  Inverted: (actualPrices) => invertedPath(actualPrices),
};

const LADDER_ORDER = [
  'Perfect',
  'Tight Noise',
  'Medium Noise',
  'Lagged Turns',
  'Flat',
  'Inverted',
];

function summarize(values: number[]): FairnessProfileSummary {
  const stats = computeStats(values);
  return {
    mean: stats.mean,
    median: stats.median,
    p10: stats.p10,
    p90: stats.p90,
  };
}

function summarizeDelta(values: number[]): Pick<FairnessPairwiseSummary, 'meanDelta' | 'p10Delta' | 'p90Delta'> {
  const stats: Stats = computeStats(values);
  return {
    meanDelta: stats.mean,
    p10Delta: stats.p10,
    p90Delta: stats.p90,
  };
}

export function runFairnessStudy({
  roundsPerTimeframe = DEFAULT_ROUNDS_PER_TIMEFRAME,
  seed = DEFAULT_SEED,
  dataPath,
}: FairnessOptions = {}): FairnessResult {
  const data = loadBacktestPriceData(dataPath);
  const prices = data.map((entry) => entry[1]!);
  const rng = mulberry32(seed);
  const profileScores = Object.fromEntries(
    LADDER_ORDER.map((name) => [name, [] as number[]]),
  ) as Record<string, number[]>;
  const pairwiseDeltas = Object.fromEntries(
    LADDER_ORDER.slice(0, -1).map((name, index) => [
      `${name}>${LADDER_ORDER[index + 1]!}`,
      [] as number[],
    ]),
  ) as Record<string, number[]>;

  let ladderPasses = 0;
  let totalLadders = 0;

  for (const timeframeMinutes of Object.values(BACKTEST_TIMEFRAMES)) {
    const minStart = LOOKBACK_MINUTES;
    const maxStart = prices.length - timeframeMinutes - 1;
    if (maxStart <= minStart) {
      continue;
    }

    for (let round = 0; round < roundsPerTimeframe; round++) {
      const startIndex = Math.floor(rng() * (maxStart - minStart)) + minStart;
      const actualPrices = prices.slice(startIndex, startIndex + timeframeMinutes + 1);
      const roundScores: Record<string, number> = {};

      for (const name of LADDER_ORDER) {
        const predictedPrices = FAIRNESS_PROFILES[name]!(actualPrices, rng);
        const score = computeScore(predictedPrices, actualPrices);
        roundScores[name] = score.total;
        profileScores[name]!.push(score.total);
      }

      totalLadders++;
      let ladderPass = true;
      for (let index = 0; index < LADDER_ORDER.length - 1; index++) {
        const better = LADDER_ORDER[index]!;
        const worse = LADDER_ORDER[index + 1]!;
        const delta = roundScores[better]! - roundScores[worse]!;
        pairwiseDeltas[`${better}>${worse}`]!.push(delta);
        if (delta <= 0) {
          ladderPass = false;
        }
      }

      if (ladderPass) {
        ladderPasses++;
      }
    }
  }

  const profiles = Object.fromEntries(
    LADDER_ORDER.map((name) => [name, summarize(profileScores[name]!)]),
  ) as Record<string, FairnessProfileSummary>;

  const pairwise = LADDER_ORDER.slice(0, -1).map((better, index) => {
    const worse = LADDER_ORDER[index + 1]!;
    const deltas = pairwiseDeltas[`${better}>${worse}`]!;
    const { meanDelta, p10Delta, p90Delta } = summarizeDelta(deltas);
    const wins =
      deltas.filter((value) => value > 0).length / Math.max(deltas.length, 1);

    return {
      better,
      worse,
      winRate: wins,
      meanDelta,
      p10Delta,
      p90Delta,
    };
  });

  return {
    roundsPerTimeframe,
    loadedCandles: prices.length,
    ladderOrder: LADDER_ORDER,
    ladderPassRate: ladderPasses / Math.max(totalLadders, 1),
    profiles,
    pairwise,
  };
}
