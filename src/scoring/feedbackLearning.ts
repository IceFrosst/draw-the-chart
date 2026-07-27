/**
 * Feedback-Based Scoring Weight Learner (Part B)
 *
 * Analyzes human feedback data to recommend scoring weight adjustments.
 * Pulls rounds + feedback from a JSON export, computes alignment metrics,
 * and suggests config changes.
 *
 * Usage: npx tsx src/scoring/runFeedbackLearn.ts [path-to-export.json]
 */

import * as fs from 'node:fs';

// ─── TYPES ───────────────────────────────────────────────────

export interface FeedbackRound {
  roundId: string;
  predictedPrices: number[];
  actualPrices: number[];
  algoScore: {
    direction: number;
    magnitude: number;
    turningPoints: number;
    volatility: number;
    total: number;
  };
  feedback: {
    fairnessVote: 'too_low' | 'about_right' | 'too_high';
    selfAssessedScore: number;
    confidence: number;
    wrongComponents: string[];
    difficultyPerception: string;
    wouldBetRealMoney: boolean;
    comment: string | null;
  };
}

export interface FeedbackAnalysis {
  sampleSize: number;
  scoreCorrelation: number;
  fairnessRate: number;
  fairnessDistribution: { tooLow: number; aboutRight: number; tooHigh: number };
  componentComplaints: Record<string, number>;
  scoreBias: number;
  calibrationByBand: Array<{
    band: string;
    algoMean: number;
    humanMean: number;
    delta: number;
    count: number;
  }>;
  recommendedWeights: {
    direction: number;
    magnitude: number;
    turningPoints: number;
    volatility: number;
  };
  calibrationShift: number;
  confidence: 'low' | 'medium' | 'high';
}

// ─── ANALYSIS ────────────────────────────────────────────────

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;

  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let vx = 0;
  let vy = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }

  if (vx < 1e-16 || vy < 1e-16) return 0;
  return cov / Math.sqrt(vx * vy);
}

export function analyzeFeedback(
  rounds: FeedbackRound[],
  currentWeights = { direction: 40, magnitude: 30, turningPoints: 20, volatility: 10 },
): FeedbackAnalysis {
  const n = rounds.length;

  // Score correlation
  const algoScores = rounds.map((r) => r.algoScore.total);
  const humanScores = rounds.map((r) => r.feedback.selfAssessedScore);
  const scoreCorrelation = pearsonCorrelation(algoScores, humanScores);

  // Fairness distribution
  const fairnessCounts = { tooLow: 0, aboutRight: 0, tooHigh: 0 };
  for (const r of rounds) {
    if (r.feedback.fairnessVote === 'too_low') fairnessCounts.tooLow++;
    else if (r.feedback.fairnessVote === 'about_right') fairnessCounts.aboutRight++;
    else if (r.feedback.fairnessVote === 'too_high') fairnessCounts.tooHigh++;
  }
  const fairnessRate = n > 0 ? fairnessCounts.aboutRight / n : 0;

  // Component complaints
  const complaints: Record<string, number> = {
    direction: 0,
    magnitude: 0,
    turningPoints: 0,
    volatility: 0,
  };
  for (const r of rounds) {
    if (r.feedback.wrongComponents) {
      for (const comp of r.feedback.wrongComponents) {
        complaints[comp] = (complaints[comp] ?? 0) + 1;
      }
    }
  }

  // Score bias
  const deltas = rounds.map((r) => r.algoScore.total - r.feedback.selfAssessedScore);
  const scoreBias = n > 0 ? deltas.reduce((s, v) => s + v, 0) / n : 0;

  // Calibration by band
  const bands = [
    { band: '0-20', min: 0, max: 20 },
    { band: '20-40', min: 20, max: 40 },
    { band: '40-60', min: 40, max: 60 },
    { band: '60-80', min: 60, max: 80 },
    { band: '80-100', min: 80, max: 100 },
  ];

  const calibrationByBand = bands.map(({ band, min, max }) => {
    const inBand = rounds.filter(
      (r) => r.algoScore.total >= min && r.algoScore.total < (max === 100 ? 101 : max),
    );
    const algoMean =
      inBand.length > 0
        ? inBand.reduce((s, r) => s + r.algoScore.total, 0) / inBand.length
        : 0;
    const humanMean =
      inBand.length > 0
        ? inBand.reduce((s, r) => s + r.feedback.selfAssessedScore, 0) / inBand.length
        : 0;
    return {
      band,
      algoMean: +algoMean.toFixed(1),
      humanMean: +humanMean.toFixed(1),
      delta: +(algoMean - humanMean).toFixed(1),
      count: inBand.length,
    };
  });

  // Weight recommendations based on complaint patterns
  const totalComplaints = Object.values(complaints).reduce((s, v) => s + v, 0);
  const recommendedWeights = { ...currentWeights };

  if (totalComplaints > 0 && n >= 10) {
    // Reduce weight of frequently-complained components
    const components = ['direction', 'magnitude', 'turningPoints', 'volatility'] as const;
    const adjustments = components.map((comp) => {
      const complaintRate = complaints[comp]! / n;
      // If this component is frequently complained about, reduce its weight
      // Scale: 50% complaint rate → reduce by 20%
      return 1 - complaintRate * 0.4;
    });

    // Apply adjustments
    const raw = components.map((comp, i) => currentWeights[comp] * adjustments[i]!);
    const sum = raw.reduce((s, v) => s + v, 0);

    for (let i = 0; i < components.length; i++) {
      const normalized = Math.max(5, Math.min(80, (raw[i]! / sum) * 100));
      recommendedWeights[components[i]!] = +normalized.toFixed(1);
    }

    // Fix sum to 100
    const recSum = Object.values(recommendedWeights).reduce((s, v) => s + v, 0);
    recommendedWeights.direction = +(recommendedWeights.direction + (100 - recSum)).toFixed(1);
  }

  // Calibration shift
  const calibrationShift = -scoreBias; // If algo scores too high, shift down

  // Confidence
  const confidence: 'low' | 'medium' | 'high' =
    n < 10 ? 'low' : n < 50 ? 'medium' : 'high';

  return {
    sampleSize: n,
    scoreCorrelation,
    fairnessRate,
    fairnessDistribution: fairnessCounts,
    componentComplaints: complaints,
    scoreBias,
    calibrationByBand,
    recommendedWeights,
    calibrationShift,
    confidence,
  };
}

