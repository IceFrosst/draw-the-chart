import { useState, useEffect, useMemo, type JSX } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// ─── TYPES ──────────────────────────────────────────────────────

interface RoundRow {
  id: string;
  user_id: string;
  timeframe: string;
  score_total: number;
  score_direction: number;
  score_magnitude: number;
  score_turning_points: number;
  score_volatility: number;
  payout_multiplier: number;
  payout_profit: number;
  realized_vol: number;
  drawing_duration_seconds: number;
  settled_at: string;
  created_at: string;
}

interface FeedbackRow {
  id: string;
  round_id: string;
  fairness_vote: 'too_low' | 'about_right' | 'too_high';
  self_assessed_score: number;
  confidence: number;
  wrong_components: string[];
  difficulty_perception: 'easy' | 'medium' | 'hard' | 'impossible';
  would_bet_real_money: boolean;
  comment: string | null;
  created_at: string;
  rounds?: { score_total: number };
}

// ─── SVG CHART HELPERS ──────────────────────────────────────────

function BarChart({
  data,
  width = 320,
  height = 180,
  barColor = 'var(--accent)',
}: {
  data: { label: string; value: number; color?: string }[];
  width?: number;
  height?: number;
  barColor?: string;
}) {
  if (data.length === 0) return <EmptyChart width={width} height={height} />;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const padding = { top: 10, right: 10, bottom: 30, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barWidth = Math.min(40, (chartW / data.length) * 0.7);
  const gap = (chartW - barWidth * data.length) / (data.length + 1);

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const barH = (d.value / maxVal) * chartH;
        const x = padding.left + gap * (i + 1) + barWidth * i;
        const y = padding.top + chartH - barH;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={2}
              fill={d.color ?? barColor}
              opacity={0.85}
            />
            <text
              x={x + barWidth / 2}
              y={y - 4}
              textAnchor="middle"
              fill="var(--text-secondary)"
              fontSize="10"
              fontFamily="JetBrains Mono, monospace"
            >
              {d.value}
            </text>
            <text
              x={x + barWidth / 2}
              y={height - 8}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ScatterPlot({
  points,
  xLabel,
  yLabel,
  width = 320,
  height = 220,
}: {
  points: { x: number; y: number }[];
  xLabel: string;
  yLabel: string;
  width?: number;
  height?: number;
}) {
  if (points.length === 0) return <EmptyChart width={width} height={height} />;

  const padding = { top: 15, right: 15, bottom: 35, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const xMin = Math.min(...points.map((p) => p.x));
  const xMax = Math.max(...points.map((p) => p.x));
  const yMin = Math.min(...points.map((p) => p.y));
  const yMax = Math.max(...points.map((p) => p.y));
  const xRange = Math.max(xMax - xMin, 1);
  const yRange = Math.max(yMax - yMin, 1);

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Axes */}
      <line
        x1={padding.left}
        y1={padding.top + chartH}
        x2={padding.left + chartW}
        y2={padding.top + chartH}
        stroke="var(--border-strong)"
        strokeWidth={1}
      />
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + chartH}
        stroke="var(--border-strong)"
        strokeWidth={1}
      />

      {/* Diagonal reference line (y = x) */}
      {(() => {
        const diagMin = Math.max(xMin, yMin);
        const diagMax = Math.min(xMax, yMax);
        if (diagMax <= diagMin) return null;
        const x1 = padding.left + ((diagMin - xMin) / xRange) * chartW;
        const y1 = padding.top + chartH - ((diagMin - yMin) / yRange) * chartH;
        const x2 = padding.left + ((diagMax - xMin) / xRange) * chartW;
        const y2 = padding.top + chartH - ((diagMax - yMin) / yRange) * chartH;
        return (
          <line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="4,4" opacity={0.4}
          />
        );
      })()}

      {/* Points */}
      {points.map((p, i) => {
        const cx = padding.left + ((p.x - xMin) / xRange) * chartW;
        const cy = padding.top + chartH - ((p.y - yMin) / yRange) * chartH;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={3.5}
            fill="var(--accent)"
            opacity={0.6}
          />
        );
      })}

      {/* Labels */}
      <text
        x={padding.left + chartW / 2}
        y={height - 4}
        textAnchor="middle"
        fill="var(--text-muted)"
        fontSize="10"
        fontFamily="JetBrains Mono, monospace"
      >
        {xLabel}
      </text>
      <text
        x={12}
        y={padding.top + chartH / 2}
        textAnchor="middle"
        fill="var(--text-muted)"
        fontSize="10"
        fontFamily="JetBrains Mono, monospace"
        transform={`rotate(-90, 12, ${padding.top + chartH / 2})`}
      >
        {yLabel}
      </text>
    </svg>
  );
}

