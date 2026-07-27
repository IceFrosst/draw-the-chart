/**
 * Progressive logging for the evolutionary optimizer.
 *
 * - JSONL: one line per generation, append-only (tail -f friendly)
 * - Checkpoint reports: markdown snapshots every N generations
 * - Final report: comprehensive markdown with full results
 */

import * as fs from 'node:fs';
import type { GenerationSummary, PopulationState, EvaluatedGenome, FitnessResult } from './evolveTypes.js';

// ─── JSONL LOGGING ──────────────────────────────────────────

export function appendGenerationLog(
  summary: GenerationSummary,
  logPath: string,
): void {
  fs.appendFileSync(logPath, JSON.stringify(summary) + '\n');
}

export function buildGenerationSummary(state: PopulationState): GenerationSummary {
  const fitnesses = state.population.map((g) => g.fitness.compositeScore);
  const sorted = [...fitnesses].sort((a, b) => b - a);

  // Count unique variant combinations for diversity
  const combos = new Set<string>();
  for (const eg of state.population) {
    const key = [
      eg.genome.variantSelection.direction,
      eg.genome.variantSelection.magnitude,
      eg.genome.variantSelection.turningPoints,
      eg.genome.variantSelection.volatility,
    ].join('|');
    combos.add(key);
  }

  return {
    generation: state.generation,
    timestamp: new Date().toISOString(),
    elapsedSeconds: (Date.now() - state.startTime) / 1000,
    bestFitness: sorted[0] ?? 0,
    avgFitness: fitnesses.reduce((s, v) => s + v, 0) / fitnesses.length,
    worstFitness: sorted[sorted.length - 1] ?? 0,
    bestEverFitness: state.bestEver.fitness.compositeScore,
    bestGenomeId: state.bestEver.genome.id,
    bestVariants: { ...state.bestEver.genome.variantSelection },
    bestWeights: { ...state.bestEver.genome.componentWeights },
    diversity: combos.size,
    generationsSinceImprovement: state.generationsSinceImprovement,
  };
}

// ─── CHECKPOINT REPORT ──────────────────────────────────────

export function writeCheckpointReport(
  state: PopulationState,
  reportPath: string,
): void {
  const lines: string[] = [];
  const w = (s: string) => lines.push(s);
  const elapsed = (Date.now() - state.startTime) / 1000;

  w('# Evolution Checkpoint Report');
  w('');
  w(`**Generation**: ${state.generation} | **Elapsed**: ${formatDuration(elapsed)} | **Best Ever**: ${state.bestEver.fitness.compositeScore.toFixed(2)}`);
  w(`**Stagnation**: ${state.generationsSinceImprovement} generations | **Evaluations**: ${state.totalEvaluations}`);
  w('');

  // Best genome
  w('## Best Genome');
  w('');
  writeGenomeDetails(state.bestEver, lines);

  // Top 5
  w('## Top 5 Current Population');
  w('');
  const sorted = [...state.population].sort((a, b) => b.fitness.compositeScore - a.fitness.compositeScore);
  w('| # | ID | Composite | RW | Flat | Trend | Perfect | Inverse | Spread | Mono% | Baselines |');
  w('|---|----|-----------|----|------|-------|---------|---------|--------|-------|-----------|');
  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    const eg = sorted[i]!;
    const f = eg.fitness;
    w(`| ${i + 1} | ${eg.genome.id.slice(0, 8)} | ${f.compositeScore.toFixed(2)} | ${f.rwMean.toFixed(1)} | ${f.flatMean.toFixed(1)} | ${f.trendMean.toFixed(1)} | ${f.perfectMean.toFixed(1)} | ${f.inverseMean.toFixed(1)} | ${f.scoreSpread.toFixed(1)} | ${(f.monotonicity * 100).toFixed(0)} | ${f.baselinesPassed ? 'Y' : 'N'} |`);
  }
  w('');

  // Convergence
  if (state.history.length > 0) {
    w('## Convergence');
    w('');
    const recent = state.history.slice(-10);
    w('| Gen | Best | Avg | Worst | Diversity | Stagnation |');
    w('|-----|------|-----|-------|-----------|------------|');
    for (const h of recent) {
      w(`| ${h.generation} | ${h.bestFitness.toFixed(2)} | ${h.avgFitness.toFixed(2)} | ${h.worstFitness.toFixed(2)} | ${h.diversity} | ${h.generationsSinceImprovement} |`);
    }
    w('');
  }

  // Variant prevalence
  w('## Variant Prevalence');
  w('');
  const variantCounts: Record<string, number> = {};
  for (const eg of state.population) {
    for (const v of Object.values(eg.genome.variantSelection)) {
      variantCounts[v] = (variantCounts[v] ?? 0) + 1;
    }
  }
  const sortedVariants = Object.entries(variantCounts).sort((a, b) => b[1] - a[1]);
  for (const [v, count] of sortedVariants) {
    const pct = ((count / state.population.length) * 100).toFixed(0);
    w(`- **${v}**: ${count} (${pct}%)`);
  }
  w('');

  w(`*Report generated at ${new Date().toISOString()}*`);

  fs.writeFileSync(reportPath, lines.join('\n'));
}

