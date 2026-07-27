import { describe, expect, it } from 'vitest';
import { runBacktestSuite } from './harness';

describe('runBacktestSuite', () => {
  it('keeps baseline strategy means in the target calibration bands', () => {
    const { overallMeans } = runBacktestSuite({ roundsPerStrategy: 1000 });

    expect(overallMeans['Random Walk']).toBeGreaterThanOrEqual(30);
    expect(overallMeans['Random Walk']).toBeLessThanOrEqual(35);

    expect(overallMeans['Flat Line']).toBeGreaterThanOrEqual(25);
    expect(overallMeans['Flat Line']).toBeLessThanOrEqual(35);

    expect(overallMeans['Naive Trend']).toBeGreaterThanOrEqual(35);
    expect(overallMeans['Naive Trend']).toBeLessThanOrEqual(50);

    expect(overallMeans['Near Perfect']).toBeGreaterThanOrEqual(98);
    expect(overallMeans['Near Perfect']).toBeLessThanOrEqual(100);
    // 1000 rounds x 11 strategies lands within a few hundred ms of vitest's
    // 5s default, so this times out under parallel load on a busy machine.
    // The assertions above are the contract; the wall clock is not.
  }, 60_000);
});
