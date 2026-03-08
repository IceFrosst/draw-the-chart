-- DTC Testing Phase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Users: minimal for testing, expandable for wallet auth later
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  created_at timestamptz not null default now()
);

-- Rounds: one row per submitted round with full data for scoring analysis
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  seed bigint not null,
  round_code text,
  timeframe text not null,
  instrument text not null default 'BTC/USDT',
  stake numeric not null,

  -- Full paths (resampled arrays, ~120 floats each)
  predicted_path jsonb not null,
  actual_path jsonb not null,

  -- Score components
  score_direction numeric not null,
  score_magnitude numeric not null,
  score_turning_points numeric not null,
  score_volatility numeric not null,
  score_total numeric not null,

  -- Payout
  payout_multiplier numeric not null,
  payout_amount numeric not null,
  payout_profit numeric not null,

  -- Market conditions (computed from actual path)
  realized_vol numeric,
  trend_direction numeric,
  max_step_move numeric,

  -- Drawing metadata
  drawing_point_count integer,
  drawing_duration_seconds numeric,

  settled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Feedback: one row per feedback submission, linked to round
create table if not exists round_feedback (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  user_id uuid references users(id),

  fairness_vote text not null check (fairness_vote in ('too_low', 'about_right', 'too_high')),
  self_assessed_score integer not null check (self_assessed_score >= 0 and self_assessed_score <= 100),
  confidence integer not null check (confidence >= 1 and confidence <= 5),
  wrong_components text[],
  difficulty_perception text not null check (difficulty_perception in ('easy', 'medium', 'hard', 'impossible')),
  would_bet_real_money boolean not null,
  comment text,

  created_at timestamptz not null default now()
);

-- Indexes for common analysis queries
create index if not exists idx_rounds_user_id on rounds(user_id);
create index if not exists idx_rounds_timeframe on rounds(timeframe);
create index if not exists idx_rounds_score_total on rounds(score_total);
create index if not exists idx_rounds_settled_at on rounds(settled_at);
create index if not exists idx_feedback_round_id on round_feedback(round_id);
create index if not exists idx_feedback_fairness on round_feedback(fairness_vote);

-- RLS: permissive for testing phase (anon key can insert + read)
alter table users enable row level security;
alter table rounds enable row level security;
alter table round_feedback enable row level security;

create policy "anon_insert_users" on users for insert with check (true);
create policy "anon_select_users" on users for select using (true);
create policy "anon_insert_rounds" on rounds for insert with check (true);
create policy "anon_select_rounds" on rounds for select using (true);
create policy "anon_insert_feedback" on round_feedback for insert with check (true);
create policy "anon_select_feedback" on round_feedback for select using (true);
