import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_PAYOUT_CONFIG, getBreakEvenScore } from '../../scoring/payout';
import { getPayoutExample, formatMoney, formatMultiplier, formatProfit } from '../lib/payoutPresentation';

const scoringComponents = [
  { title: 'Direction', points: '0-40', body: 'Multi-scale segment sign matching with coarser scales weighted more heavily.', formula: 'DirectionScore = 40 * sum(w_l * H_l) / sum(w_l)' },
  { title: 'Magnitude', points: '0-30', body: 'Bias and debiased tracking error, normalized by realized volatility.', formula: 'MagnitudeScore = 30 * exp(-lambda * normalized_error)' },
  { title: 'Turning Points', points: '0-20', body: 'Smoothed local extrema matched via Hungarian algorithm with hallucination/miss penalties.', formula: 'TurningScore = matched_quality - penalties' },
  { title: 'Volatility Regime', points: '0-10', body: 'Predicted vs realized volatility compared quarter by quarter.', formula: 'ShapeScore = 10 * exp(-mu * regime_mismatch)' },
];

const calibrationRows = [
  ['Random Walk', '35.0', '30-35'],
  ['Flat Line', '25.7', '25-35'],
  ['Naive Trend', '39.5', '35-50'],
  ['Near Perfect', '98.7', '~100'],
];

const breakEvenScore = getBreakEvenScore();
const payoutRows = [0, 20, 40, 55, breakEvenScore, 70, 80, 90, 95, 100].map(
  (score) => getPayoutExample(score, 100),
);

