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
    <div
      className="pt-20 pb-16 px-6"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(207, 123, 53, 0.12), transparent 24%), radial-gradient(circle at bottom right, rgba(72, 183, 132, 0.08), transparent 16%), var(--bg-primary)',
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          className="dtc-panel p-7 mb-8"
          style={{
            background: 'rgba(14, 18, 15, 0.84)',
            border: '1px solid rgba(58, 70, 59, 0.72)',
            boxShadow: 'var(--shadow-soft)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <h1
                className="dtc-display text-5xl font-semibold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                How It Works
              </h1>
              <p className="text-sm max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
                The mechanics behind scoring, payout, fairness, and sandbox rounds.
              </p>
            </div>
            <Link
              to="/whitepaper"
              className="px-4 py-2 text-sm font-semibold no-underline dtc-button-secondary"
            >
              Full Whitepaper
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <InfoChip label="Scoring" value="4 components" />
            <InfoChip label="Resampling" value="120 points" />
            <InfoChip label="Break-even" value={`${breakEvenScore.toFixed(0)} score`} />
          </div>
        </div>

        <div className="space-y-8">
          <Section title="How does scoring work?">
            <p>
              Your prediction is scored across 4 components, totaling 0-100 points:
            </p>
            <div className="mt-4 space-y-3">
              <ScoreComponent
                name="Direction Accuracy"
                max={40}
                description="Did you get the direction right? Evaluated at multiple time scales — halves, quarters, eighths, and sixteenths of the prediction horizon. Coarser scales are weighted more heavily. Getting the broad trend right matters most."
              />
              <ScoreComponent
                name="Magnitude Accuracy"
                max={30}
                description="How close was your predicted level to the actual price path? Measures both systematic bias (consistently too high or low) and tracking error (how closely you followed the actual moves). Both are normalized by realized volatility."
              />
              <ScoreComponent
                name="Turning Points"
                max={20}
                description="Did you predict the right peaks and troughs? Significant turning points in both your prediction and the actual path are detected and matched using the Hungarian algorithm. Points are awarded for correct timing and amplitude of turns."
              />
              <ScoreComponent
                name="Volatility Regime"
                max={10}
                description="Did you predict the right amount of movement? The prediction horizon is split into 4 quarters. The volatility in each quarter of your prediction is compared to the actual volatility."
              />
            </div>
            <p className="mt-4">
              Both paths are converted to log-return space and resampled to 120 evenly-spaced points before scoring, ensuring fair comparison regardless of the drawing resolution.
            </p>
          </Section>

          <Section title="How do payouts work?">
            <p>
              Your score maps to a payout multiplier through a two-zone curve:
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Below {breakEvenScore.toFixed(0)} (break-even):</strong> You get a partial refund. Higher scores within this zone recover more of your stake.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Above {breakEvenScore.toFixed(0)}:</strong> You earn a profit. With the current curve, a score of 70 returns about {formatMultiplier(profitExamples.score70)}, 80 returns {formatMultiplier(profitExamples.score80)}, and 90 returns {formatMultiplier(profitExamples.score90)}.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Hard cap:</strong> Maximum multiplier is {DEFAULT_PAYOUT_CONFIG.maxMultiplier.toFixed(0)}x to protect the bankroll.
              </li>
            </ul>
            <div
              className="mt-4 p-4 text-sm dtc-panel-subtle"
              style={{ background: 'rgba(18, 24, 19, 0.78)', border: '1px solid rgba(58, 70, 59, 0.44)' }}
            >
              <div className="grid grid-cols-3 gap-3 text-center">
                <div style={{ color: 'var(--text-muted)' }}>Score</div>
                <div style={{ color: 'var(--text-muted)' }}>Multiplier</div>
                <div style={{ color: 'var(--text-muted)' }}>$100 Bet</div>
                {payoutExamples.map((example) => (
                  <Row
                    key={example.score}
                    score={example.score}
                    mult={formatMultiplier(example.multiplier)}
                    pay={formatMoney(example.payout)}
                  />
                ))}
              </div>
            </div>
          </Section>

          <Section title="What is the house edge?">
            <p>
              The house edge is 2%. This means a perfectly break-even score ({breakEvenScore.toFixed(0)}/100) returns 98% of your stake.
              The edge funds the prize pool backing for high-scoring predictions and covers operational costs.
            </p>
          </Section>

          <Section title="Is it provably fair?">
            <p>
              The sandbox already exposes the fairness skeleton the live product will rely on:
            </p>
            <ol className="mt-3 space-y-2 list-decimal list-inside">
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Deterministic round selection:</strong> A seed maps to a reproducible historical segment, so a shared sandbox round can be replayed exactly.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Commitment proof:</strong> The sandbox API exposes a commitment hash, a reveal payload, and a verification endpoint for settled rounds.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Public config surface:</strong> The scoring, payout, and protocol versions are available through the API manifest so clients can see what rules were active.
              </li>
            </ol>
            <p className="mt-3">
              In the live product, this becomes a full commit-reveal settlement pipeline. In the sandbox, the goal is narrower: reproducible rounds, inspectable proofs, and visible scoring rules.
            </p>
          </Section>

          <Section title="What assets and timeframes are supported?">
            <p>Currently supported:</p>
            <ul className="mt-3 space-y-1">
              <li><strong style={{ color: 'var(--text-primary)' }}>Asset:</strong> BTC/USDT</li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Timeframes:</strong> 15 minutes, 1 hour, 6 hours, 24 hours, 7 days
              </li>
            </ul>
            <p className="mt-3">
              More assets (ETH, SOL, etc.) will be added in future releases. Each timeframe uses appropriately-resolved candle data — 1-minute candles for short horizons, up to 1-hour candles for the 7-day timeframe.
            </p>
          </Section>

          <Section title="What is sandbox mode?">
            <p>
              Sandbox mode uses historical price data so you can practice without waiting for real-time results. When you start a round, a seeded historical period is selected. After you draw your prediction, the actual price path is revealed instantly.
            </p>
            <p className="mt-2">
              No real money is at stake in sandbox mode. Completed rounds are saved locally in your browser so the leaderboard becomes a real sandbox journal instead of a synthetic feed.
            </p>
          </Section>
        </div>
      </div>

      <footer className="mt-16 pt-8 text-center" style={{ borderTop: '1px solid rgba(54, 58, 69, 0.3)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          This is a concept product. Not financial advice.
        </p>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="dtc-panel p-6"
      style={{
        background: 'rgba(14, 18, 15, 0.84)',
        border: '1px solid rgba(58, 70, 59, 0.72)',
      }}
    >
      <h2 className="dtc-display text-3xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
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
    <div
      className="p-4 dtc-panel-subtle"
      style={{ background: 'rgba(18, 24, 19, 0.78)', border: '1px solid rgba(58, 70, 59, 0.44)' }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
        <span className="text-xs dtc-data" style={{ color: 'var(--text-muted)' }}>0-{max} pts</span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</p>
    </div>
  );
}

function Row({ score, mult, pay }: { score: number; mult: string; pay: string }) {
  const profit = score >= getBreakEvenScore();
  return (
    <>
      <div style={{ color: 'var(--text-primary)' }}>{score}</div>
      <div style={{ color: profit ? 'var(--green)' : 'var(--text-secondary)' }}>{mult}</div>
      <div style={{ color: profit ? 'var(--green)' : 'var(--text-secondary)' }}>{pay}</div>
    </>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-4 py-3 dtc-panel-subtle"
      style={{
        background: 'rgba(18, 24, 19, 0.78)',
        border: '1px solid rgba(58, 70, 59, 0.44)',
      }}
    >
      <div className="dtc-eyebrow mb-1">
        {label}
      </div>
      <div className="text-sm font-semibold dtc-data" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}
