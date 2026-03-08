import { useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DrawingChart, type DrawnPoint } from '../components/DrawingChart';
import { usePriceData, TIMEFRAMES, type TimeframeKey, type CandleData } from '../hooks/usePriceData';
import { computeScore, type ScoreBreakdown } from '../../scoring/index';
import { computePayout, DEFAULT_PAYOUT_CONFIG } from '../../scoring/payout';
import { PayoutCurve } from '../components/PayoutCurve';
import { TAOverlay, type TAToolType } from '../components/TAOverlay';
import { TAToolbar } from '../components/TAToolbar';
import {
  getDrawingConstraintSummary,
  normalizeDrawnPath,
} from '../lib/drawingConstraints';
import { getRoundAssessment } from '../lib/roundInsights';
import {
  appendRoundHistory,
  createRoundHistoryEntry,
  loadRoundHistory,
} from '../lib/roundHistory';

const TIMEFRAME_KEYS: TimeframeKey[] = ['15m', '1h', '6h', '24h', '7d'];
const DEFAULT_TIMEFRAME: TimeframeKey = '1h';
const DEFAULT_STAKE = 100;
const MIN_STAKE = 10;
const MAX_STAKE = 1000;
const STORAGE_TIMEFRAME_KEY = 'dtc.preferences.timeframe';
const STORAGE_STAKE_KEY = 'dtc.preferences.stake';
const STORAGE_DRAW_GUIDE_COLLAPSED_KEY = 'dtc.preferences.drawGuideCollapsed';
const MAX_MULTIPLIER = DEFAULT_PAYOUT_CONFIG.maxMultiplier;
const FOOTER_ACTION_BUTTON_CLASS =
  'h-10 w-[112px] px-4 inline-flex items-center justify-center whitespace-nowrap text-xs transition-colors dtc-button-secondary shrink-0';
const FOOTER_PRIMARY_BUTTON_CLASS =
  'h-10 w-[112px] px-5 inline-flex items-center justify-center whitespace-nowrap text-xs font-semibold transition-all dtc-button-primary shrink-0';

type GamePhase = 'setup' | 'drawing' | 'submitted';

function getToolLabel(tool: TAToolType): string {
  switch (tool) {
    case 'trendline':
      return 'Trend line';
    case 'ray':
      return 'Ray';
    case 'hline':
      return 'H-line';
    case 'fib':
      return 'Fib';
    default:
      return 'Cursor';
  }
}

function isTimeframeKey(value: string | null): value is TimeframeKey {
  return value != null && TIMEFRAME_KEYS.includes(value as TimeframeKey);
}

function parseRoundSeed(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function clampStake(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_STAKE;
  const rounded = Math.round(value / 10) * 10;
  return Math.min(MAX_STAKE, Math.max(MIN_STAKE, rounded));
}

function readStoredTimeframe(): TimeframeKey {
  if (typeof window === 'undefined') return DEFAULT_TIMEFRAME;
  const stored = window.localStorage.getItem(STORAGE_TIMEFRAME_KEY);
  return isTimeframeKey(stored) ? stored : DEFAULT_TIMEFRAME;
}

function readStoredStake(): number {
  if (typeof window === 'undefined') return DEFAULT_STAKE;
  const stored = Number.parseInt(window.localStorage.getItem(STORAGE_STAKE_KEY) ?? '', 10);
  return clampStake(stored);
}

function readStoredDrawGuideCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_DRAW_GUIDE_COLLAPSED_KEY) === 'true';
}

