import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DrawingChart, type DrawnPoint } from '../components/DrawingChart';
import { usePriceData, TIMEFRAMES, type TimeframeKey, type CandleData } from '../hooks/usePriceData';
import { computeScore, type ScoreBreakdown } from '../../scoring/index';
import { computePayout } from '../../scoring/payout';
import { scoreRoundV3, computePayoutV3, STANDARD_PAYOUT_V3, type RoundV3Result } from '../../scoring/v3/index';
import { TAOverlay, type TAToolType } from '../components/TAOverlay';
import { TAToolbar } from '../components/TAToolbar';
import {
  getDrawingConstraintSummary,
  normalizeDrawnPath,
} from '../lib/drawingConstraints';
import {
  appendRoundHistory,
  createRoundHistoryEntry,
} from '../lib/roundHistory';
import { isSupabaseConfigured } from '../../lib/supabase';
import { persistRound } from '../../lib/roundPersistence';

const TIMEFRAME_KEYS: TimeframeKey[] = ['15m', '1h', '6h', '24h', '7d'];
const DEFAULT_TIMEFRAME: TimeframeKey = '1h';
const DEFAULT_STAKE = 100;
const MIN_STAKE = 10;
const MAX_STAKE = 1000;
const STORAGE_TIMEFRAME_KEY = 'dtc.preferences.timeframe';
const STORAGE_STAKE_KEY = 'dtc.preferences.stake';
const FOOTER_ACTION_BUTTON_CLASS =
  'h-10 px-5 inline-flex items-center justify-center whitespace-nowrap text-xs transition-colors dtc-button-secondary shrink-0';
const FOOTER_PRIMARY_BUTTON_CLASS =
  'h-10 px-6 inline-flex items-center justify-center whitespace-nowrap text-xs font-semibold transition-all dtc-button-primary shrink-0';