export function Whitepaper() {
  return (
    <div className="min-h-screen pt-12">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="dtc-eyebrow mb-2">Whitepaper v1.1</div>
            <h1 className="dtc-display text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Draw The Chart
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)', maxWidth: 520 }}>
              A chart-native BTC prediction game. Draw the future path, get scored in log-return space, settle against a published payout curve.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/play" className="px-3 py-1.5 text-xs font-semibold no-underline dtc-button-primary">
              Open Sandbox
            </Link>
            <a href="/DrawTheChart_Whitepaper_v1.1.pdf" target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs font-medium no-underline dtc-button-secondary">
              Download PDF
            </a>
          </div>
        </div>

        {/* Key metrics */}
        <div
          className="grid grid-cols-3 sm:grid-cols-6 gap-px rounded-lg overflow-hidden mb-8"
          style={{ background: 'var(--border)', border: '1px solid var(--border)' }}
        >
          <MetaCell label="Asset" value="BTC/USDT" />
          <MetaCell label="Horizons" value="15m-7d" />
          <MetaCell label="Score" value="0-100" />
          <MetaCell label="Cap" value={`${DEFAULT_PAYOUT_CONFIG.maxMultiplier}x`} />
          <MetaCell label="Resample" value="120 pts" />
          <MetaCell label="Status" value="Sandbox" />
        </div>

        <div className="space-y-6">
          {/* What DTC Is */}
          <Section title="What DTC Is">
            <p>
              DTC sits between prediction markets and trading. More expressive than a binary bet,
              simpler than a leveraged position. The chart is not decoration — it is the game object.
            </p>
            <p className="mt-2">
              The player sees historical BTC, draws the expected path for the next 15 minutes to 7 days,
              and receives a score based on direction, magnitude, turning points, and volatility regime.
            </p>
          </Section>

          {/* Core Loop */}
          <Section title="Core Loop">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StepCard n="1" title="Select" body="BTC + fixed horizon." />
              <StepCard n="2" title="Lock" body="Chart freezes at anchor." />
              <StepCard n="3" title="Draw" body="Freehand, then normalized." />
              <StepCard n="4" title="Score" body="120-pt log-return comparison." />
            </div>
          </Section>

          {/* Scoring Engine */}
          <Section title="Scoring Engine">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {scoringComponents.map((c) => (
                <div key={c.title} className="dtc-panel-subtle p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                    <span className="dtc-data text-[11px]" style={{ color: 'var(--accent)' }}>{c.points}</span>
                  </div>
                  <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>{c.body}</p>
                  <code className="block text-[10px] dtc-data px-2 py-1.5 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                    {c.formula}
                  </code>
                </div>
              ))}
            </div>

            {/* Calibration table */}
            <div className="overflow-hidden rounded" style={{ border: '1px solid var(--border)' }}>
              <div className="px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span className="dtc-eyebrow">Calibration</span>
              </div>
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderTop: '1px solid var(--border)' }}>
                    <th className="text-left px-3 py-1.5 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>Strategy</th>
                    <th className="text-right px-3 py-1.5 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>Mean</th>
                    <th className="text-right px-3 py-1.5 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {calibrationRows.map(([label, mean, target]) => (
                    <tr key={label} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="px-3 py-1.5 dtc-data" style={{ color: 'var(--text-primary)' }}>{label}</td>
                      <td className="text-right px-3 py-1.5 dtc-data" style={{ color: 'var(--text-primary)' }}>{mean}</td>
                      <td className="text-right px-3 py-1.5 dtc-data" style={{ color: 'var(--text-muted)' }}>{target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Payout Engine */}
          <Section title="Payout Engine">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="mb-3">
                  Two-zone curve: refund below break-even, convex profit above. Fixed in advance so the player
                  always knows the settlement surface before submitting.
                </p>
                <code className="block text-[10px] dtc-data px-2 py-1.5 rounded mb-2" style={{ background: 'var(--bg-primary)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                  M(x) = M_min + (1-h-M_min) * (x/x_be)^alpha
                </code>
                <code className="block text-[10px] dtc-data px-2 py-1.5 rounded mb-3" style={{ background: 'var(--bg-primary)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                  M(x) = min(M_max, (1-h) * exp(k*(x-x_be)/(1-x_be)))
                </code>
                <div className="grid grid-cols-2 gap-2">
                  <MetaCell label="House edge" value="2%" />
                  <MetaCell label="Break-even" value={`${breakEvenScore}`} />
                  <MetaCell label="Min mult" value={`${DEFAULT_PAYOUT_CONFIG.minMultiplier.toFixed(2)}x`} />
                  <MetaCell label="Max mult" value={`${DEFAULT_PAYOUT_CONFIG.maxMultiplier}x`} />
                </div>
              </div>
              <div className="overflow-hidden rounded" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <th className="text-left px-3 py-2 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>Score</th>
                      <th className="text-right px-3 py-2 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>Mult</th>
                      <th className="text-right px-3 py-2 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutRows.map((row) => (
                      <tr key={row.score} style={{ borderTop: '1px solid var(--border)', background: row.score === breakEvenScore ? 'var(--accent-soft)' : 'transparent' }}>
                        <td className="px-3 py-1.5 dtc-data" style={{ color: row.score === breakEvenScore ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {row.score}{row.score === breakEvenScore ? ' BE' : ''}
                        </td>
                        <td className="text-right px-3 py-1.5 dtc-data" style={{ color: 'var(--text-secondary)' }}>
                          {formatMultiplier(row.multiplier)}
                        </td>
                        <td className="text-right px-3 py-1.5 dtc-data" style={{ color: row.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {formatProfit(row.profit, row.profit % 1 === 0 ? 0 : 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* Trust & Roadmap */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InfoCard title="Trust & Fairness" body="Deterministic scoring, replayable rounds, config visibility. Live adds commit-reveal and auditable settlement." />
            <InfoCard title="House Risk" body="Reserve exposure across open rounds, cap single-round payouts, treat overlapping horizons as correlated risk." />
            <InfoCard title="Compliance" body="Speculative entertainment. Geo controls, age gating, session controls, and loss disclosure for live launch." />
          </div>

          {/* Roadmap */}
          <Section title="Roadmap">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StepCard n="1" title="Sandbox" body="Scoring, replay, normalization, payout previews." />
              <StepCard n="2" title="Live" body="Commit-reveal, wallets, risk-aware stakes, settlement." />
              <StepCard n="3" title="Depth" body="Public replays, social, tournaments, multi-asset." />
            </div>
          </Section>
        </div>

        <footer className="mt-8 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            DTC Sandbox &middot; Concept product. Not financial advice.
          </p>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="dtc-panel p-5">
      <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </div>
    </div>
  );
}

function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="dtc-panel-subtle p-3">
      <div className="dtc-data text-[10px] mb-1" style={{ color: 'var(--accent)' }}>{n}</div>
      <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</div>
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{body}</p>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 text-center" style={{ background: 'var(--bg-secondary)' }}>
      <div className="dtc-eyebrow mb-1">{label}</div>
      <div className="dtc-data text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="dtc-panel p-4">
      <h3 className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{body}</p>
    </div>
  );
}
