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
    <div className="min-h-screen pt-12">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="dtc-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Journal
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {entries.length} sandbox rounds saved locally.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-0.5 p-0.5 rounded"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}
            >
              {(['score', 'payout', 'multiplier'] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className="px-2.5 py-1 text-[11px] transition-all capitalize dtc-data rounded"
                  style={{
                    background: sortBy === key ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: sortBy === key ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: sortBy === key ? 600 : 400,
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        </div>

        {entries.length === 0 ? (
          <>
            <div className="dtc-panel p-8 text-center mb-6">
              <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                No rounds yet
              </h2>
              <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                This journal tracks every sandbox round you play.
              </p>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Scores, multipliers, P&L, and performance trends — all saved locally.
              </p>
              <Link
                to="/play"
                className="inline-flex px-5 py-2.5 text-sm font-semibold no-underline dtc-button-primary"
              >
                Start Drawing
              </Link>
            </div>
            <div
              className="grid grid-cols-2 sm:grid-cols-5 gap-px rounded-lg overflow-hidden"
              style={{ background: 'var(--border)', border: '1px solid var(--border)' }}
            >
              <StatCell label="Rounds" value="0" />
              <StatCell label="Avg Score" value="--" />
              <StatCell label="Avg Mult" value="--" />
              <StatCell label="Win Rate" value="--" />
              <StatCell label="Net P&L" value="$0.00" />
            </div>
          </>
        ) : (
          <>
            <div
              className="dtc-panel overflow-x-auto mb-6"
            >
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="text-left px-3 py-2.5 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>#</th>
                    <th className="text-left px-3 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>Round</th>
                    <th className="text-left px-3 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>TF</th>
                    <th className="text-right px-3 py-2.5 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>Stake</th>
                    <SortableHeader label="Score" active={sortBy === 'score'} onClick={() => setSortBy('score')} />
                    <SortableHeader label="Mult" active={sortBy === 'multiplier'} onClick={() => setSortBy('multiplier')} />
                    <SortableHeader label="Payout" active={sortBy === 'payout'} onClick={() => setSortBy('payout')} />
                    <th className="text-right px-3 py-2.5 font-medium dtc-data" style={{ color: 'var(--text-muted)' }}>P&L</th>
                    <th className="text-right px-3 py-2.5 font-medium" style={{ color: 'var(--text-muted)' }}>Age</th>
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
                              ? '1px solid var(--border)'
                              : 'none',
                        }}
                        className="transition-colors"
                        onMouseEnter={(event) => {
                          event.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <td className="px-3 py-2 dtc-data" style={{ color: 'var(--text-muted)' }}>
                          {index + 1}
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            to={entry.sharePath}
                            className="text-xs no-underline dtc-data"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {entry.roundCode}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <span className="dtc-data text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            {entry.timeframe}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right dtc-data" style={{ color: 'var(--text-secondary)' }}>
                          ${entry.stake.toFixed(0)}
                        </td>
                        <td className="px-3 py-2 text-right dtc-data font-medium" style={{
                          color:
                            entry.score.total >= 70
                              ? 'var(--green)'
                              : entry.score.total >= 50
                                ? 'var(--text-primary)'
                                : 'var(--red)',
                        }}>
                          {entry.score.total.toFixed(1)}
                        </td>
                        <td className="px-3 py-2 text-right dtc-data" style={{
                          color: profitable ? 'var(--green)' : 'var(--red)',
                        }}>
                          {entry.payout.multiplier.toFixed(2)}x
                        </td>
                        <td className="px-3 py-2 text-right dtc-data" style={{
                          color: profitable ? 'var(--green)' : 'var(--text-secondary)',
                        }}>
                          ${entry.payout.payout.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right dtc-data font-medium" style={{
                          color: entry.payout.profit >= 0 ? 'var(--green)' : 'var(--red)',
                        }}>
                          {entry.payout.profit >= 0 ? '+' : ''}
                          ${entry.payout.profit.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {formatRoundAge(entry.settledAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="grid grid-cols-2 sm:grid-cols-5 gap-px rounded-lg overflow-hidden"
              style={{ background: 'var(--border)', border: '1px solid var(--border)' }}
            >
              <StatCell label="Rounds" value={String(stats.rounds)} />
              <StatCell label="Avg Score" value={stats.avgScore.toFixed(1)} />
              <StatCell label="Avg Mult" value={`${stats.avgMultiplier.toFixed(2)}x`} />
              <StatCell label="Win Rate" value={`${stats.profitableRate.toFixed(0)}%`} />
              <StatCell
                label="Net P&L"
                value={`${stats.totalProfit >= 0 ? '+' : ''}$${stats.totalProfit.toFixed(2)}`}
                color={stats.totalProfit >= 0 ? 'var(--green)' : 'var(--red)'}
              />
            </div>
          </>
        )}

        <footer className="mt-8 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            DTC Sandbox. Not financial advice.
          </span>
        </footer>
      </div>
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
      className="text-right px-3 py-2.5 font-medium cursor-pointer select-none dtc-data"
      style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
      onClick={onClick}
    >
      {label}
      {active && <span className="ml-0.5 text-[9px]">&#x25BC;</span>}
    </th>
  );
}

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="p-4 text-center" style={{ background: 'var(--bg-secondary)' }}>
      <div className="dtc-data text-lg font-semibold mb-0.5" style={{ color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
