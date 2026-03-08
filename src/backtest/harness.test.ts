import { describe, expect, it } from 'vitest';
import { runBacktestSuite } from './harness';

describe('runBacktestSuite', () => {
  it('keeps baseline strategy means in the target calibration bands', () => {
    const { overallMeans } = runBacktestSuite({ roundsPerStrategy: 250 });

    expect(overallMeans['Random Walk']).toBeGreaterThanOrEqual(30);
    expect(overallMeans['Random Walk']).toBeLessThanOrEqual(35.25);

    // Flat line now correctly scores lower: the old turning-point component
    // gave 20/20 when actual had no detected extrema (common on smooth BTC
    // trends). The fix uses path correlation so a trivial flat prediction
    // only gets ~10/20 instead of a free 20/20.
    expect(overallMeans['Flat Line']).toBeGreaterThanOrEqual(23);
    expect(overallMeans['Flat Line']).toBeLessThanOrEqual(35);

    expect(overallMeans['Naive Trend']).toBeGreaterThanOrEqual(35);
    expect(overallMeans['Naive Trend']).toBeLessThanOrEqual(50);

    expect(overallMeans['Near Perfect']).toBeGreaterThanOrEqual(98);
    expect(overallMeans['Near Perfect']).toBeLessThanOrEqual(100);
  });
});
