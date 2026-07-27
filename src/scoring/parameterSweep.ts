/**
 * Parameter Sweep — Grid search over scoring config parameters.
 *
 * Runs 500+ parameter combinations against the 5-year BTC dataset
 * using the backtest harness. Evaluates each combination on:
 *   - Baseline target compliance (CLAUDE.md ranges)
 *   - Score spread (std of all scores)
 *   - Monotonicity violation rate
 *   - Direction × Magnitude correlation (target < 0.8)
 *
 * Usage: npx tsx src/scoring/parameterSweep.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_CONFIG } from './config.js';
import {
  runFullAudit,
  computeExtendedStats,
  pearsonCorrelation,
  testMonotonicity,
  loadExpandedData,
  type AuditReport,
} from './backtest.js';
import type { ScoringConfig, ScoreBreakdown } from './types.js';

// ─── TYPES ──────────────────────────────────────────────────────

interface SweepResult {
  configId: string;
  config: Partial<ScoringConfig>;
  baselinesPassed: boolean;
  baselineViolations: string[];
  rwMean: number;
  flatMean: number;
  trendMean: number;
  perfectMean: number;
  inverseMean: number;
  scoreSpread: number;
  monotonicity: number;
  dirMagCorrelation: number;
  compositeScore: number;
}

interface SweepReport {
  totalConfigs: number;
  totalRuns: number;
  bestConfig: SweepResult;
  top10: SweepResult[];
  allResults: SweepResult[];
  phaseResults: {
    phase1Best: SweepResult;
    phase2Best: SweepResult;
    phase3Best: SweepResult;
  };
  currentConfigResult: SweepResult;
  parameterSensitivity: Record<string, { param: string; range: string; impact: string }>;
}

// ─── PARAMETER GRID GENERATION ──────────────────────────────────

function linspace(start: number, end: number, n: number): number[] {
  if (n <= 1) return [start];
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => +(start + i * step).toFixed(6));
}

interface SweepPhase {
  name: string;
  params: Record<string, number[]>;
}

function generatePhase1Grid(): SweepPhase {
  return {
    name: 'Phase 1: Core Sensitivity',
    params: {
      magnitudeLambda: linspace(0.8, 2.2, 8),
      directionDecayBase: linspace(1.5, 3.0, 6),
      volatilityMu: linspace(1.0, 3.0, 6),
    },
  };
  // 8 × 6 × 6 = 288 combos
}

function generatePhase2Grid(bestPhase1: Partial<ScoringConfig>): SweepPhase {
  const lambda = bestPhase1.magnitudeLambda ?? DEFAULT_CONFIG.magnitudeLambda;
  const decay = bestPhase1.directionDecayBase ?? DEFAULT_CONFIG.directionDecayBase;
  const mu = bestPhase1.volatilityMu ?? DEFAULT_CONFIG.volatilityMu;

  return {
    name: 'Phase 2: Secondary Parameters',
    params: {
      magnitudeLambda: [lambda],
      directionDecayBase: [decay],
      volatilityMu: [mu],
      magnitudeBiasWeight: linspace(0.3, 0.7, 5),
      turningPointSmoothingFraction: linspace(0.03, 0.08, 4),
      turningPointProminenceMultiple: linspace(0.2, 0.5, 4),
    },
  };
  // 1 × 1 × 1 × 5 × 4 × 4 = 80 combos
}

function generatePhase3Grid(bestPhase2: Partial<ScoringConfig>): SweepPhase {
  const base = { ...bestPhase2 };
  return {
    name: 'Phase 3: Fine-Tuning',
    params: {
      magnitudeLambda: [base.magnitudeLambda ?? DEFAULT_CONFIG.magnitudeLambda],
      directionDecayBase: [base.directionDecayBase ?? DEFAULT_CONFIG.directionDecayBase],
      volatilityMu: [base.volatilityMu ?? DEFAULT_CONFIG.volatilityMu],
      magnitudeBiasWeight: [base.magnitudeBiasWeight ?? DEFAULT_CONFIG.magnitudeBiasWeight],
      turningPointSmoothingFraction: [base.turningPointSmoothingFraction ?? DEFAULT_CONFIG.turningPointSmoothingFraction],
      turningPointProminenceMultiple: [base.turningPointProminenceMultiple ?? DEFAULT_CONFIG.turningPointProminenceMultiple],
      turningPointTimeTolerance: linspace(0.05, 0.15, 4),
      turningPointHallucinationPenalty: linspace(0.1, 0.35, 4),
      turningPointMissPenalty: linspace(0.08, 0.25, 4),
      directionMaxScaleLevel: [3, 4, 5],
    },
  };
  // 1 × 1 × 1 × 1 × 1 × 1 × 4 × 4 × 4 × 3 = 192 combos
}

function cartesianProduct(params: Record<string, number[]>): Partial<ScoringConfig>[] {
  const keys = Object.keys(params);
  const values = keys.map((k) => params[k]!);

  const combos: Partial<ScoringConfig>[] = [];
  const indices = new Array(keys.length).fill(0);

  while (true) {
    const combo: Record<string, number> = {};
    for (let i = 0; i < keys.length; i++) {
      combo[keys[i]!] = values[i]![indices[i]!]!;
    }
    combos.push(combo as Partial<ScoringConfig>);

    // Increment indices
    let carry = true;
    for (let i = keys.length - 1; i >= 0 && carry; i--) {
      indices[i]!++;
      if (indices[i]! < values[i]!.length) {
        carry = false;
      } else {
        indices[i] = 0;
      }
    }
    if (carry) break;
  }

  return combos;
}

// ─── EVALUATION ─────────────────────────────────────────────────

function evaluateConfig(
  overrides: Partial<ScoringConfig>,
  configId: string,
  roundsPerStratPerTf: number = 50,
): SweepResult {
  const config: ScoringConfig = { ...DEFAULT_CONFIG, ...overrides };

  // Ensure biasWeight + trackingWeight don't get silly
  if (config.magnitudeBiasWeight !== undefined && config.magnitudeTrackingWeight !== undefined) {
    config.magnitudeTrackingWeight = +(1.0 - config.magnitudeBiasWeight).toFixed(4);
  }

  const audit = runFullAudit({
    roundsPerStrategyPerTimeframe: roundsPerStratPerTf,
    seed: 42424242,
    config,
  });

  // Extract key metrics
  const rw = audit.strategies['Random Walk'];
  const fl = audit.strategies['Flat Line'];
  const tr = audit.strategies['Naive Trend'];
  const pf = audit.strategies['Perfect'];
  const inv = audit.strategies['Inverse'];

  const rwMean = rw?.stats.mean ?? 0;
  const flatMean = fl?.stats.mean ?? 0;
  const trendMean = tr?.stats.mean ?? 0;
  const perfectMean = pf?.stats.mean ?? 0;
  const inverseMean = inv?.stats.mean ?? 0;

  // Score spread across all strategies
  const allMeans = Object.values(audit.strategies).map((s) => s.stats.mean);
  const spreadStats = computeExtendedStats(allMeans);
  const scoreSpread = spreadStats.max - spreadStats.min;

  // Direction × Magnitude correlation
  const allBreakdowns: ScoreBreakdown[] = [];
  for (const s of Object.values(audit.strategies)) {
    allBreakdowns.push(...s.breakdowns);
  }
  const dirMagCorrelation = pearsonCorrelation(
    allBreakdowns.map((b) => b.direction),
    allBreakdowns.map((b) => b.magnitude),
  );

  // Monotonicity violation rate
  const monotonicity = audit.monotonicity.violationRate;

  // Baseline check
  const baselineViolations = audit.baselineViolations;
  const baselinesPassed = baselineViolations.length === 0;

  // Composite score — higher is better
  const compositeScore = computeCompositeScore({
    baselinesPassed,
    rwMean,
    flatMean,
    trendMean,
    perfectMean,
    inverseMean,
    scoreSpread,
    monotonicity,
    dirMagCorrelation,
  });

  return {
    configId,
    config: overrides,
    baselinesPassed,
    baselineViolations,
    rwMean,
    flatMean,
    trendMean,
    perfectMean,
    inverseMean,
    scoreSpread,
    monotonicity,
    dirMagCorrelation,
    compositeScore,
  };
}

function computeCompositeScore(metrics: {
  baselinesPassed: boolean;
  rwMean: number;
  flatMean: number;
  trendMean: number;
  perfectMean: number;
  inverseMean: number;
  scoreSpread: number;
  monotonicity: number;
  dirMagCorrelation: number;
}): number {
  let score = 0;

  // 1. Baseline compliance (40 points max)
  // Baselines must pass — heavy penalty for violations
  if (metrics.baselinesPassed) {
    score += 25;
    // Bonus for being centered in target ranges
    // RW target: 30-35, ideal center: 32.5
    score += 5 * Math.exp(-Math.pow((metrics.rwMean - 32.5) / 2.5, 2));
    // Flat target: 25-35, ideal center: 30
    score += 5 * Math.exp(-Math.pow((metrics.flatMean - 30) / 5, 2));
    // Trend target: 35-50, ideal center: 42.5
    score += 5 * Math.exp(-Math.pow((metrics.trendMean - 42.5) / 7.5, 2));
  }

  // 2. Score spread (15 points max) — wider separation is better
  // Perfect = 100, Inverse ≈ 14 → ideal spread ≈ 86
  score += 15 * Math.min(1, metrics.scoreSpread / 86);

  // 3. Monotonicity (20 points max) — lower violation rate is better
  score += 20 * Math.exp(-10 * metrics.monotonicity);

  // 4. Dir × Mag independence (15 points max) — lower correlation is better
  // Target < 0.8, ideal < 0.6
  const corr = Math.abs(metrics.dirMagCorrelation);
  if (corr < 0.6) {
    score += 15;
  } else if (corr < 0.8) {
    score += 15 * (0.8 - corr) / 0.2;
  } else {
    score += 0; // penalty zone
  }

  // 5. Inverse should score low (10 points max)
  // Inverse scoring < 20 means scoring properly penalizes wrong predictions
  if (metrics.inverseMean < 15) {
    score += 10;
  } else if (metrics.inverseMean < 20) {
    score += 10 * (20 - metrics.inverseMean) / 5;
  }

  return +score.toFixed(3);
}

// ─── MAIN SWEEP ─────────────────────────────────────────────────

export function runParameterSweep(): SweepReport {
  console.log('='.repeat(60));
  console.log('PARAMETER SWEEP — SCORING ENGINE OPTIMIZATION');
  console.log('='.repeat(60));
  console.log('');

  // Pre-load data to confirm it exists
  const data = loadExpandedData();
  console.log(`Data loaded: ${data.length.toLocaleString()} candles`);
  console.log('');

  let totalRuns = 0;
  const allResults: SweepResult[] = [];

  // ─── Phase 0: Current config baseline ───
  console.log('Phase 0: Evaluating current config...');
  const currentResult = evaluateConfig({}, 'current', 100);
  console.log(`  Current config composite: ${currentResult.compositeScore.toFixed(2)}`);
  console.log(`  RW=${currentResult.rwMean.toFixed(1)}, Flat=${currentResult.flatMean.toFixed(1)}, Trend=${currentResult.trendMean.toFixed(1)}`);
  console.log(`  Monotonicity: ${(currentResult.monotonicity * 100).toFixed(1)}%, Dir×Mag: ${currentResult.dirMagCorrelation.toFixed(3)}`);
  console.log('');

  // ─── Phase 1: Core Sensitivity (288 combos) ───
  const phase1 = generatePhase1Grid();
  const phase1Combos = cartesianProduct(phase1.params);
  console.log(`Phase 1: ${phase1.name} (${phase1Combos.length} configs)`);

  for (let i = 0; i < phase1Combos.length; i++) {
    const combo = phase1Combos[i]!;
    const id = `p1_${i}`;
    const result = evaluateConfig(combo, id, 40);
    allResults.push(result);
    totalRuns += 40 * 12 * 5; // rounds × strategies × timeframes (approx)

    if ((i + 1) % 50 === 0) {
      console.log(`  ${i + 1}/${phase1Combos.length} done...`);
    }
  }

  // Find best from phase 1
  const phase1Sorted = [...allResults].sort((a, b) => b.compositeScore - a.compositeScore);
  const phase1Best = phase1Sorted[0]!;
  console.log(`  Phase 1 best: ${phase1Best.configId} (score ${phase1Best.compositeScore.toFixed(2)})`);
  console.log(`    Config: lambda=${phase1Best.config.magnitudeLambda}, decay=${phase1Best.config.directionDecayBase}, mu=${phase1Best.config.volatilityMu}`);
  console.log('');

  // ─── Phase 2: Secondary Parameters (80 combos) ───
  const phase2 = generatePhase2Grid(phase1Best.config);
  const phase2Combos = cartesianProduct(phase2.params);
  console.log(`Phase 2: ${phase2.name} (${phase2Combos.length} configs)`);

  const phase2Start = allResults.length;
  for (let i = 0; i < phase2Combos.length; i++) {
    const combo = phase2Combos[i]!;
    const id = `p2_${i}`;
    const result = evaluateConfig(combo, id, 50);
    allResults.push(result);
    totalRuns += 50 * 12 * 5;

    if ((i + 1) % 20 === 0) {
      console.log(`  ${i + 1}/${phase2Combos.length} done...`);
    }
  }

  const phase2Results = allResults.slice(phase2Start);
  const phase2Sorted = [...phase2Results].sort((a, b) => b.compositeScore - a.compositeScore);
  const phase2Best = phase2Sorted[0]!;
  console.log(`  Phase 2 best: ${phase2Best.configId} (score ${phase2Best.compositeScore.toFixed(2)})`);
  console.log('');

  // ─── Phase 3: Fine-Tuning (192 combos) ───
  const phase3 = generatePhase3Grid(phase2Best.config);
  const phase3Combos = cartesianProduct(phase3.params);
  console.log(`Phase 3: ${phase3.name} (${phase3Combos.length} configs)`);

  const phase3Start = allResults.length;
  for (let i = 0; i < phase3Combos.length; i++) {
    const combo = phase3Combos[i]!;
    const id = `p3_${i}`;
    const result = evaluateConfig(combo, id, 50);
    allResults.push(result);
    totalRuns += 50 * 12 * 5;

    if ((i + 1) % 40 === 0) {
      console.log(`  ${i + 1}/${phase3Combos.length} done...`);
    }
  }

  const phase3Results = allResults.slice(phase3Start);
  const phase3Sorted = [...phase3Results].sort((a, b) => b.compositeScore - a.compositeScore);
  const phase3Best = phase3Sorted[0]!;
  console.log(`  Phase 3 best: ${phase3Best.configId} (score ${phase3Best.compositeScore.toFixed(2)})`);
  console.log('');

  // ─── Full validation of best config ───
  const overallBest = [...allResults].sort((a, b) => b.compositeScore - a.compositeScore)[0]!;
  console.log('Running full validation on best config (200 rounds/strat/tf)...');
  const validated = evaluateConfig(overallBest.config, 'best_validated', 200);
  console.log(`  Validated composite: ${validated.compositeScore.toFixed(2)}`);
  console.log(`  RW=${validated.rwMean.toFixed(1)}, Flat=${validated.flatMean.toFixed(1)}, Trend=${validated.trendMean.toFixed(1)}, Perfect=${validated.perfectMean.toFixed(1)}`);
  console.log(`  Monotonicity: ${(validated.monotonicity * 100).toFixed(1)}%, Dir×Mag: ${validated.dirMagCorrelation.toFixed(3)}`);
  console.log('');

  // Determine the actual best after validation
  const finalBest = validated.compositeScore >= currentResult.compositeScore ? validated : currentResult;

  // Sort all results
  allResults.sort((a, b) => b.compositeScore - a.compositeScore);

  // ─── Parameter sensitivity analysis ───
  const sensitivity = computeSensitivity(allResults);

  return {
    totalConfigs: allResults.length,
    totalRuns,
    bestConfig: finalBest,
    top10: allResults.slice(0, 10),
    allResults,
    phaseResults: {
      phase1Best,
      phase2Best,
      phase3Best,
    },
    currentConfigResult: currentResult,
    parameterSensitivity: sensitivity,
  };
}

// ─── SENSITIVITY ANALYSIS ───────────────────────────────────────

function computeSensitivity(
  results: SweepResult[],
): Record<string, { param: string; range: string; impact: string }> {
  const paramNames = [
    'magnitudeLambda', 'directionDecayBase', 'volatilityMu',
    'magnitudeBiasWeight', 'turningPointSmoothingFraction',
    'turningPointProminenceMultiple', 'turningPointTimeTolerance',
    'turningPointHallucinationPenalty', 'turningPointMissPenalty',
    'directionMaxScaleLevel',
  ] as const;

  const sensitivity: Record<string, { param: string; range: string; impact: string }> = {};

  for (const param of paramNames) {
    const valuesMap = new Map<number, number[]>();

    for (const r of results) {
      const val = (r.config as Record<string, number | undefined>)[param];
      if (val === undefined) continue;
      if (!valuesMap.has(val)) valuesMap.set(val, []);
      valuesMap.get(val)!.push(r.compositeScore);
    }

    if (valuesMap.size < 2) continue;

    const entries = [...valuesMap.entries()].map(([val, scores]) => ({
      val,
      mean: scores.reduce((s, v) => s + v, 0) / scores.length,
    }));
    entries.sort((a, b) => a.val - b.val);

    const means = entries.map((e) => e.mean);
    const maxMean = Math.max(...means);
    const minMean = Math.min(...means);
    const impact = maxMean - minMean;

    const bestEntry = entries.find((e) => e.mean === maxMean)!;

    sensitivity[param] = {
      param,
      range: `${entries[0]!.val} – ${entries[entries.length - 1]!.val}`,
      impact: `${impact.toFixed(2)} pts (best at ${bestEntry.val})`,
    };
  }

  return sensitivity;
}

// ─── REPORT GENERATION ──────────────────────────────────────────

export function generateSweepReport(sweep: SweepReport): string {
  const lines: string[] = [];
  const w = (s: string) => lines.push(s);

  w('# Parameter Sweep Report');
  w('');
  w(`**Generated**: ${new Date().toISOString()}`);
  w(`**Total configurations tested**: ${sweep.totalConfigs}`);
  w(`**Estimated total scoring runs**: ~${(sweep.totalRuns / 1000).toFixed(0)}k`);
  w('');

  // ─── Current vs Best ───
  w('## 1. Current Config vs Best Found');
  w('');

  const curr = sweep.currentConfigResult;
  const best = sweep.bestConfig;

  w('| Metric | Current Config | Best Found | Delta |');
  w('|--------|---------------|------------|-------|');
  w(`| Composite Score | ${curr.compositeScore.toFixed(2)} | ${best.compositeScore.toFixed(2)} | ${(best.compositeScore - curr.compositeScore).toFixed(2)} |`);
  w(`| Random Walk Mean | ${curr.rwMean.toFixed(1)} | ${best.rwMean.toFixed(1)} | ${(best.rwMean - curr.rwMean).toFixed(1)} |`);
  w(`| Flat Line Mean | ${curr.flatMean.toFixed(1)} | ${best.flatMean.toFixed(1)} | ${(best.flatMean - curr.flatMean).toFixed(1)} |`);
  w(`| Naive Trend Mean | ${curr.trendMean.toFixed(1)} | ${best.trendMean.toFixed(1)} | ${(best.trendMean - curr.trendMean).toFixed(1)} |`);
  w(`| Perfect Mean | ${curr.perfectMean.toFixed(1)} | ${best.perfectMean.toFixed(1)} | ${(best.perfectMean - curr.perfectMean).toFixed(1)} |`);
  w(`| Inverse Mean | ${curr.inverseMean.toFixed(1)} | ${best.inverseMean.toFixed(1)} | ${(best.inverseMean - curr.inverseMean).toFixed(1)} |`);
  w(`| Score Spread | ${curr.scoreSpread.toFixed(1)} | ${best.scoreSpread.toFixed(1)} | ${(best.scoreSpread - curr.scoreSpread).toFixed(1)} |`);
  w(`| Monotonicity Violation | ${(curr.monotonicity * 100).toFixed(1)}% | ${(best.monotonicity * 100).toFixed(1)}% | ${((best.monotonicity - curr.monotonicity) * 100).toFixed(1)}% |`);
  w(`| Dir×Mag Correlation | ${curr.dirMagCorrelation.toFixed(3)} | ${best.dirMagCorrelation.toFixed(3)} | ${(best.dirMagCorrelation - curr.dirMagCorrelation).toFixed(3)} |`);
  w(`| Baselines Pass | ${curr.baselinesPassed ? 'YES' : 'NO'} | ${best.baselinesPassed ? 'YES' : 'NO'} | - |`);
  w('');

  // ─── Best Config Parameters ───
  w('## 2. Best Configuration Parameters');
  w('');

  if (best.configId === 'current') {
    w('**Current config is already optimal.** No parameter changes needed.');
  } else {
    w('```typescript');
    w('export const DEFAULT_CONFIG: ScoringConfig = {');
    const fullConfig = { ...DEFAULT_CONFIG, ...best.config };
    for (const [key, val] of Object.entries(fullConfig)) {
      w(`  ${key}: ${val},`);
    }
    w('};');
    w('```');
    w('');
    w('**Changes from current:**');
    for (const [key, val] of Object.entries(best.config)) {
      const currVal = (DEFAULT_CONFIG as unknown as Record<string, number>)[key];
      if (currVal !== val) {
        w(`- \`${key}\`: ${currVal} → ${val}`);
      }
    }
  }
  w('');

  // ─── Phase Results ───
  w('## 3. Phase-by-Phase Results');
  w('');

  const phases = [
    { name: 'Phase 1: Core Sensitivity', result: sweep.phaseResults.phase1Best },
    { name: 'Phase 2: Secondary Parameters', result: sweep.phaseResults.phase2Best },
    { name: 'Phase 3: Fine-Tuning', result: sweep.phaseResults.phase3Best },
  ];

  for (const phase of phases) {
    w(`### ${phase.name}`);
    w(`- Best composite: ${phase.result.compositeScore.toFixed(2)}`);
    w(`- Config: ${JSON.stringify(phase.result.config)}`);
    w(`- Baselines: ${phase.result.baselinesPassed ? 'PASS' : 'FAIL'}`);
    if (phase.result.baselineViolations.length > 0) {
      w(`- Violations: ${phase.result.baselineViolations.join(', ')}`);
    }
    w('');
  }

  // ─── Top 10 ───
  w('## 4. Top 10 Configurations');
  w('');
  w('| Rank | ID | Composite | RW | Flat | Trend | Mono% | Dir×Mag | Spread | Pass |');
  w('|------|----|-----------|----|------|-------|-------|---------|--------|------|');

  for (let i = 0; i < Math.min(10, sweep.top10.length); i++) {
    const r = sweep.top10[i]!;
    w(`| ${i + 1} | ${r.configId} | ${r.compositeScore.toFixed(2)} | ${r.rwMean.toFixed(1)} | ${r.flatMean.toFixed(1)} | ${r.trendMean.toFixed(1)} | ${(r.monotonicity * 100).toFixed(1)} | ${r.dirMagCorrelation.toFixed(3)} | ${r.scoreSpread.toFixed(1)} | ${r.baselinesPassed ? 'Y' : 'N'} |`);
  }
  w('');

  // ─── Parameter Sensitivity ───
  w('## 5. Parameter Sensitivity Analysis');
  w('');
  w('How much each parameter affects the composite score (higher impact = more sensitive):');
  w('');
  w('| Parameter | Range Tested | Impact on Composite |');
  w('|-----------|-------------|-------------------|');

  const sortedSensitivity = Object.values(sweep.parameterSensitivity)
    .sort((a, b) => {
      const aImpact = parseFloat(a.impact);
      const bImpact = parseFloat(b.impact);
      return bImpact - aImpact;
    });

  for (const s of sortedSensitivity) {
    w(`| ${s.param} | ${s.range} | ${s.impact} |`);
  }
  w('');

  // ─── Distribution of Configs That Pass Baselines ───
  w('## 6. Configuration Space Analysis');
  w('');

  const passingConfigs = sweep.allResults.filter((r) => r.baselinesPassed);
  const failingConfigs = sweep.allResults.filter((r) => !r.baselinesPassed);

  w(`- **Configs that pass all baselines**: ${passingConfigs.length}/${sweep.totalConfigs} (${((passingConfigs.length / sweep.totalConfigs) * 100).toFixed(1)}%)`);
  w(`- **Configs that fail baselines**: ${failingConfigs.length}/${sweep.totalConfigs}`);
  w('');

  if (passingConfigs.length > 0) {
    const passingScores = passingConfigs.map((r) => r.compositeScore);
    const passingStats = computeExtendedStats(passingScores);
    w(`Among passing configs:`);
    w(`- Mean composite: ${passingStats.mean.toFixed(2)}`);
    w(`- Best composite: ${passingStats.max.toFixed(2)}`);
    w(`- Worst composite: ${passingStats.min.toFixed(2)}`);
    w(`- Std: ${passingStats.std.toFixed(2)}`);
  }
  w('');

  // ─── Recommendations ───
  w('## 7. Recommendations');
  w('');

  const improvement = best.compositeScore - curr.compositeScore;
  if (improvement <= 0.5) {
    w('**No significant improvement found.** The current parameters are near-optimal within the search space. The scoring engine is well-calibrated.');
  } else if (improvement <= 3) {
    w(`**Minor improvement found** (+${improvement.toFixed(2)} composite points). The suggested parameters provide marginally better calibration. Consider adopting if the baseline numbers look good.`);
  } else {
    w(`**Significant improvement found** (+${improvement.toFixed(2)} composite points). The suggested parameters substantially improve scoring quality. Recommended to update config.ts.`);
  }
  w('');

  if (best.dirMagCorrelation > 0.8) {
    w('- **Warning**: Direction × Magnitude correlation remains above 0.8. This is structurally expected but may indicate some redundancy between components.');
  }
  if (best.monotonicity > 0.05) {
    w(`- **Note**: Monotonicity violation rate is ${(best.monotonicity * 100).toFixed(1)}%. While acceptable (< 10%), further reduction may be possible with different turning point parameters.`);
  }
  w('');

  return lines.join('\n');
}

// ─── CLI ENTRY POINT ────────────────────────────────────────────

if (process.argv[1]?.endsWith('parameterSweep.ts') || process.argv[1]?.endsWith('parameterSweep.js')) {
  const startTime = Date.now();

  const sweep = runParameterSweep();
  const report = generateSweepReport(sweep);

  const reportPath = path.join(process.cwd(), 'PARAMETER_SWEEP_REPORT.md');
  fs.writeFileSync(reportPath, report);

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nSweep complete in ${elapsed} minutes.`);
  console.log(`Report written to ${reportPath}`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SWEEP SUMMARY');
  console.log('='.repeat(60));
  console.log(`Configs tested: ${sweep.totalConfigs}`);
  console.log(`Best composite: ${sweep.bestConfig.compositeScore.toFixed(2)} (current: ${sweep.currentConfigResult.compositeScore.toFixed(2)})`);
  console.log(`Best config ID: ${sweep.bestConfig.configId}`);

  if (sweep.bestConfig.configId !== 'current') {
    console.log('\nBest config overrides:');
    for (const [key, val] of Object.entries(sweep.bestConfig.config)) {
      const currVal = (DEFAULT_CONFIG as unknown as Record<string, number>)[key];
      if (currVal !== val) {
        console.log(`  ${key}: ${currVal} → ${val}`);
      }
    }
  } else {
    console.log('\nCurrent config is already optimal.');
  }
}
