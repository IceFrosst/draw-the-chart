import { useRef, useEffect, useState } from 'react';
import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts';

export type TAToolType = 'none' | 'hline' | 'trendline' | 'ray' | 'fib';

interface ScreenPoint {
  x: number;
  y: number;
}

interface ChartPoint {
  time: number;
  price: number;
}

interface TADrawingBase {
  id: string;
  tool: TAToolType;
  points: ChartPoint[];
  color: string;
}

interface HLineDrawing extends TADrawingBase {
  tool: 'hline';
  points: [ChartPoint];
}

interface TrendLineDrawing extends TADrawingBase {
  tool: 'trendline';
  points: [ChartPoint, ChartPoint];
}

interface RayDrawing extends TADrawingBase {
  tool: 'ray';
  points: [ChartPoint, ChartPoint];
}

interface FibDrawing extends TADrawingBase {
  tool: 'fib';
  points: [ChartPoint, ChartPoint];
}

type TADrawing = HLineDrawing | TrendLineDrawing | RayDrawing | FibDrawing;

interface PaneMetrics {
  left: number;
  top: number;
  width: number;
  height: number;
  freezeX: number | null;
  endX: number | null;
}

interface TAOverlayProps {
  chartApi: IChartApi | null;
  seriesApi: ISeriesApi<SeriesType> | null;
  activeTool: TAToolType;
  onToolDone: () => void;
  lastHistoryTime?: number | null;
  endTime?: number | null;
}

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const TA_COLORS = ['#e9a56a', '#67c1b4', '#d86858', '#c8b58b', '#8a9f86', '#7a8580'];
const FUTURE_RIGHT_PAD = 14;
let nextId = 1;