function buildRoundUrl(seed: number, timeframe: TimeframeKey): string {
  const url = new URL(window.location.href);
  url.pathname = '/play';
  url.searchParams.set('tf', timeframe);
  url.searchParams.set('seed', String(seed));
  return url.toString();
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function resampleDrawnPath(path: DrawnPoint[], numSamples: number): number[] {
  if (path.length < 2) return [];
  const tStart = path[0]!.time;
  const tEnd = path[path.length - 1]!.time;
  if (tEnd <= tStart) return [];

  const prices: number[] = [];
  let segIdx = 0;
  for (let i = 0; i < numSamples; i++) {
    const t = tStart + (i / (numSamples - 1)) * (tEnd - tStart);
    while (segIdx < path.length - 2 && path[segIdx + 1]!.time < t) {
      segIdx++;
    }
    const p0 = path[segIdx]!;
    const p1 = path[Math.min(segIdx + 1, path.length - 1)]!;
    if (p1.time === p0.time) {
      prices.push(p0.price);
    } else {
      const frac = (t - p0.time) / (p1.time - p0.time);
      prices.push(p0.price + frac * (p1.price - p0.price));
    }
  }
  return prices;
}

export function Game() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSeedRef = useRef<number | null>(parseRoundSeed(searchParams.get('seed')));
  const [timeframe, setTimeframe] = useState<TimeframeKey>(() => {
    const queryTimeframe = searchParams.get('tf');
    return isTimeframeKey(queryTimeframe) ? queryTimeframe : readStoredTimeframe();
  });
  const [phase, setPhase] = useState<GamePhase>(() =>
    initialSeedRef.current != null ? 'drawing' : 'setup',
  );
  const [locked, setLocked] = useState(initialSeedRef.current != null);
  const [roundSeed, setRoundSeed] = useState<number | null>(initialSeedRef.current);
  const [drawnPath, setDrawnPath] = useState<DrawnPoint[] | null>(null);
  const [normalizedPath, setNormalizedPath] = useState<DrawnPoint[] | null>(null);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [replayProgress, setReplayProgress] = useState<number>(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [scoreHidden, setScoreHidden] = useState(false);
  const [stake, setStake] = useState<number>(() => readStoredStake());
  const [resampledPath, setResampledPath] = useState<DrawnPoint[] | null>(null);
  const [roundLogCount, setRoundLogCount] = useState<number>(() => loadRoundHistory().length);
  const replayRef = useRef<number>(0);
  const copyTimeoutRef = useRef<number | null>(null);
  const savedHistoryEntryIdRef = useRef<string | null>(null);
  const [linkStatus, setLinkStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [drawGuideCollapsed, setDrawGuideCollapsed] = useState<boolean>(() =>
    readStoredDrawGuideCollapsed(),
  );

  // TA tools state
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  const [activeTATool, setActiveTATool] = useState<TAToolType>('none');
  const [taDrawingCount, setTaDrawingCount] = useState(0);
  const [taKey, setTaKey] = useState(0);

  // Chart API refs for TA overlay (set via onChartReady callback)
  const [chartApi, setChartApi] = useState<import('lightweight-charts').IChartApi | null>(null);
  const [seriesApi, setSeriesApi] = useState<import('lightweight-charts').ISeriesApi<import('lightweight-charts').SeriesType> | null>(null);

  const {
    preview,
    history,
    future,
    loading,
    error,
    isLive,
    maxHourlyLogMove,
  } = usePriceData(timeframe, locked, roundSeed);
  const chartData = locked ? history : preview;
  const lastChartCandle = chartData.length > 0 ? chartData[chartData.length - 1]! : null;
  const prevChartCandle =
    chartData.length > 1 ? chartData[chartData.length - 2]! : lastChartCandle;
  const chartChange =
    lastChartCandle && prevChartCandle
      ? lastChartCandle.close - prevChartCandle.close
      : 0;
  const chartChangePct =
    lastChartCandle && prevChartCandle && prevChartCandle.close > 0
      ? (chartChange / prevChartCandle.close) * 100
      : 0;
  const chartHigh =
    chartData.length > 0 ? Math.max(...chartData.map((candle) => candle.high)) : null;
  const chartLow =
    chartData.length > 0 ? Math.min(...chartData.map((candle) => candle.low)) : null;
  const drawingRules = useMemo(
    () => getDrawingConstraintSummary(timeframe, maxHourlyLogMove),
    [timeframe, maxHourlyLogMove],
  );
  const roundCode = roundSeed != null ? String(roundSeed).slice(-6).padStart(6, '0') : null;

  const handleLockStart = useCallback(() => {
    setLinkStatus('idle');
    savedHistoryEntryIdRef.current = null;
    setShowAdvancedTools(false);
    setActiveTATool('none');
    setRoundSeed(Date.now());
    setLocked(true);
    setPhase('drawing');
  }, []);

  const drawingEnabled = locked && !loading && history.length > 0 && phase !== 'submitted';

  const handleDrawComplete = useCallback((path: DrawnPoint[]) => {
    setDrawnPath(path.length >= 2 ? path : null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!drawnPath || drawnPath.length < 2 || future.length === 0) return;

    const lastHistory = history[history.length - 1];
    if (!lastHistory) return;

    const normalized = normalizeDrawnPath({
      rawPath: drawnPath,
      timeframe,
      startTime: lastHistory.time,
      endTime: lastHistory.time + TIMEFRAMES[timeframe].minutes * 60,
      startPrice: lastHistory.close,
      maxHourlyLogMove,
    });
    if (normalized.length < 3) return;

    const predictedPrices = resampleDrawnPath(normalized, future.length);
    if (predictedPrices.length === 0) return;

    const tStart = normalized[0]!.time;
    const tEnd = normalized[normalized.length - 1]!.time;
    const resampledPoints: DrawnPoint[] = predictedPrices.map((price, i) => ({
      time: tStart + (i / (predictedPrices.length - 1)) * (tEnd - tStart),
      price,
    }));
    setNormalizedPath(normalized);
    setResampledPath(resampledPoints);

    const actualPrices = future.map((c) => c.close);
    const result = computeScore(predictedPrices, actualPrices);
    setScore(result);
    setPhase('submitted');

    setReplayProgress(0);
    setIsReplaying(true);
    const animId = ++replayRef.current;
    const duration = 2000;
    const startTs = performance.now();
    const animate = (now: number) => {
      if (animId !== replayRef.current) return;
      const elapsed = now - startTs;
      const progress = Math.min(1, elapsed / duration);
      setReplayProgress(progress);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsReplaying(false);
      }
    };
    requestAnimationFrame(animate);
  }, [drawnPath, future, history, timeframe, maxHourlyLogMove]);

  const handleChartReady = useCallback((chart: import('lightweight-charts').IChartApi, series: import('lightweight-charts').ISeriesApi<import('lightweight-charts').SeriesType>) => {
    setChartApi(chart);
    setSeriesApi(series);
  }, []);

  const handleReset = useCallback(() => {
    setPhase('setup');
    setLocked(false);
    setRoundSeed(null);
    setDrawnPath(null);
    setNormalizedPath(null);
    setResampledPath(null);
    setScore(null);
    setReplayProgress(0);
    setIsReplaying(false);
    setScoreHidden(false);
    setLinkStatus('idle');
    setShowAdvancedTools(false);
    setActiveTATool('none');
    setChartApi(null);
    setSeriesApi(null);
    savedHistoryEntryIdRef.current = null;
    replayRef.current++;
  }, []);

  const handleClearDrawing = useCallback(() => {
    if (!drawingEnabled) return;
    setDrawnPath(null);
  }, [drawingEnabled]);

  const handleClearTA = useCallback(() => {
    setTaKey(k => k + 1);
    setTaDrawingCount(0);
    setActiveTATool('none');
  }, []);

  const handleToggleAdvancedTools = useCallback(() => {
    setShowAdvancedTools((current) => {
      if (current) {
        setActiveTATool('none');
      }
      return !current;
    });
  }, []);

  const handleSelectTATool = useCallback((tool: TAToolType) => {
    setShowAdvancedTools(true);
    setActiveTATool(tool);
  }, []);

  const visibleFuture: CandleData[] | undefined = phase === 'submitted' && future.length > 0
    ? future.slice(0, Math.max(1, Math.ceil(future.length * replayProgress)))
    : undefined;

  const payoutInfo = useMemo(
    () => (score ? computePayout(score.total, stake) : null),
    [score, stake],
  );
  const roundAssessment = useMemo(
    () => (score && payoutInfo ? getRoundAssessment(score, payoutInfo.multiplier) : null),
    [payoutInfo, score],
  );
  const maxPayout = stake * MAX_MULTIPLIER;
  const roundExport = useMemo(() => {
    if (roundSeed == null) return null;

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      round: {
        seed: roundSeed,
        code: roundCode,
        instrument: 'BTC/USDT',
        timeframe,
        stake,
        phase,
      },
      anchor:
        lastChartCandle != null
          ? {
              time: lastChartCandle.time,
              price: lastChartCandle.close,
            }
          : null,
      prediction: {
        rawPath: drawnPath,
        normalizedPath,
        resampledPath,
      },
      settlement: {
        history,
        actualFuture: future,
        score,
        payout: payoutInfo,
      },
    };
  }, [
    drawnPath,
    future,
    history,
    lastChartCandle,
    normalizedPath,
    payoutInfo,
    phase,
    resampledPath,
    roundCode,
    roundSeed,
    score,
    stake,
    timeframe,
  ]);
  const roundHistoryEntry = useMemo(() => {
    if (roundSeed == null || roundCode == null || score == null || payoutInfo == null) {
      return null;
    }

    return createRoundHistoryEntry({
      seed: roundSeed,
      roundCode,
      timeframe,
      stake,
      score,
      payout: payoutInfo,
      historyPoints: history.length,
      futurePoints: future.length,
    });
  }, [
    future.length,
    history.length,
    payoutInfo,
    roundCode,
    roundSeed,
    score,
    stake,
    timeframe,
  ]);

  const handleTimeframeChange = useCallback(
    (tf: TimeframeKey) => {
      if (phase !== 'setup') return;
      setTimeframe(tf);
      setTaKey((key) => key + 1);
      setTaDrawingCount(0);
      setShowAdvancedTools(false);
      setActiveTATool('none');
    },
    [phase],
  );

  const hasDrawing = drawnPath != null && drawnPath.length >= 2;
  const phaseStep = phase === 'setup' ? 0 : phase === 'drawing' ? 1 : 2;
  const activeToolLabel = getToolLabel(activeTATool);

  const handleCopyRoundLink = useCallback(async () => {
    if (roundSeed == null) return;
    const url = buildRoundUrl(roundSeed, timeframe);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setLinkStatus('copied');
    } catch {
      setLinkStatus('error');
    }

    if (copyTimeoutRef.current != null) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setLinkStatus('idle');
      copyTimeoutRef.current = null;
    }, 2200);
  }, [roundSeed, timeframe]);

  const handleExportRound = useCallback(() => {
    if (!roundExport || roundSeed == null) return;
    downloadJson(`dtc-round-${roundCode ?? roundSeed}-${timeframe}.json`, roundExport);
  }, [roundCode, roundExport, roundSeed, timeframe]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && phase === 'drawing') {
        if (activeTATool !== 'none') {
          setActiveTATool('none');
        } else if (hasDrawing) {
          handleClearDrawing();
        } else {
          handleReset();
        }
      }
      if (e.key === 'Enter' && phase === 'drawing' && hasDrawing) {
        handleSubmit();
      }
      if (e.key === 'Enter' && phase === 'submitted') {
        handleReset();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, hasDrawing, handleClearDrawing, handleReset, handleSubmit, activeTATool]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_TIMEFRAME_KEY, timeframe);
  }, [timeframe]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_STAKE_KEY, String(stake));
  }, [stake]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      STORAGE_DRAW_GUIDE_COLLAPSED_KEY,
      String(drawGuideCollapsed),
    );
  }, [drawGuideCollapsed]);

  useEffect(() => {
    if (!roundHistoryEntry) return;
    if (savedHistoryEntryIdRef.current === roundHistoryEntry.id) return;

    const nextEntries = appendRoundHistory(roundHistoryEntry);
    setRoundLogCount(nextEntries.length);
    savedHistoryEntryIdRef.current = roundHistoryEntry.id;
  }, [roundHistoryEntry]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('tf', timeframe);
    if (roundSeed != null) {
      next.set('seed', String(roundSeed));
    } else {
      next.delete('seed');
    }

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [roundSeed, searchParams, setSearchParams, timeframe]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current != null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, []);

  useEffect(() => {
    function handleStorage() {
      setRoundLogCount(loadRoundHistory().length);
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Determine if TA tool should intercept pointer events (only when a TA tool is active)
  const taToolActive = showAdvancedTools && activeTATool !== 'none';

  return (
    <div
      className="flex flex-col"
      style={{
        height: '100svh',
        minHeight: '100vh',
        paddingTop: '56px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        background:
          'radial-gradient(circle at top left, rgba(207, 123, 53, 0.09), transparent 24%), radial-gradient(circle at bottom right, rgba(103, 193, 180, 0.06), transparent 18%), var(--bg-primary)',
      }}
    >
      {/* Game top bar */}
      <div
        className="flex items-center justify-between px-2 sm:px-4 h-12 shrink-0 gap-2"
        style={{
          borderBottom: '1px solid rgba(58, 70, 59, 0.88)',
          background:
            'linear-gradient(180deg, rgba(15, 19, 16, 0.96), rgba(18, 22, 18, 0.92))',
        }}
      >
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="dtc-chip">
            BTC/USDT
          </span>
          {phase === 'drawing' && (
            <span
              className="dtc-chip"
              style={{
                background: 'rgba(207, 123, 53, 0.12)',
                borderColor: 'rgba(207, 123, 53, 0.34)',
                color: 'var(--accent-strong)',
              }}
            >
              DRAWING
            </span>
          )}
          {phase === 'submitted' && (
            <span
              className="dtc-chip"
              style={{
                background: 'rgba(72, 183, 132, 0.12)',
                borderColor: 'rgba(72, 183, 132, 0.3)',
                color: 'var(--green)',
              }}
            >
              SCORED
            </span>
          )}
          {phase === 'setup' && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {isLive && (
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--teal)', boxShadow: '0 0 4px rgba(103, 193, 180, 0.5)' }}
                  />
                  <span style={{ color: 'var(--teal)' }}>LIVE</span>
                </span>
              )}
              Sandbox Mode
            </span>
          )}
          {roundSeed != null && phase !== 'setup' && (
            <span className="hidden md:inline dtc-chip" style={{ color: 'var(--text-secondary)' }}>
              round {roundCode}
            </span>
          )}
        </div>

        {/* Timeframe selector */}
        <div
          className="flex items-center gap-1 p-1 shrink-0"
          style={{
            background: 'rgba(14, 18, 15, 0.92)',
            border: '1px solid rgba(58, 70, 59, 0.82)',
          }}
        >
          {TIMEFRAME_KEYS.map((tfKey) => (
            <button
              key={tfKey}
              onClick={() => handleTimeframeChange(tfKey)}
              disabled={phase !== 'setup'}
              className="px-2 sm:px-3 py-1 text-xs transition-all dtc-data"
              style={{
                background:
                  timeframe === tfKey ? 'rgba(207, 123, 53, 0.14)' : 'transparent',
                color:
                  timeframe === tfKey ? 'var(--accent-strong)' : 'var(--text-secondary)',
                border:
                  timeframe === tfKey
                    ? '1px solid rgba(207, 123, 53, 0.28)'
                    : '1px solid transparent',
                cursor: phase !== 'setup' ? 'default' : 'pointer',
                opacity: phase !== 'setup' && timeframe !== tfKey ? 0.3 : 1,
                fontWeight: timeframe === tfKey ? 600 : 400,
              }}
            >
              {TIMEFRAMES[tfKey].label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="hidden sm:inline text-xs dtc-eyebrow" style={{ color: 'var(--text-muted)' }}>Stake</span>
            <div
              className="flex items-center overflow-hidden"
              style={{
                border: '1px solid rgba(58, 70, 59, 0.82)',
                background: 'rgba(14, 18, 15, 0.92)',
              }}
            >
              <button
                onClick={() => setStake((current) => clampStake(current - 10))}
                disabled={phase !== 'setup'}
                className="px-1.5 py-0.5 text-xs dtc-data"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              >-</button>
              <span className="px-2 py-0.5 text-xs dtc-data" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', minWidth: '58px', textAlign: 'center' }}>
                ${stake}
              </span>
              <button
                onClick={() => setStake((current) => clampStake(current + 10))}
                disabled={phase !== 'setup'}
                className="px-1.5 py-0.5 text-xs dtc-data"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              >+</button>
            </div>
          </div>
          {phase === 'setup' && (
            <span className="hidden sm:inline text-xs dtc-data" style={{ color: 'var(--text-secondary)' }}>
              Max payout: <span style={{ color: 'var(--teal)' }}>${maxPayout.toLocaleString()}</span>
            </span>
          )}
          <div className="hidden sm:block text-xs dtc-data" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Local round log:</span>{' '}
            <span style={{ color: 'var(--text-primary)' }}>{roundLogCount}</span>
          </div>
        </div>
      </div>

      <div
        className="shrink-0 px-2 sm:px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto"
        style={{
          borderBottom: '1px solid rgba(48, 58, 49, 0.72)',
          background: 'rgba(11, 15, 12, 0.76)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-2 min-w-max">
          <PhaseStep index={1} title="Brief" active={phaseStep === 0} complete={phaseStep > 0} />
          <PhaseStep index={2} title="Draw" active={phaseStep === 1} complete={phaseStep > 1} />
          <PhaseStep index={3} title="Reveal" active={phaseStep === 2} complete={false} />
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs dtc-data" style={{ color: 'var(--text-secondary)' }}>
          <span className="dtc-chip">Tool {activeToolLabel}</span>
          {roundCode && <span className="dtc-chip">Round {roundCode}</span>}
          <span className="dtc-chip">{TIMEFRAMES[timeframe].interval} candles</span>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        {/* Setup overlay */}
        {phase === 'setup' && !locked && (
          <div
            className="absolute inset-0 z-20 animate-fade-in"
            style={{
              background:
                'linear-gradient(90deg, rgba(8, 11, 9, 0.82) 0%, rgba(8, 11, 9, 0.58) 34%, rgba(8, 11, 9, 0.18) 72%, rgba(8, 11, 9, 0.06) 100%)',
              backdropFilter: 'blur(1.5px)',
            }}
          >
            <div className="h-full flex items-center px-4 sm:px-8 lg:px-12">
              <div
                className="dtc-panel max-w-[820px] w-full p-5 sm:p-6 lg:p-7"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(15, 19, 16, 0.96), rgba(12, 16, 13, 0.94))',
                }}
              >
                <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <div className="dtc-eyebrow mb-2">Round Briefing</div>
                    <h1 className="dtc-display text-4xl sm:text-5xl font-semibold leading-none mb-3" style={{ color: 'var(--text-primary)' }}>
                      Draw the next {TIMEFRAMES[timeframe].label}
                    </h1>
                    <p className="text-sm sm:text-[15px] mb-4" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
                      Freeze the tape at the anchor, sketch the path you believe BTC will take, and let the engine judge direction, level control, turning points, and pace.
                    </p>
                    <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 dtc-chip" style={{ background: 'rgba(17, 22, 18, 0.94)' }}>
                      <span style={{ color: 'var(--green)' }}>Sandbox only</span>
                      <span style={{ color: 'var(--text-muted)' }}>No real money at risk</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                      <MetricTile label="Structure" value={`${drawingRules.controlPoints} control points`} />
                      <MetricTile label="Min Spacing" value={`${Math.round(drawingRules.minSpacingSeconds / 60)} min`} />
                      <MetricTile label="Slope Cap" value={`${(drawingRules.maxSlopeLogMovePerHour * 100).toFixed(1)}% / hr`} />
                      <MetricTile label="Stake" value={`$${stake}`} />
                    </div>

                    <div className="mb-4 text-xs dtc-data" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {roundLogCount > 0
                        ? `${roundLogCount} scored sandbox rounds are already saved locally for replay, comparison, and seed sharing.`
                        : 'Completed rounds are saved locally for replay, comparison, and seed sharing.'}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <button
                        onClick={handleLockStart}
                        className="px-6 py-3 text-sm font-semibold transition-colors dtc-button-primary"
                      >
                        Start Round
                      </button>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        Freehand is captured first, then normalized to {drawingRules.controlPoints} valid control points before scoring and payout.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="dtc-panel-subtle p-4">
                      <div className="dtc-eyebrow mb-2">What Counts</div>
                      <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <div className="flex items-center justify-between gap-4">
                          <span>Direction</span>
                          <span className="dtc-data" style={{ color: 'var(--text-primary)' }}>40 pts</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Magnitude</span>
                          <span className="dtc-data" style={{ color: 'var(--text-primary)' }}>30 pts</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Turning points</span>
                          <span className="dtc-data" style={{ color: 'var(--text-primary)' }}>20 pts</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Volatility regime</span>
                          <span className="dtc-data" style={{ color: 'var(--text-primary)' }}>10 pts</span>
                        </div>
                      </div>
                    </div>

                    <div className="dtc-panel-subtle p-4">
                      <div className="dtc-eyebrow mb-2">Quick Start</div>
                      <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        <div>1. Start the round and draw inside the future zone that opens to the right of the anchor.</div>
                        <div>2. Submit once the line spans the future zone. Sandbox settlement is instant.</div>
                        <div>3. If you want TA tools, turn them on later. They are optional for a first round.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div
            className="absolute inset-0 z-20 p-6"
            style={{ background: 'var(--bg-primary)' }}
          >
            <div className="h-full flex flex-col gap-3">
              <div className="flex-1 rounded-lg shimmer" />
              <div className="flex gap-4">
                <div className="h-3 w-24 rounded shimmer" />
                <div className="h-3 w-32 rounded shimmer" />
                <div className="h-3 w-20 rounded shimmer" />
                <div className="h-3 w-28 rounded shimmer" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20"
            style={{ background: 'rgba(8, 11, 9, 0.82)' }}
          >
            <span className="text-sm" style={{ color: 'var(--red)' }}>{error}</span>
            <button
              onClick={handleReset}
              className="px-4 py-1.5 rounded text-xs"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
            >
              Try Again
            </button>
          </div>
        )}

        {chartData.length > 0 && !loading && (
          <div
            className="absolute top-2 right-3 z-10 hidden lg:flex items-center justify-between gap-4 px-4 py-3"
            style={{
              left: '78px',
              background: 'rgba(14, 18, 15, 0.84)',
              border: '1px solid rgba(58, 70, 59, 0.74)',
              backdropFilter: 'blur(14px)',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <div className="flex items-center gap-5">
              <div>
                <div className="dtc-eyebrow" style={{ color: 'var(--text-muted)' }}>
                  Instrument
                </div>
                <div className="flex items-end gap-2 flex-wrap">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    BTC/USDT
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {TIMEFRAMES[timeframe].label} sandbox round
                  </span>
                  {roundCode && (
                    <span className="text-xs dtc-data" style={{ color: 'var(--text-muted)' }}>
                      seed {roundCode}
                    </span>
                  )}
                </div>
              </div>
              {lastChartCandle && (
                <div>
                  <div className="dtc-eyebrow" style={{ color: 'var(--text-muted)' }}>
                    Last close
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-lg font-semibold dtc-data" style={{ color: 'var(--text-primary)' }}>
                      {lastChartCandle.close.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span
                      className="text-xs font-medium dtc-data"
                      style={{ color: chartChange >= 0 ? 'var(--green)' : 'var(--red)' }}
                    >
                      {chartChange >= 0 ? '+' : ''}
                      {chartChange.toFixed(2)} ({chartChangePct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs dtc-data" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-center gap-3">
                {chartHigh != null && (
                  <span className="tabular-nums">
                    H <span style={{ color: 'var(--text-primary)' }}>{chartHigh.toFixed(2)}</span>
                  </span>
                )}
                {chartLow != null && (
                  <span className="tabular-nums">
                    L <span style={{ color: 'var(--text-primary)' }}>{chartLow.toFixed(2)}</span>
                  </span>
                )}
              </div>
              <span
                className="dtc-chip"
                style={{
                  background: phase === 'drawing' ? 'rgba(207, 123, 53, 0.12)' : 'rgba(72, 183, 132, 0.12)',
                  color: phase === 'drawing' ? 'var(--accent-strong)' : 'var(--green)',
                  borderColor: phase === 'drawing' ? 'rgba(207, 123, 53, 0.24)' : 'rgba(72, 183, 132, 0.24)',
                }}
              >
                {phase === 'setup' ? 'Preview' : phase === 'drawing' ? 'Future zone open' : 'Reveal mode'}
              </span>
              <button
                type="button"
                onClick={handleToggleAdvancedTools}
                className="dtc-chip"
                style={{
                  background: 'rgba(17, 22, 18, 0.9)',
                  color: 'var(--text-secondary)',
                  borderColor: 'rgba(58, 70, 59, 0.72)',
                  cursor: phase === 'submitted' ? 'default' : 'pointer',
                  opacity: phase === 'submitted' ? 0.72 : 1,
                }}
                disabled={phase === 'submitted'}
              >
                {showAdvancedTools ? `${activeToolLabel} tools on` : 'Tools hidden'}
              </button>
            </div>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <DrawingChart
            history={chartData}
            timeframe={timeframe}
            drawingEnabled={drawingEnabled && !taToolActive}
            drawnPath={drawnPath}
            resampledPath={phase === 'submitted' ? resampledPath : null}
            onDrawComplete={handleDrawComplete}
            actualFuture={visibleFuture}
            showFreezeLine={phase === 'drawing' || phase === 'submitted'}
            onChartReady={handleChartReady}
          />
        )}

        {/* TA Drawing Overlay */}
        {chartData.length > 0 && (
          <TAOverlay
            key={taKey}
            chartApi={chartApi}
            seriesApi={seriesApi}
            activeTool={activeTATool}
            lastHistoryTime={lastChartCandle?.time ?? null}
            endTime={
              lastChartCandle
                ? lastChartCandle.time + TIMEFRAMES[timeframe].minutes * 60
                : null
            }
            onToolDone={() => {
              setTaDrawingCount((count) => count + 1);
            }}
          />
        )}

        {/* TA Toolbar - advanced tools are opt-in for first-time users */}
        {phase === 'drawing' && chartData.length > 0 && !loading && showAdvancedTools && (
          <div className="hidden sm:block">
            <TAToolbar
              activeTool={activeTATool}
              onSelectTool={handleSelectTATool}
              onClearAll={handleClearTA}
              hasDrawings={taDrawingCount > 0}
            />
          </div>
        )}

        {phase === 'drawing' && !loading && (
          <div className="absolute right-3 bottom-14 z-20 hidden xl:block max-w-[280px]">
            {drawGuideCollapsed ? (
              <button
                type="button"
                onClick={() => setDrawGuideCollapsed(false)}
                className="dtc-panel px-3 py-2 text-xs font-medium"
                style={{
                  background: 'rgba(14, 18, 15, 0.94)',
                  backdropFilter: 'blur(12px)',
                  color: 'var(--text-secondary)',
                }}
              >
                Show draw guide
              </button>
            ) : (
              <div
                className="dtc-panel p-4"
                style={{
                  background: 'rgba(14, 18, 15, 0.94)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="dtc-eyebrow">Draw Guide</div>
                  <button
                    type="button"
                    onClick={() => setDrawGuideCollapsed(true)}
                    className="text-[11px] dtc-data"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Hide
                  </button>
                </div>
                <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  <div>Draw inside the future zone. The bright right-side marker shows exactly where the round ends.</div>
                  <div>Drag the historical side of the chart to inspect more candles. The future band stays reserved for drawing.</div>
                  <div>{showAdvancedTools ? <>Use TA tools for context, then switch back to <span style={{ color: 'var(--text-primary)' }}>Cursor</span> to keep drawing.</> : 'Keep advanced tools hidden until you want more chart context. First-time users usually do not need them.'}</div>
                  <div>The engine will normalize your stroke into {drawingRules.controlPoints} valid control points on submit.</div>
                </div>
                <div className="mt-3 pt-3 flex flex-wrap gap-2 text-[11px]" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="dtc-kbd">Enter</span>
                  <span style={{ color: 'var(--text-secondary)' }}>submit</span>
                  <span className="dtc-kbd">Esc</span>
                  <span style={{ color: 'var(--text-secondary)' }}>clear / exit tool</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Score breakdown overlay */}
        {phase === 'submitted' && score && !isReplaying && !scoreHidden && (
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-30 flex flex-col sm:flex-row gap-2 sm:gap-3 animate-slide-in max-h-[calc(100%-16px)] overflow-y-auto">
            <div
              className="dtc-panel p-3 sm:p-4 relative"
              style={{
                background: 'rgba(14, 18, 15, 0.96)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <button
                onClick={() => setScoreHidden(true)}
                className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center"
                style={{ color: 'var(--text-secondary)', background: 'transparent', fontSize: '14px', lineHeight: 1 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                aria-label="Hide score"
              >
                ×
              </button>
              <div className="dtc-eyebrow mb-1 sm:mb-2">Score Breakdown</div>
              <div className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3 dtc-data animate-count-up" style={{
                color: score.total >= 60 ? 'var(--green)' : score.total >= 40 ? 'var(--accent)' : 'var(--red)',
              }}>
                {score.total.toFixed(1)}
                <span className="text-xs sm:text-sm font-normal" style={{ color: 'var(--text-secondary)' }}> / 100</span>
              </div>
              <div className="space-y-1 sm:space-y-1.5 text-xs">
                <ScoreRow label="Direction" value={score.direction} max={40} />
                <ScoreRow label="Magnitude" value={score.magnitude} max={30} />
                <ScoreRow label="Turning Pts" value={score.turningPoints} max={20} />
                <ScoreRow label="Volatility" value={score.volatility} max={10} />
              </div>
              {payoutInfo && (
                <div className="mt-2 sm:mt-3 pt-2 sm:pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex justify-between gap-6 sm:gap-8 text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>Multiplier</span>
                    <span className="font-semibold dtc-data" style={{ color: payoutInfo.multiplier >= 1 ? 'var(--green)' : 'var(--red)' }}>
                      {payoutInfo.multiplier.toFixed(2)}x
                    </span>
                  </div>
                  <div className="flex justify-between gap-6 sm:gap-8 text-xs mt-1">
                    <span style={{ color: 'var(--text-secondary)' }}>${stake} Stake</span>
                    <span className="font-semibold dtc-data" style={{ color: payoutInfo.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {payoutInfo.profit >= 0 ? '+' : ''}{payoutInfo.profit.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              <div className="hidden sm:flex mt-3 pt-2 flex-wrap items-center gap-3 text-xs" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 rounded" style={{ background: 'var(--accent-strong)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Drawing</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 rounded" style={{ background: 'rgba(233, 165, 106, 0.36)', borderBottom: '1px dotted rgba(233, 165, 106, 0.56)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Resampled</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 rounded" style={{ background: 'var(--teal)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Actual</span>
                </span>
              </div>
            </div>
            {roundAssessment && (
              <div
                className="dtc-panel p-3 sm:p-4 max-w-[340px]"
                style={{
                  background: 'rgba(14, 18, 15, 0.96)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div className="dtc-eyebrow mb-2">Round Analysis</div>
                <div
                  className="inline-flex items-center px-2 py-1 text-[11px] dtc-data mb-3"
                  style={{
                    background: 'rgba(207, 123, 53, 0.12)',
                    color: 'var(--accent-strong)',
                    border: '1px solid rgba(207, 123, 53, 0.24)',
                  }}
                >
                  {roundAssessment.band}
                </div>
                <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {roundAssessment.headline}
                </div>
                <p className="text-xs leading-6 mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {roundAssessment.summary}
                </p>
                <div className="space-y-2">
                  {roundAssessment.insights.map((insight) => (
                    <div
                      key={insight.title}
                      className="dtc-panel-subtle p-2.5"
                      style={{
                        background: 'rgba(18, 24, 19, 0.78)',
                        border: '1px solid rgba(58, 70, 59, 0.44)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{
                            background:
                              insight.tone === 'good'
                                ? 'var(--green)'
                                : insight.tone === 'warning'
                                  ? 'var(--red)'
                                  : 'var(--accent)',
                          }}
                        />
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                          {insight.title}
                        </span>
                      </div>
                      <p className="text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}>
                        {insight.body}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 text-[11px] dtc-data" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  Saved to local sandbox history as round {roundCode}.
                </div>
              </div>
            )}
            <div className="hidden sm:block">
              <PayoutCurve currentScore={score.total} />
            </div>
          </div>
        )}
        {phase === 'submitted' && score && !isReplaying && scoreHidden && (
          <button
            onClick={() => setScoreHidden(false)}
            className="absolute top-4 left-4 z-30 px-3 py-1.5 text-xs animate-fade-in dtc-button-secondary"
            style={{
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            Show Score
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <footer
        className="flex items-center justify-between gap-3 px-4 py-2 min-h-14 shrink-0 overflow-hidden"
        style={{
          borderTop: '1px solid rgba(58, 70, 59, 0.88)',
          background:
            'linear-gradient(180deg, rgba(15, 19, 16, 0.96), rgba(18, 22, 18, 0.92))',
        }}
      >
        <div className="flex items-center gap-2 shrink-0 max-w-full overflow-x-auto">
          {phase === 'drawing' && (
            <>
              <span className="hidden xl:inline text-xs dtc-data whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                {drawingRules.controlPoints} control pts • {Math.round(drawingRules.minSpacingSeconds / 60)}m min spacing{roundCode != null ? ` • round ${roundCode}` : ''}
              </span>
              {hasDrawing && (
                <button
                  onClick={handleClearDrawing}
                  className={FOOTER_ACTION_BUTTON_CLASS}
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleReset}
                className={FOOTER_ACTION_BUTTON_CLASS}
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                New Round
              </button>
              {roundSeed != null && (
                <button
                  onClick={handleCopyRoundLink}
                  className={FOOTER_ACTION_BUTTON_CLASS}
                  style={{ color: linkStatus === 'copied' ? 'var(--green)' : linkStatus === 'error' ? 'var(--red)' : 'var(--text-secondary)' }}
                >
                  {linkStatus === 'copied' ? 'Link Copied' : linkStatus === 'error' ? 'Copy Failed' : 'Copy Link'}
                </button>
              )}
            </>
          )}
          {phase === 'submitted' && (
            <>
              <button
                onClick={handleReset}
                className={FOOTER_PRIMARY_BUTTON_CLASS}
              >
                New Round
              </button>
              {roundSeed != null && (
                <button
                  onClick={handleCopyRoundLink}
                  className={FOOTER_ACTION_BUTTON_CLASS}
                  style={{ color: linkStatus === 'copied' ? 'var(--green)' : linkStatus === 'error' ? 'var(--red)' : 'var(--text-secondary)' }}
                >
                  {linkStatus === 'copied' ? 'Link Copied' : linkStatus === 'error' ? 'Copy Failed' : 'Copy Link'}
                </button>
              )}
              <button
                onClick={handleExportRound}
                className={FOOTER_ACTION_BUTTON_CLASS}
                style={{ color: 'var(--text-secondary)' }}
              >
                Export JSON
              </button>
              <Link
                to="/leaderboard"
                className={`${FOOTER_ACTION_BUTTON_CLASS} no-underline`}
                style={{ color: 'var(--text-secondary)' }}
              >
                View Journal
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 min-w-0 flex-1">
          {phase === 'setup' && (
            <span className="text-xs dtc-data" style={{ color: 'var(--text-secondary)' }}>
              {isLive ? 'Showing live BTC data' : 'Showing historical BTC data'} · {TIMEFRAMES[timeframe].interval} candles
            </span>
          )}
          {phase === 'drawing' && (
            <>
              <div className="hidden xl:flex items-center gap-3 text-xs min-w-0" style={{ color: 'var(--text-secondary)' }}>
                <span className="truncate max-w-[720px]">
                  {activeTATool !== 'none'
                    ? `${activeToolLabel} is active. Switch back to Cursor to continue drawing.`
                    : hasDrawing
                      ? `Extend from the live end handle or click ahead to continue. Drag the left chart area for more history and use the axes to scale time or price.${showAdvancedTools ? '' : ' Advanced tools stay hidden until you turn them on.'}`
                      : 'Draw inside the future zone. Drag the left chart area to pan history and use the axes to scale time or price.'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd>Enter</Kbd>
                  <span>submit</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Kbd>Esc</Kbd>
                  <span>{activeTATool !== 'none' ? 'exit tool' : hasDrawing ? 'clear' : 'reset'}</span>
                </span>
              </div>
              <span className="sm:hidden text-xs" style={{ color: 'var(--text-secondary)' }}>
                {activeTATool !== 'none'
                  ? 'Switch back to Cursor to keep drawing'
                  : hasDrawing
                    ? 'Drag the end handle to extend'
                    : 'Draw in the future zone'}
              </span>
              <button
                onClick={handleSubmit}
                disabled={!hasDrawing}
                className={`${hasDrawing ? FOOTER_PRIMARY_BUTTON_CLASS : FOOTER_ACTION_BUTTON_CLASS}`}
                style={{
                  color: hasDrawing ? '#120d09' : 'var(--text-secondary)',
                  cursor: hasDrawing ? 'pointer' : 'default',
                  opacity: hasDrawing ? 1 : 0.72,
                }}
              >
                Submit
              </button>
            </>
          )}
          {phase === 'submitted' && score && (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-xs dtc-data" style={{ color: 'var(--text-secondary)' }}>
                Local log: {roundLogCount} rounds
              </span>
              <span className="text-sm font-bold dtc-data" style={{
                color: score.total >= 60 ? 'var(--green)' : score.total >= 40 ? 'var(--accent)' : 'var(--red)',
              }}>
                Score: {score.total.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex justify-between gap-8 mb-0.5">
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="dtc-data" style={{ color: 'var(--text-primary)' }}>
          {value.toFixed(1)}<span style={{ color: 'var(--text-secondary)' }}> / {max}</span>
        </span>
      </div>
      <div className="h-1 overflow-hidden" style={{ background: 'rgba(36, 43, 37, 0.92)' }}>
        <div className="h-full transition-all" style={{
          width: `${pct}%`,
          background: pct > 70 ? 'var(--green)' : pct > 40 ? 'var(--accent)' : 'var(--red)',
        }} />
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="dtc-panel-subtle p-3">
      <div className="dtc-eyebrow mb-1">{label}</div>
      <div className="dtc-data" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function PhaseStep({
  index,
  title,
  active,
  complete,
}: {
  index: number;
  title: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5"
      style={{
        background: active ? 'rgba(207, 123, 53, 0.12)' : 'rgba(16, 21, 18, 0.76)',
        border: `1px solid ${
          active
            ? 'rgba(207, 123, 53, 0.28)'
            : complete
              ? 'rgba(72, 183, 132, 0.24)'
              : 'rgba(58, 70, 59, 0.5)'
        }`,
        borderRadius: 999,
      }}
    >
      <span
        className="dtc-data text-[11px]"
        style={{
          color: complete ? 'var(--green)' : active ? 'var(--accent-strong)' : 'var(--text-muted)',
        }}
      >
        {String(index).padStart(2, '0')}
      </span>
      <span
        className="text-xs"
        style={{
          color: active ? 'var(--text-primary)' : complete ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
      >
        {title}
      </span>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <span className="dtc-kbd">{children}</span>;
}