function Histogram({
  values,
  bins = 10,
  width = 320,
  height = 180,
  label = '',
}: {
  values: number[];
  bins?: number;
  width?: number;
  height?: number;
  label?: string;
}) {
  if (values.length === 0) return <EmptyChart width={width} height={height} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const binWidth = range / bins;
  const binCounts = new Array(bins).fill(0);

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    binCounts[idx]++;
  }

  const maxCount = Math.max(...binCounts, 1);
  const padding = { top: 10, right: 10, bottom: 30, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barW = chartW / bins;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {binCounts.map((count, i) => {
        const barH = (count / maxCount) * chartH;
        const x = padding.left + i * barW;
        const y = padding.top + chartH - barH;
        return (
          <g key={i}>
            <rect
              x={x + 1}
              y={y}
              width={barW - 2}
              height={barH}
              rx={1}
              fill="var(--accent)"
              opacity={0.7}
            />
          </g>
        );
      })}
      {/* X-axis labels */}
      <text
        x={padding.left}
        y={height - 8}
        fill="var(--text-muted)"
        fontSize="9"
        fontFamily="JetBrains Mono, monospace"
      >
        {min.toFixed(0)}
      </text>
      <text
        x={padding.left + chartW}
        y={height - 8}
        textAnchor="end"
        fill="var(--text-muted)"
        fontSize="9"
        fontFamily="JetBrains Mono, monospace"
      >
        {max.toFixed(0)}
      </text>
      {label && (
        <text
          x={padding.left + chartW / 2}
          y={height - 8}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
        >
          {label}
        </text>
      )}
    </svg>
  );
}

