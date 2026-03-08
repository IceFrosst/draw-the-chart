import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_PAYOUT_CONFIG, getBreakEvenScore } from '../../scoring/payout';
import { getPayoutExample, formatMoney, formatMultiplier, formatProfit } from '../lib/payoutPresentation';

const competitiveLandscape = [
  {
    title: 'Prediction markets',
    body: 'Strong at event resolution, weak at expressing path shape, timing, and volatility structure.',
  },
  {
    title: 'Perp trading',
    body: 'Strong at execution flexibility, but operationally heavy for users who simply want to express a chart thesis.',
  },
  {
    title: 'Social charting',
    body: 'Strong at expression, weak at economic closure. The chart exists, but settlement does not.',
  },
  {
    title: 'Casino convexity',
    body: 'Strong at excitement, weak at perceived analytical agency. DTC keeps convexity but restores market context.',
  },
];

const scoringComponents = [
  {
    title: 'Direction',
    points: '0-40',
    body: 'Multi-scale segment sign matching across halves, quarters, eighths, and sixteenths with coarser scales weighted more heavily.',
    formula: 'DirectionScore = 40 * sum(w_l * H_l) / sum(w_l)',
  },
  {
    title: 'Magnitude',
    points: '0-30',
    body: 'Bias and debiased tracking error are separated, then normalized by realized volatility before being passed through an exponential decay.',
    formula: 'MagnitudeScore = 30 * exp(-lambda * normalized_error)',
  },
  {
    title: 'Turning Points',
    points: '0-20',
    body: 'Smoothed local extrema are detected, matched, and penalized for hallucinated or missed reversals.',
    formula: 'TurningScore = matched_turn_quality - penalties',
  },
  {
    title: 'Volatility Regime',
    points: '0-10',
    body: 'Predicted versus realized volatility is compared quarter by quarter to reward matching the rhythm of the round.',
    formula: 'ShapeScore = 10 * exp(-mu * regime_mismatch)',
  },
];

const calibrationRows = [
  ['Random Walk', '35.0', '30-35'],
  ['Flat Line', '25.7', '25-35'],
  ['Naive Trend', '39.5', '35-50'],
  ['Near Perfect', '98.7', '≈100'],
];

const roadmap = [
  {
    phase: 'Sandbox',
    title: 'Trust the mechanic',
    body: 'Calibrated scoring, historical replay, path normalization, payout previews, and a reviewable reveal flow.',
  },
  {
    phase: 'Live',
    title: 'Trust the round lifecycle',
    body: 'Commit-reveal rounds, persistence, wallet connection, risk-aware stake limits, and real settlement infrastructure.',
  },
  {
    phase: 'Depth',
    title: 'Trust the venue',
    body: 'Public replays, social surfaces, additional assets, tournaments, and more sophisticated bankroll operations.',
  },
];

const nowItems = [
  'Pure-function scoring engine with tests',
  'Backtest harness using BTC 1-minute data',
  'Sandbox rounds on historical candles',
  'Future-zone draw interaction with normalized control points',
  'Visible score breakdown and payout curve',
  'Sandbox API with round start, submit, settle, and replay',
];

const laterItems = [
  'Wallet connection and balances',
  'Persistent accounts and round history',
  'Live bankroll-backed settlement',
  'Correlation-aware exposure controls',
  'Production oracle stack and failure policies',
  'Licensed full charting suite if exact exchange parity is required',
];

const breakEvenScore = getBreakEvenScore();
const payoutRows = [0, 20, 40, 55, breakEvenScore, 70, 80, 90, 95, 100].map(
  (score) => getPayoutExample(score, 100),
);

const downloadLinks = [
  { label: 'Open full document', href: '/whitepaper-full.html' },
  { label: 'Download DOCX', href: '/DrawTheChart_Whitepaper_v1.1.docx', download: true },
  { label: 'Download Markdown', href: '/WHITEPAPER.md', download: true },
];

