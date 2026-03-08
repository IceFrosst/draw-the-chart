import { describe, expect, it } from 'vitest';
import { runFairnessStudy } from './fairness.js';

describe('runFairnessStudy', () => {
  it('keeps intuitive ranking ladders mostly ordered', () => {
    const result = runFairnessStudy({
      roundsPerTimeframe: 40,
      seed: 13579,
    });
    const perfect = result.profiles.Perfect!;
    const tight = result.profiles['Tight Noise']!;
    const medium = result.profiles['Medium Noise']!;
    const lagged = result.profiles['Lagged Turns']!;
    const flat = result.profiles.Flat!;

    expect(perfect.mean).toBeGreaterThan(tight.mean);
    expect(tight.mean).toBeGreaterThan(medium.mean);
    expect(medium.mean).toBeGreaterThan(lagged.mean);
    expect(lagged.mean).toBeGreaterThan(flat.mean);

    const tightVsMedium = result.pairwise.find(
      (pair) =>
        pair.better === 'Tight Noise' && pair.worse === 'Medium Noise',
    );
    const mediumVsLagged = result.pairwise.find(
      (pair) =>
        pair.better === 'Medium Noise' && pair.worse === 'Lagged Turns',
    );

    expect(tightVsMedium?.winRate ?? 0).toBeGreaterThan(0.72);
    expect(mediumVsLagged?.winRate ?? 0).toBeGreaterThan(0.68);
    expect(result.ladderPassRate).toBeGreaterThan(0.42);
  });
});
