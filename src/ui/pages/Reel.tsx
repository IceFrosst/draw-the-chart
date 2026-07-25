import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { computeScore } from '../../scoring/index';
import { computePayout, DEFAULT_PAYOUT_CONFIG } from '../../scoring/payout';

/**
 * Full-screen scroll reel: four live markets, everything freezes on NVDA, the visitor's
 * scroll draws a prediction, the real path answers, and the round settles.
 *
 * The scroll position is the only input. It maps to a single 0..1 progress value; every
 * element derives its own local progress from a window of that value, so the whole reel is
 * scrubbable in both directions and nothing is driven by a timer.
 *
 * The score is not decorative — the drawn path and the realized path are real price series
 * fed through `computeScore`, and the payout comes from `computePayout`. What the page shows
 * is what the engine returns.
 */

/* ────────────────────────────── geometry & helpers ───────────────────────────── */

/** The viewBox height is fixed; its width tracks the container's aspect so the chart fills
 *  the row on a wide desktop and on a narrow phone without letterboxing either. */
const VIEW_H = 620;
const PLOT_L = 70;
const PLOT_T = 96;
const PLOT_B = 470;
const PLOT_PAD_R = 94;
const ANCHOR_FRAC = 0.46; // where "now" sits across the plot
const MIN_VIEW_W = 560;
const MAX_VIEW_W = 2100;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Deterministic noise so every visitor sees the identical reel. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Fractal-ish walk that reads like price rather than static. */
function walk(n: number, seed: number, vol: number, drift: number): number[] {
  const out: number[] = [0];
  for (let i = 1; i < n; i++) {
    const shock =
      (noise(i * 1.7 + seed) - 0.5) * vol +
      (noise(i * 0.31 + seed * 3.3) - 0.5) * vol * 1.9 +
      drift;
    out.push(out[i - 1]! + shock);
  }
  return out;
}


/* ────────────────────────────── the four markets ─────────────────────────────── */

interface Market {
  symbol: string;
  color: string;
  last: number;
  changePct: number;
  /** Normalized 0..1 series across the full plot width. */
  series: number[];
}

const HISTORY_N = 120;

/** NVDA is the hero: this same series becomes the round's history. */
const NVDA_WALK = walk(HISTORY_N, 4.2, 0.9, 0.055);

const MARKETS: Market[] = [
  { symbol: 'AAPL', color: '#8b8b93', last: 232.14, changePct: 0.42, series: walk(HISTORY_N, 11.9, 1.0, -0.02) },
  { symbol: 'NVDA', color: '#d4a85c', last: 178.62, changePct: 1.86, series: NVDA_WALK },
  { symbol: 'BTC', color: '#67c1b4', last: 92442.15, changePct: -0.31, series: walk(HISTORY_N, 27.4, 1.5, 0.02) },
  { symbol: 'OIL', color: '#9a6b5c', last: 71.08, changePct: -1.12, series: walk(HISTORY_N, 5.1, 0.8, -0.05) },
];

/** Normalize a walk into 0..1 so four instruments share one frame. */
function normalize(series: number[]): number[] {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  return series.map((v) => (v - min) / span);
}

const NORMALIZED = MARKETS.map((m) => normalize(m.series));
const NVDA_INDEX = MARKETS.findIndex((m) => m.symbol === 'NVDA');

/* ─────────────────────── the round, in real price space ──────────────────────── */

const ANCHOR_PRICE = 178.62;

/** NVDA history as prices, ending exactly on the anchor. */
const HISTORY_PRICES: number[] = (() => {
  const norm = NORMALIZED[NVDA_INDEX]!;
  const raw = norm.map((v) => 172 + v * 10);
  const shift = ANCHOR_PRICE - raw[raw.length - 1]!;
  return raw.map((p) => p + shift);
})();

/** The thesis: push up, pull back, finish higher. Control points in price space. */
const DRAWN_CONTROL: [number, number][] = [
  [0.0, ANCHOR_PRICE],
  [0.18, ANCHOR_PRICE + 2.1],
  [0.36, ANCHOR_PRICE + 3.4],
  [0.54, ANCHOR_PRICE + 1.6],
  [0.74, ANCHOR_PRICE + 3.9],
  [1.0, ANCHOR_PRICE + 5.2],
];

