import type { ScoreBreakdown } from '../../scoring/index.js';
import { getBreakEvenScore } from '../../scoring/payout.js';

interface Insight {
  tone: 'good' | 'neutral' | 'warning';
  title: string;
  body: string;
}

export interface RoundAssessment {
  band: string;
  headline: string;
  summary: string;
  insights: Insight[];
}

const COMPONENT_MAX = {
  direction: 40,
  magnitude: 30,
  turningPoints: 20,
  volatility: 10,
} as const;

function ratio(value: number, max: number): number {
  return max <= 0 ? 0 : value / max;
}

export function getRoundAssessment(
  score: ScoreBreakdown,
  multiplier: number,
): RoundAssessment {
  const breakEvenScore = getBreakEvenScore();
  const directionRatio = ratio(score.direction, COMPONENT_MAX.direction);
  const magnitudeRatio = ratio(score.magnitude, COMPONENT_MAX.magnitude);
  const turningRatio = ratio(score.turningPoints, COMPONENT_MAX.turningPoints);
  const volatilityRatio = ratio(score.volatility, COMPONENT_MAX.volatility);

  const insights: Insight[] = [];

  if (directionRatio >= 0.7) {
    insights.push({
      tone: 'good',
      title: 'Macro direction held',
      body: 'Your path captured the dominant move across the horizon, which carries the largest weight in the score.',
    });
  } else if (directionRatio < 0.45) {
    insights.push({
      tone: 'warning',
      title: 'Broad move was off',
      body: 'The engine saw the wrong directional story across multiple time scales, which is costly because coarse moves matter most.',
    });
  }

  if (magnitudeRatio >= 0.65) {
    insights.push({
      tone: 'good',
      title: 'Levels stayed believable',
      body: 'The predicted path stayed close to the realized price zone instead of drifting too far high or low.',
    });
  } else if (magnitudeRatio < 0.45) {
    insights.push({
      tone: 'warning',
      title: 'Price levels drifted',
      body: 'Even when parts of the shape were right, the path spent too much time away from the realized level range.',
    });
  }

  if (turningRatio >= 0.6) {
    insights.push({
      tone: 'good',
      title: 'Turns were timed well',
      body: 'You anticipated meaningful peaks and troughs with enough timing and amplitude overlap to earn turning-point credit.',
    });
  } else if (turningRatio < 0.35) {
    insights.push({
      tone: 'warning',
      title: 'Missed the inflections',
      body: 'The realized path changed character in places your drawing did not, or your path invented turns that never happened.',
    });
  }

  if (volatilityRatio >= 0.65) {
    insights.push({
      tone: 'good',
      title: 'Pace matched the tape',
      body: 'Quarter-by-quarter volatility was close to realized movement, so the path had the right rhythm instead of just the right endpoint.',
    });
  } else if (volatilityRatio < 0.4) {
    insights.push({
      tone: 'neutral',
      title: 'Rhythm was mismatched',
      body: 'The path was either too quiet or too noisy for the realized move, which reduced the volatility-regime component.',
    });
  }

  const trimmedInsights = insights.slice(0, 3);

  if (score.total >= 85) {
    return {
      band: 'Elite read',
      headline: 'You were extremely close to the realized path.',
      summary:
        multiplier >= 1
          ? 'This is the kind of round the convex payout zone is built to reward.'
          : 'Despite the strong score, the current sandbox payout configuration still governs the return.',
      insights: trimmedInsights,
    };
  }

  if (score.total >= breakEvenScore) {
    return {
      band: 'Profitable read',
      headline: 'The thesis cleared break-even and entered the profit zone.',
      summary:
        'Direction and structure were strong enough for the path to earn a positive multiplier in the profit zone.',
      insights: trimmedInsights,
    };
  }

  if (score.total >= breakEvenScore - 15) {
    return {
      band: 'Mixed read',
      headline: 'Parts of the thesis were right, but not enough of the path held together.',
      summary:
        'This is usually a round where one or two components worked while another dragged the score below break-even.',
      insights: trimmedInsights,
    };
  }

  return {
    band: 'Offside',
    headline: 'The realized path diverged materially from the thesis.',
    summary:
      'This is typically what happens when the broad move, the level range, or both are materially wrong.',
    insights: trimmedInsights,
  };
}
