import { describe, expect, it } from 'vitest';
import {
  buildRoundCode,
  computeCommitmentHash,
  getProtocolManifest,
  isFinitePriceArray,
  makeCommitment,
  makeCommitmentPayload,
  verifyCommitment,
} from './protocol.js';

describe('server protocol helpers', () => {
  it('creates verifiable commitment proofs', () => {
    const inputs = {
      roundId: '42',
      timeframe: '1h',
      startTime: 1_725_000_000_000,
      seed: 123456,
    };
    const proof = makeCommitment(inputs);
    const verification = verifyCommitment(inputs, proof.salt, proof.hash);

    expect(verification.matches).toBe(true);
    expect(verification.payload).toBe(proof.payload);
    expect(verification.computedHash).toBe(proof.hash);
  });

  it('computes stable payloads and hashes for the same inputs', () => {
    const payload = makeCommitmentPayload({
      roundId: '7',
      timeframe: '24h',
      startTime: 10,
      seed: null,
    });

    expect(payload).toBe(
      JSON.stringify({
        roundId: '7',
        timeframe: '24h',
        startTime: 10,
        seed: null,
      }),
    );

    expect(computeCommitmentHash(payload, 'salt')).toBe(
      computeCommitmentHash(payload, 'salt'),
    );
  });

  it('builds deterministic round codes', () => {
    expect(buildRoundCode(123456789, '1')).toBe('456789');
    expect(buildRoundCode(null, '12')).toBe('000012');
  });

  it('validates finite price arrays', () => {
    expect(isFinitePriceArray([1, 2, 3])).toBe(true);
    expect(isFinitePriceArray([1, 0, 3])).toBe(false);
    expect(isFinitePriceArray([1, Number.NaN, 3])).toBe(false);
  });

  it('exposes a protocol manifest with versions and configs', () => {
    const manifest = getProtocolManifest();

    expect(manifest.protocolVersion).toBeDefined();
    expect(manifest.versions.scoring).toBeDefined();
    expect(manifest.versions.payout).toBeDefined();
    expect(manifest.supportedTimeframes).toContain('1h');
    expect(manifest.commitment.payloadFields).toEqual([
      'roundId',
      'timeframe',
      'startTime',
      'seed',
    ]);
  });
});
