import express from 'express';
import { computeScore } from '../scoring/index.js';
import { computePayout } from '../scoring/payout.js';
import {
  buildRoundCode,
  COMMITMENT_ALGORITHM,
  getProtocolManifest,
  isFinitePriceArray,
  isSupportedTimeframe,
  isValidSeed,
  isValidWager,
  makeCommitment,
  makeCommitmentPayload,
  MAX_PRICE_SERIES_LENGTH,
  MAX_WAGER,
  MIN_PRICE_SERIES_LENGTH,
  MIN_WAGER,
  PAYOUT_VERSION,
  PROTOCOL_VERSION,
  SCORING_VERSION,
  verifyCommitment,
} from './protocol.js';

const app = express();
app.use(express.json());

// In-memory store for rounds
interface Round {
  id: string;
  timeframe: string;
  startTime: number;
  seed: number | null;
  commitmentHash: string;
  commitmentSalt: string;
  status: 'active' | 'submitted' | 'settled';
  predictedPrices?: number[];
  actualPrices?: number[];
  score?: { direction: number; magnitude: number; turningPoints: number; volatility: number; total: number };
  payout?: { multiplier: number; payout: number; profit: number };
  wager: number;
  createdAt: number;
  submittedAt?: number;
  settledAt?: number;
}

const rounds = new Map<string, Round>();
let nextId = 1;

function serializeRound(round: Round) {
  const commitmentInputs = {
    roundId: round.id,
    timeframe: round.timeframe,
    startTime: round.startTime,
    seed: round.seed,
  };

  return {
    id: round.id,
    roundCode: buildRoundCode(round.seed, round.id),
    timeframe: round.timeframe,
    seed: round.seed,
    status: round.status,
    wager: round.wager,
    createdAt: round.createdAt,
    startTime: round.startTime,
    commitmentHash: round.commitmentHash,
    protocolVersion: PROTOCOL_VERSION,
    scoringVersion: SCORING_VERSION,
    payoutVersion: PAYOUT_VERSION,
    submittedAt: round.submittedAt ?? null,
    settledAt: round.settledAt ?? null,
    predictedPrices: round.predictedPrices ?? null,
    actualPrices: round.actualPrices ?? null,
    score: round.score ?? null,
    payout: round.payout ?? null,
    verification: {
      verifyPath: `/rounds/${round.id}/verify`,
      replayPath: `/rounds/${round.id}/replay`,
      commitmentAlgorithm: COMMITMENT_ALGORITHM,
      revealAvailable: round.status === 'settled',
    },
    reveal:
      round.status === 'settled'
        ? {
            salt: round.commitmentSalt,
            payload: makeCommitmentPayload(commitmentInputs),
          }
        : null,
  };
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'dtc-sandbox',
    rounds: rounds.size,
    protocolVersion: PROTOCOL_VERSION,
    scoringVersion: SCORING_VERSION,
    payoutVersion: PAYOUT_VERSION,
  });
});

app.get('/config', (_req, res) => {
  res.json(getProtocolManifest());
});

app.get('/protocol/manifest', (_req, res) => {
  res.json(getProtocolManifest());
});

app.get('/rounds', (_req, res) => {
  const ordered = [...rounds.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(serializeRound);
  res.json({ rounds: ordered });
});

// POST /rounds/start — Create a new round
app.post('/rounds/start', (req, res) => {
  const { timeframe = '1h', wager = 100, seed = null } = req.body ?? {};
  if (!isSupportedTimeframe(timeframe)) {
    res.status(400).json({ error: 'Unsupported timeframe' });
    return;
  }
  if (!isValidWager(wager)) {
    res.status(400).json({
      error: `wager must be a number between ${MIN_WAGER} and ${MAX_WAGER}`,
    });
    return;
  }
  if (!isValidSeed(seed)) {
    res.status(400).json({ error: 'seed must be a positive integer when provided' });
    return;
  }

  const id = String(nextId++);
  const startTime = Date.now();
  const commitment = makeCommitment({
    roundId: id,
    timeframe,
    startTime,
    seed,
  });
  const round: Round = {
    id,
    timeframe,
    startTime,
    seed,
    commitmentHash: commitment.hash,
    commitmentSalt: commitment.salt,
    status: 'active',
    wager,
    createdAt: startTime,
  };
  rounds.set(id, round);
  res.json(serializeRound(round));
});

// POST /rounds/submit — Submit a prediction for a round
app.post('/rounds/submit', (req, res) => {
  const { roundId, predictedPrices } = req.body ?? {};
  const round = rounds.get(roundId);
  if (!round) {
    res.status(404).json({ error: 'Round not found' });
    return;
  }
  if (round.status !== 'active') {
    res.status(400).json({ error: 'Round is not active' });
    return;
  }
  if (!isFinitePriceArray(predictedPrices)) {
    res.status(400).json({
      error: `predictedPrices must be an array of ${MIN_PRICE_SERIES_LENGTH}-${MAX_PRICE_SERIES_LENGTH} positive numeric prices`,
    });
    return;
  }
  round.predictedPrices = predictedPrices;
  round.status = 'submitted';
  round.submittedAt = Date.now();
  res.json(serializeRound(round));
});

// POST /rounds/:id/settle — Settle a round with actual prices
app.post('/rounds/:id/settle', (req, res) => {
  const round = rounds.get(req.params.id);
  if (!round) {
    res.status(404).json({ error: 'Round not found' });
    return;
  }
  if (round.status !== 'submitted') {
    res.status(400).json({ error: 'Round must be submitted before settling' });
    return;
  }
  const { actualPrices } = req.body ?? {};
  if (!isFinitePriceArray(actualPrices)) {
    res.status(400).json({
      error: `actualPrices must be an array of ${MIN_PRICE_SERIES_LENGTH}-${MAX_PRICE_SERIES_LENGTH} positive numeric prices`,
    });
    return;
  }

  round.actualPrices = actualPrices;
  round.score = computeScore(round.predictedPrices!, actualPrices);
  round.payout = computePayout(round.score.total, round.wager);
  round.status = 'settled';
  round.settledAt = Date.now();

  res.json(serializeRound(round));
});

// GET /rounds/:id/replay — Get round data for replay
app.get('/rounds/:id/replay', (req, res) => {
  const round = rounds.get(req.params.id);
  if (!round) {
    res.status(404).json({ error: 'Round not found' });
    return;
  }
  res.json(serializeRound(round));
});

app.get('/rounds/:id/verify', (req, res) => {
  const round = rounds.get(req.params.id);
  if (!round) {
    res.status(404).json({ error: 'Round not found' });
    return;
  }

  const verification = verifyCommitment(
    {
      roundId: round.id,
      timeframe: round.timeframe,
      startTime: round.startTime,
      seed: round.seed,
    },
    round.commitmentSalt,
    round.commitmentHash,
  );

  res.json({
    ok: true,
    roundId: round.id,
    roundCode: buildRoundCode(round.seed, round.id),
    protocolVersion: PROTOCOL_VERSION,
    matches: verification.matches,
    payload: verification.payload,
    salt: round.commitmentSalt,
    commitmentHash: round.commitmentHash,
    computedHash: verification.computedHash,
    scoringVersion: SCORING_VERSION,
    payoutVersion: PAYOUT_VERSION,
  });
});

app.post('/rounds/reset', (_req, res) => {
  rounds.clear();
  nextId = 1;
  res.json({ ok: true, rounds: 0 });
});

const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, () => {
  console.log(`DTC server listening on port ${PORT}`);
});

export default app;