export function Whitepaper() {
  return (
    <div
      className="min-h-screen pt-20 pb-20 px-4 sm:px-6"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(207, 123, 53, 0.12), transparent 24%), radial-gradient(circle at bottom right, rgba(72, 183, 132, 0.08), transparent 16%), var(--bg-primary)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <section className="dtc-panel p-8 sm:p-12 mb-8" style={panelStyle}>
          <div className="flex flex-col xl:flex-row justify-between gap-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-5" style={tagStyle}>
                <span className="inline-block h-2 w-2" style={{ background: 'var(--accent)' }} />
                Whitepaper v1.1
              </div>
              <h1 className="dtc-display text-5xl sm:text-6xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Draw The Chart
              </h1>
              <p className="text-lg leading-8 max-w-2xl mb-6" style={{ color: 'var(--text-secondary)' }}>
                A chart-native BTC prediction game where players draw a future price path, get scored in log-return space,
                and settle against a published payout curve instead of a binary outcome.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/play" className="px-5 py-3 text-sm font-semibold no-underline dtc-button-primary" style={primaryButtonStyle}>
                  Open Sandbox
                </Link>
                {downloadLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    download={item.download}
                    target={item.download ? undefined : '_blank'}
                    rel={item.download ? undefined : 'noreferrer'}
                    className="px-5 py-3 text-sm font-semibold no-underline dtc-button-secondary"
                    style={secondaryButtonStyle}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 min-w-[280px] self-start">
              <MetaCard label="Asset" value="BTC / USDT" />
              <MetaCard label="Horizons" value="15m to 7d" />
              <MetaCard label="Scoring" value="0 to 100" />
              <MetaCard
                label="Payout Cap"
                value={`${DEFAULT_PAYOUT_CONFIG.maxMultiplier.toFixed(0)}x`}
              />
              <MetaCard label="Resample" value="120 pts" />
              <MetaCard label="Status" value="Sandbox first" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 mb-8">
          <div className="dtc-panel p-7" style={panelStyle}>
            <SectionTitle>What DTC Is</SectionTitle>
            <p className="text-sm leading-7 mb-4" style={{ color: 'var(--text-secondary)' }}>
              DTC sits between prediction markets and trading. It is more expressive than a yes-or-no market,
              simpler than a leveraged position, and more skill-flavored than a generic convex gambling product.
              The chart is not decoration. It is the game object.
            </p>
            <p className="text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
              The player sees the historical BTC chart up to a fixed anchor, draws the expected path for the next
              15 minutes to 7 days, and receives a score based on direction, magnitude, turning points, and volatility regime.
            </p>
          </div>

          <div className="dtc-panel p-7" style={panelStyle}>
            <SectionTitle>Current Scope</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <BulletPanel title="In the repo today" items={nowItems} />
              <BulletPanel title="Still part of live rollout" items={laterItems} />
            </div>
          </div>
        </section>

        <section className="dtc-panel p-7 mb-8" style={panelStyle}>
          <SectionTitle>Why This Product Should Exist</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {competitiveLandscape.map((item) => (
              <div key={item.title} className="p-5 dtc-panel-subtle" style={subPanelStyle}>
                <div className="dtc-eyebrow mb-2" style={{ color: 'var(--accent-strong)' }}>
                  Market context
                </div>
                <h3 className="dtc-display text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-6 mb-8">
          <div className="dtc-panel p-7" style={panelStyle}>
            <SectionTitle>Core Loop</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StepCard step="01" title="Select" body="Pick BTC and one fixed horizon. The product stays intentionally narrow." />
              <StepCard step="02" title="Lock" body="The chart freezes at a known anchor and a future draw zone opens to the right." />
              <StepCard step="03" title="Draw" body="Freehand capture records the thesis first, then the path is normalized into valid control points." />
              <StepCard step="04" title="Score" body="Prediction and realized path are resampled to 120 points and compared in log-return space." />
            </div>
          </div>

          <div className="dtc-panel p-7" style={panelStyle}>
            <SectionTitle>Input Model</SectionTitle>
            <ul className="space-y-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              <li>The chart history uses candles; the prediction uses a continuous line.</li>
              <li>Historical context stays visible while the future zone opens as a fixed overlay.</li>
              <li>The normalized path enforces control-point count, increasing time, slope caps, and full-horizon coverage.</li>
              <li>Technical analysis tools support interpretation but do not change the authoritative scored path.</li>
            </ul>
          </div>
        </section>

        <section className="dtc-panel p-7 mb-8" style={panelStyle}>
          <SectionTitle>Scoring Engine</SectionTitle>
          <p className="text-sm leading-7 max-w-4xl mb-6" style={{ color: 'var(--text-secondary)' }}>
            DTC scores the forecast in four components. The engine is a standalone pure module, which keeps it
            deterministic, testable, and independently backtestable. Calibration is treated as a requirement, not an aesthetic preference.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {scoringComponents.map((component) => (
              <div key={component.title} className="p-5 dtc-panel-subtle" style={subPanelStyle}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="dtc-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {component.title}
                  </h3>
                  <span className="text-xs dtc-data" style={{ color: 'var(--text-muted)' }}>
                    {component.points}
                  </span>
                </div>
                <p className="text-sm leading-6 mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {component.body}
                </p>
                <FormulaBlock>{component.formula}</FormulaBlock>
              </div>
            ))}
          </div>

          <div className="p-5 dtc-panel-subtle" style={subPanelStyle}>
            <div className="dtc-eyebrow mb-3" style={{ color: 'var(--accent-strong)' }}>
              Calibration snapshot
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs mb-3 dtc-data" style={{ color: 'var(--text-muted)' }}>
              <span>Strategy</span>
              <span>Current mean</span>
              <span>Target band</span>
            </div>
            <div className="space-y-2">
              {calibrationRows.map(([label, mean, target]) => (
                <div
                  key={label}
                  className="grid grid-cols-3 gap-3 px-3 py-2 text-sm dtc-data"
                  style={{
                    background: 'rgba(13, 17, 14, 0.8)',
                    border: '1px solid rgba(58, 70, 59, 0.38)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span>{label}</span>
                  <span>{mean}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{target}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-6 mb-8">
          <div className="dtc-panel p-7" style={panelStyle}>
            <SectionTitle>Payout Engine</SectionTitle>
            <p className="text-sm leading-7 mb-4" style={{ color: 'var(--text-secondary)' }}>
              The payout curve is explicitly two-zoned: refund below break-even and convex profit above it. The current MVP
              keeps the curve fixed in advance so the player always knows the settlement surface before submitting. The latest tuning
              raises weak-round refunds, rounds break-even to a cleaner threshold, and lowers the tail cap so the system feels fairer
              to regular users without making bankroll risk sloppy.
            </p>
            <div className="space-y-3">
              <FormulaBlock>M(x) = M_min + (1 - h - M_min) * (x / x_be)^alpha</FormulaBlock>
              <FormulaBlock>M(x) = min(M_max, (1 - h) * exp(k * (x - x_be) / (1 - x_be)))</FormulaBlock>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <MetaCard label="House edge" value="2%" />
              <MetaCard label="Break-even" value={`${breakEvenScore.toFixed(0)} score`} />
              <MetaCard
                label="Min multiplier"
                value={`${DEFAULT_PAYOUT_CONFIG.minMultiplier.toFixed(2)}x`}
              />
              <MetaCard
                label="Max multiplier"
                value={`${DEFAULT_PAYOUT_CONFIG.maxMultiplier.toFixed(0)}x`}
              />
            </div>
          </div>

          <div className="dtc-panel p-7" style={panelStyle}>
            <SectionTitle>Example Payouts</SectionTitle>
            <div className="grid grid-cols-4 gap-3 text-xs mb-3 dtc-data" style={{ color: 'var(--text-muted)' }}>
              <span>Score</span>
              <span>Multiplier</span>
              <span>Payout</span>
              <span>Result</span>
            </div>
            <div className="space-y-2">
              {payoutRows.map((row) => (
                <div
                  key={row.score}
                  className="grid grid-cols-4 gap-3 px-3 py-2 text-sm dtc-data"
                  style={{
                    background: 'rgba(13, 17, 14, 0.8)',
                    border: '1px solid rgba(58, 70, 59, 0.38)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span>{row.score}</span>
                  <span>{formatMultiplier(row.multiplier)}</span>
                  <span>{formatMoney(row.payout, row.payout % 1 === 0 ? 0 : 2)}</span>
                  <span style={{ color: row.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {formatProfit(row.profit, row.profit % 1 === 0 ? 0 : 2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <InfoPanel
            title="Trust and fairness"
            body="The sandbox already exposes deterministic scoring, replayable rounds, and config visibility. The live design layers commit-reveal, auditable settlement payloads, and documented failure policies on top."
          />
          <InfoPanel
            title="House risk"
            body="The live product must reserve exposure across open rounds, cap single-round payouts, and treat overlapping BTC horizons as correlated risk rather than independent bets."
          />
          <InfoPanel
            title="Compliance posture"
            body="DTC should be treated as a speculative entertainment product. Geo controls, age gating, session controls, and explicit loss disclosure are part of the real launch surface."
          />
        </section>

        <section className="dtc-panel p-7 mb-8" style={panelStyle}>
          <SectionTitle>Roadmap</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roadmap.map((item) => (
              <div key={item.phase} className="p-5 dtc-panel-subtle" style={subPanelStyle}>
                <div className="dtc-eyebrow mb-2" style={{ color: 'var(--accent-strong)' }}>
                  {item.phase}
                </div>
                <h3 className="dtc-display text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="dtc-panel p-7 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5"
          style={panelStyle}
        >
          <div className="max-w-3xl">
            <SectionTitle>Full Document</SectionTitle>
            <p className="text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
              The full whitepaper is maintained as the repo source of truth and exported into shareable formats.
              Use the links on this page for the long-form document, downloadable markdown, and DOCX handoff.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {downloadLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                download={item.download}
                target={item.download ? undefined : '_blank'}
                rel={item.download ? undefined : 'noreferrer'}
                className="px-5 py-3 text-sm font-semibold no-underline dtc-button-secondary"
                style={secondaryButtonStyle}
              >
                {item.label}
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="dtc-display text-4xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
      {children}
    </h2>
  );
}

function StepCard({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="p-5 dtc-panel-subtle" style={subPanelStyle}>
      <div className="dtc-eyebrow mb-2" style={{ color: 'var(--accent-strong)' }}>
        {step}
      </div>
      <h3 className="dtc-display text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        {body}
      </p>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 dtc-panel-subtle" style={subPanelStyle}>
      <div className="dtc-eyebrow mb-2">{label}</div>
      <div className="dtc-data text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function InfoPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="dtc-panel p-6" style={panelStyle}>
      <div className="dtc-eyebrow mb-2" style={{ color: 'var(--accent-strong)' }}>
        Product paper
      </div>
      <h3 className="dtc-display text-3xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <p className="text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
        {body}
      </p>
    </div>
  );
}

function BulletPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="p-4 dtc-panel-subtle" style={subPanelStyle}>
      <div className="dtc-eyebrow mb-2" style={{ color: 'var(--accent-strong)' }}>
        {title}
      </div>
      <ul className="space-y-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function FormulaBlock({ children }: { children: ReactNode }) {
  return (
    <code
      className="block px-4 py-3 text-xs dtc-data"
      style={{
        background: 'rgba(10, 13, 11, 0.9)',
        color: 'var(--accent-strong)',
        border: '1px solid rgba(58, 70, 59, 0.44)',
      }}
    >
      {children}
    </code>
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
