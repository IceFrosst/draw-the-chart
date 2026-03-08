import { describe, expect, it } from 'vitest';
import { runBacktestSuite } from './harness';

describe('runBacktestSuite', () => {
  it('keeps baseline strategy means in the target calibration bands', () => {
    const { overallMeans } = runBacktestSuite({ roundsPerStrategy: 250 });

    expect(overallMeans['Random Walk']).toBeGreaterThanOrEqual(30);
    expect(overallMeans['Random Walk']).toBeLessThanOrEqual(35.25);

    expect(overallMeans['Flat Line']).toBeGreaterThanOrEqual(25);
    expect(overallMeans['Flat Line']).toBeLessThanOrEqual(35);

    expect(overallMeans['Naive Trend']).toBeGreaterThanOrEqual(35);
    expect(overallMeans['Naive Trend']).toBeLessThanOrEqual(50);

    expect(overallMeans['Near Perfect']).toBeGreaterThanOrEqual(98);
    expect(overallMeans['Near Perfect']).toBeLessThanOrEqual(100);
  });
});
