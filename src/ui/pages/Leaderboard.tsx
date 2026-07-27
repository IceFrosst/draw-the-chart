import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  computeRoundHistoryStats,
  effectiveRoundValues,
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
      const va = effectiveRoundValues(a);
      const vb = effectiveRoundValues(b);
      if (sortBy === 'score') return vb.score - va.score;
      if (sortBy === 'multiplier') return vb.multiplier - va.multiplier;
      return vb.profit + b.stake - (va.profit + a.stake);
    });
  }, [entries, sortBy]);

  const stats = useMemo(() => computeRoundHistoryStats(entries), [entries]);

  return (
    <div className="min-h-screen pt-12">
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
          <div>
            <div className="dtc-eyebrow mb-3">Local history</div>
            <h1 className="dtc-display text-3xl mb-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Journal
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {entries.length} sandbox rounds saved in this browser.
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
          <div className="dtc-hairline-top py-16 text-center">
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              No rounds yet
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Every sandbox round you play is tracked here — scores, multipliers, P&L.
            </p>
            <Link
              to="/play"
              className="inline-flex px-6 py-3 text-sm font-semibold no-underline dtc-button-primary"
            >
              Start Drawing
            </Link>
          </div>
        ) : (
          <>
            <div
              className="dtc-strip mb-10"
              style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}
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
            <div className="overflow-x-auto mb-6">
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
                    const v = effectiveRoundValues(entry);
                    const profitable = v.multiplier >= 1;
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
                            v.score >= 80
                              ? 'var(--green)'
                              : v.score >= 50
                                ? 'var(--text-primary)'
                                : 'var(--red)',
                        }}>
                          {v.score.toFixed(1)}
                          {!v.isFieldScore && (
                            <span className="ml-1 text-[9px]" style={{ color: 'var(--text-muted)' }}>old</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right dtc-data" style={{
                          color: profitable ? 'var(--green)' : 'var(--red)',
                        }}>
                          {v.multiplier.toFixed(2)}x
                        </td>
                        <td className="px-3 py-2 text-right dtc-data" style={{
                          color: profitable ? 'var(--green)' : 'var(--text-secondary)',
                        }}>
                          ${(entry.stake + v.profit).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right dtc-data font-medium" style={{
                          color: v.profit >= 0 ? 'var(--green)' : 'var(--red)',
                        }}>
                          {v.profit >= 0 ? '+' : ''}
                          ${v.profit.toFixed(2)}
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
    <div>
      <div className="dtc-eyebrow mb-2">{label}</div>
      <div className="dtc-data text-xl" style={{ color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}
