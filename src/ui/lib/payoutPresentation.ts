import { computePayout } from '../../scoring/payout';

export interface PayoutExample {
  score: number;
  stake: number;
  multiplier: number;
  payout: number;
  profit: number;
}

export function getPayoutExample(
  score: number,
  stake: number = 100,
): PayoutExample {
  const payout = computePayout(score, stake);
  return {
    score,
    stake,
    multiplier: payout.multiplier,
    payout: payout.payout,
    profit: payout.profit,
  };
}

export function formatMoney(value: number, digits: number = 0): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatProfit(value: number, digits: number = 0): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${formatMoney(Math.abs(value), digits)}`;
}

export function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`;
}