function PieChart({
  data,
  width = 200,
  height = 200,
}: {
  data: { label: string; value: number; color: string }[];
  width?: number;
  height?: number;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0))
    return <EmptyChart width={width} height={height} />;

  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = width / 2;
  const cy = height / 2 - 10;
  const r = Math.min(cx, cy) - 20;

  let startAngle = -Math.PI / 2;
  const slices: JSX.Element[] = [];

  for (const d of data) {
    if (d.value === 0) continue;
    const angle = (d.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;

    slices.push(
      <path
        key={d.label}
        d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`}
        fill={d.color}
        opacity={0.8}
        stroke="var(--bg-primary)"
        strokeWidth={2}
      />,
    );
    startAngle = endAngle;
  }

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {slices}
      {data.map((d, i) => (
        <g key={i}>
          <rect
            x={10}
            y={height - 18 * (data.length - i) - 2}
            width={8}
            height={8}
            rx={1}
            fill={d.color}
          />
          <text
            x={22}
            y={height - 18 * (data.length - i) + 6}
            fill="var(--text-secondary)"
            fontSize="10"
            fontFamily="JetBrains Mono, monospace"
          >
            {d.label}: {d.value} ({total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%)
          </text>
        </g>
      ))}
    </svg>
  );
}

function TimeSeriesChart({
  data,
  width = 320,
  height = 160,
  label = '',
}: {
  data: { date: string; value: number }[];
  width?: number;
  height?: number;
  label?: string;
}) {
  if (data.length === 0) return <EmptyChart width={width} height={height} />;

  const padding = { top: 10, right: 10, bottom: 25, left: 35 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = Math.max(maxVal - minVal, 1);

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padding.top + chartH - ((d.value - minVal) / range) * chartH;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        opacity={0.8}
      />
      {/* Fill area */}
      <polygon
        points={`${padding.left},${padding.top + chartH} ${points.join(' ')} ${padding.left + chartW},${padding.top + chartH}`}
        fill="var(--accent)"
        opacity={0.08}
      />
      {/* X labels */}
      {data.length > 0 && (
        <>
          <text
            x={padding.left}
            y={height - 4}
            fill="var(--text-muted)"
            fontSize="8"
            fontFamily="JetBrains Mono, monospace"
          >
            {data[0]!.date}
          </text>
          <text
            x={padding.left + chartW}
            y={height - 4}
            textAnchor="end"
            fill="var(--text-muted)"
            fontSize="8"
            fontFamily="JetBrains Mono, monospace"
          >
            {data[data.length - 1]!.date}
          </text>
        </>
      )}
      {label && (
        <text
          x={8}
          y={padding.top + chartH / 2}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
          transform={`rotate(-90, 8, ${padding.top + chartH / 2})`}
        >
          {label}
        </text>
      )}
    </svg>
  );
}

function EmptyChart({ width, height }: { width: number; height: number }) {
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        fill="var(--text-muted)"
        fontSize="12"
        fontFamily="DM Sans, sans-serif"
      >
        No data
      </text>
    </svg>
  );
}

// ─── STAT CARD ──────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="p-4 text-center" style={{ background: 'var(--bg-secondary)' }}>
      <div
        className="dtc-data text-lg font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </div>
      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      {sub && (
        <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── PANEL WRAPPER ──────────────────────────────────────────────

function Panel({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`dtc-panel p-4 ${className}`}>
      <div className="dtc-eyebrow mb-3">{title}</div>
      {children}
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────

export function Admin() {
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setError('Supabase not configured');
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const [roundsRes, feedbackRes] = await Promise.all([
          supabase!
            .from('rounds')
            .select('*')
            .order('settled_at', { ascending: true }),
          supabase!
            .from('round_feedback')
            .select('*, rounds(score_total)')
            .order('created_at', { ascending: true }),
        ]);

        if (roundsRes.error) throw roundsRes.error;
        if (feedbackRes.error) throw feedbackRes.error;

        setRounds(roundsRes.data ?? []);
        setFeedback(feedbackRes.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // ─── Computed Analytics ───

  const analytics = useMemo(() => {
    if (rounds.length === 0 && feedback.length === 0) return null;

    // Fairness vote distribution
    const fairnessCounts = { too_low: 0, about_right: 0, too_high: 0 };
    for (const fb of feedback) {
      fairnessCounts[fb.fairness_vote]++;
    }

    // Algo score vs self-assessed scatter
    const scoreVsSelf = feedback
      .filter((fb) => fb.rounds?.score_total != null && fb.self_assessed_score != null)
      .map((fb) => ({
        x: fb.rounds!.score_total,
        y: fb.self_assessed_score,
      }));

    // Component complaint frequency
    const componentComplaints: Record<string, number> = {};
    for (const fb of feedback) {
      if (fb.wrong_components) {
        for (const comp of fb.wrong_components) {
          componentComplaints[comp] = (componentComplaints[comp] ?? 0) + 1;
        }
      }
    }

    // Score histogram
    const scores = rounds.map((r) => r.score_total);

    // Difficulty vs actual score
    const difficultyScores: Record<string, number[]> = {
      easy: [], medium: [], hard: [], impossible: [],
    };
    for (const fb of feedback) {
      if (fb.rounds?.score_total != null && fb.difficulty_perception) {
        difficultyScores[fb.difficulty_perception]?.push(fb.rounds.score_total);
      }
    }

    // Would bet real money %
    const betYes = feedback.filter((fb) => fb.would_bet_real_money).length;
    const betNo = feedback.filter((fb) => !fb.would_bet_real_money).length;

    // Rounds over time (group by day)
    const roundsByDay = new Map<string, number>();
    for (const r of rounds) {
      const day = (r.settled_at ?? r.created_at).slice(0, 10);
      roundsByDay.set(day, (roundsByDay.get(day) ?? 0) + 1);
    }
    const timeSeries = [...roundsByDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, value }));

    // Overall stats
    const avgScore = scores.length > 0
      ? scores.reduce((s, v) => s + v, 0) / scores.length
      : 0;
    const avgMultiplier = rounds.length > 0
      ? rounds.reduce((s, r) => s + r.payout_multiplier, 0) / rounds.length
      : 0;
    const profitableRounds = rounds.filter((r) => r.payout_profit > 0).length;
    const uniqueUsers = new Set(rounds.map((r) => r.user_id)).size;

    // Timeframe breakdown
    const timeframeCounts: Record<string, number> = {};
    for (const r of rounds) {
      timeframeCounts[r.timeframe] = (timeframeCounts[r.timeframe] ?? 0) + 1;
    }

    // Average score by difficulty
    const avgByDifficulty = Object.entries(difficultyScores)
      .filter(([, scores]) => scores.length > 0)
      .map(([diff, scores]) => ({
        label: diff,
        value: +(scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1),
      }));

    return {
      fairnessCounts,
      scoreVsSelf,
      componentComplaints,
      scores,
      avgByDifficulty,
      betYes,
      betNo,
      timeSeries,
      avgScore,
      avgMultiplier,
      profitableRounds,
      uniqueUsers,
      timeframeCounts,
    };
  }, [rounds, feedback]);

  // ─── RENDER ───

  if (loading) {
    return (
      <div
        className="min-h-screen pt-16 px-4 sm:px-6"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="h-8 w-48 shimmer mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-px shimmer h-20" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="h-64 shimmer" />
            <div className="h-64 shimmer" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen pt-16 px-4 sm:px-6 flex items-center justify-center"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div className="dtc-panel p-8 text-center max-w-md">
          <h2
            className="text-lg font-semibold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            Dashboard Unavailable
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div
        className="min-h-screen pt-16 px-4 sm:px-6 flex items-center justify-center"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div className="dtc-panel p-8 text-center max-w-md">
          <h2
            className="text-lg font-semibold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            No Data Yet
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Play some rounds and submit feedback to populate the dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pt-16 pb-12 px-4 sm:px-6"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(212, 168, 92, 0.04), transparent 24%), var(--bg-primary)',
      }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="dtc-display text-2xl font-bold mb-1">
              Admin Dashboard
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Testing analytics &middot; {rounds.length} rounds &middot;{' '}
              {feedback.length} feedback responses
            </p>
          </div>
          <div className="dtc-chip">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--green)' }}
            />
            Live
          </div>
        </div>

        {/* Summary Stats */}
        <div
          className="grid grid-cols-2 sm:grid-cols-5 gap-px rounded-lg overflow-hidden mb-6"
          style={{
            background: 'var(--border)',
            border: '1px solid var(--border)',
          }}
        >
          <StatCard label="Total Rounds" value={rounds.length} />
          <StatCard
            label="Avg Score"
            value={analytics.avgScore.toFixed(1)}
          />
          <StatCard
            label="Avg Multiplier"
            value={`${analytics.avgMultiplier.toFixed(2)}x`}
          />
          <StatCard
            label="Profitable %"
            value={
              rounds.length > 0
                ? `${((analytics.profitableRounds / rounds.length) * 100).toFixed(0)}%`
                : '0%'
            }
          />
          <StatCard label="Unique Users" value={analytics.uniqueUsers} />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* 1. Fairness Vote Distribution */}
          <Panel title="Fairness Votes">
            <PieChart
              data={[
                {
                  label: 'Too Low',
                  value: analytics.fairnessCounts.too_low,
                  color: 'var(--red)',
                },
                {
                  label: 'About Right',
                  value: analytics.fairnessCounts.about_right,
                  color: 'var(--green)',
                },
                {
                  label: 'Too High',
                  value: analytics.fairnessCounts.too_high,
                  color: 'var(--accent)',
                },
              ]}
              width={280}
              height={220}
            />
          </Panel>

          {/* 2. Algo Score vs Self-Assessed */}
          <Panel title="Algo Score vs Self-Assessed">
            <ScatterPlot
              points={analytics.scoreVsSelf}
              xLabel="Algorithm Score"
              yLabel="Self-Assessed"
              width={300}
              height={220}
            />
            {analytics.scoreVsSelf.length > 0 && (
              <p
                className="text-[10px] mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Dashed line = perfect agreement.{' '}
                {analytics.scoreVsSelf.length} data points.
              </p>
            )}
          </Panel>

          {/* 3. Component Complaint Frequency */}
          <Panel title="Component Complaints">
            <BarChart
              data={Object.entries(analytics.componentComplaints)
                .sort((a, b) => b[1] - a[1])
                .map(([label, value]) => ({ label, value }))}
              width={300}
              height={180}
              barColor="var(--red)"
            />
          </Panel>

          {/* 4. Score Histogram */}
          <Panel title="Score Distribution">
            <Histogram
              values={analytics.scores}
              bins={20}
              width={300}
              height={180}
              label="Score (0-100)"
            />
          </Panel>

          {/* 5. Difficulty vs Actual Score */}
          <Panel title="Perceived Difficulty vs Score">
            <BarChart
              data={analytics.avgByDifficulty}
              width={300}
              height={180}
              barColor="var(--teal)"
            />
            <p
              className="text-[10px] mt-1"
              style={{ color: 'var(--text-muted)' }}
            >
              Average algo score per self-reported difficulty
            </p>
          </Panel>

          {/* 6. Would Bet Real Money */}
          <Panel title="Would Bet Real Money?">
            <div className="flex items-center justify-center gap-6 py-4">
              <div className="text-center">
                <div
                  className="dtc-data text-3xl font-bold"
                  style={{ color: 'var(--green)' }}
                >
                  {feedback.length > 0
                    ? `${((analytics.betYes / feedback.length) * 100).toFixed(0)}%`
                    : '0%'}
                </div>
                <div
                  className="text-xs mt-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Yes ({analytics.betYes})
                </div>
              </div>
              <div
                className="w-px h-12"
                style={{ background: 'var(--border)' }}
              />
              <div className="text-center">
                <div
                  className="dtc-data text-3xl font-bold"
                  style={{ color: 'var(--red)' }}
                >
                  {feedback.length > 0
                    ? `${((analytics.betNo / feedback.length) * 100).toFixed(0)}%`
                    : '0%'}
                </div>
                <div
                  className="text-xs mt-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  No ({analytics.betNo})
                </div>
              </div>
            </div>
          </Panel>

          {/* 7. Round Count Over Time */}
          <Panel title="Rounds Over Time" className="md:col-span-2">
            <TimeSeriesChart
              data={analytics.timeSeries}
              width={640}
              height={160}
              label="Rounds / day"
            />
          </Panel>

          {/* 8. Timeframe Breakdown */}
          <Panel title="Timeframe Distribution">
            <BarChart
              data={['15m', '1h', '6h', '24h', '7d']
                .filter((tf) => analytics.timeframeCounts[tf])
                .map((tf) => ({
                  label: tf,
                  value: analytics.timeframeCounts[tf]!,
                }))}
              width={300}
              height={180}
            />
          </Panel>
        </div>

        {/* Recent Feedback Table */}
        <div className="mt-6">
          <Panel title="Recent Feedback">
            <div className="overflow-x-auto">
              <table
                className="w-full text-xs"
                style={{ borderCollapse: 'collapse', minWidth: '700px' }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {[
                      'Date',
                      'Algo Score',
                      'Self Score',
                      'Fairness',
                      'Difficulty',
                      'Bet?',
                      'Confidence',
                      'Comment',
                    ].map((col) => (
                      <th
                        key={col}
                        className="text-left px-3 py-2.5 font-medium dtc-data"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {feedback
                    .slice()
                    .reverse()
                    .slice(0, 50)
                    .map((fb) => (
                      <tr
                        key={fb.id}
                        style={{ borderBottom: '1px solid var(--border)' }}
                      >
                        <td className="px-3 py-2 dtc-data">
                          {new Date(fb.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 dtc-data">
                          {fb.rounds?.score_total?.toFixed(1) ?? '—'}
                        </td>
                        <td className="px-3 py-2 dtc-data">
                          {fb.self_assessed_score}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            style={{
                              color:
                                fb.fairness_vote === 'too_low'
                                  ? 'var(--red)'
                                  : fb.fairness_vote === 'too_high'
                                    ? 'var(--accent)'
                                    : 'var(--green)',
                            }}
                          >
                            {fb.fairness_vote.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2">{fb.difficulty_perception}</td>
                        <td className="px-3 py-2">
                          <span
                            style={{
                              color: fb.would_bet_real_money
                                ? 'var(--green)'
                                : 'var(--red)',
                            }}
                          >
                            {fb.would_bet_real_money ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-3 py-2 dtc-data">{fb.confidence}/5</td>
                        <td
                          className="px-3 py-2 max-w-[200px] truncate"
                          title={fb.comment ?? ''}
                        >
                          {fb.comment || '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {feedback.length === 0 && (
                <div
                  className="text-center py-8 text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  No feedback submitted yet.
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Footer */}
        <footer
          className="mt-8 pt-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            DTC Admin &middot; Data refreshes on page load
          </span>
        </footer>
      </div>
    </div>
  );
}
