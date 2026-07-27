import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { mulberry32, STANDARD_PAYOUT_V3, DEFAULT_FIELD_CONFIG } from '../../scoring/v3/index';

type PriceStatus = 'loading' | 'live' | 'offline';

function useLiveBtcPrice() {
  const [price, setPrice] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [status, setStatus] = useState<PriceStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    const controller = new AbortController();

    const timeout = window.setTimeout(() => {
      if (!cancelled && status === 'loading') setStatus('offline');
    }, 6000);

    fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const nextPrice = Number.parseFloat(String(data.lastPrice));
        const nextChange = Number.parseFloat(String(data.priceChangePercent));
        if (Number.isFinite(nextPrice)) {
          setPrice(nextPrice);
          setStatus('live');
        }
        if (Number.isFinite(nextChange)) setChange24h(nextChange);
      })
      .catch(() => {
        if (!cancelled) setStatus('offline');
      });

    const wsTimer = window.setTimeout(() => {
      if (cancelled) return;
      try {
        ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');
        ws.onmessage = (event) => {
          if (cancelled) return;
          try {
            const payload = JSON.parse(event.data);
            if (payload.p) {
              const nextPrice = Number.parseFloat(String(payload.p));
              if (Number.isFinite(nextPrice)) {
                setPrice(nextPrice);
                setStatus('live');
              }
            }
          } catch {}
        };
      } catch {}
    }, 120);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
      clearTimeout(wsTimer);
      ws?.close();
    };
  }, []);

  return { price, change24h, status };
}

// ─── hero: the mechanic, animated ────────────────────────────────────

const ANCHOR = { x: 235, y: 152 };
const END_X = 580;
const GHOST_COUNT = 16;

