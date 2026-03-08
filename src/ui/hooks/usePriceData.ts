import { useState, useEffect, useRef } from 'react';
import { DEFAULT_MAX_HOURLY_LOG_MOVE } from '../lib/marketConstants';

export interface CandleData {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Timeframe definitions with candle interval for Binance API */
export const TIMEFRAMES = {
  '15m': { minutes: 15, controlPoints: 8, label: '15m', interval: '1m', candleMinutes: 1 },
  '1h': { minutes: 60, controlPoints: 12, label: '1h', interval: '1m', candleMinutes: 1 },
  '6h': { minutes: 360, controlPoints: 16, label: '6h', interval: '5m', candleMinutes: 5 },
  '24h': { minutes: 1440, controlPoints: 16, label: '24h', interval: '15m', candleMinutes: 15 },
  '7d': { minutes: 10080, controlPoints: 16, label: '7d', interval: '1h', candleMinutes: 60 },
} as const;

export type TimeframeKey = keyof typeof TIMEFRAMES;

// Cache for fetched candle data per interval
const candleCache: Record<string, CandleData[]> = {};

/**
 * Fetch candles at the specified interval.
 * Uses local 1m data resampled to the target interval.
 */
async function fetchCandles(interval: string, limit: number): Promise<CandleData[]> {
  const cacheKey = `${interval}_${limit}`;
  if (candleCache[cacheKey]) return candleCache[cacheKey];

  const candles = await loadLocal1mFallback(interval, limit);
  candleCache[cacheKey] = candles;
  return candles;
}

// Module-level cache for the raw local data
let cachedRawData: number[][] | null = null;
let cachedMaxHourlyLogMove: number | null = null;

export async function loadRawData(): Promise<number[][]> {
  if (cachedRawData) return cachedRawData;
  const response = await fetch('/btc_1m_candles.json');
  if (!response.ok) throw new Error(`Failed to load price data: ${response.status}`);
  cachedRawData = (await response.json()) as number[][];
  return cachedRawData;
}

async function loadMaxHourlyLogMove(): Promise<number> {
  if (cachedMaxHourlyLogMove != null) return cachedMaxHourlyLogMove;

  const rawData = await loadRawData();
  if (rawData.length < 61) {
    cachedMaxHourlyLogMove = DEFAULT_MAX_HOURLY_LOG_MOVE;
    return cachedMaxHourlyLogMove;
  }

  let maxMove = 0;
  for (let i = 60; i < rawData.length; i++) {
    const startPrice = rawData[i - 60]![1]!;
    const endPrice = rawData[i]![1]!;
    const move = Math.abs(Math.log(endPrice / startPrice));
    if (move > maxMove) {
      maxMove = move;
    }
  }

  cachedMaxHourlyLogMove = maxMove || DEFAULT_MAX_HOURLY_LOG_MOVE;
  return cachedMaxHourlyLogMove;
}

export function seedToUnitFloat(seed: number): number {
  let value = seed >>> 0;
  value = (value + 0x6d2b79f5) >>> 0;
  let mixed = Math.imul(value ^ (value >>> 15), value | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
}

export function buildSyntheticCandles(
  rawSlice: number[][],
  step: number,
  initialOpen?: number,
): CandleData[] {
  if (rawSlice.length === 0 || step <= 0) {
    return [];
  }

  const candles: CandleData[] = [];
  let previousClose = initialOpen ?? rawSlice[0]![1]!;

  for (let i = 0; i + step <= rawSlice.length; i += step) {
    const bucket = rawSlice.slice(i, i + step);
    if (bucket.length === 0) continue;

    const closes = bucket.map((entry) => entry[1]!);
    const open = previousClose;
    const close = closes[closes.length - 1]!;
    candles.push({
      time: Math.floor(bucket[0]![0]! / 1000),
      open,
      high: Math.max(open, ...closes),
      low: Math.min(open, ...closes),
      close,
    });
    previousClose = close;
  }

  return candles;
}

/**
 * Fallback: resample local 1m candles into the desired interval.
 */
async function loadLocal1mFallback(interval: string, limit: number): Promise<CandleData[]> {
  const rawData = await loadRawData();

  const intervalMinutes: Record<string, number> = { '1m': 1, '5m': 5, '15m': 15, '1h': 60 };
  const mins = intervalMinutes[interval] || 1;
  const step = mins; // Each raw candle is 1 minute

  // Take the last portion of data
  const totalNeeded = limit * step;
  const start = Math.max(0, rawData.length - totalNeeded);
  const slice = rawData.slice(start);
  const initialOpen = start > 0 ? rawData[start - 1]![1]! : slice[0]?.[1]!;
  return buildSyntheticCandles(slice, step, initialOpen);
}

/** Binance WebSocket interval strings */
const WS_INTERVALS: Record<string, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h',
};

/**
 * Try to fetch recent candles from Binance REST API.
 * Falls back to null on failure (CORS, network, etc.)
 */
async function fetchBinanceCandles(interval: string, limit: number): Promise<CandleData[] | null> {
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as number[][];
    return data.map((k) => ({
      time: Math.floor(k[0]! / 1000),
      open: parseFloat(String(k[1])),
      high: parseFloat(String(k[2])),
      low: parseFloat(String(k[3])),
      close: parseFloat(String(k[4])),
    }));
  } catch {
    return null;
  }
}

