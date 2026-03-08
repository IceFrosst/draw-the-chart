import { describe, expect, it } from 'vitest';
import {
  computeRoundHistoryStats,
  createRoundHistoryEntry,
  formatRoundAge,
  mergeRoundHistory,
} from './roundHistory.js';

describe('roundHistory', () => {
  const first = createRoundHistoryEntry({
    seed: 111111,
    roundCode: '111111',
    timeframe: '1h',
    stake: 100,
    score: {
      direction: 30,
      magnitude: 20,
      turningPoints: 12,
      volatility: 8,
      total: 70,
    },
    payout: {
      multiplier: 2,
      payout: 200,
      profit: 100,
    },
    historyPoints: 120,
    futurePoints: 60,
    settledAt: '2026-03-08T00:00:00.000Z',
  });

  const second = createRoundHistoryEntry({
    seed: 222222,
    roundCode: '222222',
    timeframe: '15m',
    stake: 50,
    score: {
      direction: 18,
      magnitude: 15,
      turningPoints: 8,
      volatility: 4,
      total: 45,
    },
    payout: {
      multiplier: 0.8,
      payout: 40,
      profit: -10,
    },
    historyPoints: 120,
    futurePoints: 15,
    settledAt: '2026-03-08T01:00:00.000Z',
  });

  it('creates shareable history entries', () => {
    expect(first.id).toBe('111111:1h:2026-03-08T00:00:00.000Z');
    expect(first.sharePath).toBe('/play?tf=1h&seed=111111');
  });

  it('merges entries newest-first', () => {
    const merged = mergeRoundHistory([first], second);

    expect(merged).toHaveLength(2);
    expect(merged[0]!.id).toBe(second.id);
    expect(merged[1]!.id).toBe(first.id);
  });

  it('computes aggregate stats', () => {
    const stats = computeRoundHistoryStats([first, second]);

    expect(stats.rounds).toBe(2);
    expect(stats.avgScore).toBeCloseTo(57.5, 8);
    expect(stats.avgMultiplier).toBeCloseTo(1.4, 8);
    expect(stats.profitableRate).toBeCloseTo(50, 8);
    expect(stats.bestScore).toBe(70);
    expect(stats.totalProfit).toBe(90);
  });

  it('formats recent round ages', () => {
    expect(
      formatRoundAge('2026-03-08T01:58:00.000Z', Date.parse('2026-03-08T02:00:00.000Z')),
    ).toBe('2m ago');
    expect(
      formatRoundAge('2026-03-07T20:00:00.000Z', Date.parse('2026-03-08T02:00:00.000Z')),
    ).toBe('6h ago');
  });
});
