import { useState, useEffect, useCallback, useRef } from 'react';
import { ValidationChart } from '../components/ValidationChart';
import {
  generateValidationPair,
  getDisplayOrder,
  type ValidationPair,
} from '../lib/validationPairs';
import {
  appendJudgment,
  loadJudgments,
  computeValidationStats,
  clearJudgments,
  type HumanChoice,
  type ValidationJudgment,
  type ValidationStats,
} from '../lib/validationStorage';

type Phase = 'loading' | 'voting' | 'revealed';

export function Validate() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [pair, setPair] = useState<ValidationPair | null>(null);
  const [pairIndex, setPairIndex] = useState(0);
  const [globalSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [choice, setChoice] = useState<HumanChoice | null>(null);
  const [confidence, setConfidence] = useState(3);
  const [judgments, setJudgments] = useState<ValidationJudgment[]>([]);
  const [showStats, setShowStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load stored judgments on mount
  useEffect(() => {
    setJudgments(loadJudgments());
  }, []);

  // Load a pair
  const loadPair = useCallback(
    async (index: number) => {
      setPhase('loading');
      setChoice(null);
      setConfidence(3);
      setError(null);
      try {
        const result = await generateValidationPair(globalSeed, index);
        if (!result) {
          setError('Not enough data to generate pair');
          return;
        }
        setPair(result);
        setPhase('voting');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to generate pair');
      }
    },
    [globalSeed],
  );

  // Load first pair
  useEffect(() => {
    loadPair(0);
  }, [loadPair]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (phase === 'voting') {
        if (e.key === '1' || e.key === 'a') setChoice('A');
        else if (e.key === '2' || e.key === 't') setChoice('tie');
        else if (e.key === '3' || e.key === 'b') setChoice('B');
        else if (e.key === 'Enter' && choice) handleSubmit();
      } else if (phase === 'revealed') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleNext();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  const handleSubmit = useCallback(() => {
    if (!pair || !choice) return;

    const { displayA, displayB } = getDisplayOrder(pair);
    const judgment: ValidationJudgment = {
      pairId: pair.pairId,
      scoreA: displayA.score.total,
      scoreB: displayB.score.total,
      strategyA: displayA.strategyName,
      strategyB: displayB.strategyName,
      humanChoice: choice,
      confidence,
      swapped: pair.swapped,
      timestamp: new Date().toISOString(),
    };

    const updated = appendJudgment(judgment);
    setJudgments(updated);
    setPhase('revealed');
  }, [pair, choice, confidence]);

  const handleNext = useCallback(() => {
    const next = pairIndex + 1;
    setPairIndex(next);
    loadPair(next);
  }, [pairIndex, loadPair]);

  const handleClearData = useCallback(() => {
    clearJudgments();
    setJudgments([]);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 48px)' }}>
        <div className="text-center">
          <div className="text-sm mb-2" style={{ color: 'var(--red)' }}>{error}</div>
          <button
            className="dtc-button-secondary px-3 py-1.5 text-xs"
            onClick={() => loadPair(pairIndex)}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = computeValidationStats(judgments);
  const display = pair ? getDisplayOrder(pair) : null;

  return (
    <div ref={containerRef} className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 48px)', marginTop: 48 }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-1.5 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <span className="dtc-data text-[11px]" style={{ color: 'var(--text-muted)' }}>
            #{pairIndex + 1}
          </span>
          {/* Legend — inline in top bar */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 2, background: '#d4853a', borderRadius: 1 }} />
              <span className="text-[11px] dtc-data" style={{ color: '#d4853a' }}>A</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 2, background: '#67c1b4', borderRadius: 1 }} />
              <span className="text-[11px] dtc-data" style={{ color: '#67c1b4' }}>B</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 2, borderTop: '2px dashed #a1a1aa' }} />
              <span className="text-[11px] dtc-data" style={{ color: '#a1a1aa' }}>Actual</span>
            </div>
          </div>
          {judgments.length > 0 && (
            <span className="dtc-data text-[11px] hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
              {judgments.length} judged
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="dtc-button-secondary px-2 py-1 text-[11px]"
            onClick={() => setShowStats(!showStats)}
          >
            {showStats ? 'Chart' : 'Stats'}
          </button>
          {judgments.length > 0 && (
            <button
              className="px-2 py-1 text-[11px] rounded"
              style={{ color: 'var(--red)', background: 'var(--red-soft)', border: '1px solid rgba(239,68,68,0.2)' }}
              onClick={handleClearData}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {showStats ? (
        <StatsPanel stats={stats} judgments={judgments} />
      ) : (
        <>
          {/* Chart area */}
          <div className="flex-1 min-h-0 relative">
            {phase === 'loading' ? (
              <div className="flex items-center justify-center h-full">
                <div className="shimmer" style={{ width: 120, height: 20 }} />
              </div>
            ) : pair && display ? (
              <>
                <ValidationChart
                  historyPrices={pair.historyPrices}
                  actualPrices={pair.actualPrices}
                  predictionA={display.displayA.prices}
                  predictionB={display.displayB.prices}
                  showActual={true}
                />
              </>
            ) : null}
          </div>

          {/* Control bar */}
          <div
            className="shrink-0 px-4 py-2"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
          >
            {phase === 'voting' && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4">
                {/* Vote buttons */}
                <div className="flex items-center gap-2">
                  <VoteButton
                    label="A Better"
                    shortcut="1"
                    active={choice === 'A'}
                    color="#d4853a"
                    onClick={() => setChoice('A')}
                  />
                  <VoteButton
                    label="Tie"
                    shortcut="2"
                    active={choice === 'tie'}
                    color="var(--text-secondary)"
                    onClick={() => setChoice('tie')}
                  />
                  <VoteButton
                    label="B Better"
                    shortcut="3"
                    active={choice === 'B'}
                    color="#67c1b4"
                    onClick={() => setChoice('B')}
                  />
                </div>

                {/* Confidence + Submit */}
                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Confidence</span>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        className="dtc-data text-[11px] rounded px-1.5 py-0.5"
                        style={{
                          background: confidence === level ? 'rgba(255,255,255,0.1)' : 'transparent',
                          color: confidence === level ? 'var(--text-primary)' : 'var(--text-muted)',
                          border: confidence === level ? '1px solid var(--border-strong)' : '1px solid transparent',
                        }}
                        onClick={() => setConfidence(level)}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <button
                    className="dtc-button-primary px-4 py-1.5 text-xs"
                    disabled={!choice}
                    onClick={handleSubmit}
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}

            {phase === 'revealed' && display && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4">
                {/* Score reveal */}
                <div className="flex items-center gap-4 flex-wrap">
                  <ScoreReveal
                    label="A"
                    strategy={display.displayA.strategyLabel}
                    score={display.displayA.score}
                    color="#d4853a"
                    isWinner={display.displayA.score.total > display.displayB.score.total}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>vs</span>
                  <ScoreReveal
                    label="B"
                    strategy={display.displayB.strategyLabel}
                    score={display.displayB.score}
                    color="#67c1b4"
                    isWinner={display.displayB.score.total > display.displayA.score.total}
                  />
                  <AgreementBadge
                    humanChoice={choice!}
                    scoreA={display.displayA.score.total}
                    scoreB={display.displayB.score.total}
                  />
                </div>
                <button
                  className="dtc-button-primary px-4 py-1.5 text-xs"
                  onClick={handleNext}
                >
                  Next Pair <span className="dtc-kbd ml-1.5" style={{ fontSize: 9 }}>Space</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function VoteButton({
  label,
  shortcut,
  active,
  color,
  onClick,
}: {
  label: string;
  shortcut: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
      style={{
        background: active ? `${color}22` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? color : 'var(--border)'}`,
        color: active ? color : 'var(--text-secondary)',
      }}
      onClick={onClick}
    >
      <span className="dtc-kbd" style={{ fontSize: 9 }}>{shortcut}</span>
      {label}
    </button>
  );
}

function ScoreReveal({
  label,
  strategy,
  score,
  color,
  isWinner,
}: {
  label: string;
  strategy?: string;
  score: { total: number; direction: number; magnitude: number; turningPoints: number; volatility: number };
  color: string;
  isWinner: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="dtc-data text-sm font-semibold" style={{ color }}>
        {label}
      </span>
      <span
        className="dtc-data text-sm font-semibold animate-count-up"
        style={{ color: isWinner ? 'var(--green)' : 'var(--text-primary)' }}
      >
        {score.total.toFixed(1)}
      </span>
      <span className="dtc-data text-[10px]" style={{ color: 'var(--text-muted)' }}>
        D{score.direction.toFixed(0)} M{score.magnitude.toFixed(0)} T{score.turningPoints.toFixed(0)} V{score.volatility.toFixed(0)}
      </span>
      {strategy && (
        <span className="text-[10px] hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
          {strategy}
        </span>
      )}
    </div>
  );
}

function AgreementBadge({
  humanChoice,
  scoreA,
  scoreB,
}: {
  humanChoice: HumanChoice;
  scoreA: number;
  scoreB: number;
}) {
  const gap = Math.abs(scoreA - scoreB);
  const algoChoice: HumanChoice = gap < 2 ? 'tie' : scoreA > scoreB ? 'A' : 'B';
  const agrees = humanChoice === algoChoice;

  return (
    <span
      className="dtc-data text-[11px] px-2 py-0.5 rounded"
      style={{
        background: agrees ? 'var(--green-soft)' : 'var(--red-soft)',
        color: agrees ? 'var(--green)' : 'var(--red)',
        border: `1px solid ${agrees ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
      }}
    >
      {agrees ? 'Agree' : 'Disagree'}
    </span>
  );
}

function StatsPanel({ stats, judgments }: { stats: ValidationStats; judgments: ValidationJudgment[] }) {
  if (stats.total === 0) {
    return (
      <div className="flex items-center justify-center flex-1">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No judgments yet. Vote on some pairs first.
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Overview */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-lg overflow-hidden"
          style={{ background: 'var(--border)', border: '1px solid var(--border)' }}
        >
          <StatCell label="Total Judged" value={String(stats.total)} />
          <StatCell
            label="Agreement"
            value={`${stats.agreementRate.toFixed(1)}%`}
            color={stats.agreementRate >= 60 ? 'var(--green)' : stats.agreementRate >= 40 ? 'var(--accent)' : 'var(--red)'}
          />
          <StatCell label="Avg Confidence" value={stats.avgConfidence.toFixed(1)} />
          <StatCell
            label="Large Gap Agree"
            value={stats.agreementByGap.large.count > 0 ? `${stats.agreementByGap.large.agreement.toFixed(0)}%` : 'n/a'}
          />
        </div>

        {/* Agreement by gap */}
        <div className="dtc-panel p-3">
          <div className="dtc-eyebrow mb-2">Agreement by Score Gap</div>
          <div className="space-y-1.5">
            <GapRow label="Small (< 5)" data={stats.agreementByGap.small} />
            <GapRow label="Medium (5-15)" data={stats.agreementByGap.medium} />
            <GapRow label="Large (15+)" data={stats.agreementByGap.large} />
          </div>
        </div>

        {/* Strategy preferences */}
        {Object.keys(stats.strategyPreferences).length > 0 && (
          <div className="dtc-panel p-3">
            <div className="dtc-eyebrow mb-2">Strategy Analysis</div>
            <div className="overflow-hidden rounded" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <th className="text-left px-3 py-1.5 dtc-data font-medium" style={{ color: 'var(--text-muted)' }}>Strategy</th>
                    <th className="text-right px-3 py-1.5 dtc-data font-medium" style={{ color: 'var(--text-muted)' }}>Seen</th>
                    <th className="text-right px-3 py-1.5 dtc-data font-medium" style={{ color: 'var(--text-muted)' }}>Human Picks</th>
                    <th className="text-right px-3 py-1.5 dtc-data font-medium" style={{ color: 'var(--text-muted)' }}>Algo Picks</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats.strategyPreferences)
                    .sort((a, b) => b[1].appearances - a[1].appearances)
                    .map(([name, data]) => (
                      <tr key={name} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="px-3 py-1.5 dtc-data" style={{ color: 'var(--text-primary)' }}>{name}</td>
                        <td className="text-right px-3 py-1.5 dtc-data" style={{ color: 'var(--text-secondary)' }}>{data.appearances}</td>
                        <td className="text-right px-3 py-1.5 dtc-data" style={{ color: 'var(--accent)' }}>{data.humanWins}</td>
                        <td className="text-right px-3 py-1.5 dtc-data" style={{ color: 'var(--teal)' }}>{data.algoWins}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Confidence breakdown */}
        {Object.keys(stats.agreementByConfidence).length > 0 && (
          <div className="dtc-panel p-3">
            <div className="dtc-eyebrow mb-2">Agreement by Confidence</div>
            <div className="flex items-end gap-2">
              {[1, 2, 3, 4, 5].map((level) => {
                const data = stats.agreementByConfidence[level];
                const rate = data ? data.agreement : 0;
                const count = data ? data.count : 0;
                return (
                  <div key={level} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: Math.max(4, (rate / 100) * 60),
                        background: rate >= 60 ? 'var(--green)' : rate >= 40 ? 'var(--accent)' : 'var(--red)',
                        opacity: count > 0 ? 0.7 : 0.15,
                      }}
                    />
                    <span className="dtc-data text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {count > 0 ? `${rate.toFixed(0)}%` : '-'}
                    </span>
                    <span className="dtc-data text-[10px]" style={{ color: 'var(--text-secondary)' }}>{level}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent judgments */}
        <div className="dtc-panel p-3">
          <div className="dtc-eyebrow mb-2">Recent Judgments</div>
          <div className="space-y-1">
            {judgments.slice(0, 20).map((j) => {
              const gap = Math.abs(j.scoreA - j.scoreB);
              const algoChoice: HumanChoice = gap < 2 ? 'tie' : j.scoreA > j.scoreB ? 'A' : 'B';
              const agrees = j.humanChoice === algoChoice;
              return (
                <div
                  key={j.pairId}
                  className="flex items-center justify-between text-[11px] dtc-data px-2 py-1 rounded"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{j.pairId}</span>
                  <div className="flex items-center gap-3">
                    <span style={{ color: '#d4853a' }}>{j.scoreA.toFixed(1)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>vs</span>
                    <span style={{ color: '#67c1b4' }}>{j.scoreB.toFixed(1)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      chose {j.humanChoice}
                    </span>
                    <span style={{ color: agrees ? 'var(--green)' : 'var(--red)' }}>
                      {agrees ? 'OK' : 'X'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-3" style={{ background: 'var(--bg-secondary)' }}>
      <div className="dtc-eyebrow mb-1">{label}</div>
      <div className="dtc-data text-lg font-semibold" style={{ color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function GapRow({ label, data }: { label: string; data: { count: number; agreement: number } }) {
  return (
    <div className="flex items-center gap-3 text-[11px]">
      <span className="dtc-data w-28 shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: data.count > 0 ? `${data.agreement}%` : '0%',
            background: data.agreement >= 60 ? 'var(--green)' : data.agreement >= 40 ? 'var(--accent)' : 'var(--red)',
            opacity: data.count > 0 ? 0.7 : 0.2,
          }}
        />
      </div>
      <span className="dtc-data w-12 text-right" style={{ color: 'var(--text-muted)' }}>
        {data.count > 0 ? `${data.agreement.toFixed(0)}%` : '-'}
      </span>
      <span className="dtc-data w-8 text-right" style={{ color: 'var(--text-muted)' }}>
        n={data.count}
      </span>
    </div>
  );
}
