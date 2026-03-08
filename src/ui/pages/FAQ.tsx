import { Link } from 'react-router-dom';
import { DEFAULT_PAYOUT_CONFIG, getBreakEvenScore } from '../../scoring/payout';
import {
  formatMoney,
  formatMultiplier,
  getPayoutExample,
} from '../lib/payoutPresentation';

export function FAQ() {
  const breakEvenScore = getBreakEvenScore();
  const payoutExamples = [30, 50, breakEvenScore, 70, 80, 90, 95].map((score) =>
    getPayoutExample(score, 100),
  );
  const profitExamples = {
    score70: getPayoutExample(70, 100).multiplier,
    score80: getPayoutExample(80, 100).multiplier,
    score90: getPayoutExample(90, 100).multiplier,
  };

  return (
    <div className="min-h-screen pt-12">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="dtc-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              How It Works
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Scoring, payout, and fairness mechanics.
            </p>
          </div>
          <Link
            to="/whitepaper"
            className="px-3 py-1.5 text-xs font-medium no-underline dtc-button-secondary shrink-0"
          >
            Full Paper
          </Link>
        </div>

        <div className="space-y-4">
          <Section title="Scoring">
            <p className="mb-3">
              Your prediction is scored across 4 components, totaling 0-100:
            </p>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-px rounded overflow-hidden mb-3"
              style={{ background: 'var(--border)', border: '1px solid var(--border)' }}
            >
              <ScoreComponent name="Direction" max={40} description="Multi-scale trend matching. Coarser scales weighted more." />
              <ScoreComponent name="Magnitude" max={30} description="Bias and tracking error, normalized by realized volatility." />
              <ScoreComponent name="Turning Points" max={20} description="Peaks and troughs matched via Hungarian algorithm." />
              <ScoreComponent name="Volatility" max={10} description="Quarter-by-quarter volatility regime comparison." />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Both paths are converted to log-return space and resampled to 120 points.
            </p>
          </Section>

          <Section title="Payouts">
            <p className="mb-3">Two-zone multiplier curve:</p>
            <ul className="space-y-1.5 mb-3">
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Below {breakEvenScore}</strong> — partial refund, scaling from 0.40x up.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Above {breakEvenScore}</strong> — profit zone. 70={formatMultiplier(profitExamples.score70)}, 80={formatMultiplier(profitExamples.score80)}, 90={formatMultiplier(profitExamples.score90)}.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Hard cap</strong> — {DEFAULT_PAYOUT_CONFIG.maxMultiplier}x maximum.
              </li>
            </ul>
            <div
              className="overflow-hidden rounded"
              style={{ border: '1px solid var(--border)' }}
            >
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th className="text-left px-3 py-2 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>Score</th>
                    <th className="text-right px-3 py-2 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>Mult</th>
                    <th className="text-right px-3 py-2 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>$100 Bet</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutExamples.map((ex) => {
                    const isBreakEven = ex.score === breakEvenScore;
                    const profit = ex.score >= breakEvenScore;
                    return (
                      <tr
                        key={ex.score}
                        style={{
                          borderTop: '1px solid var(--border)',
                          background: isBreakEven ? 'var(--accent-soft)' : 'transparent',
                        }}
                      >
                        <td className="px-3 py-1.5 dtc-data" style={{ color: isBreakEven ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {ex.score}{isBreakEven ? ' BE' : ''}
                        </td>
                        <td className="text-right px-3 py-1.5 dtc-data" style={{ color: profit ? 'var(--green)' : 'var(--text-secondary)' }}>
                          {formatMultiplier(ex.multiplier)}
                        </td>
                        <td className="text-right px-3 py-1.5 dtc-data" style={{ color: profit ? 'var(--green)' : 'var(--text-secondary)' }}>
                          {formatMoney(ex.payout)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="House Edge">
            <p>
              2% edge. A break-even score ({breakEvenScore}/100) returns 98% of stake.
              The edge funds high-score payouts and operational costs.
            </p>
          </Section>

          <Section title="Fairness">
            <ol className="space-y-1.5 list-decimal list-inside">
              <li><strong style={{ color: 'var(--text-primary)' }}>Deterministic rounds</strong> — seed maps to reproducible historical data.</li>
              <li><strong style={{ color: 'var(--text-primary)' }}>Commitment proof</strong> — hash, reveal payload, and verification endpoint.</li>
              <li><strong style={{ color: 'var(--text-primary)' }}>Public config</strong> — scoring, payout, and protocol versions exposed via API.</li>
            </ol>
          </Section>

          <Section title="Assets & Timeframes">
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span style={{ color: 'var(--text-primary)' }}>BTC/USDT</span>
              {['15m', '1h', '6h', '24h', '7d'].map((tf) => (
                <span
                  key={tf}
                  className="dtc-data px-2 py-0.5 rounded"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                >
                  {tf}
                </span>
              ))}
            </div>
          </Section>

          <Section title="Sandbox Mode">
            <p>
              Uses historical price data for instant feedback. No real money at stake.
              Rounds are saved locally in your browser.
            </p>
          </Section>
        </div>

        <footer className="mt-8 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              DTC Sandbox. Not financial advice.
            </span>
            <Link
              to="/validate"
              className="text-xs no-underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Scoring Validation Tool &rarr;
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="dtc-panel p-4">
      <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </div>
    </div>
  );
}

function ScoreComponent({ name, max, description }: { name: string; max: number; description: string }) {
  return (
    <div className="p-3" style={{ background: 'var(--bg-secondary)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
        <span className="dtc-data text-[11px]" style={{ color: 'var(--accent)' }}>{max} pts</span>
      </div>
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{description}</p>
    </div>
  );
}
