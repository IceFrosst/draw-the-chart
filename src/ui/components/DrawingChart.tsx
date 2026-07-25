import {
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  Component,
  type ReactNode,
} from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
} from 'lightweight-charts';
import type { CandleData } from '../hooks/usePriceData';
import { TIMEFRAMES, type TimeframeKey } from '../hooks/usePriceData';

export interface DrawnPoint {
  time: number;
  price: number;
}

interface DrawingChartProps {
  history: CandleData[];
  timeframe: TimeframeKey;
  drawingEnabled: boolean;
  drawnPath: DrawnPoint[] | null;
  resampledPath?: DrawnPoint[] | null;
  onDrawComplete: (path: DrawnPoint[]) => void;
  actualFuture?: CandleData[];
  showFreezeLine: boolean;
  onChartReady?: (chart: IChartApi, series: ISeriesApi<SeriesType>) => void;
}

interface NumericRange {
  min: number;
  max: number;
}

interface PaneMetrics {
  left: number;
  top: number;
  width: number;
  height: number;
  freezeX: number;
  endX: number;
}

interface DraftPoint extends DrawnPoint {
  localX: number;
}

interface ScreenPoint {
  x: number;
  y: number;
}

const DRAWING_RANGE_PAD: Record<TimeframeKey, number> = {
  '15m': 0.0018,
  '1h': 0.0035,
  '6h': 0.012,
  '24h': 0.028,
  '7d': 0.082,
};

const FREEZE_TOLERANCE_PX = 18;
const END_HANDLE_RADIUS = 18;
const MIN_DRAW_STEP_PX = 0.35;
const FUTURE_RIGHT_PAD = 160;
const MIN_FIRST_SEGMENT_PX = 4;
const DRAW_START_LEFT_PAD = 22;
const AXIS_WHEEL_ZOOM_INTENSITY = 0.00045;
const AXIS_DRAG_ZOOM_INTENSITY = 0.0035;
const FUTURE_OFFSET_MULTIPLIER = 1.55;
const FUTURE_OFFSET_MIN = 8;
const FUTURE_PADDING_MULTIPLIER = 0.16;
const HISTORY_TO_FUTURE_RATIO = 1.32;
const PANE_CLIP_ID = 'dtc-chart-pane-clip';
const CHART_BG = '#0d0d0f';
const CHART_PANEL = '#111113';
const CHART_PANEL_SOFT = '#18181b';
const GRID_COLOR = 'rgba(255, 255, 255, 0.04)';
const GRID_SOFT = 'rgba(255, 255, 255, 0.03)';
const TEXT_COLOR = '#52525b';
const TEXT_MUTED = 'rgba(161, 161, 170, 0.8)';
const ACCENT = '#d4a85c';
const ACCENT_GLOW = 'rgba(212, 168, 92, 0.18)';
const ACCENT_STRONG = '#d4a85c';
const ACTUAL = '#67c1b4';
const ACTUAL_GLOW = 'rgba(103, 193, 180, 0.15)';
const UP_COLOR = '#22c55e';
const DOWN_COLOR = '#ef4444';

class ChartErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ color: '#ef5350', padding: 20, fontSize: 13 }}>
          Chart error: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function expandRange(minValue: number, maxValue: number, pad: number): NumericRange {
  const safeMin = Math.min(minValue, maxValue);
  const safeMax = Math.max(minValue, maxValue);
  const span = safeMax - safeMin;
  const effectivePad = Math.max(pad, span * 0.08, 1);

  return {
    min: Math.max(1e-6, safeMin - effectivePad),
    max: safeMax + effectivePad,
  };
}

function clampWheelDelta(delta: number): number {
  return clamp(delta, -160, 160);
}

function zoomFactorFromWheel(delta: number): number {
  const normalized = clampWheelDelta(delta);
  return clamp(Math.exp(normalized * AXIS_WHEEL_ZOOM_INTENSITY), 0.84, 1.2);
}

function zoomFactorFromDrag(delta: number): number {
  return clamp(Math.exp(delta * AXIS_DRAG_ZOOM_INTENSITY), 0.6, 1.8);
}

function computeDrawingPriceRange(
  history: CandleData[],
  timeframe: TimeframeKey,
): NumericRange {
  const lows = history.map((candle) => candle.low);
  const highs = history.map((candle) => candle.high);
  const minPrice = Math.min(...lows);
  const maxPrice = Math.max(...highs);
  const lastPrice = history[history.length - 1]?.close ?? history[0]?.close ?? 1;
  const span = Math.max(maxPrice - minPrice, lastPrice * 0.003, 1);
  const pad = Math.max(span * 0.18, lastPrice * DRAWING_RANGE_PAD[timeframe], 10);
  return expandRange(minPrice, maxPrice, pad);
}

function computeRevealPriceRange(
  history: CandleData[],
  drawnPath: DrawnPoint[] | null,
  resampledPath: DrawnPoint[] | null | undefined,
  actualFuture: CandleData[] | undefined,
): NumericRange {
  const values = [
    ...history.flatMap((candle) => [candle.high, candle.low]),
    ...(drawnPath?.map((point) => point.price) ?? []),
    ...(resampledPath?.map((point) => point.price) ?? []),
    ...(actualFuture?.flatMap((candle) => [candle.high, candle.low]) ?? []),
  ];
  const fallback = history[history.length - 1]?.close ?? 1;

  if (values.length === 0) {
    return expandRange(fallback, fallback, fallback * 0.02);
  }

  const minPrice = Math.min(...values);
  const maxPrice = Math.max(...values);
  const span = Math.max(maxPrice - minPrice, fallback * 0.01, 1);
  return expandRange(minPrice, maxPrice, Math.max(span * 0.08, fallback * 0.0025));
}

