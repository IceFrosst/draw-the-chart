import { describe, expect, it } from 'vitest';
import { getRoundAssessment } from './roundInsights.js';

describe('getRoundAssessment', () => {
  it('classifies strong profitable rounds', () => {
    const assessment = getRoundAssessment(
      {
        direction: 33,
        magnitude: 25,
        turningPoints: 15,
        volatility: 8,
        total: 81,
      },
      2.4,
    );

    expect(assessment.band).toBe('Profitable read');
    expect(assessment.insights.length).toBeGreaterThan(0);
    expect(assessment.summary).toContain('profit zone');
  });

  it('classifies weak rounds below break-even', () => {
    const assessment = getRoundAssessment(
      {
        direction: 10,
        magnitude: 8,
        turningPoints: 3,
        volatility: 2,
        total: 23,
      },
      0.41,
    );

    expect(assessment.band).toBe('Offside');
    expect(assessment.headline).toContain('diverged');
    expect(
      assessment.insights.some((insight) => insight.tone === 'warning'),
    ).toBe(true);
  });
});
