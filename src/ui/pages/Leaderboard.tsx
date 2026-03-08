import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  computeRoundHistoryStats,
  formatRoundAge,
  loadRoundHistory,
  type RoundHistoryEntry,
} from '../lib/roundHistory';

type SortKey = 'score' | 'payout' | 'multiplier';

export function Leaderboard() {
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [entries, setEntries] = useState<RoundHistoryEntry[]>([]);

  useEffect(() => {
    setEntries(loadRoundHistory());

    function syncHistory() {
      setEntries(loadRoundHistory());
    }

    window.addEventListener('storage', syncHistory);
    return () => window.removeEventListener('storage', syncHistory);
  }, []);

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (sortBy === 'score') return b.score.total - a.score.total;
      if (sortBy === 'multiplier') return b.payout.multiplier - a.payout.multiplier;
      return b.payout.payout - a.payout.payout;
    });
  }, [entries, sortBy]);

  const stats = useMemo(() => computeRoundHistoryStats(entries), [entries]);

  return (
    <div
      className="min-h-screen pt-20 pb-16 px-4 sm:px-6"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(207, 123, 53, 0.12), transparent 24%), radial-gradient(circle at bottom right, rgba(72, 183, 132, 0.08), transparent 16%), var(--bg-primary)',
      }}
    >
      <div className="max-w-5xl mx-auto">
        <div
          className="dtc-panel p-7 mb-8"
          style={{
            background: 'rgba(14, 18, 15, 0.84)',
            border: '1px solid rgba(58, 70, 59, 0.72)',
            boxShadow: 'var(--shadow-soft)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="dtc-display text-5xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Sandbox Journal
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Real rounds saved in this browser from the current sandbox build.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="dtc-chip"
                style={{
                  background: 'rgba(72, 183, 132, 0.12)',
                  borderColor: 'rgba(72, 183, 132, 0.3)',
                  color: 'var(--green)',
                }}
              >
                {entries.length} local rounds
              </span>
              <Link
                to="/whitepaper"
                className="px-4 py-2 text-sm font-semibold no-underline dtc-button-secondary"
              >
                Scoring Model
              </Link>
            </div>
          </div>
        </div>

        {entries.length === 0 ? (
          <div
            className="dtc-panel p-8 text-center"
            style={{
              background: 'rgba(14, 18, 15, 0.84)',
              border: '1px solid rgba(58, 70, 59, 0.72)',
            }}
          >
            <div className="dtc-eyebrow mb-3">No history yet</div>
            <h2 className="dtc-display text-4xl font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Play a sandbox round first.
            </h2>
            <p className="text-sm max-w-xl mx-auto mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              Completed rounds are saved locally after settlement. Once you submit a few drawings,
              this page turns into a real journal of scores, multipliers, payout outcomes, and round links.
            </p>
            <Link
              to="/play"
              className="inline-flex px-5 py-2.5 text-sm font-semibold no-underline dtc-button-primary"
            >
              Open Sandbox
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Sorted journal of your recent scored rounds.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs dtc-eyebrow" style={{ color: 'var(--text-muted)' }}>Sort by:</span>
                  <div
                    className="flex items-center gap-0.5 p-0.5"
                    style={{ background: 'rgba(18, 24, 19, 0.78)', border: '1px solid rgba(58, 70, 59, 0.44)' }}
                  >
                    {(['score', 'payout', 'multiplier'] as SortKey[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => setSortBy(key)}
                        className="px-3 py-1 text-xs transition-all capitalize"
                        style={{
                          background: sortBy === key ? 'var(--accent)' : 'transparent',
                          color: sortBy === key ? '#120d09' : 'var(--text-secondary)',
                          fontWeight: sortBy === key ? 600 : 400,
                        }}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="hidden sm:inline text-xs dtc-data" style={{ color: 'var(--text-muted)' }}>
                  Local browser storage
                </span>
              </div>
            </div>

            <div
              className="dtc-panel overflow-x-auto"
              style={{
                background: 'rgba(14, 18, 15, 0.84)',
                border: '1px solid rgba(58, 70, 59, 0.72)',
              }}
            >
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: '760px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(58, 70, 59, 0.52)' }}>
                    <th className="text-left px-3 sm:px-5 py-3 text-xs font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>#</th>
                    <th className="text-left px-3 sm:px-5 py-3 text-xs font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>Round</th>
                    <th className="text-left px-3 sm:px-5 py-3 text-xs font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>Timeframe</th>
                    <th className="text-right px-3 sm:px-5 py-3 text-xs font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>Stake</th>
                    <SortableHeader label="Score" active={sortBy === 'score'} onClick={() => setSortBy('score')} />
                    <SortableHeader label="Multiplier" active={sortBy === 'multiplier'} onClick={() => setSortBy('multiplier')} />
                    <SortableHeader label="Payout" active={sortBy === 'payout'} onClick={() => setSortBy('payout')} />
                    <th className="text-right px-3 sm:px-5 py-3 text-xs font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>Profit</th>
                    <th className="text-right px-3 sm:px-5 py-3 text-xs font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((entry, index) => {
                    const profitable = entry.payout.multiplier >= 1;
                    return (
                      <tr
                        key={entry.id}
                        style={{
                          borderBottom:
                            index < sorted.length - 1
                              ? '1px solid rgba(58, 70, 59, 0.24)'
                              : 'none',
                        }}
                        className="transition-colors"
                        onMouseEnter={(event) => {
                          event.currentTarget.style.background = 'rgba(207, 123, 53, 0.04)';
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <td className="px-3 sm:px-5 py-3 dtc-data" style={{ color: 'var(--text-muted)' }}>
                          {index + 1}
                        </td>
                        <td className="px-3 sm:px-5 py-3">
                          <div className="flex flex-col gap-1">
                            <Link
                              to={entry.sharePath}
                              className="text-sm no-underline"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              Round {entry.roundCode}
                            </Link>
                            <span className="text-[11px] dtc-data" style={{ color: 'var(--text-muted)' }}>
                              BTC/USDT · {entry.historyPoints}/{entry.futurePoints} candles
                            </span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-5 py-3">
                          <span
                            className="inline-block px-2 py-0.5 text-xs dtc-data"
                            style={{ background: 'rgba(207, 123, 53, 0.12)', color: 'var(--accent-strong)', border: '1px solid rgba(207, 123, 53, 0.24)' }}
                          >
                            {entry.timeframe}
                          </span>
                        </td>
                        <td className="px-3 sm:px-5 py-3 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          ${entry.stake.toFixed(0)}
                        </td>
                        <td className="px-3 sm:px-5 py-3 text-right tabular-nums font-medium" style={{
                          color:
                            entry.score.total >= 70
                              ? 'var(--green)'
                              : entry.score.total >= 50
                                ? 'var(--text-primary)'
                                : 'var(--red)',
                        }}>
                          {entry.score.total.toFixed(1)}
                        </td>
                        <td className="px-3 sm:px-5 py-3 text-right tabular-nums" style={{
                          color: profitable ? 'var(--green)' : 'var(--red)',
                        }}>
                          {entry.payout.multiplier.toFixed(2)}x
                        </td>
                        <td className="px-3 sm:px-5 py-3 text-right tabular-nums font-medium" style={{
                          color: profitable ? 'var(--green)' : 'var(--red)',
                        }}>
                          ${entry.payout.payout.toFixed(2)}
                        </td>
                        <td className="px-3 sm:px-5 py-3 text-right tabular-nums" style={{
                          color: entry.payout.profit >= 0 ? 'var(--green)' : 'var(--red)',
                        }}>
                          {entry.payout.profit >= 0 ? '+' : ''}
                          ${entry.payout.profit.toFixed(2)}
                        </td>
                        <td className="px-3 sm:px-5 py-3 text-right text-xs dtc-data" style={{ color: 'var(--text-muted)' }}>
                          {formatRoundAge(entry.settledAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
              <StatCard label="Rounds" value={String(stats.rounds)} />
              <StatCard label="Avg Score" value={stats.avgScore.toFixed(1)} />
              <StatCard label="Avg Multiplier" value={`${stats.avgMultiplier.toFixed(2)}x`} />
              <StatCard label="Profitable" value={`${stats.profitableRate.toFixed(0)}%`} />
              <StatCard
                label="Net Sandbox PnL"
                value={`${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toFixed(2)}`}
                accent={stats.totalProfit >= 0 ? 'var(--green)' : 'var(--red)'}
              />
            </div>
          </>
        )}
      </div>

      <footer className="mt-16 pt-8 text-center" style={{ borderTop: '1px solid rgba(54, 58, 69, 0.3)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Sandbox journal data is local to this browser unless exported.
        </p>
      </footer>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th
      className="text-right px-3 sm:px-5 py-3 text-xs font-medium tracking-wide cursor-pointer select-none transition-colors"
      style={{ color: active ? 'var(--accent-strong)' : 'var(--text-muted)' }}
      onClick={onClick}
    >
      {label}
      {active && <span className="ml-1">&#x25BC;</span>}
    </th>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      className="dtc-panel p-5 text-center"
      style={{
        background: 'rgba(14, 18, 15, 0.84)',
        border: '1px solid rgba(58, 70, 59, 0.72)',
      }}
    >
      <div className="dtc-display text-4xl font-semibold dtc-data mb-1" style={{ color: accent ?? 'var(--text-primary)' }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}
