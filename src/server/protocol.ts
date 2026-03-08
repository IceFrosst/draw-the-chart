import { createHash, randomBytes } from 'node:crypto';
import { DEFAULT_CONFIG } from '../scoring/config.js';
import { DEFAULT_PAYOUT_CONFIG } from '../scoring/payout.js';

export const PROTOCOL_VERSION = '1.2';
export const SCORING_VERSION = '1.1';
export const PAYOUT_VERSION = '1.1';
export const COMMITMENT_ALGORITHM = 'sha256';
export const SUPPORTED_TIMEFRAMES = ['15m', '1h', '6h', '24h', '7d'] as const;
export const MIN_WAGER = 10;
export const MAX_WAGER = 10_000;
export const MIN_PRICE_SERIES_LENGTH = 3;
export const MAX_PRICE_SERIES_LENGTH = 10_000;

export type SupportedTimeframe = (typeof SUPPORTED_TIMEFRAMES)[number];

export interface CommitmentInputs {
  roundId: string;
  timeframe: string;
  startTime: number;
  seed: number | null;
}

export interface CommitmentProof {
  salt: string;
  payload: string;
  hash: string;
  algorithm: typeof COMMITMENT_ALGORITHM;
}

export function isSupportedTimeframe(value: unknown): value is SupportedTimeframe {
  return (
    typeof value === 'string' &&
    (SUPPORTED_TIMEFRAMES as readonly string[]).includes(value)
  );
}

export function isValidWager(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_WAGER &&
    value <= MAX_WAGER
  );
}

export function isValidSeed(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
  );
}

export function isFinitePriceArray(values: unknown): values is number[] {
  return (
    Array.isArray(values) &&
    values.length >= MIN_PRICE_SERIES_LENGTH &&
    values.length <= MAX_PRICE_SERIES_LENGTH &&
    values.every(
      (value) => typeof value === 'number' && Number.isFinite(value) && value > 0,
    )
  );
}

export function buildRoundCode(seed: number | null, roundId: string): string {
  if (seed != null) {
    return String(seed).slice(-6).padStart(6, '0');
  }

  return roundId.padStart(6, '0').slice(-6);
}

export function makeCommitmentPayload({
  roundId,
  timeframe,
  startTime,
  seed,
}: CommitmentInputs): string {
  return JSON.stringify({
    roundId,
    timeframe,
    startTime,
    seed,
  });
}

export function computeCommitmentHash(payload: string, salt: string): string {
  return createHash(COMMITMENT_ALGORITHM)
    .update(`${payload}:${salt}`)
    .digest('hex');
}

export function makeCommitment(inputs: CommitmentInputs): CommitmentProof {
  const salt = randomBytes(16).toString('hex');
  const payload = makeCommitmentPayload(inputs);
  return {
    salt,
    payload,
    hash: computeCommitmentHash(payload, salt),
    algorithm: COMMITMENT_ALGORITHM,
  };
}

export function verifyCommitment(
  inputs: CommitmentInputs,
  salt: string,
  expectedHash: string,
) {
  const payload = makeCommitmentPayload(inputs);
  const computedHash = computeCommitmentHash(payload, salt);
  return {
    payload,
    computedHash,
    matches: computedHash === expectedHash,
  };
}

export function getProtocolManifest() {
  return {
    protocolVersion: PROTOCOL_VERSION,
    commitment: {
      algorithm: COMMITMENT_ALGORITHM,
      payloadFields: ['roundId', 'timeframe', 'startTime', 'seed'],
    },
    supportedTimeframes: [...SUPPORTED_TIMEFRAMES],
    wagerLimits: { min: MIN_WAGER, max: MAX_WAGER },
    pathLengthLimits: {
      min: MIN_PRICE_SERIES_LENGTH,
      max: MAX_PRICE_SERIES_LENGTH,
    },
    versions: {
      scoring: SCORING_VERSION,
      payout: PAYOUT_VERSION,
    },
    scoring: DEFAULT_CONFIG,
    payout: DEFAULT_PAYOUT_CONFIG,
  };
}