// ─── REPORT ──────────────────────────────────────────────────

export function generateFeedbackReport(analysis: FeedbackAnalysis): string {
  const lines: string[] = [];
  const w = (s: string) => lines.push(s);

  w('# Feedback-Based Scoring Analysis Report');
  w('');
  w(`**Date**: ${new Date().toISOString()}`);
  w(`**Sample Size**: ${analysis.sampleSize} rounds with feedback`);
  w(`**Confidence**: ${analysis.confidence.toUpperCase()}`);
  w('');

  if (analysis.confidence === 'low') {
    w('> **Warning**: Sample size is too small for reliable recommendations.');
    w('> Collect at least 10 rounds with feedback before acting on these results.');
    w('');
  }

  // Score correlation
  w('## Score Alignment');
  w('');
  w(`| Metric | Value |`);
  w(`|--------|-------|`);
  w(`| Algo vs Human Score Correlation | ${analysis.scoreCorrelation.toFixed(3)} |`);
  w(`| Score Bias (algo - human) | ${analysis.scoreBias >= 0 ? '+' : ''}${analysis.scoreBias.toFixed(1)} |`);
  w(`| Fairness Rate ("about right") | ${(analysis.fairnessRate * 100).toFixed(0)}% |`);
  w('');

  // Fairness distribution
  w('## Fairness Votes');
  w('');
  const fd = analysis.fairnessDistribution;
  w(`- Too Low: ${fd.tooLow} (${analysis.sampleSize > 0 ? ((fd.tooLow / analysis.sampleSize) * 100).toFixed(0) : 0}%)`);
  w(`- About Right: ${fd.aboutRight} (${analysis.sampleSize > 0 ? ((fd.aboutRight / analysis.sampleSize) * 100).toFixed(0) : 0}%)`);
  w(`- Too High: ${fd.tooHigh} (${analysis.sampleSize > 0 ? ((fd.tooHigh / analysis.sampleSize) * 100).toFixed(0) : 0}%)`);
  w('');

  // Component complaints
  w('## Component Complaints');
  w('');
  const sortedComplaints = Object.entries(analysis.componentComplaints)
    .sort((a, b) => b[1] - a[1]);
  for (const [comp, count] of sortedComplaints) {
    const pct = analysis.sampleSize > 0 ? ((count / analysis.sampleSize) * 100).toFixed(0) : '0';
    const bar = '#'.repeat(Math.round(count / Math.max(1, analysis.sampleSize) * 20));
    w(`- **${comp}**: ${count} complaints (${pct}%) ${bar}`);
  }
  w('');

  // Calibration by band
  w('## Calibration by Score Band');
  w('');
  w('| Band | Count | Algo Mean | Human Mean | Delta |');
  w('|------|-------|-----------|------------|-------|');
  for (const band of analysis.calibrationByBand) {
    if (band.count > 0) {
      w(`| ${band.band} | ${band.count} | ${band.algoMean} | ${band.humanMean} | ${band.delta >= 0 ? '+' : ''}${band.delta} |`);
    }
  }
  w('');

  // Recommendations
  w('## Recommendations');
  w('');
  if (analysis.confidence === 'low') {
    w('Insufficient data for reliable recommendations. Current recommendations are tentative.');
    w('');
  }

  w('### Weight Adjustments');
  w('');
  w('| Component | Current | Recommended | Change |');
  w('|-----------|---------|-------------|--------|');
  const currentWeights = { direction: 40, magnitude: 30, turningPoints: 20, volatility: 10 };
  for (const comp of ['direction', 'magnitude', 'turningPoints', 'volatility'] as const) {
    const curr = currentWeights[comp];
    const rec = analysis.recommendedWeights[comp];
    const delta = rec - curr;
    w(`| ${comp} | ${curr} | ${rec.toFixed(1)} | ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} |`);
  }
  w('');

  if (Math.abs(analysis.calibrationShift) > 1) {
    w(`### Calibration Shift: ${analysis.calibrationShift >= 0 ? '+' : ''}${analysis.calibrationShift.toFixed(1)} points`);
    w('');
    w(`The algorithm scores are systematically ${analysis.scoreBias > 0 ? 'higher' : 'lower'} than human self-assessments.`);
    w(`Consider applying a ${Math.abs(analysis.calibrationShift).toFixed(1)}-point ${analysis.calibrationShift > 0 ? 'bonus' : 'penalty'} to the total score.`);
    w('');
  }

  w(`*Report generated at ${new Date().toISOString()}*`);

  return lines.join('\n');
}