/** Linear interpolation through the control points. */
function drawnPriceAt(t: number): number {
  const x = clamp01(t);
  for (let i = 0; i < DRAWN_CONTROL.length - 1; i++) {
    const [t0, p0] = DRAWN_CONTROL[i]!;
    const [t1, p1] = DRAWN_CONTROL[i + 1]!;
    if (x >= t0 && x <= t1) return lerp(p0, p1, (x - t0) / (t1 - t0));
  }
  return DRAWN_CONTROL[DRAWN_CONTROL.length - 1]![1];
}

const FUTURE_N = 80;
const DRAWN_PRICES = Array.from({ length: FUTURE_N }, (_, i) => drawnPriceAt(i / (FUTURE_N - 1)));

/**
 * What NVDA actually did: agrees on direction, times the pullback early, and undershoots
 * the last leg. Same skeleton as the drawing, so the picture is consistent with the score.
 */
const ACTUAL_PRICES = Array.from({ length: FUTURE_N }, (_, i) => {
  const t = i / (FUTURE_N - 1);
  const base = drawnPriceAt(Math.min(1, t * 1.08));
  const magnitudeMiss = -1.15 * Math.sin(t * Math.PI);
  const jitter = (noise(i * 5.3) - 0.5) * 0.62 + (noise(i * 13.1) - 0.5) * 0.3;
  return base + magnitudeMiss + jitter;
});

/** Real engine output — not a chosen number. */
const SCORE = computeScore(DRAWN_PRICES, ACTUAL_PRICES);
const STAKE = 250;
const OUTCOME = computePayout(SCORE.total, STAKE);

const COMPONENTS = [
  { label: 'Direction', earned: SCORE.direction, max: 40 },
  { label: 'Magnitude', earned: SCORE.magnitude, max: 30 },
  { label: 'Turning points', earned: SCORE.turningPoints, max: 20 },
  { label: 'Volatility', earned: SCORE.volatility, max: 10 },
];

/* ───────────────────────────── price → screen space ──────────────────────────── */

const ALL_PRICES = [...HISTORY_PRICES, ...DRAWN_PRICES, ...ACTUAL_PRICES];
const P_MIN = Math.min(...ALL_PRICES) - 1.4;
const P_MAX = Math.max(...ALL_PRICES) + 1.4;

const priceToY = (p: number) => PLOT_B - ((p - P_MIN) / (P_MAX - P_MIN)) * (PLOT_B - PLOT_T);

function polyline(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
}

/** All x-geometry for a given viewBox width. */
function buildLayout(viewW: number) {
  const plotR = viewW - PLOT_PAD_R;
  const anchorX = PLOT_L + (plotR - PLOT_L) * ANCHOR_FRAC;
  const futureToX = (t: number) => anchorX + (plotR - anchorX) * t;
  return {
    plotR,
    anchorX,
    futureToX,
    /** History spans the full plot until the anchor arrives, then compresses left so the
     *  future zone has somewhere to open. */
    historyToX: (i: number, right: number) => PLOT_L + ((right - PLOT_L) * i) / (HISTORY_N - 1),
    drawnPath: polyline(DRAWN_PRICES.map((p, i) => [futureToX(i / (FUTURE_N - 1)), priceToY(p)])),
    actualPath: polyline(ACTUAL_PRICES.map((p, i) => [futureToX(i / (FUTURE_N - 1)), priceToY(p)])),
    drawnNodes: DRAWN_CONTROL.map(([t, p]) => [futureToX(t), priceToY(p)] as [number, number]),
  };
}

/**
 * One-shot 0→1 ramp on mount. The four markets are meant to be streaming when the page
 * lands; without this the hero sits on an empty chart until the visitor scrolls.
 */