function dedupeAsc<T extends { time: Time }>(data: T[]): T[] {
  if (data.length <= 1) return data;
  const result: T[] = [data[0]!];
  for (let index = 1; index < data.length; index++) {
    if ((data[index]!.time as number) > (result[result.length - 1]!.time as number)) {
      result.push(data[index]!);
    }
  }
  return result;
}

function makePath(points: ScreenPoint[]): string {
  if (points.length === 0) {
    return '';
  }

  return points
    .map((point, index) =>
      `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(' ');
}

function DrawingChartInner({
  history,
  timeframe,
  drawingEnabled,
  drawnPath,
  resampledPath,
  onDrawComplete,
  actualFuture,
  showFreezeLine,
  onChartReady,
}: DrawingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paneElementRef = useRef<HTMLElement | null>(null);
  const priceAxisElementRef = useRef<HTMLElement | null>(null);
  const timeAxisElementRef = useRef<HTMLElement | null>(null);
  const interactionLayerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const historySeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceRangeRef = useRef<NumericRange | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const isDrawingRef = useRef(false);
  const lastCommittedXRef = useRef<number | null>(null);
  const rawPathRef = useRef<DrawnPoint[]>([]);
  const pendingPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const paneMetricsRef = useRef<PaneMetrics | null>(null);
  const displayPathRef = useRef<DrawnPoint[] | null>(drawnPath);
  const anchorCoreRef = useRef<SVGCircleElement | null>(null);
  const anchorGlowRef = useRef<SVGCircleElement | null>(null);
  const predictionGlowPathRef = useRef<SVGPathElement | null>(null);
  const predictionMainPathRef = useRef<SVGPathElement | null>(null);
  const pathEndCoreRef = useRef<SVGCircleElement | null>(null);
  const pathEndGlowRef = useRef<SVGCircleElement | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [paneMetrics, setPaneMetrics] = useState<PaneMetrics | null>(null);
  const [displayPath, setDisplayPath] = useState<DrawnPoint[] | null>(drawnPath);

  const tf = TIMEFRAMES[timeframe];
  const lastHistoryTime = history.length > 0 ? history[history.length - 1]!.time : 0;
  const lastHistoryPrice = history.length > 0 ? history[history.length - 1]!.close : 0;
  const endTime = lastHistoryTime + tf.minutes * 60;

  const stateRef = useRef({
    drawingEnabled,
    drawnPath,
    endTime,
    lastHistoryPrice,
    lastHistoryTime,
  });
  stateRef.current = {
    drawingEnabled,
    drawnPath,
    endTime,
    lastHistoryPrice,
    lastHistoryTime,
  };
  paneMetricsRef.current = paneMetrics;
  displayPathRef.current = displayPath;

  const onDrawCompleteRef = useRef(onDrawComplete);
  onDrawCompleteRef.current = onDrawComplete;
  const onChartReadyRef = useRef(onChartReady);
  onChartReadyRef.current = onChartReady;

  function getPaneMetrics(): PaneMetrics | null {
    const container = containerRef.current;
    const chart = chartRef.current;
    if (!container || !chart) return null;

    const pane = chart.panes()[0]?.getHTMLElement() ?? paneElementRef.current;
    if (!pane) return null;
    paneElementRef.current = pane;

    const paneRect = pane.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const priceAxisRect = priceAxisElementRef.current?.getBoundingClientRect() ?? null;
    const widthFromAxis =
      priceAxisRect != null ? priceAxisRect.left - paneRect.left : paneRect.width;
    const width = clamp(widthFromAxis, Math.min(320, paneRect.width), paneRect.width);
    const height = paneRect.height;
    if (width <= 0 || height <= 0) return null;

    const freeze = chart.timeScale().timeToCoordinate(lastHistoryTime as Time);
    const freezeX = freeze ?? width * 0.64;
    const endX = Math.max(freezeX + 40, width - FUTURE_RIGHT_PAD);

    return {
      left: paneRect.left - containerRect.left,
      top: paneRect.top - containerRect.top,
      width,
      height,
      freezeX,
      endX,
    };
  }

  function syncPaneMetrics() {
    const nextMetrics = getPaneMetrics();
    paneMetricsRef.current = nextMetrics;
    syncPredictionOverlay(displayPathRef.current, nextMetrics);
    setPaneMetrics(nextMetrics);
  }

  function syncChartChrome() {
    const container = containerRef.current;
    if (!container) return;

    const tableCells = container.querySelectorAll('td');
    priceAxisElementRef.current = tableCells[2] instanceof HTMLElement ? tableCells[2] : null;
    timeAxisElementRef.current = tableCells[4] instanceof HTMLElement ? tableCells[4] : null;
  }

  function getVisiblePriceRange(): NumericRange | null {
    if (priceRangeRef.current) {
      return priceRangeRef.current;
    }

    const series = historySeriesRef.current;
    const metrics = paneMetrics;
    if (!series || !metrics) return null;

    const top = series.coordinateToPrice(0);
    const bottom = series.coordinateToPrice(metrics.height);
    if (top == null || bottom == null) {
      return null;
    }

    return {
      min: Math.max(1e-6, Math.min(top, bottom)),
      max: Math.max(top, bottom),
    };
  }

  function applyPriceRange(range: NumericRange) {
    const chart = chartRef.current;
    if (!chart) return;

    const safeMin = Math.max(1e-6, Math.min(range.min, range.max - 1e-6));
    const safeMax = Math.max(range.max, safeMin + 1e-6);
    const nextRange = { min: safeMin, max: safeMax };

    priceRangeRef.current = nextRange;
    const priceScale = chart.priceScale('right');
    priceScale.setAutoScale(false);
    priceScale.setVisibleRange({ from: nextRange.min, to: nextRange.max });
  }

  function priceToLocalY(price: number): number | null {
    const series = historySeriesRef.current;
    const metrics = paneMetrics;
    if (!series || !metrics) return null;
    const y = series.priceToCoordinate(price);
    if (y == null) return null;
    return clamp(y, 0, metrics.height);
  }

  function localYToPrice(localY: number): number {
    const series = historySeriesRef.current;
    const metrics = paneMetrics;
    if (series && metrics) {
      const price = series.coordinateToPrice(clamp(localY, 0, metrics.height));
      if (price != null) {
        return Math.max(price, 1e-6);
      }
    }

    const range = priceRangeRef.current;
    if (!range || !metrics) {
      return Math.max(lastHistoryPrice, 1e-6);
    }

    return Math.max(
      range.max - (clamp(localY, 0, metrics.height) / metrics.height) * (range.max - range.min),
      1e-6,
    );
  }

  function futureProgressToLocalX(progress: number): number | null {
    if (!paneMetrics) return null;
    return paneMetrics.freezeX + progress * (paneMetrics.endX - paneMetrics.freezeX);
  }

  function futureTimeToLocalX(time: number): number | null {
    if (!paneMetrics) return null;
    const span = endTime - lastHistoryTime;
    const progress = span <= 0 ? 0 : (time - lastHistoryTime) / span;
    return futureProgressToLocalX(clamp(progress, 0, 1));
  }

  function localXToFutureTime(localX: number): number {
    if (!paneMetrics) return lastHistoryTime;
    const span = endTime - lastHistoryTime;
    if (span <= 0 || paneMetrics.endX <= paneMetrics.freezeX) {
      return lastHistoryTime;
    }
    const progress =
      (clamp(localX, paneMetrics.freezeX, paneMetrics.endX) - paneMetrics.freezeX) /
      (paneMetrics.endX - paneMetrics.freezeX);
    return Math.round(lastHistoryTime + progress * span);
  }

  function projectFuturePath(path: DrawnPoint[] | null | undefined): ScreenPoint[] {
    if (!path || path.length === 0 || !paneMetrics) {
      return [];
    }

    const projected: ScreenPoint[] = [];
    for (const point of path) {
      const x = futureTimeToLocalX(point.time);
      const y = priceToLocalY(point.price);
      if (x == null || y == null) continue;
      projected.push({
        x: paneMetrics.left + x,
        y: paneMetrics.top + y,
      });
    }
    return projected;
  }

  function projectActualFuture(): ScreenPoint[] {
    if (!actualFuture || actualFuture.length === 0 || !paneMetrics) {
      return [];
    }

    const points: DrawnPoint[] = [
      { time: lastHistoryTime, price: lastHistoryPrice },
      ...actualFuture.map((candle) => ({
        time: candle.time,
        price: candle.close,
      })),
    ];

    return projectFuturePath(points);
  }

  function toViewportPoint(point: ScreenPoint | null): ScreenPoint | null {
    const container = containerRef.current;
    if (!container || !point) return null;

    const rect = container.getBoundingClientRect();
    return {
      x: rect.left + point.x,
      y: rect.top + point.y,
    };
  }

  function getAnchorScreenPoint(): ScreenPoint | null {
    return getAnchorScreenPointForMetrics(paneMetrics);
  }

  function getAnchorScreenPointForMetrics(metrics: PaneMetrics | null): ScreenPoint | null {
    if (!metrics) return null;
    const y = priceToLocalYForMetrics(lastHistoryPrice, metrics);
    if (y == null) return null;
    return {
      x: metrics.left + metrics.freezeX,
      y: metrics.top + y,
    };
  }

  function getPathEndScreenPoint(path: DrawnPoint[] | null | undefined): ScreenPoint | null {
    const projected = projectFuturePath(path);
    return projected.length > 0 ? projected[projected.length - 1]! : null;
  }

  function pointerToDraftPoint(
    clientX: number,
    clientY: number,
    minLocalX: number,
  ): DraftPoint | null {
    const container = containerRef.current;
    const metrics = paneMetrics;
    if (!container || !metrics) return null;

    const containerRect = container.getBoundingClientRect();
    const localX = clientX - containerRect.left - metrics.left;
    const localY = clientY - containerRect.top - metrics.top;
    const clampedX = clamp(localX, minLocalX, metrics.endX);
    const clampedY = clamp(localY, 0, metrics.height);

    return {
      localX: clampedX,
      time: localXToFutureTime(clampedX),
      price: localYToPrice(clampedY),
    };
  }

  function priceToLocalYForMetrics(price: number, metrics: PaneMetrics): number | null {
    const series = historySeriesRef.current;
    if (!series) return null;
    const y = series.priceToCoordinate(price);
    if (y == null) return null;
    return clamp(y, 0, metrics.height);
  }

  function futureTimeToLocalXForMetrics(
    time: number,
    metrics: PaneMetrics,
  ): number {
    const span = endTime - lastHistoryTime;
    const progress = span <= 0 ? 0 : (time - lastHistoryTime) / span;
    return metrics.freezeX + clamp(progress, 0, 1) * (metrics.endX - metrics.freezeX);
  }

  function projectFuturePathForMetrics(
    path: DrawnPoint[] | null | undefined,
    metrics: PaneMetrics | null,
  ): ScreenPoint[] {
    if (!path || path.length === 0 || !metrics) {
      return [];
    }

    const projected: ScreenPoint[] = [];
    for (const point of path) {
      const x = futureTimeToLocalXForMetrics(point.time, metrics);
      const y = priceToLocalYForMetrics(point.price, metrics);
      if (y == null) continue;
      projected.push({
        x: metrics.left + x,
        y: metrics.top + y,
      });
    }
    return projected;
  }

  function syncPredictionOverlay(
    path: DrawnPoint[] | null | undefined,
    metrics: PaneMetrics | null,
  ) {
    const anchorCore = anchorCoreRef.current;
    const anchorGlow = anchorGlowRef.current;
    const predictionGlowPath = predictionGlowPathRef.current;
    const predictionMainPath = predictionMainPathRef.current;
    const pathEndCore = pathEndCoreRef.current;
    const pathEndGlow = pathEndGlowRef.current;

    const anchorPoint = showFreezeLine ? getAnchorScreenPointForMetrics(metrics) : null;
    if (anchorCore && anchorGlow) {
      const visible = anchorPoint != null;
      anchorCore.style.display = visible ? '' : 'none';
      anchorGlow.style.display = visible ? '' : 'none';
      if (anchorPoint) {
        anchorCore.setAttribute('cx', String(anchorPoint.x));
        anchorCore.setAttribute('cy', String(anchorPoint.y));
        anchorGlow.setAttribute('cx', String(anchorPoint.x));
        anchorGlow.setAttribute('cy', String(anchorPoint.y));
      }
    }

    const points = projectFuturePathForMetrics(path, metrics);
    const visiblePath = points.length >= 2;
    const pathData = visiblePath ? makePath(points) : '';
    if (predictionGlowPath && predictionMainPath) {
      predictionGlowPath.style.display = visiblePath ? '' : 'none';
      predictionMainPath.style.display = visiblePath ? '' : 'none';
      if (visiblePath) {
        predictionGlowPath.setAttribute('d', pathData);
        predictionMainPath.setAttribute('d', pathData);
      }
    }

    const pathEndPoint = visiblePath ? points[points.length - 1]! : null;
    if (pathEndCore) {
      pathEndCore.style.display = pathEndPoint != null ? '' : 'none';
      if (pathEndPoint) {
        pathEndCore.setAttribute('cx', String(pathEndPoint.x));
        pathEndCore.setAttribute('cy', String(pathEndPoint.y));
      }
    }
    if (pathEndGlow) {
      pathEndGlow.style.display = pathEndPoint != null && drawingEnabled ? '' : 'none';
      if (pathEndPoint) {
        pathEndGlow.setAttribute('cx', String(pathEndPoint.x));
        pathEndGlow.setAttribute('cy', String(pathEndPoint.y));
      }
    }
  }

  function updateDisplayPath(nextPath: DrawnPoint[] | null) {
    displayPathRef.current = nextPath;
    syncPredictionOverlay(nextPath, paneMetricsRef.current);
    setDisplayPath(nextPath);
  }

  useEffect(() => {
    if (isDrawingRef.current) return;
    rawPathRef.current = drawnPath ? [...drawnPath] : [];
    updateDisplayPath(drawnPath);
  }, [drawnPath]);

  useLayoutEffect(() => {
    syncPredictionOverlay(displayPathRef.current, paneMetricsRef.current);
  }, [displayPath, drawingEnabled, paneMetrics, showFreezeLine]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || history.length === 0) return;
    container.innerHTML = '';

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: TEXT_COLOR,
        fontSize: 11,
        fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif",
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_SOFT },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(137, 146, 132, 0.38)',
          style: LineStyle.Dashed,
          width: 1,
          labelVisible: true,
          labelBackgroundColor: CHART_PANEL,
        },
        horzLine: {
          color: 'rgba(137, 146, 132, 0.38)',
          style: LineStyle.Dashed,
          width: 1,
          labelVisible: true,
          labelBackgroundColor: CHART_PANEL,
        },
      },
      timeScale: {
        borderColor: '#2b342d',
        timeVisible: true,
        secondsVisible: false,
        borderVisible: true,
      },
      rightPriceScale: {
        borderColor: '#2b342d',
        borderVisible: true,
        scaleMargins: { top: 0.04, bottom: 0.06 },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
      },
    });

    const historySeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      borderVisible: false,
      wickVisible: true,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineStyle: LineStyle.Dotted,
      priceLineColor: 'rgba(212, 168, 92, 0.28)',
    });

    historySeries.setData(
      dedupeAsc(
        history.map((candle) => ({
          time: candle.time as Time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        })),
      ),
    );

    chartRef.current = chart;
    historySeriesRef.current = historySeries;
    paneElementRef.current = chart.panes()[0]?.getHTMLElement() ?? null;
    syncChartChrome();
    setChartReady(true);
    onChartReadyRef.current?.(chart, historySeries);

    const resizeObserver = new ResizeObserver(() => {
      chart.resize(container.clientWidth, container.clientHeight);
      syncChartChrome();
      syncPaneMetrics();
    });
    resizeObserver.observe(container);
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncPaneMetrics);
    syncChartChrome();
    syncPaneMetrics();

    return () => {
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(syncPaneMetrics);
      activePointerIdRef.current = null;
      isDrawingRef.current = false;
      lastCommittedXRef.current = null;
      setChartReady(false);
      setPaneMetrics(null);
      paneElementRef.current = null;
      chartRef.current = null;
      historySeriesRef.current = null;
      priceRangeRef.current = null;
      chart.remove();
    };
  }, [history, timeframe, lastHistoryTime]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !chartReady) return;

    const horizonCandles = Math.ceil(tf.minutes / tf.candleMinutes);
    const futureOffset =
      Math.ceil(horizonCandles * FUTURE_OFFSET_MULTIPLIER) +
      Math.max(FUTURE_OFFSET_MIN, Math.round(horizonCandles * FUTURE_PADDING_MULTIPLIER));
    const desiredHistoryVisible = Math.max(
      72,
      Math.round(futureOffset * HISTORY_TO_FUTURE_RATIO),
    );
    const lastIndex = history.length - 1;
    const firstVisibleIndex = Math.max(0, lastIndex - desiredHistoryVisible);

    chart.timeScale().applyOptions({ rightOffset: futureOffset });
    chart.timeScale().setVisibleLogicalRange({
      from: firstVisibleIndex,
      to: lastIndex + futureOffset,
    });
    syncPaneMetrics();
  }, [chartReady, history.length, tf.candleMinutes, tf.minutes]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !chartReady) return;

    chart.applyOptions({
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
      },
    });
  }, [chartReady]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !chartReady) return;

    if (!showFreezeLine) {
      priceRangeRef.current = null;
      chart.priceScale('right').setAutoScale(true);
      syncPaneMetrics();
      return;
    }

    if (!actualFuture || actualFuture.length === 0) {
      if (priceRangeRef.current != null) {
        return;
      }

      applyPriceRange(computeDrawingPriceRange(history, timeframe));
      syncPaneMetrics();
      return;
    }

    const range =
      computeRevealPriceRange(history, displayPath, resampledPath, actualFuture);

    applyPriceRange(range);
    syncPaneMetrics();
  }, [
    actualFuture,
    chartReady,
    displayPath,
    history,
    resampledPath,
    showFreezeLine,
    timeframe,
  ]);

  useEffect(() => {
    const layer = interactionLayerRef.current;
    if (!layer || !chartReady) return;

    function beginPath(clientX: number, clientY: number): boolean {
      const metrics = paneMetrics;
      const state = stateRef.current;
      if (!metrics || !state.drawingEnabled) return false;

      const containerRect = containerRef.current?.getBoundingClientRect();
      const anchor = toViewportPoint(getAnchorScreenPoint());
      if (!anchor || !containerRect) return false;

      const existing =
        state.drawnPath && state.drawnPath.length >= 1 ? [...state.drawnPath] : null;
      const endPoint = existing?.[existing.length - 1] ?? null;
      const endHandle = toViewportPoint(endPoint ? getPathEndScreenPoint(existing) : null);

      let workingPath: DrawnPoint[];
      let minLocalX = metrics.freezeX;

      if (!existing || !endPoint || !endHandle) {
        const localX = clientX - containerRect.left - metrics.left;
        const localY = clientY - containerRect.top - metrics.top;
        const insideFutureZone =
          localX >= metrics.freezeX - DRAW_START_LEFT_PAD &&
          localX <= metrics.endX &&
          localY >= 0 &&
          localY <= metrics.height;
        if (!insideFutureZone) {
          return false;
        }
        workingPath = [{ time: state.lastHistoryTime, price: state.lastHistoryPrice }];
      } else {
        const endLocalX = futureTimeToLocalX(endPoint.time);
        if (endLocalX == null) return false;

        const onHandle = Math.hypot(clientX - endHandle.x, clientY - endHandle.y) <= END_HANDLE_RADIUS;
        const aheadOfPath = clientX >= endHandle.x - FREEZE_TOLERANCE_PX;
        if (!onHandle && !aheadOfPath) {
          return false;
        }

        workingPath = existing;
        minLocalX = endLocalX;
      }

      rawPathRef.current = workingPath;
      lastCommittedXRef.current = minLocalX;
      isDrawingRef.current = true;
      updateDisplayPath([...workingPath]);

      extendPath(clientX, clientY);
      return true;
    }

    function extendPath(clientX: number, clientY: number) {
      if (!isDrawingRef.current || !paneMetrics) return;

      const current = rawPathRef.current;
      if (current.length === 0) return;

      const minLocalX = Math.max(lastCommittedXRef.current ?? paneMetrics.freezeX, paneMetrics.freezeX);
      const draft = pointerToDraftPoint(clientX, clientY, minLocalX);
      if (!draft) return;

      if (current.length === 1) {
        if (draft.localX <= paneMetrics.freezeX + MIN_FIRST_SEGMENT_PX) {
          return;
        }

        rawPathRef.current = [
          current[0]!,
          {
            time: Math.max(draft.time, current[0]!.time + 1),
            price: draft.price,
          },
        ];
        lastCommittedXRef.current = draft.localX;
        updateDisplayPath([...rawPathRef.current]);
        return;
      }

      const previousFixedPoint = current[current.length - 2]!;
      const nextPoint: DrawnPoint = {
        time: Math.max(draft.time, previousFixedPoint.time + 1),
        price: draft.price,
      };

      const lastCommittedX = lastCommittedXRef.current ?? paneMetrics.freezeX;
      if (draft.localX >= lastCommittedX + MIN_DRAW_STEP_PX) {
        rawPathRef.current = [...current, nextPoint];
        lastCommittedXRef.current = draft.localX;
      } else {
        rawPathRef.current = [...current.slice(0, -1), nextPoint];
      }

      updateDisplayPath([...rawPathRef.current]);
    }

    function flushPendingPointer() {
      if (!pendingPointerRef.current) return;
      const { clientX, clientY } = pendingPointerRef.current;
      pendingPointerRef.current = null;
      extendPath(clientX, clientY);
    }

    function schedulePointerFlush() {
      if (pointerFrameRef.current != null) return;
      pointerFrameRef.current = requestAnimationFrame(() => {
        pointerFrameRef.current = null;
        flushPendingPointer();
      });
    }

    function endPath(pointerId: number | null) {
      if (!isDrawingRef.current) return;
      if (pointerId != null && activePointerIdRef.current != null && pointerId !== activePointerIdRef.current) {
        return;
      }

      flushPendingPointer();

      isDrawingRef.current = false;
      activePointerIdRef.current = null;
      lastCommittedXRef.current = null;

      if (rawPathRef.current.length >= 2) {
        const completed = [...rawPathRef.current];
        updateDisplayPath(completed);
        onDrawCompleteRef.current(completed);
      } else {
        rawPathRef.current = [];
        updateDisplayPath(null);
        onDrawCompleteRef.current([]);
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (!beginPath(event.clientX, event.clientY)) return;

      activePointerIdRef.current = event.pointerId;
      layer.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isDrawingRef.current || activePointerIdRef.current !== event.pointerId) return;
      pendingPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      schedulePointerFlush();
      event.preventDefault();
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (activePointerIdRef.current === event.pointerId) {
        endPath(event.pointerId);
      }
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (activePointerIdRef.current === event.pointerId) {
        endPath(event.pointerId);
      }
    };

    layer.addEventListener('pointerdown', handlePointerDown);
    layer.addEventListener('pointermove', handlePointerMove);
    layer.addEventListener('pointerup', handlePointerUp);
    layer.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      layer.removeEventListener('pointerdown', handlePointerDown);
      layer.removeEventListener('pointermove', handlePointerMove);
      layer.removeEventListener('pointerup', handlePointerUp);
      layer.removeEventListener('pointercancel', handlePointerCancel);
      if (pointerFrameRef.current != null) {
        cancelAnimationFrame(pointerFrameRef.current);
        pointerFrameRef.current = null;
      }
      pendingPointerRef.current = null;
    };
  }, [chartReady, paneMetrics]);

  useEffect(() => {
    const chart = chartRef.current;
    const priceAxis = priceAxisElementRef.current;
    const timeAxis = timeAxisElementRef.current;
    if (!chart || !priceAxis || !timeAxis || !showFreezeLine) return;
    const chartApi = chart;
    const priceAxisElement = priceAxis;
    const timeAxisElement = timeAxis;
    const previousPriceAxisCursor = priceAxisElement.style.cursor;
    const previousTimeAxisCursor = timeAxisElement.style.cursor;
    priceAxisElement.style.cursor = 'ns-resize';
    timeAxisElement.style.cursor = 'ew-resize';

    function resolvePriceAtClientY(clientY: number, range: NumericRange | null): number | null {
      const metrics = paneMetrics;
      if (!metrics || !range) return null;
      const rect = priceAxisElement.getBoundingClientRect();
      const localY = clamp(clientY - rect.top, 0, metrics.height);
      const progress = metrics.height <= 0 ? 0.5 : localY / metrics.height;
      return Math.max(1e-6, range.max - progress * (range.max - range.min));
    }

    function scalePriceAround(centerPrice: number, factor: number) {
      const range = getVisiblePriceRange();
      if (!range) return;

      applyPriceRange({
        min: Math.max(1e-6, centerPrice - (centerPrice - range.min) * factor),
        max: centerPrice + (range.max - centerPrice) * factor,
      });
      syncPaneMetrics();
    }

    function scaleTimeAround(centerLogical: number, factor: number) {
      const visibleRange = chartApi.timeScale().getVisibleLogicalRange();
      if (!visibleRange) return;

      chartApi.timeScale().setVisibleLogicalRange({
        from: centerLogical + (visibleRange.from - centerLogical) * factor,
        to: centerLogical + (visibleRange.to - centerLogical) * factor,
      });
      syncPaneMetrics();
    }

    const priceDragState = {
      active: false,
      startY: 0,
      centerPrice: 0,
      startRange: null as NumericRange | null,
    };

    const handlePriceAxisWheel = (event: WheelEvent) => {
      const range = getVisiblePriceRange();
      if (!range) return;

      const centerPrice = resolvePriceAtClientY(event.clientY, range);
      if (centerPrice == null) return;
      const factor = zoomFactorFromWheel(event.deltaY);
      scalePriceAround(centerPrice, factor);
      event.preventDefault();
      event.stopPropagation();
    };

    const handlePriceAxisMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      priceDragState.active = true;
      priceDragState.startY = event.clientY;
      priceDragState.startRange = getVisiblePriceRange();
      const centerPrice = resolvePriceAtClientY(event.clientY, priceDragState.startRange);
      if (centerPrice == null) {
        priceDragState.active = false;
        priceDragState.startRange = null;
        return;
      }
      priceDragState.centerPrice = centerPrice;
      event.preventDefault();
      event.stopPropagation();
    };

    const handlePriceAxisMouseMove = (event: MouseEvent) => {
      if (!priceDragState.active || !priceDragState.startRange) return;

      const deltaY = event.clientY - priceDragState.startY;
      const factor = zoomFactorFromDrag(deltaY);
      const { centerPrice, startRange } = priceDragState;

      applyPriceRange({
        min: Math.max(1e-6, centerPrice - (centerPrice - startRange.min) * factor),
        max: centerPrice + (startRange.max - centerPrice) * factor,
      });
      syncPaneMetrics();
      event.preventDefault();
      event.stopPropagation();
    };

    const endPriceAxisDrag = () => {
      if (!priceDragState.active) return;
      priceDragState.active = false;
      priceDragState.startRange = null;
    };

    const handlePriceAxisMouseUp = (_event: MouseEvent) => {
      endPriceAxisDrag();
    };

    const handleWindowBlur = () => {
      endPriceAxisDrag();
      endTimeAxisDrag();
    };

    const timeDragState = {
      active: false,
      startX: 0,
      centerLogical: 0,
      startRange: null as { from: number; to: number } | null,
    };

    const resolveLogicalAtClientX = (clientX: number): number | null => {
      const rect = timeAxis.getBoundingClientRect();
      const logical = chartApi.timeScale().coordinateToLogical(clientX - rect.left);
      return logical == null ? null : Number(logical);
    };

    const handleTimeAxisWheel = (event: WheelEvent) => {
      const centerLogical = resolveLogicalAtClientX(event.clientX);
      if (centerLogical == null) return;

      const factor = zoomFactorFromWheel(event.deltaY);
      scaleTimeAround(centerLogical, factor);
      event.preventDefault();
      event.stopPropagation();
    };

    const handleTimeAxisMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const visibleLogicalRange = chartApi.timeScale().getVisibleLogicalRange();
      const centerLogical = resolveLogicalAtClientX(event.clientX);
      if (!visibleLogicalRange || centerLogical == null) return;

      timeDragState.active = true;
      timeDragState.startX = event.clientX;
      timeDragState.centerLogical = centerLogical;
      timeDragState.startRange = {
        from: Number(visibleLogicalRange.from),
        to: Number(visibleLogicalRange.to),
      };
      event.preventDefault();
      event.stopPropagation();
    };

    const handleTimeAxisMouseMove = (event: MouseEvent) => {
      if (!timeDragState.active || !timeDragState.startRange) return;

      const deltaX = event.clientX - timeDragState.startX;
      const factor = zoomFactorFromDrag(-deltaX);
      const { centerLogical, startRange } = timeDragState;

      chartApi.timeScale().setVisibleLogicalRange({
        from: centerLogical + (startRange.from - centerLogical) * factor,
        to: centerLogical + (startRange.to - centerLogical) * factor,
      });
      syncPaneMetrics();
      event.preventDefault();
      event.stopPropagation();
    };

    const endTimeAxisDrag = () => {
      if (!timeDragState.active) return;
      timeDragState.active = false;
      timeDragState.startRange = null;
    };

    const handleTimeAxisMouseUp = (_event: MouseEvent) => {
      endTimeAxisDrag();
    };

    priceAxisElement.addEventListener('wheel', handlePriceAxisWheel, { passive: false });
    priceAxisElement.addEventListener('mousedown', handlePriceAxisMouseDown);
    window.addEventListener('mousemove', handlePriceAxisMouseMove);
    window.addEventListener('mouseup', handlePriceAxisMouseUp);

    timeAxisElement.addEventListener('wheel', handleTimeAxisWheel, { passive: false });
    timeAxisElement.addEventListener('mousedown', handleTimeAxisMouseDown);
    window.addEventListener('mousemove', handleTimeAxisMouseMove);
    window.addEventListener('mouseup', handleTimeAxisMouseUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      priceAxisElement.style.cursor = previousPriceAxisCursor;
      timeAxisElement.style.cursor = previousTimeAxisCursor;
      priceAxisElement.removeEventListener('wheel', handlePriceAxisWheel);
      priceAxisElement.removeEventListener('mousedown', handlePriceAxisMouseDown);
      window.removeEventListener('mousemove', handlePriceAxisMouseMove);
      window.removeEventListener('mouseup', handlePriceAxisMouseUp);

      timeAxisElement.removeEventListener('wheel', handleTimeAxisWheel);
      timeAxisElement.removeEventListener('mousedown', handleTimeAxisMouseDown);
      window.removeEventListener('mousemove', handleTimeAxisMouseMove);
      window.removeEventListener('mouseup', handleTimeAxisMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [chartReady, paneMetrics, showFreezeLine]);

  const anchorPoint = getAnchorScreenPoint();
  const predictionPoints = projectFuturePath(displayPath);
  const resampledPoints = projectFuturePath(resampledPath);
  const actualPoints = projectActualFuture();
  const pathEndPoint =
    predictionPoints.length > 0 ? predictionPoints[predictionPoints.length - 1]! : null;

  const futureWidth =
    paneMetrics != null ? Math.max(0, paneMetrics.endX - paneMetrics.freezeX) : 0;
  const futureGradientX = paneMetrics ? paneMetrics.left + paneMetrics.freezeX : 0;
  const futureGradientY = paneMetrics ? paneMetrics.top : 0;
  const futureEndX = futureGradientX + futureWidth;
  // On narrow viewports the future zone is too tight for both end labels, and
  // "NOW" and "FINISH" render on top of each other. Below this width, drop
  // FINISH and keep NOW, which is the one that orients the drawing.
  const futureZoneFitsBothLabels = futureWidth >= 132;
  const futureZoneFitsRoundEnd = futureWidth >= 190;
  // "FUTURE ZONE" starts 56px in and runs ~90px, so it spills over the price axis
  // in a narrower zone.
  const futureZoneFitsHeader = futureWidth >= 150;
  const drawBandLeft =
    paneMetrics != null
      ? paneMetrics.left + Math.max(0, paneMetrics.freezeX - DRAW_START_LEFT_PAD)
      : 0;
  const drawBandTop = paneMetrics?.top ?? 0;
  const drawBandWidth =
    paneMetrics != null
      ? Math.max(0, paneMetrics.endX - Math.max(0, paneMetrics.freezeX - DRAW_START_LEFT_PAD))
      : 0;
  const drawBandHeight = paneMetrics?.height ?? 0;
  const ghostPoints =
    drawingEnabled && !displayPath && anchorPoint && paneMetrics
      ? [
          anchorPoint,
          {
            x: futureGradientX + futureWidth * 0.24,
            y: clamp(
              anchorPoint.y - 36,
              futureGradientY + 28,
              futureGradientY + paneMetrics.height - 28,
            ),
          },
          {
            x: futureGradientX + futureWidth * 0.56,
            y: clamp(
              anchorPoint.y - 4,
              futureGradientY + 28,
              futureGradientY + paneMetrics.height - 28,
            ),
          },
          {
            x: futureGradientX + futureWidth * 0.82,
            y: clamp(
              anchorPoint.y - 48,
              futureGradientY + 28,
              futureGradientY + paneMetrics.height - 28,
            ),
          },
        ]
      : [];

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden"
        style={{ cursor: 'default' }}
      />
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        style={{ zIndex: 5 }}
      >
        {showFreezeLine && paneMetrics && (
          <>
            <defs>
              <linearGradient id="future-zone-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(212, 168, 92, 0.16)" />
                <stop offset="35%" stopColor="rgba(212, 168, 92, 0.08)" />
                <stop offset="100%" stopColor="rgba(212, 168, 92, 0.02)" />
              </linearGradient>
              <clipPath id={PANE_CLIP_ID}>
                <rect
                  x={paneMetrics.left}
                  y={paneMetrics.top}
                  width={paneMetrics.width}
                  height={paneMetrics.height}
                />
              </clipPath>
            </defs>
            <rect
              x={futureGradientX}
              y={futureGradientY}
              width={futureWidth}
              height={paneMetrics.height}
              fill="url(#future-zone-gradient)"
            />
            <line
              x1={futureGradientX}
              x2={futureGradientX}
              y1={futureGradientY}
              y2={futureGradientY + paneMetrics.height}
              stroke="rgba(137, 146, 132, 0.76)"
              strokeDasharray="4 4"
            />
            <line
              x1={futureEndX}
              x2={futureEndX}
              y1={futureGradientY}
              y2={futureGradientY + paneMetrics.height}
              stroke="rgba(212, 168, 92, 0.5)"
              strokeDasharray="6 6"
            />
            {futureZoneFitsHeader && (
              <text
                x={futureGradientX + Math.max(56, futureWidth * 0.14)}
                y={futureGradientY + 16}
                fill={TEXT_MUTED}
                fontSize="10"
                fontWeight="700"
                letterSpacing="1.1"
              >
                FUTURE ZONE
              </text>
            )}
            {futureZoneFitsRoundEnd && (
              <rect
                x={Math.max(futureGradientX + 18, futureEndX - 112)}
                y={futureGradientY + 8}
                width="104"
                height="20"
                rx="10"
                fill="rgba(17, 17, 19, 0.94)"
                stroke="rgba(212, 168, 92, 0.2)"
              />
            )}
            {futureZoneFitsRoundEnd && (
              <text
                x={futureEndX - 68}
                y={futureGradientY + 22}
                textAnchor="middle"
                fill={ACCENT_STRONG}
                fontSize="9.5"
                fontWeight="700"
                letterSpacing="0.9"
              >
                ROUND END
              </text>
            )}
            <text
              x={futureGradientX}
              y={futureGradientY + paneMetrics.height - 10}
              textAnchor="middle"
              fill={TEXT_MUTED}
              fontSize="10"
              fontWeight="700"
              letterSpacing="1.2"
            >
              NOW
            </text>
            {futureZoneFitsBothLabels && (
              <text
                x={futureEndX - 12}
                y={futureGradientY + paneMetrics.height - 10}
                textAnchor="end"
                fill={ACCENT_STRONG}
                fontSize="10"
                fontWeight="700"
                letterSpacing="1"
              >
                FINISH
              </text>
            )}
          </>
        )}

        <g clipPath={`url(#${PANE_CLIP_ID})`}>
          {ghostPoints.length >= 2 && (
            <path
              d={makePath(ghostPoints)}
              fill="none"
              stroke="rgba(212, 168, 92, 0.55)"
              strokeWidth="2.2"
              strokeDasharray="6 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {anchorPoint && showFreezeLine && (
            <>
              <circle
                ref={anchorCoreRef}
                cx={anchorPoint.x}
                cy={anchorPoint.y}
                r="12"
                fill={CHART_PANEL}
                stroke={ACCENT}
                strokeWidth="3"
              />
              <circle
                ref={anchorGlowRef}
                cx={anchorPoint.x}
                cy={anchorPoint.y}
                r="22"
                fill={ACCENT_GLOW}
              />
            </>
          )}

          {predictionPoints.length >= 2 && (
            <>
              <path
                ref={predictionGlowPathRef}
                d={makePath(predictionPoints)}
                fill="none"
                stroke={ACCENT_GLOW}
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                ref={predictionMainPathRef}
                d={makePath(predictionPoints)}
                fill="none"
                stroke={ACCENT_STRONG}
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {resampledPoints.length >= 2 && (
            <path
              d={makePath(resampledPoints)}
              fill="none"
              stroke="rgba(212, 168, 92, 0.42)"
              strokeWidth="2"
              strokeDasharray="5 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {actualPoints.length >= 2 && (
            <>
              <path
                d={makePath(actualPoints)}
                fill="none"
                stroke={ACTUAL_GLOW}
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={makePath(actualPoints)}
                fill="none"
                stroke={ACTUAL}
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {pathEndPoint && (
            <>
              <circle
                ref={pathEndCoreRef}
                cx={pathEndPoint.x}
                cy={pathEndPoint.y}
                r="7"
                fill={CHART_BG}
                stroke={ACCENT_STRONG}
                strokeWidth="2.5"
              />
              {drawingEnabled && (
                <circle
                  ref={pathEndGlowRef}
                  cx={pathEndPoint.x}
                  cy={pathEndPoint.y}
                  r="14"
                  fill={ACCENT_GLOW}
                />
              )}
            </>
          )}
        </g>

        {drawingEnabled && !displayPath && anchorPoint && (
          <>
            <rect
              x={anchorPoint.x + 16}
              y={futureGradientY + 8}
              width="180"
              height="24"
              rx="4"
              fill="rgba(17, 17, 19, 0.92)"
              stroke="rgba(212, 168, 92, 0.2)"
            />
            <text
              x={anchorPoint.x + 28}
              y={futureGradientY + 23}
              fill={ACCENT_STRONG}
              fontSize="10"
              fontWeight="700"
              letterSpacing="0.8"
            >
              DRAW IN THE FUTURE ZONE
            </text>
          </>
        )}
      </svg>
      <div
        ref={interactionLayerRef}
        className="absolute"
        style={{
          zIndex: 6,
          left: `${drawBandLeft}px`,
          top: `${drawBandTop}px`,
          width: `${drawBandWidth}px`,
          height: `${drawBandHeight}px`,
          pointerEvents: drawingEnabled && paneMetrics ? 'auto' : 'none',
          touchAction: 'none',
          cursor: drawingEnabled ? 'crosshair' : 'default',
        }}
      />
    </>
  );
}

export function DrawingChart(props: DrawingChartProps) {
  return (
    <ChartErrorBoundary>
      <DrawingChartInner {...props} />
    </ChartErrorBoundary>
  );
}
