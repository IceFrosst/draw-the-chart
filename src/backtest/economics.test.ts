import { describe, expect, it } from 'vitest';
import { DEFAULT_PAYOUT_CONFIG } from '../scoring/payout.js';
import { runPayoutEconomicsAnalysis } from './economics.js';

describe('payout economics guardrails', () => {
  it('keeps baseline retention and bankroll metrics inside the tuned bands', () => {
    const result = runPayoutEconomicsAnalysis({ roundsPerStrategy: 200 });

    expect(result.strategies['Flat Line']!.meanMultiplier).toBeGreaterThan(0.50);
    expect(result.strategies['Flat Line']!.meanMultiplier).toBeLessThan(0.75);

    expect(result.strategies['Random Walk']!.meanMultiplier).toBeGreaterThan(0.60);
    expect(result.strategies['Random Walk']!.meanMultiplier).toBeLessThan(0.82);
    expect(result.strategies['Random Walk']!.profitableRate).toBeGreaterThan(0.02);
    expect(result.strategies['Random Walk']!.profitableRate).toBeLessThan(0.12);

    expect(result.strategies['Naive Trend']!.meanMultiplier).toBeGreaterThan(0.65);
    expect(result.strategies['Naive Trend']!.meanMultiplier).toBeLessThan(1.00);

    expect(result.strategies['Mean Reversion']!.meanMultiplier).toBeGreaterThan(0.70);
    expect(result.strategies['Mean Reversion']!.meanMultiplier).toBeLessThan(1.00);

    expect(result.strategies['Near Perfect']!.meanMultiplier).toBeGreaterThan(10);
    expect(result.strategies['Near Perfect']!.meanMultiplier).toBeLessThan(14);
    expect(result.strategies['Near Perfect']!.maxMultiplier).toBeLessThanOrEqual(
      DEFAULT_PAYOUT_CONFIG.maxMultiplier,
    );

    const casualBlend = result.blends.find((blend) => blend.name === 'Casual Blend');
    const engagedBlend = result.blends.find((blend) => blend.name === 'Engaged Blend');

    expect(casualBlend).toBeDefined();
    expect(engagedBlend).toBeDefined();
    expect(casualBlend!.meanMultiplier).toBeGreaterThan(0.55);
    expect(casualBlend!.meanMultiplier).toBeLessThan(0.85);
    expect(engagedBlend!.meanMultiplier).toBeGreaterThan(0.68);
    expect(engagedBlend!.meanMultiplier).toBeLessThan(0.95);
  });
});