// ─── DATA LOADING ────────────────────────────────────────────

export function loadFeedbackData(filePath: string): FeedbackRound[] {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  if (!Array.isArray(raw)) {
    throw new Error('Feedback data must be a JSON array');
  }

  return raw.map((entry: Record<string, unknown>, i: number) => {
    if (!entry['predictedPrices'] || !entry['actualPrices'] || !entry['algoScore'] || !entry['feedback']) {
      throw new Error(`Invalid feedback entry at index ${i}: missing required fields`);
    }
    return entry as unknown as FeedbackRound;
  });
}

/**
 * Compute feedback alignment score for GA fitness integration.
 * Returns 0-1 where 1 = perfect alignment with human feedback.
 */
export function computeFeedbackAlignment(
  algoScores: number[],
  humanScores: number[],
  fairnessVotes: Array<'too_low' | 'about_right' | 'too_high'>,
): number {
  if (algoScores.length === 0) return 0.5;

  const n = algoScores.length;

  // 1. Score correlation component (0-0.5)
  const corr = pearsonCorrelation(algoScores, humanScores);
  const corrScore = Math.max(0, (corr + 1) / 4); // map [-1,1] to [0, 0.5]

  // 2. Fairness vote component (0-0.5)
  let fairnessScore = 0;
  for (let i = 0; i < n; i++) {
    if (fairnessVotes[i] === 'about_right') {
      fairnessScore += 1;
    } else {
      // Partial credit if the vote direction makes sense
      const delta = algoScores[i]! - humanScores[i]!;
      if (fairnessVotes[i] === 'too_high' && delta > 0) fairnessScore += 0.3;
      else if (fairnessVotes[i] === 'too_low' && delta < 0) fairnessScore += 0.3;
    }
  }
  fairnessScore = (fairnessScore / n) * 0.5;

  return corrScore + fairnessScore;
}
