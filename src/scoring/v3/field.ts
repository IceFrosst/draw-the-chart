/**
 * v3 Layer 2 — The synthetic field.
 *
 * Generates B zero-information baseline price paths conditioned on the
 * anchor market state (lookback prices), deterministically from a seed.
 * The player's similarity is ranked against the field's similarities to
 * produce the percentile U that drives the payout.
 *
 * Field version: 'field-v1' (WHITEPAPER_v3.md §6). Mixture:
 *   40% conditional block bootstrap   20% GBM (EWMA vol)
 *   15% trend extrapolators           10% mean reverters
 *   10% flat & drift lines             5% smoothed/lagged replays
 */

import { pricesToLogReturns, resamplePath } from '../score.js';
import {
  computeSimilarityFromLogReturns,
  DEFAULT_SIMILARITY_CONFIG,
  type SimilarityConfig,
} from './similarity.js';

export const FIELD_VERSION = 'field-v1';

export interface FieldConfig {
  B: number;
  ewmaLambda: number;
  blockFraction: number; // block length = steps * blockFraction
}

export const DEFAULT_FIELD_CONFIG: FieldConfig = {
  B: 5000,
  ewmaLambda: 0.94,
  blockFraction: 1 / 8,
};

// ─── deterministic PRNG ──────────────────────────────────────────────

export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─── anchor state ────────────────────────────────────────────────────

export interface AnchorState {
  anchorPrice: number;
  /** per-step log returns from the lookback window, same resolution as the future steps */
  lookbackReturns: number[];
  /** EWMA per-step volatility at the anchor */
  ewmaVol: number;
  /** lookback drift per step (log) */
  driftPerStep: { half: number; full: number; double: number };
  /** typical resampled-path sigma for the σ_eff floor */
  sigmaTypical: number;
}

export function computeAnchorState(
  lookbackPrices: number[],
  anchorPrice: number,
  horizonSteps: number,
  ewmaLambda: number,
  N: number,
): AnchorState {
  const returns: number[] = [];
  for (let i = 1; i < lookbackPrices.length; i++) {
    returns.push(Math.log(lookbackPrices[i]! / lookbackPrices[i - 1]!));
  }

  // EWMA variance over lookback returns
  let v = returns.length > 0 ? returns[0]! ** 2 : 1e-8;
  for (let i = 1; i < returns.length; i++) {
    v = ewmaLambda * v + (1 - ewmaLambda) * returns[i]! ** 2;
  }
  const ewmaVol = Math.max(Math.sqrt(v), 1e-6);

  const driftOver = (steps: number): number => {
    const n = Math.min(steps, lookbackPrices.length - 1);
    if (n < 2) return 0;
    const p0 = lookbackPrices[lookbackPrices.length - 1 - n]!;
    const p1 = lookbackPrices[lookbackPrices.length - 1]!;
    return Math.log(p1 / p0) / n;
  };

  // typical path sigma: std of the resampled log-return path over the most
  // recent lookback window of horizon length (what "a normal round" looks like)
  let sigmaTypical = ewmaVol * Math.sqrt(horizonSteps) * 0.5;
  if (lookbackPrices.length > horizonSteps + 1) {
    const window = lookbackPrices.slice(lookbackPrices.length - horizonSteps - 1);
    const path = resamplePath(pricesToLogReturns(window), N);
    const mean = path.reduce((s, x) => s + x, 0) / N;
    const variance = path.reduce((s, x) => s + (x - mean) ** 2, 0) / N;
    sigmaTypical = Math.max(Math.sqrt(variance), 1e-8);
  }

  return {
    anchorPrice,
    lookbackReturns: returns,
    ewmaVol,
    driftPerStep: {
      half: driftOver(Math.floor(horizonSteps / 2)),
      full: driftOver(horizonSteps),
      double: driftOver(horizonSteps * 2),
    },
    sigmaTypical,
  };
}

// ─── generators (each returns a log-return path of horizonSteps+1 points, r[0]=0) ───

type Gen = (state: AnchorState, steps: number, rng: () => number) => number[];

function fromSteps(stepFn: (i: number) => number, steps: number): number[] {
  const path = new Array<number>(steps + 1);
  path[0] = 0;
  for (let i = 1; i <= steps; i++) path[i] = path[i - 1]! + stepFn(i - 1);
  return path;
}

const genGbm: Gen = (state, steps, rng) =>
  fromSteps(() => gaussian(rng) * state.ewmaVol, steps);

const genBootstrap: Gen = (state, steps, rng) => {
  const src = state.lookbackReturns;
  if (src.length < 4) return genGbm(state, steps, rng);
  // rescale source returns so their std matches EWMA vol at the anchor
  const srcStd = Math.sqrt(src.reduce((s, r) => s + r * r, 0) / src.length) || 1e-8;
  const scale = state.ewmaVol / srcStd;
  const blockLen = Math.max(2, Math.round(steps * DEFAULT_FIELD_CONFIG.blockFraction));
  const draws: number[] = [];
  while (draws.length <= steps) {
    const start = Math.floor(rng() * Math.max(1, src.length - blockLen));
    for (let k = 0; k < blockLen && draws.length <= steps; k++) {
      draws.push(src[start + k]! * scale);
    }
  }
  return fromSteps((i) => draws[i]!, steps);
};