// ─── FINAL REPORT ───────────────────────────────────────────

export function writeFinalReport(
  state: PopulationState,
  validatedFitness: FitnessResult,
  reportPath: string,
): void {
  const lines: string[] = [];
  const w = (s: string) => lines.push(s);
  const elapsed = (Date.now() - state.startTime) / 1000;

  w('# Evolutionary Scoring Optimization — Final Report');
  w('');
  w(`**Date**: ${new Date().toISOString()}`);
  w(`**Generations**: ${state.generation}`);
  w(`**Total Evaluations**: ${state.totalEvaluations}`);
  w(`**Duration**: ${formatDuration(elapsed)}`);
  w('');

  // Executive summary
  w('## Executive Summary');
  w('');
  w(`Best composite fitness: **${validatedFitness.compositeScore.toFixed(2)}**`);
  w(`Baselines passed: **${validatedFitness.baselinesPassed ? 'Yes' : 'No'}**`);
  w('');
  w('| Metric | Value |');
  w('|--------|-------|');
  w(`| Random Walk | ${validatedFitness.rwMean.toFixed(1)} (target: 30-35) |`);
  w(`| Flat Line | ${validatedFitness.flatMean.toFixed(1)} (target: 25-35) |`);
  w(`| Naive Trend | ${validatedFitness.trendMean.toFixed(1)} (target: 35-50) |`);
  w(`| Perfect | ${validatedFitness.perfectMean.toFixed(1)} (target: ~100) |`);
  w(`| Inverse | ${validatedFitness.inverseMean.toFixed(1)} (target: <15) |`);
  w(`| Score Spread | ${validatedFitness.scoreSpread.toFixed(1)} |`);
  w(`| Monotonicity Violations | ${(validatedFitness.monotonicity * 100).toFixed(1)}% |`);
  w(`| Dir x Mag Correlation | ${validatedFitness.dirMagCorrelation.toFixed(3)} |`);
  w('');

  // Best genome details
  w('## Best Genome Configuration');
  w('');
  writeGenomeDetails(state.bestEver, lines);

  // How to apply
  w('## How to Apply');
  w('');
  w('The best genome uses the following variant selections and weights.');
  w('To integrate into the live scoring system, update `computeScore` to use');
  w('the variant-aware scorer with this genome\'s configuration.');
  w('');
  w('```typescript');
  w('// Variant selections:');
  w(`//   direction: '${state.bestEver.genome.variantSelection.direction}'`);
  w(`//   magnitude: '${state.bestEver.genome.variantSelection.magnitude}'`);
  w(`//   turningPoints: '${state.bestEver.genome.variantSelection.turningPoints}'`);
  w(`//   volatility: '${state.bestEver.genome.variantSelection.volatility}'`);
  w('//');
  w('// Component weights:');
  w(`//   direction: ${state.bestEver.genome.componentWeights.direction.toFixed(1)}`);
  w(`//   magnitude: ${state.bestEver.genome.componentWeights.magnitude.toFixed(1)}`);
  w(`//   turningPoints: ${state.bestEver.genome.componentWeights.turningPoints.toFixed(1)}`);
  w(`//   volatility: ${state.bestEver.genome.componentWeights.volatility.toFixed(1)}`);
  w('```');
  w('');

  // Variant parameters
  w('### Variant Parameters');
  w('');
  const genome = state.bestEver.genome;
  const activeVariants = Object.values(genome.variantSelection);
  for (const vId of activeVariants) {
    w(`**${vId}**:`);
    const prefix = `${vId}:`;
    const params = Object.entries(genome.variantParams)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => `  - ${k.replace(prefix, '')}: ${typeof v === 'number' ? v.toFixed(6) : v}`);
    if (params.length > 0) {
      for (const p of params) w(p);
    } else {
      w('  (no parameters)');
    }
    w('');
  }

  // Convergence history
  if (state.history.length > 0) {
    w('## Convergence History');
    w('');
    w('| Gen | Best | Avg | Diversity | Stagnation |');
    w('|-----|------|-----|-----------|------------|');
    // Show every 5th generation + last
    for (let i = 0; i < state.history.length; i++) {
      if (i % 5 === 0 || i === state.history.length - 1) {
        const h = state.history[i]!;
        w(`| ${h.generation} | ${h.bestFitness.toFixed(2)} | ${h.avgFitness.toFixed(2)} | ${h.diversity} | ${h.generationsSinceImprovement} |`);
      }
    }
    w('');
  }

  // Variant prevalence in final population
  w('## Variant Survival Analysis');
  w('');
  w('Which variants survived evolution:');
  w('');
  const components = ['direction', 'magnitude', 'turningPoints', 'volatility'] as const;
  for (const comp of components) {
    const counts: Record<string, number> = {};
    for (const eg of state.population) {
      const v = eg.genome.variantSelection[comp];
      counts[v] = (counts[v] ?? 0) + 1;
    }
    w(`**${comp}**:`);
    for (const [v, c] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      w(`  - ${v}: ${c}/${state.population.length} (${((c / state.population.length) * 100).toFixed(0)}%)`);
    }
    w('');
  }

  w(`*Report generated at ${new Date().toISOString()}*`);

  fs.writeFileSync(reportPath, lines.join('\n'));
}

// ─── HELPERS ────────────────────────────────────────────────

function writeGenomeDetails(eg: EvaluatedGenome, lines: string[]): void {
  const g = eg.genome;
  const w = (s: string) => lines.push(s);

  w(`**ID**: ${g.id}`);
  w(`**Generation**: ${g.generation}`);
  w(`**Composite Score**: ${eg.fitness.compositeScore.toFixed(2)}`);
  w('');
  w('**Variants**:');
  w(`- Direction: \`${g.variantSelection.direction}\``);
  w(`- Magnitude: \`${g.variantSelection.magnitude}\``);
  w(`- Turning Points: \`${g.variantSelection.turningPoints}\``);
  w(`- Volatility: \`${g.variantSelection.volatility}\``);
  w('');
  w('**Weights**:');
  w(`- Direction: ${g.componentWeights.direction.toFixed(1)}`);
  w(`- Magnitude: ${g.componentWeights.magnitude.toFixed(1)}`);
  w(`- Turning Points: ${g.componentWeights.turningPoints.toFixed(1)}`);
  w(`- Volatility: ${g.componentWeights.volatility.toFixed(1)}`);
  w('');
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
