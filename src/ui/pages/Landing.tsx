import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { DEFAULT_PAYOUT_CONFIG, getBreakEvenScore } from '../../scoring/payout';
import {
  formatMoney,
  formatMultiplier,
  formatProfit,
  getPayoutExample,
} from '../lib/payoutPresentation';

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

export function Landing() {
  const { price, change24h, status } = useLiveBtcPrice();
  const breakEvenScore = getBreakEvenScore();
  const payoutExamples = [40, 55, breakEvenScore, 70, 80, 90].map((score) =>
    getPayoutExample(score, 100),
  );

  return (
    <div className="min-h-screen pt-12">
      {/* Hero — tight, data-first */}
      <section className="px-4 pt-8 pb-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1
              className="dtc-display text-2xl sm:text-3xl mb-1"
              style={{ color: 'var(--text-primary)', lineHeight: 1.1 }}
            >
              Draw the path. Get scored.
            </h1>
            <p className="text-[13px]" style={{ color: 'var(--text-muted)', maxWidth: 420 }}>
              Predict BTC price movement by drawing a chart. Scored on direction, magnitude, turns, and volatility.
            </p>
          </div>
          <Link
            to="/play"
            className="px-5 py-2.5 text-[13px] font-semibold no-underline dtc-button-primary shrink-0 self-start sm:self-auto"
          >
            Start Drawing
          </Link>
        </div>

        {/* Live ticker + stats row */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-lg overflow-hidden"
          style={{ background: 'var(--border)', border: '1px solid var(--border)' }}
        >
          <div className="p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div className="dtc-eyebrow mb-1">BTC/USDT</div>
            {status === 'loading' ? (
              <div className="shimmer" style={{ width: 120, height: 22, borderRadius: 3 }} />
            ) : price ? (
              <div className="dtc-data text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            ) : (
              <div className="dtc-data text-lg font-semibold" style={{ color: 'var(--text-muted)' }}>
                Offline
              </div>
            )}
            {change24h != null && (
              <div
                className="dtc-data text-[11px] mt-0.5"
                style={{ color: change24h >= 0 ? 'var(--green)' : 'var(--red)' }}
              >
                {change24h >= 0 ? '+' : ''}
                {change24h.toFixed(2)}% 24h
              </div>
            )}
          </div>
          <div className="p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div className="dtc-eyebrow mb-1">Score Range</div>
            <div className="dtc-data text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>0 - 100</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>4 components</div>
          </div>
          <div className="p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div className="dtc-eyebrow mb-1">Break-even</div>
            <div className="dtc-data text-lg font-semibold" style={{ color: 'var(--accent)' }}>{breakEvenScore}</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>2% house edge</div>
          </div>
          <div className="p-3" style={{ background: 'var(--bg-secondary)' }}>
            <div className="dtc-eyebrow mb-1">Max Payout</div>
            <div className="dtc-data text-lg font-semibold" style={{ color: 'var(--green)' }}>
              {DEFAULT_PAYOUT_CONFIG.maxMultiplier}x
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Hard cap</div>
          </div>
        </div>
      </section>

      {/* Chart preview + Payout table side by side */}
      <section className="px-4 pb-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
          {/* Example chart */}
          <div className="dtc-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="dtc-eyebrow">Example Round</span>
              <span className="dtc-data text-xs" style={{ color: 'var(--text-muted)' }}>
                BTC/USDT 1h
              </span>
            </div>
            <svg viewBox="0 0 600 220" className="w-full" style={{ display: 'block' }}>
              <rect x="0" y="0" width="600" height="220" rx="4" fill="var(--bg-primary)" />
              {/* Grid */}
              {[50, 100, 150, 190].map((y) => (
                <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="rgba(255,255,255,0.03)" />
              ))}
              {/* NOW line */}
              <rect x="340" y="0" width="260" height="220" fill="rgba(91,141,239,0.03)" />
              <line x1="340" y1="0" x2="340" y2="220" stroke="rgba(255,255,255,0.12)" strokeDasharray="3 3" />
              <text x="340" y="214" textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontFamily="JetBrains Mono">
                NOW
              </text>
              {/* History */}
              <polyline
                points="20,130 55,120 90,128 130,108 170,113 210,98 250,106 290,84 320,92 340,88"
                fill="none"
                stroke="var(--text-secondary)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Prediction */}
              <polyline
                points="340,88 380,70 420,82 460,58 500,72 550,44"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Actual */}
              <polyline
                points="340,88 385,96 425,70 458,76 488,68 520,66 558,74"
                fill="none"
                stroke="var(--green)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="4 2"
              />
              {/* Anchor */}
              <circle cx="340" cy="88" r="4" fill="var(--bg-primary)" stroke="var(--accent)" strokeWidth="1.5" />
              {/* Legend */}
              <line x1="400" y1="186" x2="420" y2="186" stroke="var(--accent)" strokeWidth="2" />
              <text x="424" y="189" fill="var(--text-muted)" fontSize="9" fontFamily="JetBrains Mono">Predicted</text>
              <line x1="490" y1="186" x2="510" y2="186" stroke="var(--green)" strokeWidth="1.5" strokeDasharray="4 2" />
              <text x="514" y="189" fill="var(--text-muted)" fontSize="9" fontFamily="JetBrains Mono">Actual</text>
            </svg>
            <div
              className="flex items-center justify-between mt-3 pt-3"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Score</span>
                  <span className="dtc-data text-sm font-semibold ml-2" style={{ color: 'var(--text-primary)' }}>72.0</span>
                </div>
                <div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Mult</span>
                  <span className="dtc-data text-sm font-semibold ml-2" style={{ color: 'var(--green)' }}>2.60x</span>
                </div>
              </div>
              <div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>$100 stake</span>
                <span className="dtc-data text-sm font-semibold ml-2" style={{ color: 'var(--green)' }}>+$160</span>
              </div>
            </div>
          </div>

          {/* Payout curve table */}
          <div className="dtc-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="dtc-eyebrow">Payout Curve</span>
              <span className="dtc-data text-xs" style={{ color: 'var(--text-muted)' }}>
                $100 stake
              </span>
            </div>
            <div className="overflow-hidden rounded" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th className="text-left px-3 py-2 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>Score</th>
                    <th className="text-right px-3 py-2 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>Mult</th>
                    <th className="text-right px-3 py-2 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>Payout</th>
                    <th className="text-right px-3 py-2 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutExamples.map((ex) => {
                    const isBreakEven = ex.score === breakEvenScore;
                    return (
                      <tr
                        key={ex.score}
                        style={{
                          borderTop: '1px solid var(--border)',
                          background: isBreakEven ? 'var(--accent-soft)' : 'transparent',
                        }}
                      >
                        <td className="px-3 py-2 dtc-data" style={{ color: isBreakEven ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {ex.score}{isBreakEven ? ' BE' : ''}
                        </td>
                        <td className="text-right px-3 py-2 dtc-data" style={{ color: 'var(--text-secondary)' }}>
                          {formatMultiplier(ex.multiplier)}
                        </td>
                        <td className="text-right px-3 py-2 dtc-data" style={{ color: 'var(--text-secondary)' }}>
                          {formatMoney(ex.payout)}
                        </td>
                        <td className="text-right px-3 py-2 dtc-data font-medium" style={{ color: ex.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {formatProfit(ex.profit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Scoring components strip */}
      <section className="px-4 pb-6 max-w-4xl mx-auto">
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-lg overflow-hidden"
          style={{ background: 'var(--border)', border: '1px solid var(--border)' }}
        >
          <ScoreBlock label="Direction" points={40} desc="Multi-scale trend matching" />
          <ScoreBlock label="Magnitude" points={30} desc="Bias + tracking accuracy" />
          <ScoreBlock label="Turning Pts" points={20} desc="Peaks & troughs detection" />
          <ScoreBlock label="Volatility" points={10} desc="Regime shape matching" />
        </div>
      </section>

      {/* Timeframes + CTA */}
      <section className="px-4 pb-6 max-w-4xl mx-auto">
        <div className="dtc-panel p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="dtc-eyebrow">Timeframes</span>
            {['15m', '1h', '6h', '24h', '7d'].map((tf) => (
              <span
                key={tf}
                className="dtc-data text-[11px] px-2 py-0.5 rounded"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                {tf}
              </span>
            ))}
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>BTC only</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/whitepaper"
              className="px-3 py-1.5 text-xs font-medium no-underline dtc-button-secondary"
            >
              Paper
            </Link>
            <Link
              to="/play"
              className="px-3 py-1.5 text-xs font-semibold no-underline dtc-button-primary"
            >
              Open Sandbox
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 pb-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            DTC Sandbox. Not financial advice.
          </span>
          <span className="text-xs dtc-data" style={{ color: 'var(--text-muted)' }}>
            v1.1
          </span>
        </div>
      </footer>
    </div>
  );
}

function ScoreBlock({ label, points, desc }: { label: string; points: number; desc: string }) {
  return (
    <div className="p-3" style={{ background: 'var(--bg-secondary)' }}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
        <span className="dtc-data text-[11px]" style={{ color: 'var(--accent)' }}>{points}</span>
      </div>
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{desc}</span>
    </div>
  );
}
