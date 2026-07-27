/**
 * CLI entry point for the evolutionary scoring optimizer.
 *
 * Usage:
 *   npx tsx src/scoring/runEvolve.ts
 *   npx tsx src/scoring/runEvolve.ts --generations 500 --population 100
 *   npx tsx src/scoring/runEvolve.ts --generations 5  (smoke test)
 */

import * as path from 'node:path';
import { runEvolution } from './evolve.js';
import { loadExpandedData } from './backtest.js';
import type { EvolutionConfig } from './evolveTypes.js';

function parseArgs(): Partial<EvolutionConfig> {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--') && i + 1 < args.length) {
      parsed[arg.slice(2)] = args[i + 1]!;
      i++;
    }
  }

  const result: Partial<EvolutionConfig> = {};
  if (parsed['population']) result.populationSize = parseInt(parsed['population']);
  if (parsed['generations']) result.maxGenerations = parseInt(parsed['generations']);
  if (parsed['stagnation']) result.stagnationLimit = parseInt(parsed['stagnation']);
  if (parsed['rounds']) result.evalRoundsPerStratPerTf = parseInt(parsed['rounds']);
  if (parsed['seed']) result.seed = parseInt(parsed['seed']);
  if (parsed['elite']) result.eliteCount = parseInt(parsed['elite']);
  if (parsed['validation']) result.validationRounds = parseInt(parsed['validation']);

  return result;
}

const overrides = parseArgs();

const config: EvolutionConfig = {
  populationSize: overrides.populationSize ?? 60,
  eliteCount: overrides.eliteCount ?? 5,
  tournamentSize: 3,
  crossoverRate: 0.8,
  mutationRate: 0.15,
  mutationStrength: 0.1,
  variantSwapRate: 0.05,
  maxGenerations: overrides.maxGenerations ?? 200,
  stagnationLimit: overrides.stagnationLimit ?? 30,
  evalRoundsPerStratPerTf: overrides.evalRoundsPerStratPerTf ?? 20,
  validationRounds: overrides.validationRounds ?? 200,
  seed: overrides.seed ?? 777,
  logPath: path.join(process.cwd(), 'EVOLUTION_LOG.jsonl'),
  reportPath: path.join(process.cwd(), 'EVOLUTION_REPORT.md'),
  checkpointInterval: 10,
};

console.log('Loading price data...');
const candles = loadExpandedData();
console.log(`Loaded ${candles.length.toLocaleString()} candles\n`);

const result = runEvolution(config, candles);

console.log('\n' + '='.repeat(60));
console.log('EVOLUTION COMPLETE');
console.log('='.repeat(60));
console.log(`Best composite: ${result.bestEver.fitness.compositeScore.toFixed(2)}`);
console.log(`Baselines passed: ${result.bestEver.fitness.baselinesPassed}`);
console.log(`Generations: ${result.generation}`);
console.log(`Total evaluations: ${result.totalEvaluations}`);
console.log(`Duration: ${((Date.now() - result.startTime) / 1000 / 60).toFixed(1)} minutes`);
console.log('');
console.log('Variant selections:');
for (const [comp, variant] of Object.entries(result.bestEver.genome.variantSelection)) {
  console.log(`  ${comp}: ${variant}`);
}
console.log('');
console.log('Component weights:');
for (const [comp, weight] of Object.entries(result.bestEver.genome.componentWeights)) {
  console.log(`  ${comp}: ${weight.toFixed(1)}`);
}
