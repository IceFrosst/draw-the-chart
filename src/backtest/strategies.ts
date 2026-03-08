/**
 * Synthetic player strategies for backtesting.
 * Each strategy takes an actual price path and generates a predicted price path.
 */

/** Seeded PRNG for reproducible strategies */
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

/** Box-Muller transform for normal distribution */
function normalRandom(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
}

/**
 * Strategy A: Random Walk (Brownian motion from start price)
 * Expected score: ~30–35
 */
export function randomWalkStrategy(
  actualPrices: number[],
  seed: number,
): number[] {
  const rng = mulberry32(seed);
  const N = actualPrices.length;
  const p0 = actualPrices[0]!;

  // Estimate actual volatility from the path to calibrate step size
  const logReturns: number[] = [];
  for (let i = 1; i < N; i++) {
    logReturns.push(Math.log(actualPrices[i]! / actualPrices[i - 1]!));
  }
  const actualVol =
    logReturns.length > 0
      ? Math.sqrt(
          logReturns.reduce((s, r) => s + r * r, 0) / logReturns.length,
        )
      : 0.001;

  // Generate random walk with same per-step volatility
  const predicted = [p0];
  for (let i = 1; i < N; i++) {
    const step = normalRandom(rng) * actualVol;
    predicted.push(predicted[i - 1]! * Math.exp(step));
  }

  return predicted;
}

/**
 * Strategy B: Flat Line (predict no change)
 * Expected score: ~25–35
 */
export function flatLineStrategy(actualPrices: number[]): number[] {
  const p0 = actualPrices[0]!;
  return new Array(actualPrices.length).fill(p0);
}

/**
 * Strategy C: Naive Trend Extrapolation
 * Looks at the last `lookback` candles before the prediction starts
 * and extrapolates the trend forward.
 * Expected score: ~35–50
 */
export function naiveTrendStrategy(
  actualPrices: number[],
  lookbackPrices: number[],
): number[] {
  const N = actualPrices.length;
  const p0 = actualPrices[0]!;

  // Compute trend from lookback period
  if (lookbackPrices.length < 2) {
    return new Array(N).fill(p0);
  }

  const lbFirst = lookbackPrices[0]!;
  const lbLast = lookbackPrices[lookbackPrices.length - 1]!;
  const logTrendPerStep =
    Math.log(lbLast / lbFirst) / lookbackPrices.length;

  // Extrapolate the trend
  const predicted = [p0];
  for (let i = 1; i < N; i++) {
    predicted.push(predicted[i - 1]! * Math.exp(logTrendPerStep));
  }

  return predicted;
}

/**
 * Strategy D: Mean Reversion
 * Predicts price will revert to the recent average over the prediction horizon.
 * Expected score: varies, likely ~30–45
 */
export function meanReversionStrategy(
  actualPrices: number[],
  lookbackPrices: number[],
): number[] {
  const N = actualPrices.length;
  const p0 = actualPrices[0]!;

  if (lookbackPrices.length < 2) {
    return new Array(N).fill(p0);
  }

  // Mean of lookback prices
  const mean =
    lookbackPrices.reduce((s, p) => s + p, 0) / lookbackPrices.length;

  // Linear interpolation from p0 to mean over the horizon
  const predicted: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    predicted.push(p0 + t * (mean - p0));
  }

  return predicted;
}

/**
 * Strategy E: "Perfect" prediction (actual path with small noise)
 * Noise scales with actual path volatility so it works across all timeframes.
 * Expected score: ~85–100 depending on noise fraction
 */
export function nearPerfectStrategy(
  actualPrices: number[],
  seed: number,
  noiseFraction: number = 0.05,
): number[] {
  const rng = mulberry32(seed);
  const N = actualPrices.length;

  // Estimate per-step volatility of the actual path
  let sumSq = 0;
  for (let i = 1; i < N; i++) {
    const lr = Math.log(actualPrices[i]! / actualPrices[i - 1]!);
    sumSq += lr * lr;
  }
  const stepVol = Math.sqrt(sumSq / Math.max(N - 1, 1));

  // Noise is a small fraction of per-step vol
  const noiseLevel = stepVol * noiseFraction;

  return actualPrices.map((p) => {
    const noise = normalRandom(rng) * noiseLevel;
    return p * Math.exp(noise);
  });
}
