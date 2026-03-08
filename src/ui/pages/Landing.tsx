import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { DEFAULT_PAYOUT_CONFIG, getBreakEvenScore } from '../../scoring/payout';
import {
  formatMoney,
  formatMultiplier,
  formatProfit,
  getPayoutExample,
} from '../lib/payoutPresentation';

function useLiveBtcPrice() {
  const [price, setPrice] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    const controller = new AbortController();

    fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Ticker request failed: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const nextPrice = Number.parseFloat(String(data.lastPrice));
        const nextChange = Number.parseFloat(String(data.priceChangePercent));
        if (Number.isFinite(nextPrice)) setPrice(nextPrice);
        if (Number.isFinite(nextChange)) setChange24h(nextChange);
      })
      .catch(() => {
        // Ignore startup errors on landing.
      });

    const timer = window.setTimeout(() => {
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
              }
            }
          } catch {
            // Ignore parse errors.
          }
        };
      } catch {
        // Ignore websocket errors on landing.
      }
    }, 120);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
      ws?.close();
    };
  }, []);

  return { price, change24h };
}

const comparisonCards = [
  {
    title: 'Prediction markets',
    body: 'Good for event resolution, weak at expressing a nuanced market thesis.',
  },
  {
    title: 'Perp trading',
    body: 'Powerful but operationally heavy. You manage leverage, entries, exits, and liquidation risk.',
  },
  {
    title: 'Draw The Chart',
    body: 'One action, one thesis: draw the path you believe the market will take, then get scored on accuracy.',
  },
];

const featureCards = [
  {
    eyebrow: 'Historical sandbox',
    title: 'Instant feedback loop',
    body: 'You do not wait hours or days to learn whether the thesis made sense. Historical rounds reveal immediately and can be replayed later from a shared seed.',
  },
  {
    eyebrow: 'Calibrated scoring',
    title: 'Not a black box',
    body: 'Scores decompose into direction, magnitude, turning points, and volatility regime with known baseline distributions.',
  },
  {
    eyebrow: 'Payout transparency',
    title: 'Visible convexity',
    body: 'Below break-even you recover part of the stake. Above break-even you climb into the profit zone on a published curve.',
  },
];

const processSteps = [
  {
    step: '01',
    title: 'Watch the market',
    body: 'Use the live BTC preview or lock into a historical sandbox round.',
  },
  {
    step: '02',
    title: 'Grab the anchor',
    body: 'The future zone opens to the right. Pull a path instead of choosing up or down.',
  },
  {
    step: '03',
    title: 'See the reveal',
    body: 'Your raw stroke becomes a validated scoring path, then gets compared against the realized move.',
  },
];

