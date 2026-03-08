import type { ScoreBreakdown } from '../../scoring/index.js';
import type { TimeframeKey } from '../hooks/usePriceData.js';

export interface RoundPayoutSummary {
  multiplier: number;
  payout: number;
  profit: number;
}

export interface RoundHistoryEntry {
  id: string;
  seed: number;
  roundCode: string;
  timeframe: TimeframeKey;
  instrument: 'BTC/USDT';
  stake: number;
  settledAt: string;
  score: ScoreBreakdown;
  payout: RoundPayoutSummary;
  historyPoints: number;
  futurePoints: number;
  sharePath: string;
}

export interface RoundHistoryStats {
  rounds: number;
  avgScore: number;
  avgMultiplier: number;
  profitableRate: number;
  bestScore: number;
  totalProfit: number;
}

interface CreateRoundHistoryEntryInput {
  seed: number;
  roundCode: string;
  timeframe: TimeframeKey;
  stake: number;
  score: ScoreBreakdown;
  payout: RoundPayoutSummary;
  historyPoints: number;
  futurePoints: number;
  settledAt?: string;
}

const STORAGE_KEY = 'dtc.roundHistory.v1';
const MAX_ENTRIES = 100;

function isRoundHistoryEntry(value: unknown): value is RoundHistoryEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<RoundHistoryEntry>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.seed === 'number' &&
    typeof candidate.roundCode === 'string' &&
    typeof candidate.timeframe === 'string' &&
    candidate.instrument === 'BTC/USDT' &&
    typeof candidate.stake === 'number' &&
    typeof candidate.settledAt === 'string' &&
    typeof candidate.sharePath === 'string' &&
    typeof candidate.historyPoints === 'number' &&
    typeof candidate.futurePoints === 'number' &&
    candidate.score != null &&
    typeof candidate.score.total === 'number' &&
    candidate.payout != null &&
    typeof candidate.payout.multiplier === 'number' &&
    typeof candidate.payout.payout === 'number' &&
    typeof candidate.payout.profit === 'number'
  );
}

export function createRoundHistoryEntry({
  seed,
  roundCode,
  timeframe,
  stake,
  score,
  payout,
  historyPoints,
  futurePoints,
  settledAt = new Date().toISOString(),
}: CreateRoundHistoryEntryInput): RoundHistoryEntry {
  return {
    id: `${seed}:${timeframe}:${settledAt}`,
    seed,
    roundCode,
    timeframe,
    instrument: 'BTC/USDT',
    stake,
    settledAt,
    score,
    payout,
    historyPoints,
    futurePoints,
    sharePath: `/play?tf=${timeframe}&seed=${seed}`,
  };
}

export function mergeRoundHistory(
  entries: RoundHistoryEntry[],
  nextEntry: RoundHistoryEntry,
): RoundHistoryEntry[] {
  return [nextEntry, ...entries.filter((entry) => entry.id !== nextEntry.id)]
    .sort(
      (left, right) =>
        new Date(right.settledAt).getTime() - new Date(left.settledAt).getTime(),
    )
    .slice(0, MAX_ENTRIES);
}

export function computeRoundHistoryStats(
  entries: RoundHistoryEntry[],
): RoundHistoryStats {
  if (entries.length === 0) {
    return {
      rounds: 0,
      avgScore: 0,
      avgMultiplier: 0,
      profitableRate: 0,
      bestScore: 0,
      totalProfit: 0,
    };
  }

  const totalScore = entries.reduce((sum, entry) => sum + entry.score.total, 0);
  const totalMultiplier = entries.reduce(
    (sum, entry) => sum + entry.payout.multiplier,
    0,
  );
  const profitableRounds = entries.filter(
    (entry) => entry.payout.multiplier >= 1,
  ).length;
  const bestScore = Math.max(...entries.map((entry) => entry.score.total));
  const totalProfit = entries.reduce((sum, entry) => sum + entry.payout.profit, 0);

  return {
    rounds: entries.length,
    avgScore: totalScore / entries.length,
    avgMultiplier: totalMultiplier / entries.length,
    profitableRate: (profitableRounds / entries.length) * 100,
    bestScore,
    totalProfit,
  };
}

export function formatRoundAge(
  settledAt: string,
  nowTimestamp: number = Date.now(),
): string {
  const deltaMs = Math.max(0, nowTimestamp - new Date(settledAt).getTime());
  const deltaMinutes = Math.floor(deltaMs / 60_000);

  if (deltaMinutes < 1) return 'just now';
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;

  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 30) return `${deltaDays}d ago`;

  const date = new Date(settledAt);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function loadRoundHistory(): RoundHistoryEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRoundHistoryEntry);
  } catch {
    return [];
  }
}

export function saveRoundHistory(entries: RoundHistoryEntry[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function appendRoundHistory(nextEntry: RoundHistoryEntry): RoundHistoryEntry[] {
  const merged = mergeRoundHistory(loadRoundHistory(), nextEntry);
  saveRoundHistory(merged);
  return merged;
}
