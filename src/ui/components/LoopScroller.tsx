import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { computePayout, generatePayoutCurve, getBreakEvenScore } from '../../scoring/payout';

/**
 * Scroll-driven walkthrough of a full round: anchor, stake, draw, lock, reveal, score.
 *
 * The section is `STAGES` viewports tall with a sticky visual pane inside it. Scroll
 * position through the section becomes a single 0..1 progress value, and every animated
 * element derives its own local 0..1 from a window of that value (see `seg`). Nothing is
 * keyframed on a timer, so the animation is fully scrubbable in both directions.
 *
 * Under `prefers-reduced-motion` the whole thing collapses to a static, fully-revealed
 * summary — no sticky positioning and no scroll listener.
 */

const STAGES = 6;
const VIEW_W = 720;
const VIEW_H = 420;

/* ---------- math helpers ---------- */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Local 0..1 progress for the window [start, end] of a global progress value. */
const seg = (p: number, start: number, end: number) => clamp01((p - start) / (end - start));

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Deterministic [0,1) noise so the demo round is identical on every load. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/* ---------- demo round geometry ---------- */

const ANCHOR_X = 300;
const ANCHOR_Y = 268;
const END_X = 664;

interface Candle {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
  up: boolean;
}

/** History candles walking up to the anchor. */
const CANDLES: Candle[] = (() => {
  const out: Candle[] = [];
  const count = 24;
  const step = (ANCHOR_X - 34) / count;
  let level = 214;
  for (let i = 0; i < count; i++) {
    // Trend gently downward into the anchor with enough range to read as a chart.
    const drift = (noise(i * 3.1) - 0.42) * 34;
    const open = level;
    const close = level + drift;
    const wick = 4 + noise(i * 7.7) * 14;
    out.push({
      x: 22 + i * step,
      open,
      close,
      high: Math.min(open, close) - wick,
      low: Math.max(open, close) + wick,
      up: close <= open,
    });
    level = close;
  }
  // Land the final close exactly on the anchor so the drawing starts from it.
  const shift = ANCHOR_Y - out[out.length - 1]!.close;
  return out.map((c) => ({
    ...c,
    open: c.open + shift,
    close: c.close + shift,
    high: c.high + shift,
    low: c.low + shift,
  }));
})();

/**
 * The player's thesis as control points: run up, pull back, finish higher. The drawn path
 * and the realized path are both derived from these, so the picture stays consistent with
 * the score the panel reports — a good-but-imperfect read, not a lucky one.
 */
const CONTROL_POINTS: [number, number][] = [
  [ANCHOR_X, ANCHOR_Y],
  [372, 214],
  [438, 176],
  [502, 214],
  [566, 168],
  [END_X, 140],
];