export function TAOverlay({
  chartApi,
  seriesApi,
  activeTool,
  onToolDone,
  lastHistoryTime = null,
  endTime = null,
}: TAOverlayProps) {
  const rootRef = useRef<SVGSVGElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [drawings, setDrawings] = useState<TADrawing[]>([]);
  const [paneMetrics, setPaneMetrics] = useState<PaneMetrics | null>(null);
  const [pending, setPending] = useState<{
    tool: Exclude<TAToolType, 'none' | 'hline'>;
    start: ChartPoint;
    current: ChartPoint;
    color: string;
  } | null>(null);

  const chartApiRef = useRef(chartApi);
  chartApiRef.current = chartApi;
  const seriesApiRef = useRef(seriesApi);
  seriesApiRef.current = seriesApi;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const onToolDoneRef = useRef(onToolDone);
  onToolDoneRef.current = onToolDone;

  function getPaneMetrics(): PaneMetrics | null {
    const svg = rootRef.current;
    const chart = chartApiRef.current;
    if (!svg || !chart) return null;

    const pane = chart.panes()[0]?.getHTMLElement();
    if (!pane) return null;

    const svgRect = svg.getBoundingClientRect();
    const paneRect = pane.getBoundingClientRect();
    const width = paneRect.width;
    const height = paneRect.height;
    if (width <= 0 || height <= 0) return null;

    const freezeX =
      lastHistoryTime != null
        ? chart.timeScale().timeToCoordinate(lastHistoryTime as Time) ?? width * 0.64
        : null;

    return {
      left: paneRect.left - svgRect.left,
      top: paneRect.top - svgRect.top,
      width,
      height,
      freezeX,
      endX: freezeX != null ? Math.max(freezeX + 40, width - FUTURE_RIGHT_PAD) : null,
    };
  }

  useEffect(() => {
    if (!chartApi) return;

    const sync = () => {
      setPaneMetrics(getPaneMetrics());
    };

    sync();
    chartApi.timeScale().subscribeVisibleLogicalRangeChange(sync);
    chartApi.subscribeCrosshairMove(sync);
    const pane = chartApi.panes()[0]?.getHTMLElement();
    const resizeObserver = pane ? new ResizeObserver(sync) : null;
    if (pane && resizeObserver) {
      resizeObserver.observe(pane);
    }

    return () => {
      chartApi.timeScale().unsubscribeVisibleLogicalRangeChange(sync);
      chartApi.unsubscribeCrosshairMove(sync);
      resizeObserver?.disconnect();
    };
  }, [chartApi, lastHistoryTime]);

  function chartToScreen(point: ChartPoint): ScreenPoint | null {
    const chart = chartApiRef.current;
    const series = seriesApiRef.current;
    const metrics = paneMetrics;
    if (!chart || !series || !metrics) return null;

    let x: number | null = null;
    if (
      lastHistoryTime != null &&
      endTime != null &&
      metrics.freezeX != null &&
      metrics.endX != null &&
      point.time >= lastHistoryTime
    ) {
      const span = endTime - lastHistoryTime;
      const progress = span <= 0 ? 0 : (point.time - lastHistoryTime) / span;
      x = metrics.freezeX + Math.max(0, Math.min(1, progress)) * (metrics.endX - metrics.freezeX);
    } else {
      x = chart.timeScale().timeToCoordinate(point.time as Time);
    }

    const y = series.priceToCoordinate(point.price);
    if (x == null || y == null) return null;

    return {
      x: metrics.left + x,
      y: metrics.top + y,
    };
  }

  function screenToChart(point: ScreenPoint): ChartPoint | null {
    const chart = chartApiRef.current;
    const series = seriesApiRef.current;
    const metrics = paneMetrics;
    if (!chart || !series || !metrics) return null;

    const paneX = point.x - metrics.left;
    const paneY = point.y - metrics.top;
    if (paneX < 0 || paneY < 0 || paneX > metrics.width || paneY > metrics.height) {
      return null;
    }

    const price = series.coordinateToPrice(paneY);
    if (price == null) return null;

    if (
      lastHistoryTime != null &&
      endTime != null &&
      metrics.freezeX != null &&
      metrics.endX != null &&
      paneX >= metrics.freezeX - 1
    ) {
      const span = endTime - lastHistoryTime;
      const progress =
        metrics.endX <= metrics.freezeX
          ? 0
          : (Math.min(paneX, metrics.endX) - metrics.freezeX) / (metrics.endX - metrics.freezeX);

      return {
        time: Math.round(lastHistoryTime + Math.max(0, Math.min(1, progress)) * span),
        price,
      };
    }

    const time = chart.timeScale().coordinateToTime(paneX);
    if (time != null) {
      return { time: Math.round(time as number), price };
    }

    const logical = chart.timeScale().coordinateToLogical(paneX);
    const visibleRange = chart.timeScale().getVisibleLogicalRange();
    if (logical == null || !visibleRange) return null;

    const firstTime = chart.timeScale().coordinateToTime(0);
    const lastTimeAtEdge = chart.timeScale().coordinateToTime(metrics.width);
    if (firstTime == null || lastTimeAtEdge == null) return null;

    const logicalSpan = visibleRange.to - visibleRange.from;
    if (logicalSpan <= 0) return null;
    const ratio = (logical - visibleRange.from) / logicalSpan;

    return {
      time: Math.round((firstTime as number) + ratio * ((lastTimeAtEdge as number) - (firstTime as number))),
      price,
    };
  }

  function toLocalPoint(event: PointerEvent): ScreenPoint {
    const rect = rootRef.current!.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  useEffect(() => {
    const svg = rootRef.current;
    if (!svg) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const tool = activeToolRef.current;
      if (tool === 'none') return;

      const chartPoint = screenToChart(toLocalPoint(event));
      if (!chartPoint) return;

      const color = TA_COLORS[drawings.length % TA_COLORS.length]!;
      if (tool === 'hline') {
        const drawing: HLineDrawing = {
          id: `ta-${nextId++}`,
          tool,
          points: [chartPoint],
          color,
        };
        setDrawings((prev) => [...prev, drawing]);
        onToolDoneRef.current();
        event.preventDefault();
        return;
      }

      setPending({
        tool,
        start: chartPoint,
        current: chartPoint,
        color,
      });
      activePointerIdRef.current = event.pointerId;
      svg.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (activePointerIdRef.current !== event.pointerId || !pending) return;
      const chartPoint = screenToChart(toLocalPoint(event));
      if (!chartPoint) return;
      setPending((current) => (current ? { ...current, current: chartPoint } : current));
      event.preventDefault();
    };

    const finalizePending = (pointerId: number) => {
      if (activePointerIdRef.current !== pointerId || !pending) return;

      const delta =
        Math.abs(pending.current.time - pending.start.time) +
        Math.abs(pending.current.price - pending.start.price);

      if (delta > 0) {
        const drawing = {
          id: `ta-${nextId++}`,
          tool: pending.tool,
          points: [pending.start, pending.current],
          color: pending.color,
        } as TADrawing;
        setDrawings((prev) => [...prev, drawing]);
      }

      activePointerIdRef.current = null;
      setPending(null);
      onToolDoneRef.current();
    };

    const handlePointerUp = (event: PointerEvent) => {
      finalizePending(event.pointerId);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (activePointerIdRef.current === event.pointerId) {
        activePointerIdRef.current = null;
        setPending(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        activePointerIdRef.current = null;
        setPending(null);
      }
    };

    svg.addEventListener('pointerdown', handlePointerDown);
    svg.addEventListener('pointermove', handlePointerMove);
    svg.addEventListener('pointerup', handlePointerUp);
    svg.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      svg.removeEventListener('pointerdown', handlePointerDown);
      svg.removeEventListener('pointermove', handlePointerMove);
      svg.removeEventListener('pointerup', handlePointerUp);
      svg.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawings.length, pending, paneMetrics]);

  const allDrawings: TADrawing[] = pending
    ? [
        ...drawings,
        {
          id: '__pending',
          tool: pending.tool,
          points: [pending.start, pending.current],
          color: pending.color,
        } as TADrawing,
      ]
    : drawings;

  const interactive = activeTool !== 'none' || pending != null;

  return (
    <svg
      ref={rootRef}
      className="absolute inset-0"
      width="100%"
      height="100%"
      style={{
        zIndex: 7,
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: interactive ? 'crosshair' : 'default',
      }}
    >
      {allDrawings.map((drawing) => {
        switch (drawing.tool) {
          case 'hline':
            return renderHLine(drawing, paneMetrics, chartToScreen, drawing.id === '__pending');
          case 'trendline':
            return renderTrendLine(drawing, chartToScreen, drawing.id === '__pending');
          case 'ray':
            return renderRay(drawing, paneMetrics, chartToScreen, drawing.id === '__pending');
          case 'fib':
            return renderFib(drawing, paneMetrics, chartToScreen, drawing.id === '__pending');
          default:
            return null;
        }
      })}
    </svg>
  );
}

function renderHLine(
  drawing: HLineDrawing,
  metrics: PaneMetrics | null,
  chartToScreen: (point: ChartPoint) => ScreenPoint | null,
  preview: boolean,
) {
  if (!metrics) return null;
  const point = chartToScreen(drawing.points[0]);
  if (!point) return null;

  const label = drawing.points[0].price.toFixed(2);
  return (
    <g key={drawing.id}>
      <line
        x1={metrics.left}
        y1={point.y}
        x2={metrics.left + metrics.width}
        y2={point.y}
        stroke={drawing.color}
        strokeWidth={preview ? 1.2 : 1.5}
        strokeDasharray={preview ? '6 4' : '9 4'}
        opacity={preview ? 0.72 : 0.92}
      />
      <rect
        x={metrics.left + metrics.width - 72}
        y={point.y - 10}
        width="64"
        height="18"
        rx="4"
        fill={drawing.color}
        opacity="0.96"
      />
      <text
        x={metrics.left + metrics.width - 40}
        y={point.y + 3}
        fill="#0d0d0f"
        fontSize="10"
        textAnchor="middle"
        fontWeight="700"
      >
        {label}
      </text>
    </g>
  );
}

function renderTrendLine(
  drawing: TrendLineDrawing,
  chartToScreen: (point: ChartPoint) => ScreenPoint | null,
  preview: boolean,
) {
  const start = chartToScreen(drawing.points[0]);
  const end = chartToScreen(drawing.points[1]);
  if (!start || !end) return null;

  return (
    <g key={drawing.id}>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={drawing.color}
        strokeWidth={preview ? 1.4 : 1.8}
        opacity={preview ? 0.72 : 0.95}
      />
      {renderHandle(start, drawing.color)}
      {renderHandle(end, drawing.color)}
    </g>
  );
}

function renderRay(
  drawing: RayDrawing,
  metrics: PaneMetrics | null,
  chartToScreen: (point: ChartPoint) => ScreenPoint | null,
  preview: boolean,
) {
  if (!metrics) return null;
  const start = chartToScreen(drawing.points[0]);
  const end = chartToScreen(drawing.points[1]);
  if (!start || !end) return null;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return null;
  const extend = metrics.width * 1.5;
  const rayEnd = {
    x: end.x + (dx / length) * extend,
    y: end.y + (dy / length) * extend,
  };

  return (
    <g key={drawing.id}>
      <line
        x1={start.x}
        y1={start.y}
        x2={rayEnd.x}
        y2={rayEnd.y}
        stroke={drawing.color}
        strokeWidth={preview ? 1.4 : 1.8}
        opacity={preview ? 0.72 : 0.95}
      />
      {renderHandle(start, drawing.color)}
      {renderHandle(end, drawing.color)}
    </g>
  );
}

function renderFib(
  drawing: FibDrawing,
  metrics: PaneMetrics | null,
  chartToScreen: (point: ChartPoint) => ScreenPoint | null,
  preview: boolean,
) {
  if (!metrics) return null;
  const start = chartToScreen(drawing.points[0]);
  const end = chartToScreen(drawing.points[1]);
  if (!start || !end) return null;

  return (
    <g key={drawing.id}>
      <rect
        x={metrics.left}
        y={Math.min(start.y, end.y)}
        width={metrics.width}
        height={Math.abs(end.y - start.y)}
        fill={drawing.color}
        opacity={preview ? 0.03 : 0.05}
      />
      {FIB_LEVELS.map((level) => {
        const y = start.y + (end.y - start.y) * level;
        const isBound = level === 0 || level === 1;
        const isKey = level === 0.5 || level === 0.618;

        return (
          <g key={`${drawing.id}-${level}`}>
            <line
              x1={metrics.left}
              y1={y}
              x2={metrics.left + metrics.width}
              y2={y}
              stroke={drawing.color}
              strokeWidth={isBound ? 1.4 : isKey ? 1.1 : 0.9}
              strokeDasharray={isBound ? undefined : '6 4'}
              opacity={preview ? 0.35 : isBound ? 0.8 : isKey ? 0.62 : 0.4}
            />
            <text
              x={metrics.left + 10}
              y={y - 4}
              fill={drawing.color}
              fontSize="10"
            >
              {(level * 100).toFixed(1)}%
            </text>
          </g>
        );
      })}
      {renderHandle(start, drawing.color)}
      {renderHandle(end, drawing.color)}
    </g>
  );
}

function renderHandle(point: ScreenPoint, color: string) {
  return (
    <g>
      <circle cx={point.x} cy={point.y} r="5.5" fill="#0d0d0f" stroke={color} strokeWidth="2" />
      <circle cx={point.x} cy={point.y} r="10" fill={color} opacity="0.08" />
    </g>
  );
}