const genTrend: Gen = (state, steps, rng) => {
  const windows = [state.driftPerStep.half, state.driftPerStep.full, state.driftPerStep.double];
  const drift = windows[Math.floor(rng() * windows.length)]!;
  const strength = [0.5, 1.0, 1.5][Math.floor(rng() * 3)]!;
  const noise = 0.6 * state.ewmaVol;
  return fromSteps(() => drift * strength + gaussian(rng) * noise, steps);
};

const genMeanRevert: Gen = (state, steps, rng) => {
  // OU pull toward the lookback mean log-price (relative to anchor)
  const src = state.lookbackReturns;
  let target = 0;
  if (src.length > 0) {
    // mean of recent log prices relative to anchor ≈ -(average cumulated recent move)
    const n = Math.min(src.length, steps * 2);
    let cum = 0;
    let sum = 0;
    for (let i = src.length - 1; i >= src.length - n; i--) {
      cum -= src[i]!;
      sum += cum;
    }
    target = sum / n;
  }
  const theta = [0.02, 0.05, 0.1][Math.floor(rng() * 3)]!;
  const noise = 0.7 * state.ewmaVol;
  const path = new Array<number>(steps + 1);
  path[0] = 0;
  for (let i = 1; i <= steps; i++) {
    path[i] = path[i - 1]! + theta * (target - path[i - 1]!) + gaussian(rng) * noise;
  }
  return path;
};

const genFlatDrift: Gen = (state, steps, rng) => {
  const horizonSigma = state.ewmaVol * Math.sqrt(steps);
  const endDrifts = [0, 0, 0.25, -0.25, 0.5, -0.5];
  const end = endDrifts[Math.floor(rng() * endDrifts.length)]! * horizonSigma;
  const noise = 0.1 * state.ewmaVol;
  return fromSteps((i) => end / steps + gaussian(rng) * noise, steps);
};

const genReplay: Gen = (state, steps, rng) => {
  // smoothed or lagged transform of a bootstrap path: plausible but low-detail
  const base = genBootstrap(state, steps, rng);
  if (rng() < 0.5) {
    // smooth: moving average, window 10% of steps, re-anchored at r(0)=0
    const w = Math.max(1, Math.round(steps * 0.1));
    const smoothed = base.map((_, i) => {
      let s = 0;
      let c = 0;
      for (let j = Math.max(0, i - w); j <= Math.min(steps, i + w); j++) {
        s += base[j]!;
        c++;
      }
      return s / c;
    });
    const offset = smoothed[0]!;
    return smoothed.map((v) => v - offset);
  }
  // lag by 5-10% of steps
  const lag = Math.max(1, Math.round(steps * (0.05 + 0.05 * rng())));
  return base.map((_, i) => base[Math.max(0, i - lag)]!);
};

// ─── field generation + percentile ──────────────────────────────────

const MIXTURE: Array<[Gen, number]> = [
  [genBootstrap, 0.4],
  [genGbm, 0.2],
  [genTrend, 0.15],
  [genMeanRevert, 0.1],
  [genFlatDrift, 0.1],
  [genReplay, 0.05],
];

/** Generators whose paths are mirrored (antithetic pairs) for directional balance. */
const ANTITHETIC = new Set<Gen>([genBootstrap, genGbm]);

/** Generate the field as resampled (N-point) log-return paths. */
export function generateField(
  state: AnchorState,
  horizonSteps: number,
  seed: number,
  fieldCfg: FieldConfig = DEFAULT_FIELD_CONFIG,
  N: number = DEFAULT_SIMILARITY_CONFIG.N,
): number[][] {
  const rng = mulberry32(seed);
  const field: number[][] = [];
  for (const [gen, share] of MIXTURE) {
    const count = Math.round(fieldCfg.B * share);
    if (ANTITHETIC.has(gen)) {
      // antithetic pairs: each stochastic path is emitted with its mirror,
      // so the random cohorts can never lean bullish/bearish within a round
      for (let i = 0; i < count; i += 2) {
        const path = gen(state, horizonSteps, rng);
        field.push(resamplePath(path, N));
        if (i + 1 < count) {
          field.push(resamplePath(path.map((r) => -r), N));
        }
      }
    } else {
      for (let i = 0; i < count; i++) {
        field.push(resamplePath(gen(state, horizonSteps, rng), N));
      }
    }
  }
  return field;
}

export interface FieldResult {
  /** mid-rank percentile of the player within the field */
  percentile: number;
  fieldSize: number;
  beaten: number;
  playerSimilarity: number;
  /** similarity totals of the whole field (for visualization/histograms) */
  fieldSimilarities: number[];
}

/**
 * Rank a player's similarity against the field on the same realized path.
 * `actualLogReturns` must already be resampled to N points.
 */
export function rankAgainstField(
  playerSimilarity: number,
  field: number[][],
  actualLogReturns: number[],
  sigmaTypical: number,
  simCfg: SimilarityConfig = DEFAULT_SIMILARITY_CONFIG,
): FieldResult {
  const sims = field.map(
    (path) =>
      computeSimilarityFromLogReturns(path, actualLogReturns, sigmaTypical, simCfg).total,
  );
  let below = 0;
  let ties = 0;
  for (const s of sims) {
    if (s < playerSimilarity) below++;
    else if (s === playerSimilarity) ties++;
  }
  const percentile = (below + 0.5 * ties) / sims.length;
  return {
    percentile,
    fieldSize: sims.length,
    beaten: below,
    playerSimilarity,
    fieldSimilarities: sims,
  };
}
