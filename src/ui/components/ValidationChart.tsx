/**
 * Chart for the validation tool — shows candlestick history + two prediction overlays.
 * Lighter than DrawingChart: read-only, no drawing interaction.
 */

import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  LineSeries,
  CandlestickSeries,
  LineStyle,
  type IChartApi,
  type Time,
} from 'lightweight-charts';

interface ValidationChartProps {
  /** Historical prices (1 per minute) */
  historyPrices: number[];
  /** Actual future prices (revealed after voting) */
  actualPrices?: number[];
  /** Prediction A prices */
  predictionA: number[];
  /** Prediction B prices */
  predictionB: number[];
  /** Base timestamp (unix seconds) for time axis — defaults to arbitrary */
  baseTime?: number;
  /** Whether to show the actual future line */
  showActual?: boolean;
  /** Chart height */
  height?: number;
}

const CHART_BG = '#0d0d0f';
const GRID_COLOR = 'rgba(255, 255, 255, 0.03)';
const TEXT_COLOR = '#52525b';
const COLOR_A = '#d4853a'; // accent orange
const COLOR_B = '#67c1b4'; // teal
const COLOR_ACTUAL = '#a1a1aa'; // gray
const UP_COLOR = '#22c55e';
const DOWN_COLOR = '#ef4444';

export function ValidationChart({
  historyPrices,
  actualPrices,
  predictionA,
  predictionB,
  baseTime = 1700000000,
  showActual = false,
  height = 400,
}: ValidationChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || historyPrices.length === 0) return;
    container.innerHTML = '';

    const chartHeight = container.clientHeight || height;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: chartHeight,
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: TEXT_COLOR,
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      crosshair: {
        vertLine: { color: 'rgba(255, 255, 255, 0.1)', style: LineStyle.Dashed, width: 1 },
        horzLine: { color: 'rgba(255, 255, 255, 0.1)', style: LineStyle.Dashed, width: 1 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
        timeVisible: true,
        secondsVisible: false,
        borderVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.06)',
        borderVisible: true,
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true },
    });

    // Build candlestick data from 1-minute prices (group into 5-min candles for readability)
    const candleStep = 5;
    const candleData: Array<{ time: Time; open: number; high: number; low: number; close: number }> = [];
    for (let i = 0; i + candleStep <= historyPrices.length; i += candleStep) {
      const slice = historyPrices.slice(i, i + candleStep);
      const open = i === 0 ? slice[0]! : candleData[candleData.length - 1]?.close ?? slice[0]!;
      const close = slice[slice.length - 1]!;
      candleData.push({
        time: (baseTime + i * 60) as Time,
        open,
        high: Math.max(open, ...slice),
        low: Math.min(open, ...slice),
        close,
      });
    }

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      borderVisible: false,
      wickVisible: true,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    candleSeries.setData(candleData);

    // Prediction time starts after history
    const predStartTime = baseTime + historyPrices.length * 60;

    // Prediction A line (orange)
    const seriesA = chart.addSeries(LineSeries, {
      color: COLOR_A,
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    seriesA.setData(
      predictionA.map((p, i) => ({
        time: (predStartTime + i * 60) as Time,
        value: p,
      })),
    );

    // Prediction B line (teal)
    const seriesB = chart.addSeries(LineSeries, {
      color: COLOR_B,
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    seriesB.setData(
      predictionB.map((p, i) => ({
        time: (predStartTime + i * 60) as Time,
        value: p,
      })),
    );

    // Actual future line (gray dashed — only after reveal)
    if (showActual && actualPrices && actualPrices.length > 0) {
      const actualSeries = chart.addSeries(LineSeries, {
        color: COLOR_ACTUAL,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
      actualSeries.setData(
        actualPrices.map((p, i) => ({
          time: (predStartTime + i * 60) as Time,
          value: p,
        })),
      );
    }

    // Fit visible range to show predictions
    chart.timeScale().fitContent();

    chartRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [historyPrices, predictionA, predictionB, actualPrices, showActual, baseTime, height]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 200,
        background: CHART_BG,
        overflow: 'hidden',
      }}
    />
  );
}