export function Landing() {
  const { price, change24h } = useLiveBtcPrice();
  const breakEvenScore = getBreakEvenScore();
  const payoutExamples = [40, 55, breakEvenScore, 70, 80, 90].map((score) =>
    getPayoutExample(score, 100),
  );
  const exampleRound = getPayoutExample(72, 100);

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(207, 123, 53, 0.12), transparent 24%), radial-gradient(circle at bottom right, rgba(72, 183, 132, 0.08), transparent 16%), var(--bg-primary)',
      }}
    >
      <section className="px-4 sm:px-6 pt-24 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-5" style={tagStyle}>
              <span className="inline-block h-2 w-2" style={{ background: 'var(--accent)' }} />
              Sandbox MVP
            </div>
            <h1 className="dtc-display text-6xl sm:text-7xl font-semibold mb-5" style={{ color: 'var(--text-primary)', lineHeight: 0.95 }}>
              Predict the move by drawing the chart.
            </h1>
            <p className="text-lg leading-8 mb-8" style={{ color: 'var(--text-secondary)' }}>
              Draw The Chart turns TA behavior into a game mechanic. Instead of placing a binary bet,
              you sketch the future path, get scored on how accurate that thesis was, and see what that
              score would have paid on a transparent multiplier curve.
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <Link to="/play" className="px-6 py-3 text-sm font-semibold no-underline dtc-button-primary" style={primaryButtonStyle}>
                Open Sandbox
              </Link>
              <Link to="/faq" className="px-6 py-3 text-sm font-semibold no-underline dtc-button-secondary" style={secondaryButtonStyle}>
                How It Works
              </Link>
              <Link to="/whitepaper" className="px-6 py-3 text-sm font-semibold no-underline dtc-button-secondary" style={secondaryButtonStyle}>
                Read Whitepaper
              </Link>
            </div>
            <div className="mb-8 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              New here: start with the 15m or 1h sandbox, make one path, then review the journal before reading the full paper.
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatPill label="Asset" value="BTC only" />
              <StatPill label="Horizons" value="5 fixed" />
              <StatPill label="Score" value="0-100" />
              <StatPill label="Cap" value={`${DEFAULT_PAYOUT_CONFIG.maxMultiplier.toFixed(0)}x`} />
            </div>
          </div>

          <div className="dtc-panel p-5 sm:p-6" style={panelStyle}>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="dtc-eyebrow mb-2">
                  Live BTC pulse
                </div>
                <div className="dtc-display text-4xl font-semibold dtc-data" style={{ color: 'var(--text-primary)' }}>
                  {price
                    ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '--'}
                </div>
              </div>
              {change24h != null && (
                <div
                  className="px-3 py-1 text-xs font-semibold dtc-data"
                  style={{
                    background: change24h >= 0 ? 'rgba(72, 183, 132, 0.12)' : 'rgba(216, 104, 88, 0.12)',
                    color: change24h >= 0 ? 'var(--green)' : 'var(--red)',
                    border: `1px solid ${change24h >= 0 ? 'rgba(72, 183, 132, 0.24)' : 'rgba(216, 104, 88, 0.24)'}`,
                  }}
                >
                  {change24h >= 0 ? '+' : ''}
                  {change24h.toFixed(2)}%
                </div>
              )}
            </div>

            <div className="p-4 mb-4 dtc-panel-subtle" style={subPanelStyle}>
              <div className="dtc-eyebrow mb-3">
                Example round
              </div>
              <svg viewBox="0 0 600 250" className="w-full">
                <rect x="0" y="0" width="600" height="250" rx="10" fill="rgba(8, 11, 9, 0.9)" />
                {[60, 110, 160, 210].map((y) => (
                  <line key={y} x1="32" y1={y} x2="568" y2={y} stroke="rgba(70, 80, 69, 0.32)" strokeWidth="1" />
                ))}
                {[90, 170, 250, 330, 410, 490].map((x) => (
                  <line key={x} x1={x} y1="24" x2={x} y2="220" stroke="rgba(70, 80, 69, 0.18)" strokeWidth="1" />
                ))}
                <rect x="350" y="24" width="210" height="196" fill="rgba(207, 123, 53, 0.06)" />
                <line x1="350" y1="24" x2="350" y2="220" stroke="rgba(155, 146, 123, 0.72)" strokeDasharray="5 5" />
                <text x="350" y="236" textAnchor="middle" fill="#9d9c8e" fontSize="11" fontWeight="700">
                  NOW
                </text>
                <polyline
                  points="32,148 60,138 95,146 130,126 170,131 210,116 250,124 288,100 320,108 350,104"
                  fill="none"
                  stroke="#23c58d"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points="350,104 386,86 430,100 470,74 510,91 555,61"
                  fill="none"
                  stroke="#dfb27d"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points="350,104 390,112 430,86 462,93 490,84 520,82 560,90"
                  fill="none"
                  stroke="var(--teal)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="350" cy="104" r="9" fill="#0b0e0c" stroke="var(--accent)" strokeWidth="3" />
                <rect x="412" y="136" width="116" height="52" rx="8" fill="rgba(12, 15, 13, 0.96)" stroke="rgba(73, 84, 72, 0.44)" />
                <text x="470" y="158" textAnchor="middle" fill="var(--text-primary)" fontSize="12" fontWeight="700">
                  Score 72.0
                </text>
                <text x="470" y="176" textAnchor="middle" fill="var(--accent-strong)" fontSize="11">
                  {formatMultiplier(exampleRound.multiplier)} payout
                </text>
              </svg>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MiniMetric label="Stake" value="$100" />
              <MiniMetric label="Score 72" value={formatProfit(exampleRound.profit)} />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-14">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {comparisonCards.map((card) => (
              <div key={card.title} className="dtc-panel p-6" style={panelStyle}>
                <div className="dtc-eyebrow mb-3" style={{ color: 'var(--accent-strong)' }}>
                  Market behavior
                </div>
                <h2 className="dtc-display text-3xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  {card.title}
                </h2>
                <p className="text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
          <div className="dtc-panel p-7" style={panelStyle}>
            <div className="dtc-eyebrow mb-3" style={{ color: 'var(--accent-strong)' }}>
              Why it feels different
            </div>
            <h2 className="dtc-display text-5xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              One stroke expresses more than one bet.
            </h2>
            <p className="text-sm leading-7 mb-6" style={{ color: 'var(--text-secondary)' }}>
              A single drawing carries direction, conviction, expected retracements, timing, and volatility.
              That makes the game legible to traders while still being simple enough for pure consumers.
            </p>
            <div className="space-y-4">
              {featureCards.map((card) => (
                <div key={card.title} className="p-4 dtc-panel-subtle" style={subPanelStyle}>
                  <div className="dtc-eyebrow mb-2">
                    {card.eyebrow}
                  </div>
                  <div className="dtc-display text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    {card.title}
                  </div>
                  <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="dtc-panel p-7" style={panelStyle}>
            <div className="dtc-eyebrow mb-3" style={{ color: 'var(--accent-strong)' }}>
              Product loop
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {processSteps.map((step) => (
                <div key={step.step} className="p-4 dtc-panel-subtle" style={subPanelStyle}>
                  <div className="dtc-eyebrow mb-2" style={{ color: 'var(--accent-strong)' }}>
                    {step.step}
                  </div>
                  <div className="dtc-display text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    {step.title}
                  </div>
                  <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
            <div className="p-5 mt-5 dtc-panel-subtle" style={subPanelStyle}>
              <div className="dtc-eyebrow mb-3">
                Multiplier preview
              </div>
              <div className="grid grid-cols-4 gap-3 text-[11px] uppercase tracking-[0.12em] mb-2 dtc-data" style={{ color: 'var(--text-muted)' }}>
                <span>Score</span>
                <span>Mult</span>
                <span>Payout</span>
                <span>Result</span>
              </div>
              <div className="space-y-2">
                {payoutExamples.map((example) => (
                  <div
                    key={example.score}
                    className="grid grid-cols-4 gap-3 px-3 py-2 text-sm dtc-data"
                    style={{
                      background: 'rgba(13, 17, 14, 0.8)',
                      border: '1px solid rgba(58, 70, 59, 0.38)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span>{example.score}</span>
                    <span>{formatMultiplier(example.multiplier)}</span>
                    <span>{formatMoney(example.payout)}</span>
                    <span style={{ color: example.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {formatProfit(example.profit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 pb-20">
        <div
          className="max-w-6xl mx-auto dtc-panel p-8 sm:p-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
          style={panelStyle}
        >
          <div className="max-w-2xl">
            <div className="dtc-eyebrow mb-3" style={{ color: 'var(--accent-strong)' }}>
              Current build
            </div>
            <h2 className="dtc-display text-5xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              The MVP is focused on the hard part: making the draw feel trustworthy.
            </h2>
            <p className="text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
              The current release is sandbox-first. It includes candle history, a fixed future drawing zone,
              technical analysis overlays, score breakdowns, a calibrated backtest harness, and a transparent payout curve.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/play" className="px-6 py-3 text-sm font-semibold no-underline dtc-button-primary" style={primaryButtonStyle}>
              Start Drawing
            </Link>
            <Link to="/leaderboard" className="px-6 py-3 text-sm font-semibold no-underline dtc-button-secondary" style={secondaryButtonStyle}>
              Open Journal
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 dtc-panel-subtle" style={subPanelStyle}>
      <div className="dtc-eyebrow mb-1">
        {label}
      </div>
      <div className="dtc-data text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 dtc-panel-subtle" style={subPanelStyle}>
      <div className="dtc-eyebrow mb-2">
        {label}
      </div>
      <div className="dtc-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: 'rgba(14, 18, 15, 0.84)',
  border: '1px solid rgba(58, 70, 59, 0.72)',
  boxShadow: 'var(--shadow-soft)',
  backdropFilter: 'blur(16px)',
};

const subPanelStyle: CSSProperties = {
  background: 'rgba(18, 24, 19, 0.78)',
  border: '1px solid rgba(58, 70, 59, 0.44)',
};

const tagStyle: CSSProperties = {
  background: 'rgba(207, 123, 53, 0.1)',
  border: '1px solid rgba(207, 123, 53, 0.28)',
  color: 'var(--accent-strong)',
  fontFamily: 'IBM Plex Mono, monospace',
  fontSize: '11px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const primaryButtonStyle: CSSProperties = {
  color: '#120d09',
};

const secondaryButtonStyle: CSSProperties = {
  color: 'var(--text-primary)',
};
