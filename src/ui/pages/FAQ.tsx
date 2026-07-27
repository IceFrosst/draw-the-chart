import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { multiplierAt, STANDARD_PAYOUT_V3, DEFAULT_FIELD_CONFIG } from '../../scoring/v3/index';

export function FAQ() {
  const breakEvenPct = Math.round(100 * STANDARD_PAYOUT_V3.breakEvenPercentile);
  const edgePct = (100 * STANDARD_PAYOUT_V3.houseEdge).toFixed(0);
  const fieldSize = DEFAULT_FIELD_CONFIG.B.toLocaleString();

  const payoutRows = useMemo(
    () =>
      [25, 50, 65, 80, 90, 95, 99, 100].map((score) => ({
        score,
        multiplier: multiplierAt(score / 100),
      })),
    [],
  );

  return (
    <div className="min-h-screen pt-12">
      <div className="max-w-3xl mx-auto px-6 py-14">
        <div className="mb-12">
          <div className="dtc-eyebrow mb-3">Documentation</div>
          <h1 className="dtc-display text-3xl mb-3" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            How It Works
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', maxWidth: 460, lineHeight: 1.65 }}>
            The field, the score, the payout — and why none of it can cheat you.
            The formal version lives in the{' '}
            <Link to="/whitepaper" style={{ color: 'var(--accent)' }} className="no-underline">whitepaper</Link>.
          </p>
        </div>

        <Section n="01" title="Your score is a rank, not a grade">
          <p className="mb-4">
            When your round settles, DTC generates{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{fieldSize} simulated forecasts</strong> for
            that exact round — the field — and measures every one of them against what actually
            happened, using the same yardstick as your drawing. Your score is the share of the field you beat:
          </p>
          <div
            className="dtc-data text-[13px] px-4 py-3 rounded mb-4"
            style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '2px solid var(--accent)', color: 'var(--text-primary)' }}
          >
            Score 77 = your line was closer to reality than 77% of the field
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Because the field faces the same market you do, difficulty cancels out — a calm Sunday and
            a violent breakout are equally fair. 50 is an average no-insight result; {breakEvenPct} breaks
            even; 99+ is jackpot territory.
          </p>
        </Section>

        <Section n="02" title="Who is in the field">
          <p className="mb-4">
            Every strategy a player <em>without</em> market insight could use — so copying one of them
            can never beat the house:
          </p>
          <table className="dtc-table-hairline text-xs">
            <tbody>
              <FieldRow share="40%" name="Market noise" desc="realistic wiggles stitched from recent BTC behavior" />
              <FieldRow share="20%" name="Random walks" desc="pure randomness at current volatility" />
              <FieldRow share="15%" name="Trend followers" desc="it's been going up, so it keeps going up" />
              <FieldRow share="10%" name="Mean reverters" desc="it moved too far, it'll come back" />
              <FieldRow share="10%" name="Flat & drift lines" desc="not much will happen" />
              <FieldRow share="5%" name="Lazy shapes" desc="smoothed, low-effort plausible paths" />
            </tbody>
          </table>
          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            The field is generated deterministically from the round's seed — it cannot be regenerated
            after the fact to hand you a worse rank, and anyone can reproduce it to verify a settled round.
          </p>
        </Section>

        <Section n="03" title="How closeness is measured">
          <table className="dtc-table-hairline text-xs">
            <tbody>
              <FieldRow share="50" name="Shape & Timing" desc="moves like reality moved — slightly early or late still counts, no cliffs" />
              <FieldRow share="30" name="Direction" desc="up when it went up, weighted by how big each move was" />
              <FieldRow share="20" name="Level" desc="finished near the right price, no systematic drift" />
            </tbody>
          </table>
          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            This 0–100 accuracy is only used to <em>rank</em> you against the field — money always flows
            through the rank. Paths are compared in log-return space at 120 points.
          </p>
        </Section>

        <Section n="04" title="Payouts">
          <p className="mb-4">
            Three zones: partial refunds below break-even, growing profits above it, and a jackpot tail
            for beating essentially everyone. Cap: {STANDARD_PAYOUT_V3.maxMultiplier}x.
          </p>
          <table className="dtc-table-hairline text-xs dtc-data" style={{ maxWidth: 380 }}>
            <thead>
              <tr>
                <th>Score</th>
                <th style={{ textAlign: 'right' }}>Mult</th>
                <th style={{ textAlign: 'right' }}>$100 bet returns</th>
              </tr>
            </thead>
            <tbody>
              {payoutRows.map((row) => {
                const isBreakEven = row.score === breakEvenPct;
                const profit = row.score >= breakEvenPct;
                return (
                  <tr key={row.score}>
                    <td style={{ color: isBreakEven ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {row.score}{isBreakEven ? ' · BE' : ''}
                    </td>
                    <td style={{ textAlign: 'right', color: profit ? 'var(--green)' : 'var(--text-secondary)' }}>
                      {row.multiplier.toFixed(2)}x
                    </td>
                    <td style={{ textAlign: 'right', color: profit ? 'var(--green)' : 'var(--text-secondary)' }}>
                      ${(100 * row.multiplier).toFixed(0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section n="05" title="The house edge is exact">
          <p>
            A player with no real insight is statistically identical to the field, so their rank is a
            coin toss across all {fieldSize} positions — and the payout curve is built so a random rank
            pays back exactly {100 - Number(edgePct)}% of the stake on average. That {edgePct}% edge holds
            by construction in every market regime: no tuning, no luck. Beating it consistently means
            genuine forecasting skill — which is the point of the game.
          </p>
        </Section>

        <Section n="06" title="Honest quirks">
          <div className="space-y-4">
            <Quirk title="Flat lines lose.">
              Drawing "nothing happens" is a no-thesis play — most of the field expresses some view,
              so flat lines typically rank in the bottom third. The game rewards having an opinion.
            </Quirk>
            <Quirk title="Tail events happen.">
              When the market does something almost nobody could predict, the whole field misses and
              ranks are decided among imperfect forecasts. The reveal flags these rounds and shows how
              the field did, so a strange-feeling score always comes with context.
            </Quirk>
            <Quirk title="Right direction, timid size pays fairly.">
              Call the direction but draw a tenth of the move, and you beat the half of the field that
              leaned wrong — and lose to everyone who committed. The rank reflects exactly that.
            </Quirk>
          </div>
        </Section>

        <Section n="07" title="Fairness & verifiability">
          <div className="space-y-3">
            <Quirk title="Deterministic rounds.">
              Every round replays exactly from its seed, field included.
            </Quirk>
            <Quirk title="Committed before you draw.">
              The round — and the field's seed — is fixed before your first stroke.
            </Quirk>
            <Quirk title="Tested continuously.">
              129 automated checks assert the edge is exact and good drawings beat random ones,
              on every code change.
            </Quirk>
          </div>
        </Section>

        <Section n="08" title="Sandbox">
          <p>
            Rounds replay historical BTC/USDT data across five horizons (15m, 1h, 6h, 24h, 7d) for
            instant feedback. No real money at stake. Your journal is saved locally in this browser.
          </p>
        </Section>

        <footer className="dtc-hairline-top mt-14 pt-5 flex items-center justify-between">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Sandbox — not financial advice.
          </span>
          <Link
            to="/validate"
            className="text-[11px] no-underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Scoring validation tool &rarr;
          </Link>
        </footer>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="dtc-hairline-top py-8 grid grid-cols-[44px_1fr] gap-4">
      <div className="dtc-data text-[11px] pt-1" style={{ color: 'var(--text-muted)' }}>{n}</div>
      <div>
        <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function FieldRow({ share, name, desc }: { share: string; name: string; desc: string }) {
  return (
    <tr>
      <td className="dtc-data" style={{ color: 'var(--accent)', width: 46 }}>{share}</td>
      <td style={{ color: 'var(--text-primary)', width: 150 }}>{name}</td>
      <td style={{ color: 'var(--text-muted)' }}>{desc}</td>
    </tr>
  );
}

function Quirk({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed">
      <strong style={{ color: 'var(--text-primary)' }}>{title}</strong>{' '}
      <span style={{ color: 'var(--text-secondary)' }}>{children}</span>
    </p>
  );
}