/** Catmull-Rom through the control points, emitted as cubic beziers. */
function smoothPath(points: [number, number][], tension = 0.5): string {
  if (points.length < 2) return '';
  const d: string[] = [`M ${points[0]![0]} ${points[0]![1]}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension * 2;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension * 2;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension * 2;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension * 2;
    d.push(`C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0]} ${p2[1]}`);
  }
  return d.join(' ');
}

const PREDICTION = smoothPath(CONTROL_POINTS);

/** Linear interpolation along the control polyline — the skeleton both paths share. */
function alongPrediction(t: number): number {
  const span = END_X - ANCHOR_X;
  const x = ANCHOR_X + span * t;
  for (let i = 0; i < CONTROL_POINTS.length - 1; i++) {
    const [x0, y0] = CONTROL_POINTS[i]!;
    const [x1, y1] = CONTROL_POINTS[i + 1]!;
    if (x >= x0 && x <= x1) return lerp(y0, y1, (x - x0) / (x1 - x0));
  }
  return CONTROL_POINTS[CONTROL_POINTS.length - 1]![1];
}

/**
 * What the market actually did. Tracks the thesis — same direction, same turns — but
 * arrives early on the pullback and undershoots the final leg, which is what leaves
 * magnitude at 22/30 rather than full marks.
 */
const ACTUAL_POINTS: [number, number][] = (() => {
  const pts: [number, number][] = [];
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Slight timing lead, so turns land near — not on — the drawn ones.
    const base = alongPrediction(Math.min(1, t * 1.06));
    const magnitudeMiss = 16 * Math.sin(t * Math.PI); // widest gap mid-round
    const jitter = (noise(i * 5.3) - 0.5) * 15 + (noise(i * 11.7) - 0.5) * 7;
    pts.push([lerp(ANCHOR_X, END_X, t), base + magnitudeMiss + jitter]);
  }
  pts[0] = [ANCHOR_X, ANCHOR_Y];
  return pts;
})();

const ACTUAL_PATH = ACTUAL_POINTS.map(([x, y], i) =>
  `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`,
).join(' ');

/* ---------- the demo round's real numbers ---------- */

const COMPONENTS = [
  { label: 'Direction', earned: 31.2, max: 40 },
  { label: 'Magnitude', earned: 22.0, max: 30 },
  { label: 'Turning Pts', earned: 17.4, max: 20 },
  { label: 'Volatility', earned: 7.8, max: 10 },
] as const;

const TOTAL = COMPONENTS.reduce((sum, c) => sum + c.earned, 0);
const STAKE = 100;
const OUTCOME = computePayout(TOTAL, STAKE);
const BREAK_EVEN = getBreakEvenScore();

const STEPS = [
  {
    tag: 'Round opens',
    title: 'Every round starts at a locked price.',
    body: 'You see the chart up to that moment and nothing after it. No one — including us — knows what comes next.',
  },
  {
    tag: 'Your terms',
    title: 'Pick a horizon. Pick a stake.',
    body: 'Fifteen minutes to seven days. The maximum you can win is published before you commit a cent.',
  },
  {
    tag: 'The input',
    title: 'Draw what happens next.',
    body: 'Not up or down. The whole path — where it runs, where it turns, how hard it moves.',
  },
  {
    tag: 'Locked',
    title: 'Your drawing becomes the position.',
    body: 'The stroke is normalized into control points and committed. From here it cannot be edited, only settled.',
  },
  {
    tag: 'Settlement',
    title: 'The market answers.',
    body: 'The real path arrives and lands on top of yours. This is the moment the whole product exists for.',
  },
  {
    tag: 'Payout',
    title: "You're paid on how close you got.",
    body: 'Four components, one score, one published curve. No discretion, no review — the same inputs always pay the same.',
  },
] as const;

/* ---------- scroll plumbing ---------- */

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

/**
 * Progress of `ref` through the viewport, 0 when its top hits the top of the screen and
 * 1 when its bottom does. Reads layout inside a rAF and only while the section is on
 * screen, so idle scrolling elsewhere on the page costs nothing.
 */
function useScrollProgress(ref: React.RefObject<HTMLElement | null>, enabled: boolean): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let frame = 0;
    let visible = false;

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

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        if (visible) request();
      },
      { rootMargin: '96px' },
    );
    observer.observe(el);

    const onScroll = () => {
      if (visible) request();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', request);
    measure();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', request);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref, enabled]);

  return progress;
}

/* ---------- component ---------- */

export function LoopScroller() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const raw = useScrollProgress(sectionRef, !reduced);
  const p = reduced ? 1 : raw;

  const curve = useMemo(() => generatePayoutCurve(undefined, 120), []);

  // Animation windows. Overlapping ranges are intentional — each beat starts before the
  // previous one settles so the sequence reads as one motion.
  const historyIn = easeOut(seg(p, 0.0, 0.1));
  const zoneIn = easeOut(seg(p, 0.07, 0.16));
  const termsIn = easeOut(seg(p, 0.17, 0.28));
  const drawIn = easeInOut(seg(p, 0.3, 0.5));
  const lockIn = easeOut(seg(p, 0.5, 0.6));
  const revealIn = easeInOut(seg(p, 0.62, 0.78));
  const scoreIn = easeOut(seg(p, 0.78, 0.9));
  const payoutIn = easeOut(seg(p, 0.88, 0.99));

  const stepIndex = Math.min(STEPS.length - 1, Math.floor(p * STAGES));

  const stakeShown = Math.round(lerp(0, STAKE, termsIn) / 5) * 5;
  const scoreShown = TOTAL * scoreIn;
  const multiplierShown = lerp(1, OUTCOME.multiplier, payoutIn);
  const profitShown = OUTCOME.profit * payoutIn;

  // Where the score sits on the payout curve, for the marker at the end.
  const curveX = (score: number) => 24 + (score / 100) * 176;
  const curveY = (multiplier: number) => {
    const min = Math.log(0.4);
    const max = Math.log(25);
    return 92 - ((Math.log(Math.max(0.4, multiplier)) - min) / (max - min)) * 74;
  };
  const curvePath = curve
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${curveX(pt.score).toFixed(1)} ${curveY(pt.multiplier).toFixed(1)}`)
    .join(' ');

  return (
    <section
      ref={sectionRef}
      aria-label="How a round works"
      style={{ position: 'relative', height: reduced ? 'auto' : `${STAGES * 100}svh` }}
    >
      <div
        className="flex flex-col justify-center px-4"
        style={{
          position: reduced ? 'static' : 'sticky',
          top: 0,
          minHeight: reduced ? undefined : '100svh',
          paddingTop: reduced ? 24 : 56,
          paddingBottom: 32,
          overflow: 'hidden',
        }}
      >
        <div className="w-full max-w-5xl mx-auto">
          {/* progress rail */}
          <div className="flex items-center gap-2 mb-4" aria-hidden="true">
            {STEPS.map((step, i) => (
              <div key={step.tag} className="flex-1">
                <div
                  style={{
                    height: 2,
                    borderRadius: 2,
                    background:
                      i < stepIndex || reduced
                        ? 'var(--accent)'
                        : i === stepIndex
                          ? `linear-gradient(to right, var(--accent) ${
                              (p * STAGES - stepIndex) * 100
                            }%, var(--border-strong) 0%)`
                          : 'var(--border)',
                    transition: 'background 120ms linear',
                  }}
                />
              </div>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_360px] items-start">
            {/* ---------- the chart ---------- */}
            <div className="dtc-panel p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="dtc-eyebrow">BTC/USDT · 1h round</span>
                <span
                  className="dtc-data text-[11px] px-2 py-0.5 rounded"
                  style={{
                    background: lockIn > 0.6 ? 'var(--accent-soft)' : 'transparent',
                    color: lockIn > 0.6 ? 'var(--accent)' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    transition: 'color 200ms, background 200ms',
                  }}
                >
                  {scoreIn > 0.05
                    ? 'SCORED'
                    : revealIn > 0.02
                      ? 'SETTLING'
                      : lockIn > 0.6
                        ? 'LOCKED'
                        : drawIn > 0.02
                          ? 'DRAWING'
                          : 'OPEN'}
                </span>
              </div>

              <svg
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                className="w-full"
                preserveAspectRatio="xMidYMid meet"
                // Cap the height so the whole sticky pane still fits a short viewport.
                style={{
                  display: 'block',
                  borderRadius: 4,
                  background: 'var(--bg-primary)',
                  maxHeight: 'min(40svh, 420px)',
                }}
                role="img"
                aria-label="A drawn prediction path compared against the realized BTC price path"
              >
                <defs>
                  <linearGradient id="loop-zone" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgba(212,168,92,0.13)" />
                    <stop offset="100%" stopColor="rgba(212,168,92,0.02)" />
                  </linearGradient>
                  <filter id="loop-glow" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {[80, 140, 200, 260, 320].map((y) => (
                  <line key={y} x1="0" y1={y} x2={VIEW_W} y2={y} stroke="rgba(255,255,255,0.035)" />
                ))}

                {/* future zone */}
                <rect
                  x={ANCHOR_X}
                  y="0"
                  width={(END_X - ANCHOR_X + 24) * zoneIn}
                  height={VIEW_H}
                  fill="url(#loop-zone)"
                />
                <line
                  x1={ANCHOR_X}
                  y1="0"
                  x2={ANCHOR_X}
                  y2={VIEW_H}
                  stroke="rgba(255,255,255,0.22)"
                  strokeDasharray="4 4"
                  opacity={zoneIn}
                />
                <text
                  x={ANCHOR_X - 8}
                  y={VIEW_H - 10}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  letterSpacing="1"
                  opacity={zoneIn}
                >
                  NOW
                </text>

                {/* history candles */}
                {CANDLES.map((c, i) => {
                  const appear = clamp01(historyIn * CANDLES.length - i);
                  if (appear <= 0) return null;
                  const top = Math.min(c.open, c.close);
                  const height = Math.max(1.5, Math.abs(c.close - c.open));
                  const color = c.up ? 'var(--green)' : 'var(--red)';
                  return (
                    <g key={i} opacity={appear * 0.85}>
                      <line x1={c.x} y1={c.high} x2={c.x} y2={c.low} stroke={color} strokeWidth="1" />
                      <rect x={c.x - 3} y={top} width="6" height={height} fill={color} rx="0.5" />
                    </g>
                  );
                })}

                {/* the drawn path */}
                <path
                  d={PREDICTION}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={lockIn > 0.5 ? 2.6 : 3}
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset={1 - drawIn}
                  filter={drawIn > 0 && drawIn < 1 ? 'url(#loop-glow)' : undefined}
                />

                {/* pen tip while drawing */}
                {drawIn > 0.01 && drawIn < 0.995 && (
                  <PenTip d={PREDICTION} t={drawIn} />
                )}

                {/* control points snap in on lock */}
                {CONTROL_POINTS.map(([x, y], i) => {
                  const appear = clamp01(lockIn * CONTROL_POINTS.length - i);
                  if (appear <= 0) return null;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={lerp(7, 3.4, easeOut(appear))}
                      fill="var(--bg-primary)"
                      stroke="var(--accent)"
                      strokeWidth="1.6"
                      opacity={appear}
                    />
                  );
                })}

                {/* the realized path */}
                <path
                  d={ACTUAL_PATH}
                  fill="none"
                  stroke="var(--teal, #67c1b4)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset={1 - revealIn}
                />

                {/* anchor */}
                <circle
                  cx={ANCHOR_X}
                  cy={ANCHOR_Y}
                  r={lerp(4, 6.5, zoneIn)}
                  fill="var(--bg-primary)"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  opacity={historyIn}
                />

                {/* legend, once both paths exist */}
                <g opacity={revealIn}>
                  <line x1="430" y1="352" x2="452" y2="352" stroke="var(--accent)" strokeWidth="2.5" />
                  <text x="458" y="356" fill="var(--text-muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    Your drawing
                  </text>
                  <line x1="556" y1="352" x2="578" y2="352" stroke="var(--teal, #67c1b4)" strokeWidth="2.5" />
                  <text x="584" y="356" fill="var(--text-muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">
                    Actual
                  </text>
                </g>
              </svg>

              {/* round metadata — the same fields the app shows, so the demo reads as real */}
              <div
                className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 pt-2.5 dtc-data text-[10px]"
                style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                <span>anchor ${(67544.19).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span>horizon 60m</span>
                <span>{CONTROL_POINTS.length} control pts</span>
                <span>120 samples</span>
                <span style={{ color: lockIn > 0.9 ? 'var(--accent)' : undefined }}>
                  {lockIn > 0.9 ? 'committed' : 'uncommitted'}
                </span>
              </div>

              {/* the loop, lighting up as it happens */}
              <ol
                className="hidden lg:grid mt-3 pt-3 gap-y-1.5"
                style={{ borderTop: '1px solid var(--border)', listStyle: 'none', margin: 0 }}
              >
                {STEPS.map((step, i) => {
                  const done = i < stepIndex;
                  const active = i === stepIndex;
                  const fill = active ? clamp01(p * STAGES - i) : done ? 1 : 0;
                  return (
                    <li key={step.tag} className="flex items-center gap-2.5">
                      <span
                        className="dtc-data text-[10px] shrink-0 flex items-center justify-center"
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          border: `1px solid ${done || active ? 'var(--accent)' : 'var(--border-strong)'}`,
                          background: done ? 'var(--accent)' : 'transparent',
                          color: done ? '#120d09' : active ? 'var(--accent)' : 'var(--text-muted)',
                          transition: 'background 200ms, color 200ms, border-color 200ms',
                        }}
                      >
                        {done ? '✓' : i + 1}
                      </span>
                      <span
                        className="text-[11px] shrink-0"
                        style={{
                          width: 96,
                          color: active ? 'var(--text-primary)' : done ? 'var(--text-secondary)' : 'var(--text-muted)',
                          transition: 'color 200ms',
                        }}
                      >
                        {step.tag}
                      </span>
                      <span style={{ flex: 1, height: 2, background: 'var(--bg-tertiary)', borderRadius: 2 }}>
                        <span
                          style={{
                            display: 'block',
                            height: '100%',
                            width: `${fill * 100}%`,
                            background: 'var(--accent)',
                            borderRadius: 2,
                          }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* ---------- side panel ---------- */}
            <div className="flex flex-col gap-3">
              {/* caption */}
              <div className="dtc-panel p-4" style={{ minHeight: 150 }}>
                <div className="dtc-eyebrow mb-2" style={{ color: 'var(--accent)' }}>
                  {String(stepIndex + 1).padStart(2, '0')} · {STEPS[stepIndex]!.tag}
                </div>
                <h3
                  className="dtc-display text-lg sm:text-xl mb-2"
                  style={{ color: 'var(--text-primary)', lineHeight: 1.2 }}
                >
                  {STEPS[stepIndex]!.title}
                </h3>
                <p className="text-[13px]" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {STEPS[stepIndex]!.body}
                </p>
              </div>

              {/*
                Phones get one compact row instead of the three panels below — the sticky
                pane has to fit a single viewport, and stacked panels pushed the score and
                payout off-screen exactly when the story reaches them.
              */}
              <div className="grid grid-cols-3 gap-px lg:hidden rounded-lg overflow-hidden"
                style={{ background: 'var(--border)', border: '1px solid var(--border)' }}
              >
                <MiniStat
                  label="Stake"
                  value={`$${stakeShown}`}
                  active={termsIn > 0}
                  color="var(--text-primary)"
                />
                <MiniStat
                  label="Score"
                  value={scoreIn > 0 ? scoreShown.toFixed(1) : '—'}
                  active={scoreIn > 0}
                  color={scoreShown >= BREAK_EVEN ? 'var(--green)' : 'var(--text-primary)'}
                />
                <MiniStat
                  label="Payout"
                  value={payoutIn > 0 ? `${multiplierShown.toFixed(2)}x` : '—'}
                  active={payoutIn > 0}
                  color="var(--green)"
                />
              </div>

              {/* terms */}
              <div
                className="dtc-panel p-3 hidden lg:block"
                style={{
                  opacity: Math.max(termsIn, 0.25),
                  transition: 'opacity 200ms',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="dtc-eyebrow">Your terms</span>
                  <span className="dtc-data text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    1h
                  </span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[10px] mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      Stake
                    </div>
                    <div className="dtc-data text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                      ${stakeShown}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      Max win
                    </div>
                    <div className="dtc-data text-xl font-semibold" style={{ color: 'var(--teal, #67c1b4)' }}>
                      ${(stakeShown * 25).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* score */}
              <div
                className="dtc-panel p-3 hidden lg:block"
                style={{ opacity: Math.max(scoreIn, 0.25), transition: 'opacity 200ms' }}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className="dtc-eyebrow">Score</span>
                  <span
                    className="dtc-data text-2xl font-bold"
                    style={{ color: scoreShown >= BREAK_EVEN ? 'var(--green)' : 'var(--text-primary)' }}
                  >
                    {scoreShown.toFixed(1)}
                    <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                      {' '}
                      / 100
                    </span>
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {COMPONENTS.map((c, i) => {
                    const fill = clamp01(scoreIn * COMPONENTS.length - i);
                    return (
                      <div key={c.label}>
                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                          <span style={{ color: 'var(--text-secondary)' }}>{c.label}</span>
                          <span className="dtc-data" style={{ color: 'var(--text-muted)' }}>
                            {(c.earned * fill).toFixed(1)} / {c.max}
                          </span>
                        </div>
                        <div style={{ height: 3, background: 'var(--bg-tertiary)', borderRadius: 2 }}>
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
              </div>

              {/* payout */}
              <div
                className="dtc-panel p-3 hidden lg:block"
                style={{ opacity: Math.max(payoutIn, 0.25), transition: 'opacity 200ms' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="dtc-eyebrow">Payout curve</span>
                  <span className="dtc-data text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    break-even {BREAK_EVEN}
                  </span>
                </div>
                <svg viewBox="0 0 224 104" className="w-full" style={{ display: 'block' }}>
                  <line x1="24" y1="92" x2="216" y2="92" stroke="var(--border)" />
                  <line
                    x1={curveX(BREAK_EVEN)}
                    y1="10"
                    x2={curveX(BREAK_EVEN)}
                    y2="92"
                    stroke="var(--border-strong)"
                    strokeDasharray="3 3"
                  />
                  <path d={curvePath} fill="none" stroke="var(--accent)" strokeWidth="1.8" />
                  <circle
                    cx={curveX(TOTAL * payoutIn)}
                    cy={curveY(multiplierShown)}
                    r="4"
                    fill="var(--green)"
                    opacity={payoutIn}
                  />
                  <text x="24" y="102" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono, monospace">
                    0
                  </text>
                  <text x="206" y="102" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono, monospace">
                    100
                  </text>
                </svg>
                <div
                  className="flex items-center justify-between mt-2 pt-2"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <span className="dtc-data text-lg font-semibold" style={{ color: 'var(--green)' }}>
                    {multiplierShown.toFixed(2)}x
                  </span>
                  <span className="dtc-data text-sm font-semibold" style={{ color: 'var(--green)' }}>
                    +${profitShown.toFixed(0)}
                  </span>
                </div>
              </div>

              {payoutIn > 0.85 && (
                <Link
                  to="/play"
                  className="px-4 py-2.5 text-[13px] font-semibold no-underline dtc-button-primary text-center"
                >
                  Draw one yourself
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** One cell of the compact phone readout. */
function MiniStat({
  label,
  value,
  active,
  color,
}: {
  label: string;
  value: string;
  active: boolean;
  color: string;
}) {
  return (
    <div className="p-2.5" style={{ background: 'var(--bg-secondary)' }}>
      <div className="text-[10px] mb-0.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div
        className="dtc-data text-base font-semibold"
        style={{ color: active ? color : 'var(--text-muted)', transition: 'color 200ms' }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Marker that rides the drawn path while it is being revealed. Uses the SVG geometry API
 * so it follows the real curve rather than an approximation of it.
 */
function PenTip({ d, t }: { d: string; t: number }) {
  const ref = useRef<SVGPathElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const path = ref.current;
    if (!path) return;
    const len = path.getTotalLength();
    const point = path.getPointAtLength(len * clamp01(t));
    setPos({ x: point.x, y: point.y });
  }, [d, t]);

  return (
    <>
      <path ref={ref} d={d} fill="none" stroke="none" />
      {pos && (
        <>
          <circle cx={pos.x} cy={pos.y} r="11" fill="rgba(212,168,92,0.16)" />
          <circle cx={pos.x} cy={pos.y} r="4" fill="var(--accent)" />
        </>
      )}
    </>
  );
}