/**
 * Load price data for the game.
 * When not locked: tries Binance API + WebSocket for live data, falls back to local.
 * When locked: picks a random historical segment at the correct resolution (sandbox mode).
 */
export function usePriceData(
  timeframe: TimeframeKey,
  locked: boolean,
  roundSeed?: number | null,
) {
  const [preview, setPreview] = useState<CandleData[]>([]);
  const [history, setHistory] = useState<CandleData[]>([]);
  const [future, setFuture] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [maxHourlyLogMove, setMaxHourlyLogMove] = useState(
    DEFAULT_MAX_HOURLY_LOG_MOVE,
  );
  const loadIdRef = useRef(0);

  const tf = TIMEFRAMES[timeframe];
  const previewCandleLimit = Math.min(
    720,
    Math.max(240, Math.ceil(tf.minutes / tf.candleMinutes) * 4),
  );

  // Load preview data (shown before round starts)
  // Tries Binance API first, then WebSocket for live updates, falls back to local
  useEffect(() => {
    if (locked) return;
    setHistory([]);
    setFuture([]);
    setIsLive(false);
    setLoading(true);

    let cancelled = false;
    let ws: WebSocket | null = null;

    async function loadPreview() {
      setError(null);
      // Try Binance REST API first for initial data
      try {
        const binanceCandles = await fetchBinanceCandles(tf.interval, previewCandleLimit);
        if (cancelled) return;

        if (binanceCandles && binanceCandles.length > 50) {
          setPreview(binanceCandles);
          setIsLive(true);

          // Connect WebSocket for live updates
          const wsInterval = WS_INTERVALS[tf.interval];
          if (wsInterval) {
            try {
              ws = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${wsInterval}`);
              ws.onmessage = (event) => {
                if (cancelled) return;
                try {
                  const msg = JSON.parse(event.data);
                  if (msg.k) {
                    const kline = msg.k;
                    const newCandle: CandleData = {
                      time: Math.floor(kline.t / 1000),
                      open: parseFloat(kline.o),
                      high: parseFloat(kline.h),
                      low: parseFloat(kline.l),
                      close: parseFloat(kline.c),
                    };
                    setPreview((prev) => {
                      if (prev.length === 0) return prev;
                      const last = prev[prev.length - 1]!;
                      if (newCandle.time === last.time) {
                        return [...prev.slice(0, -1), newCandle];
                      } else if (newCandle.time > last.time) {
                        return [...prev.slice(-(previewCandleLimit - 1)), newCandle];
                      }
                      return prev;
                    });
                  }
                } catch {
                  // Ignore parse errors
                }
              };
              ws.onerror = () => {
                // WebSocket failed, live data still works from REST
              };
            } catch {
              // WebSocket connection failed, no-op
            }
          }
        } else {
          const candles = await fetchCandles(tf.interval, previewCandleLimit);
          if (cancelled) return;
          setPreview(candles);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load preview price data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadPreview();
    return () => {
      cancelled = true;
      if (ws) {
        ws.close();
        ws = null;
      }
    };
  }, [locked, previewCandleLimit, tf.interval, timeframe]);

  useEffect(() => {
    let cancelled = false;

    loadMaxHourlyLogMove()
      .then((value) => {
        if (!cancelled) {
          setMaxHourlyLogMove(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMaxHourlyLogMove(DEFAULT_MAX_HOURLY_LOG_MOVE);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load round data when locked
  useEffect(() => {
    if (!locked) return;

    const loadId = ++loadIdRef.current;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // For sandbox mode, load from local data at the correct resolution
        const rawData = await loadRawData();
        if (loadId !== loadIdRef.current) return;

        // Number of 1m candles per interval candle
        const step = tf.candleMinutes;
        // Number of interval candles for the horizon
        const horizonCandles = Math.ceil(tf.minutes / step);
        // Keep significantly deeper history than the future horizon so the user can pan left for context.
        const lookbackCandles = Math.max(Math.round(horizonCandles * 4), 120);
        const totalNeeded = (lookbackCandles + horizonCandles) * step;

        if (rawData.length < totalNeeded + 100) {
          setError('Not enough historical data');
          return;
        }

        // Pick a random start point that's aligned to the interval
        const maxStart = rawData.length - totalNeeded;
        const seedSource = roundSeed ?? Date.now();
        const rawStartIdx = Math.floor(seedToUnitFloat(seedSource) * maxStart);
        // Align to interval boundary
        const startIdx = rawStartIdx - (rawStartIdx % step);

        // Extract and resample to the correct interval
        const slice = rawData.slice(startIdx, startIdx + totalNeeded);
        const initialOpen =
          startIdx > 0 ? rawData[startIdx - 1]![1]! : slice[0]?.[1]!;
        const allCandles = buildSyntheticCandles(slice, step, initialOpen);

        if (allCandles.length < lookbackCandles + horizonCandles) {
          setError('Not enough data for this timeframe');
          return;
        }

        setHistory(allCandles.slice(0, lookbackCandles));
        setFuture(allCandles.slice(lookbackCandles, lookbackCandles + horizonCandles));
      } catch (e) {
        if (loadId === loadIdRef.current) {
          setError(e instanceof Error ? e.message : 'Failed to load data');
        }
      } finally {
        if (loadId === loadIdRef.current) {
          setLoading(false);
        }
      }
    }

    load();
  }, [timeframe, locked, roundSeed]);

  return { preview, history, future, loading, error, isLive, maxHourlyLogMove };
}