type GamePhase = 'setup' | 'drawing' | 'submitted';

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
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [scoreV3, setScoreV3] = useState<RoundV3Result | null>(null);
  const [replayProgress, setReplayProgress] = useState<number>(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [stake, setStake] = useState<number>(() => readStoredStake());
  const [resampledPath, setResampledPath] = useState<DrawnPoint[] | null>(null);
  const replayRef = useRef<number>(0);
  const savedHistoryEntryIdRef = useRef<string | null>(null);
  const lockTimestampRef = useRef<number | null>(null);

  // TA tools — opt-in, so a first-time player sees only the chart
  const [showTools, setShowTools] = useState(false);
  const [activeTATool, setActiveTATool] = useState<TAToolType>('none');
  const [taDrawingCount, setTaDrawingCount] = useState(0);
  const [taKey, setTaKey] = useState(0);
  const [chartApi, setChartApi] = useState<import('lightweight-charts').IChartApi | null>(null);
  const [seriesApi, setSeriesApi] = useState<
    import('lightweight-charts').ISeriesApi<import('lightweight-charts').SeriesType> | null
  >(null);

  const {
    preview,
    history,
    future,
    loading,
    error,
    maxHourlyLogMove,
  } = usePriceData(timeframe, locked, roundSeed);
  /** A TA tool takes over the pointer, so freehand capture must stand down. */
  const taToolActive = showTools && activeTATool !== 'none';
  const chartData = locked ? history : preview;
  const lastChartCandle = chartData.length > 0 ? chartData[chartData.length - 1]! : null;
  const roundCode = roundSeed != null ? String(roundSeed).slice(-6).padStart(6, '0') : null;

  const handleChartReady = useCallback(
    (
      chart: import('lightweight-charts').IChartApi,
      series: import('lightweight-charts').ISeriesApi<import('lightweight-charts').SeriesType>,
    ) => {
      setChartApi(chart);
      setSeriesApi(series);
    },
    [],
  );

  const handleClearTA = useCallback(() => {
    setTaKey((key) => key + 1);
    setTaDrawingCount(0);
    setActiveTATool('none');
  }, []);

  const handleToggleTools = useCallback(() => {
    setShowTools((current) => {
      if (current) setActiveTATool('none');
      return !current;
    });
  }, []);

  const handleSelectTATool = useCallback((tool: TAToolType) => {
    setActiveTATool(tool);
  }, []);

  const handleLockStart = useCallback(() => {
    savedHistoryEntryIdRef.current = null;
    setShowTools(false);
    setActiveTATool('none');
    lockTimestampRef.current = Date.now();
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

    // Anchor-aligned scoring: both paths must start from the anchor price
    // so log-returns are computed in the same reference frame.
    // This matches the backtest harness which includes the anchor in actualPrices.
    const anchorPrice = lastHistory.close;
    const actualPrices = [anchorPrice, ...future.map((c) => c.close)];
    const predictedPrices = resampleDrawnPath(normalized, actualPrices.length);
    if (predictedPrices.length === 0) return;

    const tStart = normalized[0]!.time;
    const tEnd = normalized[normalized.length - 1]!.time;
    const resampledPoints: DrawnPoint[] = predictedPrices.map((price, i) => ({
      time: tStart + (i / (predictedPrices.length - 1)) * (tEnd - tStart),
      price,
    }));
    setResampledPath(resampledPoints);

    const result = computeScore(predictedPrices, actualPrices);
    setScore(result);

    // v3 field-relative scoring: rank the drawing against a
    // deterministic synthetic field conditioned on the lookback window.
    try {
      const v3 = scoreRoundV3({
        predictedPrices,
        actualPrices,
        lookbackPrices: history.map((c) => c.close),
        seed: (roundSeed ?? Date.now()) % 2147483647,
      });
      setScoreV3(v3);
    } catch {
      setScoreV3(null);
    }

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
  }, [drawnPath, future, history, timeframe, maxHourlyLogMove, roundSeed]);

  const handleReset = useCallback(() => {
    setPhase('setup');
    setLocked(false);
    setRoundSeed(null);
    setDrawnPath(null);
    setResampledPath(null);
    setScore(null);
    setScoreV3(null);
    setReplayProgress(0);
    setIsReplaying(false);
    setShowTools(false);
    setActiveTATool('none');
    setTaDrawingCount(0);
    setTaKey((key) => key + 1);
    setChartApi(null);
    setSeriesApi(null);
    savedHistoryEntryIdRef.current = null;
    lockTimestampRef.current = null;
    replayRef.current++;
  }, []);

  const handleClearDrawing = useCallback(() => {
    if (!drawingEnabled) return;
    setDrawnPath(null);
  }, [drawingEnabled]);

  const visibleFuture: CandleData[] | undefined = phase === 'submitted' && future.length > 0
    ? future.slice(0, Math.max(1, Math.ceil(future.length * replayProgress)))
    : undefined;

  const payoutInfo = useMemo(
    () => (score ? computePayout(score.total, stake) : null),
    [score, stake],
  );
  const payoutInfoV3 = useMemo(
    () => (scoreV3 ? computePayoutV3(scoreV3.percentile, stake) : null),
    [scoreV3, stake],
  );
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
      fieldScore:
        scoreV3 && payoutInfoV3
          ? {
              percentile: scoreV3.percentile,
              beaten: scoreV3.beaten,
              fieldSize: scoreV3.fieldSize,
              multiplier: payoutInfoV3.multiplier,
              profit: payoutInfoV3.profit,
            }
          : undefined,
      historyPoints: history.length,
      futurePoints: future.length,
    });
  }, [
    future.length,
    history.length,
    payoutInfo,
    payoutInfoV3,
    roundCode,
    roundSeed,
    score,
    scoreV3,
    stake,
    timeframe,
  ]);

  const handleTimeframeChange = useCallback(
    (tf: TimeframeKey) => {
      if (phase !== 'setup') return;
      setTimeframe(tf);
      setTaKey((key) => key + 1);
      setTaDrawingCount(0);
      setActiveTATool('none');
    },
    [phase],
  );

  const hasDrawing = drawnPath != null && drawnPath.length >= 2;

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
    if (!roundHistoryEntry) return;
    if (savedHistoryEntryIdRef.current === roundHistoryEntry.id) return;

    appendRoundHistory(roundHistoryEntry);
    savedHistoryEntryIdRef.current = roundHistoryEntry.id;

    // Persist to Supabase in parallel (non-blocking)
    if (isSupabaseConfigured() && resampledPath && future.length > 0 && roundSeed != null && roundCode != null) {
      const anchorPrice = history.length > 0 ? history[history.length - 1]!.close : 0;
      const actualPrices = [anchorPrice, ...future.map((c) => c.close)];
      const predictedPrices = resampledPath.map((p) => p.price);

      persistRound({
        seed: roundSeed,
        roundCode,
        timeframe,
        stake,
        predictedPrices,
        actualPrices,
        score: roundHistoryEntry.score,
        payoutMultiplier: roundHistoryEntry.payout.multiplier,
        payoutAmount: roundHistoryEntry.payout.payout,
        payoutProfit: roundHistoryEntry.payout.profit,
        drawingPointCount: drawnPath?.length ?? 0,
        drawingDurationSeconds: lockTimestampRef.current
          ? (Date.now() - lockTimestampRef.current) / 1000
          : 0,
      }).catch(() => {
        // best-effort persistence: never let a dead backend affect gameplay
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div
      className="flex flex-col"
      style={{
        height: '100svh',
        minHeight: '100vh',
        paddingTop: '48px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        background: 'var(--bg-primary)',
      }}
    >
      {/* Single control bar: instrument · horizon · stake */}
      <div
        className="flex items-center justify-between px-3 sm:px-4 h-11 shrink-0 gap-3"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
        }}
      >
        <span
          className="dtc-data text-xs shrink-0"
          style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}
        >
          BTC/USDT
        </span>

        <div
          className="flex items-center gap-0.5 p-0.5 shrink-0"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          {TIMEFRAME_KEYS.map((tfKey) => (
            <button
              key={tfKey}
              onClick={() => handleTimeframeChange(tfKey)}
              disabled={phase !== 'setup'}
              className="px-3 py-1 text-xs transition-all dtc-data"
              style={{
                background:
                  timeframe === tfKey ? 'rgba(212, 168, 92, 0.14)' : 'transparent',
                color:
                  timeframe === tfKey ? 'var(--accent)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '1px',
                cursor: phase !== 'setup' ? 'default' : 'pointer',
                opacity: phase !== 'setup' && timeframe !== tfKey ? 0.3 : 1,
                fontWeight: timeframe === tfKey ? 600 : 400,
              }}
            >
              {TIMEFRAMES[tfKey].label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline dtc-eyebrow" style={{ color: 'var(--text-muted)' }}>
            Stake
          </span>
          <div
            className="flex items-center overflow-hidden rounded"
            style={{
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <button
              onClick={() => setStake((current) => clampStake(current - 10))}
              disabled={phase !== 'setup'}
              className="px-2 py-1 text-xs dtc-data"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >-</button>
            <span
              className="px-2 py-1 text-xs dtc-data"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', minWidth: '52px', textAlign: 'center' }}
            >
              ${stake}
            </span>
            <button
              onClick={() => setStake((current) => clampStake(current + 10))}
              disabled={phase !== 'setup'}
              className="px-2 py-1 text-xs dtc-data"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            >+</button>
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        {/* Setup overlay */}
        {phase === 'setup' && !locked && (
          <div
            className="absolute inset-0 z-20 animate-fade-in flex items-center justify-center"
            style={{
              background: 'rgba(9, 9, 11, 0.75)',
              backdropFilter: 'blur(2px)',
            }}
          >
            <div
              className="dtc-panel max-w-[400px] w-full mx-4 p-7 text-center"
              style={{ background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-md)' }}
            >
              <div className="dtc-eyebrow mb-3">Round setup</div>
              <h1 className="dtc-display text-[30px] mb-3" style={{ color: 'var(--text-primary)', lineHeight: 1.15 }}>
                Draw the next{' '}
                <span className="dtc-display-em" style={{ color: 'var(--accent)' }}>
                  {TIMEFRAMES[timeframe].label}
                </span>
              </h1>
              <p className="text-[13px] mb-7" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                Sketch where BTC goes. Your line is ranked against 5,000 simulated
                forecasts facing the same market.
              </p>
              <button
                onClick={handleLockStart}
                className="w-full px-5 py-3 text-sm font-semibold dtc-button-primary"
              >
                Start Round
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div
            className="absolute inset-0 z-20 p-4"
            style={{ background: 'var(--bg-primary)' }}
          >
            <div className="h-full rounded-lg shimmer" />
          </div>
        )}

        {error && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20"
            style={{ background: 'rgba(9, 9, 11, 0.85)' }}
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

        {/* Price readout */}
        {lastChartCandle && !loading && phase !== 'submitted' && (
          <div className="absolute top-3 left-4 z-10 pointer-events-none">
            <span className="text-xl font-semibold dtc-data" style={{ color: 'var(--text-primary)' }}>
              {lastChartCandle.close.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <DrawingChart
            history={chartData}
            timeframe={timeframe}
            drawingEnabled={drawingEnabled && !taToolActive}
            drawnPath={drawnPath}
            onDrawComplete={handleDrawComplete}
            actualFuture={visibleFuture}
            showFreezeLine={phase === 'drawing' || phase === 'submitted'}
            onChartReady={handleChartReady}
          />
        )}

        {/* Technical-analysis overlay: only intercepts pointers when a tool is armed */}
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
            onToolDone={() => setTaDrawingCount((count) => count + 1)}
          />
        )}

        {/* Floating tool rail on the left edge of the chart, collapsed by default */}
        {phase === 'drawing' && !loading && chartData.length > 0 && (
          <div className="hidden sm:block">
            {showTools ? (
              <div className="animate-fade-in">
                <TAToolbar
                  activeTool={activeTATool}
                  onSelectTool={handleSelectTATool}
                  onClearAll={handleClearTA}
                  hasDrawings={taDrawingCount > 0}
                  onCollapse={handleToggleTools}
                />
              </div>
            ) : (
              <button
                onClick={handleToggleTools}
                title="Drawing tools"
                aria-label="Show drawing tools"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center transition-colors"
                style={{
                  width: '34px',
                  height: '34px',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: 'var(--shadow-md)',
                  color: 'var(--text-muted)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <svg viewBox="0 0 18 18" width="17" height="17" fill="none">
                  <circle cx="4.5" cy="13.5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
                  <circle cx="13.5" cy="4.5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M6 12 12 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Result card */}
        {phase === 'submitted' && score && !isReplaying && (
          <div
            className="dtc-panel absolute top-3 left-4 z-30 p-5 animate-slide-in"
            style={{
              width: '284px',
              background: 'var(--bg-panel)',
              backdropFilter: 'blur(10px)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {scoreV3 && payoutInfoV3 ? (
              <>
                <div className="dtc-eyebrow mb-2">Round score</div>
                <div
                  className="text-[42px] leading-none font-semibold dtc-data animate-count-up"
                  style={{
                    color: scoreV3.percentile >= STANDARD_PAYOUT_V3.breakEvenPercentile
                      ? 'var(--green)'
                      : scoreV3.percentile >= 0.5
                        ? 'var(--accent)'
                        : 'var(--red)',
                  }}
                >
                  {(100 * scoreV3.percentile).toFixed(1)}
                  <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}> / 100</span>
                </div>

                <div className="space-y-1.5 text-xs mt-4">
                  <ScoreRow label="Shape & Timing" value={scoreV3.similarity.shape} max={50} />
                  <ScoreRow label="Direction" value={scoreV3.similarity.direction} max={30} />
                  <ScoreRow label="Level" value={scoreV3.similarity.level} max={20} />
                </div>

                <div className="mt-3 pt-3 flex items-end justify-between gap-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div className="dtc-eyebrow mb-1">Payout</div>
                    <div
                      className="text-[28px] leading-none font-semibold dtc-data animate-count-up"
                      style={{ color: payoutInfoV3.multiplier >= 1 ? 'var(--green)' : 'var(--red)' }}
                    >
                      {payoutInfoV3.multiplier.toFixed(2)}x
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-base font-semibold dtc-data"
                      style={{ color: payoutInfoV3.profit >= 0 ? 'var(--green)' : 'var(--red)' }}
                    >
                      {payoutInfoV3.profit >= 0 ? '+' : '−'}${Math.abs(payoutInfoV3.profit).toFixed(2)}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      on ${stake}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 flex flex-wrap items-center gap-3 text-[11px]" style={{ borderTop: '1px solid var(--border)' }}>
                  {/* matches ACCENT_STRONG in DrawingChart — the drawn path */}
                  <Legend color="#f5b342" label="You" />
                  <Legend color="var(--teal)" label="Actual" />
                </div>
              </>
            ) : (
              <div className="text-4xl font-bold dtc-data animate-count-up" style={{
                color: score.total >= 60 ? 'var(--green)' : score.total >= 40 ? 'var(--accent)' : 'var(--red)',
              }}>
                {score.total.toFixed(1)}
                <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}> / 100</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <footer
        className="flex items-center justify-between gap-3 px-4 py-2 h-14 shrink-0"
        style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
        }}
      >
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {phase === 'drawing' && !hasDrawing && 'Draw your path inside the highlighted zone'}
        </span>

        <div className="flex items-center gap-2 shrink-0">
          {phase === 'drawing' && (
            <>
              {hasDrawing && (
                <button
                  onClick={handleClearDrawing}
                  className={FOOTER_ACTION_BUTTON_CLASS}
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!hasDrawing}
                className={hasDrawing ? FOOTER_PRIMARY_BUTTON_CLASS : FOOTER_ACTION_BUTTON_CLASS}
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
          {phase === 'submitted' && (
            <button onClick={handleReset} className={FOOTER_PRIMARY_BUTTON_CLASS}>
              New Round
            </button>
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
      <div className="h-1 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full transition-all" style={{
          width: `${pct}%`,
          background: pct > 70 ? 'var(--green)' : pct > 40 ? 'var(--accent)' : 'var(--red)',
        }} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-3 h-0.5 rounded" style={{ background: color }} />
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </span>
  );
}