function useIntroProgress(enabled: boolean, durationMs = 1600): number {
  const [t, setT] = useState(enabled ? 0 : 1);
  useEffect(() => {
    if (!enabled) {
      setT(1);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const v = clamp01((now - start) / durationMs);
      setT(v);
      if (v < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [enabled, durationMs]);
  return t;
}

/** True on narrow viewports, where the header wordmark and the ticker would collide. */
function useIsNarrow(breakpoint = 620): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setNarrow(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpoint]);
  return narrow;
}

/** Track a container's aspect so the viewBox can match it. */
function useViewWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [viewW, setViewW] = useState(1200);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (height <= 0) return;
      const next = Math.round((width / height) * VIEW_H);
      setViewW(Math.max(MIN_VIEW_W, Math.min(MAX_VIEW_W, next)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return viewW;
}

/* ───────────────────────────────── the beats ─────────────────────────────────── */

const BEATS = [
  {
    kicker: 'Live',
    line: 'Every market is a shape.',
    sub: 'Imagine TradingView meets Polymarket. You bet on the shape of a price path instead of a yes/no outcome.',
  },
  { kicker: 'Focus', line: 'Pick one.' },
  { kicker: 'NVDA', line: 'The last two hours.' },
  { kicker: 'Locked', line: 'The chart stops here.' },
  { kicker: 'Your move', line: 'Draw what happens next.' },
  { kicker: 'Committed', line: 'That drawing is your position.' },
  { kicker: 'Waiting', line: 'Now the market answers.' },
  { kicker: 'Reality', line: 'This is what it did.' },
  { kicker: 'Scored', line: 'Paid on how close you got.' },
] as const;

/* ────────────────────────────── scroll plumbing ──────────────────────────────── */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function useScrollProgress(ref: React.RefObject<HTMLElement | null>, enabled: boolean): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      setProgress(clamp01(-rect.top / scrollable));
    };
    const request = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    measure();
    return () => {
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref, enabled]);

  return progress;
}

/* ──────────────────────────────── component ──────────────────────────────────── */