function walkPath(seedOffset: number, drift: number, wobble: number): string {
  const rng = mulberry32(1013 + seedOffset);
  const segments = 12;
  let y = ANCHOR.y;
  const pts = [`${ANCHOR.x},${ANCHOR.y}`];
  for (let i = 1; i <= segments; i++) {
    const x = ANCHOR.x + ((END_X - ANCHOR.x) * i) / segments;
    y += drift + (rng() - 0.5) * wobble;
    y = Math.max(28, Math.min(272, y));
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

function buildGhosts(): { points: string; opacity: number; delay: number }[] {
  const rng = mulberry32(4242);
  return Array.from({ length: GHOST_COUNT }, (_, i) => ({
    points: walkPath(i * 17, (rng() - 0.5) * 9, 26 + rng() * 22),
    opacity: 0.05 + rng() * 0.07,
    delay: 0.15 + rng() * 0.9,
  }));
}

const GHOSTS = buildGhosts();
const PLAYER_PATH = `${ANCHOR.x},${ANCHOR.y} 285,128 330,112 370,124 415,102 465,88 520,94 ${END_X},72`;
const ACTUAL_PATH = `${ANCHOR.x},${ANCHOR.y} 282,136 328,104 372,132 418,96 462,98 522,82 ${END_X},80`;
const HISTORY_PATH = '20,180 52,168 84,176 118,158 150,164 184,144 214,150 235,152';

function HeroChart() {
  return (
    <div>
      <div
        className="rounded overflow-hidden"
        style={{ border: '1px solid var(--border)' }}
      >
        <svg viewBox="0 0 600 300" className="w-full" style={{ display: 'block' }}>
          <rect x="0" y="0" width="600" height="300" fill="var(--bg-primary)" />
          {[60, 120, 180, 240].map((y) => (
            <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="rgba(255,255,255,0.03)" />
          ))}

          <rect x={ANCHOR.x} y="0" width={600 - ANCHOR.x} height="300" fill="rgba(212,168,92,0.025)" />
          <line x1={ANCHOR.x} y1="0" x2={ANCHOR.x} y2="300" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 3" />
          <text x={ANCHOR.x - 6} y="290" textAnchor="end" fill="var(--text-muted)" fontSize="9" fontFamily="JetBrains Mono">
            NOW
          </text>

          <polyline
            points={HISTORY_PATH}
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {GHOSTS.map((g, i) => (
            <polyline
              key={i}
              className="dtc-hero-ghost"
              style={{ ['--ghost-opacity' as string]: g.opacity, animationDelay: `${g.delay}s` }}
              points={g.points}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          <polyline
            className="dtc-hero-line"
            style={{ animationDelay: '1.0s' }}
            pathLength={1}
            points={PLAYER_PATH}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <polyline
            className="dtc-hero-line"
            style={{ animationDelay: '1.9s' }}
            pathLength={1}
            points={ACTUAL_PATH}
            fill="none"
            stroke="var(--teal)"
            strokeWidth="1.8"
            strokeDasharray="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <circle cx={ANCHOR.x} cy={ANCHOR.y} r="4" fill="var(--bg-primary)" stroke="var(--accent)" strokeWidth="1.5" />

          <g className="dtc-hero-chip" style={{ animationDelay: '3.1s' }}>
            <rect x="440" y="26" width="140" height="26" rx="13" fill="rgba(17,17,19,0.95)" stroke="rgba(34,197,94,0.45)" />
            <text x="510" y="43" textAnchor="middle" fill="var(--green)" fontSize="11" fontWeight="700" fontFamily="JetBrains Mono">
              TOP 6% · 5.14x
            </text>
          </g>
        </svg>
      </div>
      <div className="flex items-center gap-5 mt-2.5 text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-px" style={{ background: 'var(--accent)', height: 2 }} />
          you
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4" style={{ background: 'var(--teal)', height: 2 }} />
          reality
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4" style={{ background: '#94a3b8', height: 1, opacity: 0.5 }} />
          the field · {DEFAULT_FIELD_CONFIG.B.toLocaleString()} forecasts
        </span>
      </div>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────

export function Landing() {
  const { price, change24h, status } = useLiveBtcPrice();
  const breakEvenPct = Math.round(100 * STANDARD_PAYOUT_V3.breakEvenPercentile);

  return (
    <div className="min-h-screen pt-12 dtc-atmosphere">
      <div className="max-w-5xl mx-auto px-6">
        {/* Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-10 items-center pt-16 pb-14">
          <div>
            <div className="dtc-eyebrow mb-4">BTC price-path prediction</div>
            <h1
              className="dtc-display text-5xl sm:text-[62px] mb-5"
              style={{ color: 'var(--text-primary)', lineHeight: 1.02 }}
            >
              Draw the chart.
              <br />
              <span className="dtc-display-em" style={{ color: 'var(--accent)' }}>
                Beat the field.
              </span>
            </h1>
            <p className="text-[15px] mb-7" style={{ color: 'var(--text-secondary)', maxWidth: 400, lineHeight: 1.65 }}>
              Sketch where BTC goes next. Your line is ranked against{' '}
              {DEFAULT_FIELD_CONFIG.B.toLocaleString()} simulated forecasts facing the same market —
              beat enough of them and you profit.
            </p>
            <Link
              to="/play"
              className="px-6 py-3 text-sm font-semibold no-underline dtc-button-primary inline-block"
            >
              Start Drawing
            </Link>
          </div>
          <HeroChart />
        </section>

        {/* Protocol stats strip */}
        <section className="dtc-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div>
            <div className="dtc-eyebrow mb-2">BTC / USDT</div>
            {status === 'loading' ? (
              <div className="shimmer" style={{ width: 110, height: 24, borderRadius: 3 }} />
            ) : (
              <div className="dtc-data text-xl" style={{ color: 'var(--text-primary)' }}>
                {price
                  ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '—'}
              </div>
            )}
            <div className="dtc-data text-[11px] mt-1" style={{ color: change24h != null && change24h >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {change24h != null ? `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}% 24h` : ' '}
            </div>
          </div>
          <div>
            <div className="dtc-eyebrow mb-2">The Field</div>
            <div className="dtc-data text-xl" style={{ color: 'var(--text-primary)' }}>
              {DEFAULT_FIELD_CONFIG.B.toLocaleString()}
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>forecasts per round</div>
          </div>
          <div>
            <div className="dtc-eyebrow mb-2">Break-even</div>
            <div className="dtc-data text-xl" style={{ color: 'var(--accent)' }}>
              Top {100 - breakEvenPct}%
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {(100 * STANDARD_PAYOUT_V3.houseEdge).toFixed(0)}% edge, exact by construction
            </div>
          </div>
          <div>
            <div className="dtc-eyebrow mb-2">Max Payout</div>
            <div className="dtc-data text-xl" style={{ color: 'var(--green)' }}>
              {STANDARD_PAYOUT_V3.maxMultiplier}.00x
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>beat the whole field</div>
          </div>
        </section>

        {/* How one round works */}
        <section className="py-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            <Step index="01" title="Draw your path">
              Sketch where BTC goes over 15 minutes to 7 days. The chart freezes at the anchor — no take-backs.
            </Step>
            <Step index="02" title="Face the field">
              {DEFAULT_FIELD_CONFIG.B.toLocaleString()} simulated forecasts — random walks, trend-followers,
              mean-reverters — are measured against the same reality as you.
            </Step>
            <Step index="03" title="Get paid by rank">
              Your score is the share of the field you beat. Top {100 - breakEvenPct}% breaks even;
              beat everyone for {STANDARD_PAYOUT_V3.maxMultiplier}x.
            </Step>
          </div>
        </section>

        {/* Footer */}
        <footer className="dtc-hairline-top py-8">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Sandbox — historical data, no real money. Not financial advice.
          </span>
        </footer>
      </div>
    </div>
  );
}

function Step({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <div className="dtc-hairline-top pt-5">
      <div className="dtc-data text-[11px] mb-3" style={{ color: 'var(--accent)' }}>{index}</div>
      <div className="dtc-display text-[19px] mb-2" style={{ color: 'var(--text-primary)' }}>{title}</div>
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{children}</p>
    </div>
  );
}
