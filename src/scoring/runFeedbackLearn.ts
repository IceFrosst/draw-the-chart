/**
 * CLI entry point for feedback-based scoring analysis.
 *
 * Usage:
 *   npx tsx src/scoring/runFeedbackLearn.ts feedback_export.json
 *   npx tsx src/scoring/runFeedbackLearn.ts  (attempts Supabase query)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeFeedback, generateFeedbackReport, loadFeedbackData } from './feedbackLearning.js';
import type { FeedbackRound } from './feedbackLearning.js';

async function main() {
  const inputPath = process.argv[2];
  let rounds: FeedbackRound[];

  if (inputPath) {
    console.log(`Loading feedback data from ${inputPath}...`);
    rounds = loadFeedbackData(inputPath);
  } else {
    // Try to query Supabase directly
    console.log('No input file specified. Attempting Supabase query...');
    try {
      const { createClient } = await import('@supabase/supabase-js');

      const url = process.env['VITE_SUPABASE_URL'];
      const key = process.env['VITE_SUPABASE_ANON_KEY'];

      if (!url || !key) {
        console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or pass a JSON file path.');
        process.exit(1);
      }

      const supabase = createClient(url, key);

      // Query rounds with feedback
      const { data: feedbackRows, error: fbError } = await supabase
        .from('round_feedback')
        .select('*, rounds(predicted_path, actual_path, score_direction, score_magnitude, score_turning_points, score_volatility, score_total)')
        .order('created_at', { ascending: true });

      if (fbError) {
        console.error('Supabase query error:', fbError.message);
        process.exit(1);
      }

      if (!feedbackRows || feedbackRows.length === 0) {
        console.log('No feedback data found in Supabase.');
        process.exit(0);
      }

      rounds = feedbackRows.map((row: Record<string, unknown>) => {
        const round = row['rounds'] as Record<string, unknown> | null;
        return {
          roundId: row['round_id'] as string,
          predictedPrices: (round?.['predicted_path'] as number[]) ?? [],
          actualPrices: (round?.['actual_path'] as number[]) ?? [],
          algoScore: {
            direction: (round?.['score_direction'] as number) ?? 0,
            magnitude: (round?.['score_magnitude'] as number) ?? 0,
            turningPoints: (round?.['score_turning_points'] as number) ?? 0,
            volatility: (round?.['score_volatility'] as number) ?? 0,
            total: (round?.['score_total'] as number) ?? 0,
          },
          feedback: {
            fairnessVote: row['fairness_vote'] as 'too_low' | 'about_right' | 'too_high',
            selfAssessedScore: row['self_assessed_score'] as number,
            confidence: row['confidence'] as number,
            wrongComponents: (row['wrong_components'] as string[]) ?? [],
            difficultyPerception: row['difficulty_perception'] as string,
            wouldBetRealMoney: row['would_bet_real_money'] as boolean,
            comment: (row['comment'] as string) ?? null,
          },
        };
      });
    } catch {
      console.error('Failed to query Supabase. Pass a JSON file path instead.');
      console.error('Usage: npx tsx src/scoring/runFeedbackLearn.ts feedback_export.json');
      process.exit(1);
    }
  }

  console.log(`Loaded ${rounds.length} rounds with feedback\n`);

  if (rounds.length === 0) {
    console.log('No feedback data to analyze.');
    process.exit(0);
  }

  const analysis = analyzeFeedback(rounds);
  const report = generateFeedbackReport(analysis);

  const reportPath = path.join(process.cwd(), 'FEEDBACK_ANALYSIS_REPORT.md');
  fs.writeFileSync(reportPath, report);

  console.log('='.repeat(50));
  console.log('FEEDBACK ANALYSIS RESULTS');
  console.log('='.repeat(50));
  console.log(`Sample size: ${analysis.sampleSize}`);
  console.log(`Confidence: ${analysis.confidence}`);
  console.log(`Score correlation (algo vs human): ${analysis.scoreCorrelation.toFixed(3)}`);
  console.log(`Fairness rate: ${(analysis.fairnessRate * 100).toFixed(0)}%`);
  console.log(`Score bias: ${analysis.scoreBias >= 0 ? '+' : ''}${analysis.scoreBias.toFixed(1)}`);
  console.log('');
  console.log('Component complaints:');
  for (const [comp, count] of Object.entries(analysis.componentComplaints)) {
    console.log(`  ${comp}: ${count}`);
  }
  console.log('');
  console.log('Recommended weights:');
  for (const [comp, weight] of Object.entries(analysis.recommendedWeights)) {
    console.log(`  ${comp}: ${weight.toFixed(1)}`);
  }
  console.log('');
  console.log(`Report saved to: ${reportPath}`);
}

main().catch(console.error);
