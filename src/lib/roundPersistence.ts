import { supabase, isSupabaseConfigured } from './supabase';
import type { ScoreBreakdown } from '../scoring/types';

const SESSION_USER_KEY = 'dtc.sessionUserId';

export interface RoundInsertData {
  seed: number;
  roundCode: string;
  timeframe: string;
  stake: number;
  predictedPrices: number[];
  actualPrices: number[];
  score: ScoreBreakdown;
  payoutMultiplier: number;
  payoutAmount: number;
  payoutProfit: number;
  drawingPointCount: number;
  drawingDurationSeconds: number;
}

export interface FeedbackInsertData {
  roundId: string;
  fairnessVote: 'too_low' | 'about_right' | 'too_high';
  selfAssessedScore: number;
  confidence: number;
  wrongComponents: string[];
  difficultyPerception: 'easy' | 'medium' | 'hard' | 'impossible';
  wouldBetRealMoney: boolean;
  comment: string | null;
}

export function computeMarketMetrics(actualPrices: number[]): {
  realizedVol: number;
  trendDirection: number;
  maxStepMove: number;
} {
  if (actualPrices.length < 2) {
    return { realizedVol: 0, trendDirection: 0, maxStepMove: 0 };
  }

  const logReturns: number[] = [];
  for (let i = 1; i < actualPrices.length; i++) {
    logReturns.push(Math.log(actualPrices[i]! / actualPrices[i - 1]!));
  }

  const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
  const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / logReturns.length;
  const realizedVol = Math.sqrt(variance);
  const trendDirection = Math.log(actualPrices[actualPrices.length - 1]! / actualPrices[0]!);
  const maxStepMove = Math.max(...logReturns.map(Math.abs));

  return { realizedVol, trendDirection, maxStepMove };
}

export async function getOrCreateSessionUser(): Promise<string | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  const existing = localStorage.getItem(SESSION_USER_KEY);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('users')
    .insert({ display_name: `Tester ${Math.random().toString(36).slice(2, 6)}` })
    .select('id')
    .single();

  if (error || !data) {
    console.warn('[DTC] Failed to create session user:', error?.message);
    return null;
  }

  localStorage.setItem(SESSION_USER_KEY, data.id);
  return data.id;
}

export async function persistRound(data: RoundInsertData): Promise<string | null> {
  if (!isSupabaseConfigured() || !supabase) return null;

  const userId = await getOrCreateSessionUser();
  const metrics = computeMarketMetrics(data.actualPrices);

  const { data: row, error } = await supabase
    .from('rounds')
    .insert({
      user_id: userId,
      seed: data.seed,
      round_code: data.roundCode,
      timeframe: data.timeframe,
      instrument: 'BTC/USDT',
      stake: data.stake,
      predicted_path: data.predictedPrices,
      actual_path: data.actualPrices,
      score_direction: data.score.direction,
      score_magnitude: data.score.magnitude,
      score_turning_points: data.score.turningPoints,
      score_volatility: data.score.volatility,
      score_total: data.score.total,
      payout_multiplier: data.payoutMultiplier,
      payout_amount: data.payoutAmount,
      payout_profit: data.payoutProfit,
      realized_vol: metrics.realizedVol,
      trend_direction: metrics.trendDirection,
      max_step_move: metrics.maxStepMove,
      drawing_point_count: data.drawingPointCount,
      drawing_duration_seconds: data.drawingDurationSeconds,
    })
    .select('id')
    .single();

  if (error || !row) {
    console.warn('[DTC] Failed to persist round:', error?.message);
    return null;
  }

  return row.id;
}

export async function persistFeedback(data: FeedbackInsertData): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;

  const userId = await getOrCreateSessionUser();

  const { error } = await supabase.from('round_feedback').insert({
    round_id: data.roundId,
    user_id: userId,
    fairness_vote: data.fairnessVote,
    self_assessed_score: data.selfAssessedScore,
    confidence: data.confidence,
    wrong_components: data.wrongComponents,
    difficulty_perception: data.difficultyPerception,
    would_bet_real_money: data.wouldBetRealMoney,
    comment: data.comment,
  });

  if (error) {
    console.warn('[DTC] Failed to persist feedback:', error.message);
    return false;
  }

  return true;
}