export function Reel() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const viewW = useViewWidth(chartRef);
  const narrow = useIsNarrow();
  const L = useMemo(() => buildLayout(viewW), [viewW]);
  const reduced = usePrefersReducedMotion();
  const intro = useIntroProgress(!reduced);
  const raw = useScrollProgress(sectionRef, !reduced);
  const p = reduced ? 1 : raw;

  // Animation windows, deliberately overlapping so beats hand off rather than cut.
  // The intro ramp and the scroll both feed the stream-in; whichever is further wins.
  const streamIn = Math.max(easeOut(intro), easeOut(seg(p, 0.0, 0.06))); // four markets draw in
  const freeze = seg(p, 0.11, 0.15); // the stop
  const isolate = easeInOut(seg(p, 0.15, 0.23)); // three lines leave
  const zoom = easeInOut(seg(p, 0.2, 0.31)); // NVDA rescales to price space
  const anchorIn = easeOut(seg(p, 0.31, 0.38)); // now-line + future zone
  const drawIn = easeInOut(seg(p, 0.4, 0.56)); // the scroll draws
  const lockIn = easeOut(seg(p, 0.57, 0.64)); // control points snap
  const holdIn = seg(p, 0.64, 0.7); // the pause
  const revealIn = easeInOut(seg(p, 0.71, 0.83)); // reality arrives
  const scoreIn = easeOut(seg(p, 0.84, 0.93)); // components tally
  const payoutIn = easeOut(seg(p, 0.92, 0.995)); // money lands

  const beatIndex = Math.min(
    BEATS.length - 1,
    p < 0.11 ? 0
      : p < 0.2 ? 1
        : p < 0.31 ? 2
          : p < 0.4 ? 3
            : p < 0.57 ? 4
              : p < 0.64 ? 5
                : p < 0.71 ? 6
                  : p < 0.84 ? 7
                    : 8,
  );
  const beat = BEATS[beatIndex]!;

  const scoreShown = SCORE.total * scoreIn;
  const multiplierShown = lerp(1, OUTCOME.multiplier, payoutIn);
  const profitShown = OUTCOME.profit * payoutIn;

  const histRight = lerp(L.plotR, L.anchorX, anchorIn);
  const hx = (i: number) => L.historyToX(i, histRight);

  // NVDA travels from its shared normalized band to full price space as `zoom` runs.
  const nvdaBandY = (v: number) => lerp(PLOT_B - 26, PLOT_T + 26, v);
  const nvdaPath = useMemo(() => {
    const norm = NORMALIZED[NVDA_INDEX]!;
    const pts = norm.map((v, i) => {
      const bandY = nvdaBandY(v);
      const priceY = priceToY(HISTORY_PRICES[i]!);
      return [hx(i), lerp(bandY, priceY, zoom)] as [number, number];
    });
    return polyline(pts);
  }, [zoom, histRight, L]);

  const flash = freeze > 0 && freeze < 1 ? Math.sin(freeze * Math.PI) * 0.5 : 0;

  return (
    <div
      ref={sectionRef}
      style={{ position: 'relative', height: reduced ? 'auto' : `${BEATS.length * 100}svh` }}
    >
      <div
        style={{
          position: reduced ? 'static' : 'sticky',
          top: 0,
          height: reduced ? 'auto' : '100svh',
          overflow: 'hidden',
          background: 'var(--bg-primary)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* The chart and the copy get their own rows. An earlier version had the SVG
            full-bleed behind centred text, which collided the moment the score appeared. */}
        {/* wordmark — text only, nothing to click until the end */}
        <div
          className="dtc-data"
          style={{
            position: 'absolute',
            top: 'clamp(18px, 3vh, 34px)',
            left: 'clamp(18px, 4vw, 52px)',
            fontSize: 12,
            letterSpacing: '3px',
            color: 'var(--text-muted)',
            zIndex: 3,
            opacity: narrow ? 0 : 1,
          }}
        >
          DRAW THE CHART
        </div>

        {/* ticker tape */}
        <div
          style={{
            position: 'absolute',
            top: 'clamp(14px, 3vh, 30px)',
            right: 'clamp(18px, 4vw, 52px)',
            display: 'flex',
            gap: 'clamp(10px, 2vw, 26px)',
            zIndex: 3,
          }}
        >
          {MARKETS.map((m, i) => {
            const alive = i === NVDA_INDEX ? 1 : 1 - isolate;
            const tick = noise(Math.floor(p * 260) + i * 9.3) - 0.5;
            const shown = m.last * (1 + tick * 0.0006 * (1 - freeze));
            return (
              <div
                key={m.symbol}
                className="dtc-data"
                style={{
                  opacity: alive * streamIn,
                  transform: `translateY(${(1 - alive) * -8}px)`,
                  textAlign: 'right',
                  minWidth: 62,
                  transition: 'opacity 120ms linear',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: 1.4, color: m.color }}>{m.symbol}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {shown.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* the chart */}
        <div
          ref={chartRef}
          style={{ flex: 1, minHeight: 0, position: 'relative', paddingTop: 'clamp(52px, 9vh, 88px)' }}
        >
        <svg
          viewBox={`0 0 ${viewW} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block' }}
          role="img"
          aria-label="An illustrative NVDA round: a drawn price path scored against the realized path."
        >
          <defs>
            <linearGradient id="reel-zone" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(212,168,92,0.14)" />
              <stop offset="100%" stopColor="rgba(212,168,92,0.015)" />
            </linearGradient>
            <linearGradient id="reel-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(212,168,92,0.16)" />
              <stop offset="100%" stopColor="rgba(212,168,92,0)" />
            </linearGradient>
            <filter id="reel-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {[PLOT_T, 190, 283, 376, PLOT_B].map((y) => (
            <line
              key={y}
              x1={PLOT_L}
              y1={y}
              x2={L.plotR}
              y2={y}
              stroke="rgba(255,255,255,0.032)"
              opacity={streamIn}
            />
          ))}

          {/* the three that leave */}
          {MARKETS.map((m, i) => {
            if (i === NVDA_INDEX) return null;
            const norm = NORMALIZED[i]!;
            // Compress each into its own lane so four overlapping walks stay legible.
            const lane = (i - NVDA_INDEX) * 0.13;
            const d = polyline(
              norm.map((v, j) => [hx(j), nvdaBandY(clamp01(0.5 + (v - 0.5) * 0.72 + lane))]),
            );
            const alive = 1 - isolate;
            if (alive <= 0.01) return null;
            const tipIndex = Math.floor(clamp01(streamIn) * (HISTORY_N - 1));
            return (
              <g key={m.symbol} opacity={alive}>
                <path
                  d={d}
                  fill="none"
                  stroke={m.color}
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset={1 - streamIn}
                  style={{ transform: `translateY(${isolate * 26 * (i - NVDA_INDEX)}px)` }}
                />
                {streamIn > 0.02 && streamIn < 0.999 && (
                  <circle
                    cx={hx(tipIndex)}
                    cy={nvdaBandY(clamp01(0.5 + (norm[tipIndex]! - 0.5) * 0.72 + lane))}
                    r="3"
                    fill={m.color}
                  />
                )}
              </g>
            );
          })}

          {/* future zone */}
          <rect
            x={L.anchorX}
            y={PLOT_T - 22}
            width={(L.plotR - L.anchorX) * anchorIn}
            height={PLOT_B - PLOT_T + 52}
            fill="url(#reel-zone)"
          />
          <line
            x1={L.anchorX}
            y1={PLOT_T - 22}
            x2={L.anchorX}
            y2={PLOT_B + 30}
            stroke="rgba(255,255,255,0.3)"
            strokeDasharray="4 5"
            opacity={anchorIn}
          />
          <text
            x={L.anchorX - 10}
            y={PLOT_B + 26}
            textAnchor="end"
            fill="var(--text-muted)"
            fontSize="11"
            fontFamily="JetBrains Mono, monospace"
            letterSpacing="1.6"
            opacity={anchorIn}
          >
            NOW
          </text>

          {/* NVDA history — the hero line */}
          <path
            d={nvdaPath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={lerp(1.7, 2.6, zoom)}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - streamIn}
          />

          {/* anchor */}
          <circle
            cx={L.anchorX}
            cy={priceToY(ANCHOR_PRICE)}
            r={lerp(0, 6.5, anchorIn)}
            fill="var(--bg-primary)"
            stroke="var(--accent)"
            strokeWidth="2.4"
          />
          {anchorIn > 0.4 && (
            <text
              x={L.anchorX - 14}
              y={priceToY(ANCHOR_PRICE) - 16}
              textAnchor="end"
              fill="var(--accent)"
              fontSize="12"
              fontFamily="JetBrains Mono, monospace"
              opacity={anchorIn * (1 - seg(drawIn, 0.05, 0.3))}
            >
              ${ANCHOR_PRICE.toFixed(2)}
            </text>
          )}

          {/* Area fill waits for the stroke to finish: closing a partial path left a hard
              vertical edge that tracked the pen. */}
          <path
            d={`${L.drawnPath} L ${L.plotR} ${PLOT_B} L ${L.anchorX} ${PLOT_B} Z`}
            fill="url(#reel-fill)"
            stroke="none"
            opacity={seg(drawIn, 0.92, 1) * 0.9}
          />
          <path
            d={L.drawnPath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={lerp(3.4, 2.8, lockIn)}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - drawIn}
            filter={drawIn > 0 && drawIn < 1 ? 'url(#reel-glow)' : undefined}
          />
          {drawIn > 0.01 && drawIn < 0.995 && (
            <PenTip d={L.drawnPath} t={drawIn} />
          )}

          {/* control points snap on commit */}
          {L.drawnNodes.map(([x, y], i) => {
            const a = clamp01(lockIn * L.drawnNodes.length - i);
            if (a <= 0) return null;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={lerp(9, 4, easeOut(a))}
                fill="var(--bg-primary)"
                stroke="var(--accent)"
                strokeWidth="1.8"
                opacity={a}
              />
            );
          })}

          {/* reality */}
          <path
            d={L.actualPath}
            fill="none"
            stroke="var(--teal)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - revealIn}
          />

          <g opacity={revealIn}>
            <line x1={L.plotR - 190} y1={PLOT_B + 42} x2={L.plotR - 168} y2={PLOT_B + 42} stroke="var(--accent)" strokeWidth="2.6" />
            <text x={L.plotR - 160} y={PLOT_B + 46} fill="var(--text-muted)" fontSize="11" fontFamily="JetBrains Mono, monospace">
              you
            </text>
            <line x1={L.plotR - 92} y1={PLOT_B + 42} x2={L.plotR - 70} y2={PLOT_B + 42} stroke="var(--teal)" strokeWidth="2.6" />
            <text x={L.plotR - 62} y={PLOT_B + 46} fill="var(--text-muted)" fontSize="11" fontFamily="JetBrains Mono, monospace">
              NVDA
            </text>
          </g>
        </svg>
        </div>

        {/* freeze flash */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#fff',
            opacity: flash * 0.07,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        {/* caption */}
        <div
          style={{
            flexShrink: 0,
            minHeight: 'clamp(200px, 32svh, 300px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            textAlign: 'center',
            padding: '0 24px clamp(26px, 5vh, 46px)',
            zIndex: 3,
          }}
        >
          <div
            className="dtc-data"
            style={{ fontSize: 11, letterSpacing: 3, color: 'var(--accent)', marginBottom: 10 }}
          >
            {beat.kicker.toUpperCase()}
          </div>
          <h1
            className="dtc-display"
            style={{
              fontSize: 'clamp(26px, 5.2vw, 60px)',
              lineHeight: 1.06,
              letterSpacing: '-0.5px',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {beat.line}
          </h1>

          {/* The positioning line rides the opening beat and clears out once the reel
              starts moving, so later beats stay cinematic. */}
          {'sub' in beat && beat.sub && (
            <p
              style={{
                maxWidth: 640,
                margin: '14px auto 0',
                fontSize: 'clamp(13px, 1.6vw, 17px)',
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
                opacity: 1 - seg(p, 0.05, 0.1),
              }}
            >
              {beat.sub}
            </p>
          )}

          {/* stake, once committed */}
          <div
            className="dtc-data"
            style={{
              marginTop: 18,
              display: 'flex',
              gap: 'clamp(16px, 4vw, 44px)',
              justifyContent: 'center',
              opacity: lockIn,
              fontSize: 'clamp(11px, 1.5vw, 13px)',
              color: 'var(--text-muted)',
            }}
          >
            <span>stake ${STAKE}</span>
            <span>horizon 2h</span>
            <span>max ${(STAKE * DEFAULT_PAYOUT_CONFIG.maxMultiplier).toLocaleString()}</span>
            <span style={{ color: holdIn > 0.5 ? 'var(--accent)' : undefined }}>
              {holdIn > 0.5 ? 'committed' : 'committing'}
            </span>
          </div>

          {/* score + payout */}
          <div
            style={{
              marginTop: 22,
              opacity: scoreIn,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              className="dtc-data"
              style={{
                fontSize: 'clamp(38px, 7vw, 76px)',
                fontWeight: 600,
                lineHeight: 1,
                color: scoreShown >= 60 ? 'var(--green)' : 'var(--text-primary)',
              }}
            >
              {scoreShown.toFixed(1)}
              <span style={{ fontSize: '0.3em', color: 'var(--text-muted)' }}> / 100</span>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 'clamp(10px, 2.4vw, 30px)',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              {COMPONENTS.map((c, i) => {
                const fill = clamp01(scoreIn * COMPONENTS.length - i);
                return (
                  <div key={c.label} style={{ minWidth: 92 }}>
                    <div
                      className="dtc-data"
                      style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}
                    >
                      {c.label} {(c.earned * fill).toFixed(1)}
                    </div>
                    <div style={{ height: 2, background: 'var(--bg-tertiary)', borderRadius: 2 }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${(c.earned / c.max) * fill * 100}%`,
                          background: 'var(--accent)',
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="dtc-data"
              style={{
                opacity: payoutIn,
                fontSize: 'clamp(16px, 2.6vw, 26px)',
                color: 'var(--green)',
                display: 'flex',
                gap: 'clamp(12px, 3vw, 28px)',
              }}
            >
              <span>{multiplierShown.toFixed(2)}x</span>
              <span>
                {profitShown >= 0 ? '+' : '−'}${Math.abs(profitShown).toFixed(0)}
              </span>
            </div>
          </div>

          {/* the only clickable thing on the page */}
          {payoutIn > 0.9 && (
            <Link
              to="/play"
              style={{
                display: 'inline-block',
                marginTop: 26,
                padding: '13px 30px',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                borderRadius: 6,
                background: 'var(--accent)',
                color: '#120d09',
              }}
            >
              Test now
            </Link>
          )}
        </div>

        {/* scroll hint, first beat only */}
        <div
          className="dtc-data"
          style={{
            position: 'absolute',
            bottom: 'clamp(10px, 2vh, 22px)',
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 10,
            letterSpacing: 3,
            color: 'var(--text-muted)',
            opacity: (1 - seg(p, 0.0, 0.05)) * 0.8,
            zIndex: 3,
          }}
        >
          SCROLL
        </div>

        {/* progress + disclosure */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 3 }}>
          <div style={{ height: 2, background: 'var(--accent)', width: `${p * 100}%` }} />
        </div>
        <div
          className="dtc-data"
          style={{
            position: 'absolute',
            bottom: 'clamp(10px, 2vh, 22px)',
            right: 'clamp(18px, 4vw, 52px)',
            fontSize: 9,
            letterSpacing: 1.2,
            color: 'var(--text-muted)',
            opacity: 0.55,
            zIndex: 3,
          }}
        >
          ILLUSTRATIVE · SANDBOX
        </div>
      </div>
    </div>
  );
}

/** Marker that rides the drawn path, following the real SVG geometry. */
function PenTip({ d, t }: { d: string; t: number }) {
  const ref = useRef<SVGPathElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const path = ref.current;
    if (!path) return;
    const point = path.getPointAtLength(path.getTotalLength() * clamp01(t));
    setPos({ x: point.x, y: point.y });
  }, [d, t]);

  return (
    <>
      <path ref={ref} d={d} fill="none" stroke="none" />
      {pos && (
        <>
          <circle cx={pos.x} cy={pos.y} r="15" fill="rgba(212,168,92,0.14)" />
          <circle cx={pos.x} cy={pos.y} r="5" fill="var(--accent)" />
        </>
      )}
    </>
  );
}
