/**
 * Evolutionary Scoring Optimizer — Genetic Algorithm Core
 *
 * Evolves scoring configurations by searching across both algorithm variants
 * and parameter values. Uses tournament selection, uniform crossover,
 * Gaussian mutation, and elitism.
 *
 * Usage: npx tsx src/scoring/runEvolve.ts
 */

import type {
  Genome,
  EvaluatedGenome,
  PopulationState,
  EvolutionConfig,
} from './evolveTypes.js';
import { evaluateGenome } from './evolveFitness.js';
import {
  appendGenerationLog,
  buildGenerationSummary,
  writeCheckpointReport,
  writeFinalReport,
} from './evolveLogging.js';
import { getAllVariants, getVariantsForComponent } from './variants/registry.js';

// Trigger variant registration
import './variants/direction/index.js';
import './variants/magnitude/index.js';
import './variants/turningPoints/index.js';
import './variants/volatility/index.js';

// ─── PRNG ────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussianRandom(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ─── GENOME CREATION ─────────────────────────────────────────

const COMPONENTS = ['direction', 'magnitude', 'turningPoints', 'volatility'] as const;
type ComponentName = (typeof COMPONENTS)[number];

function generateId(generation: number, index: number): string {
  return `g${generation}_${index}`;
}

/**
 * Initialize all variant parameters with defaults for ALL registered variants.
 */
function initAllVariantParams(): Record<string, number> {
  const params: Record<string, number> = {};
  for (const variant of getAllVariants()) {
    for (const pDef of variant.parameterDefs) {
      params[`${variant.id}:${pDef.name}`] = pDef.default;
    }
  }
  return params;
}

/**
 * Create a genome matching the current DEFAULT_CONFIG (seed genome).
 */
export function createSeedGenome(): Genome {
  return {
    id: 'seed',
    generation: 0,
    variantSelection: {
      direction: 'direction.multiScale',
      magnitude: 'magnitude.biasRmse',
      turningPoints: 'turningPoints.hungarianMatch',
      volatility: 'volatility.quarterBased',
    },
    componentWeights: {
      direction: 40,
      magnitude: 30,
      turningPoints: 20,
      volatility: 10,
    },
    variantParams: initAllVariantParams(),
  };
}

/**
 * Create a random genome.
 */
export function createRandomGenome(
  id: string,
  generation: number,
  rng: () => number,
): Genome {
  // Random variant selection
  const variantSelection: Record<string, string> = {};
  for (const comp of COMPONENTS) {
    const variants = getVariantsForComponent(comp);
    variantSelection[comp] = variants[Math.floor(rng() * variants.length)]!.id;
  }

  // Random weights (sum to 100, each >= 5)
  const componentWeights = randomWeights(rng);

  // Random parameters within bounds for ALL variants
  const variantParams: Record<string, number> = {};
  for (const variant of getAllVariants()) {
    for (const pDef of variant.parameterDefs) {
      let value = pDef.min + rng() * (pDef.max - pDef.min);
      if (pDef.integer) value = Math.round(value);
      variantParams[`${variant.id}:${pDef.name}`] = value;
    }
  }

  return {
    id,
    generation,
    variantSelection: variantSelection as Genome['variantSelection'],
    componentWeights,
    variantParams,
  };
}

function randomWeights(rng: () => number): Genome['componentWeights'] {
  // Generate 4 random values, normalize to sum=100, clamp each to [5, 80]
  let raw = COMPONENTS.map(() => 5 + rng() * 75);
  return repairWeights(raw);
}

function repairWeights(raw: number[]): Genome['componentWeights'] {
  // Clamp
  const clamped = raw.map((v) => Math.max(5, Math.min(80, v)));

  // Normalize to sum=100
  const sum = clamped.reduce((s, v) => s + v, 0);
  const normalized = clamped.map((v) => (v / sum) * 100);

  // Re-clamp after normalization and renormalize if needed
  const final = normalized.map((v) => Math.max(5, Math.min(80, v)));
  const finalSum = final.reduce((s, v) => s + v, 0);
  const scaled = final.map((v) => +((v / finalSum) * 100).toFixed(2));

  // Fix rounding to exactly 100
  const total = scaled.reduce((s, v) => s + v, 0);
  scaled[0] = +(scaled[0]! + (100 - total)).toFixed(2);

  return {
    direction: scaled[0]!,
    magnitude: scaled[1]!,
    turningPoints: scaled[2]!,
    volatility: scaled[3]!,
  };
}

// ─── SELECTION ───────────────────────────────────────────────

function tournamentSelect(
  population: EvaluatedGenome[],
  tournamentSize: number,
  rng: () => number,
): EvaluatedGenome {
  let best: EvaluatedGenome | null = null;

  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(rng() * population.length);
    const candidate = population[idx]!;
    if (!best || candidate.fitness.compositeScore > best.fitness.compositeScore) {
      best = candidate;
    }
  }

  return best!;
}

// ─── CROSSOVER ───────────────────────────────────────────────

function crossover(
  parentA: Genome,
  parentB: Genome,
  childId: string,
  generation: number,
  rng: () => number,
): Genome {
  // Uniform crossover for variant selection
  const variantSelection: Record<string, string> = {};
  for (const comp of COMPONENTS) {
    variantSelection[comp] = rng() < 0.5
      ? parentA.variantSelection[comp]
      : parentB.variantSelection[comp];
  }

  // Blend weights with noise
  const rawWeights = COMPONENTS.map((comp) => {
    const a = parentA.componentWeights[comp];
    const b = parentB.componentWeights[comp];
    const blend = 0.3 + rng() * 0.4; // 0.3 to 0.7
    return a * blend + b * (1 - blend);
  });
  const componentWeights = repairWeights(rawWeights);

  // Uniform crossover for params
  const variantParams: Record<string, number> = {};
  const allKeys = new Set([
    ...Object.keys(parentA.variantParams),
    ...Object.keys(parentB.variantParams),
  ]);

  for (const key of allKeys) {
    const aVal = parentA.variantParams[key];
    const bVal = parentB.variantParams[key];

    if (aVal !== undefined && bVal !== undefined) {
      variantParams[key] = rng() < 0.5 ? aVal : bVal;
    } else {
      variantParams[key] = aVal ?? bVal ?? 0;
    }
  }

  return {
    id: childId,
    generation,
    variantSelection: variantSelection as Genome['variantSelection'],
    componentWeights,
    variantParams,
  };
}

// ─── MUTATION ────────────────────────────────────────────────

function mutate(
  genome: Genome,
  config: EvolutionConfig,
  rng: () => number,
): Genome {
  const mutated: Genome = {
    ...genome,
    variantSelection: { ...genome.variantSelection },
    componentWeights: { ...genome.componentWeights },
    variantParams: { ...genome.variantParams },
  };

  // 1. Variant swap
  for (const comp of COMPONENTS) {
    if (rng() < config.variantSwapRate) {
      const variants = getVariantsForComponent(comp);
      if (variants.length > 1) {
        const current = mutated.variantSelection[comp];
        const others = variants.filter((v) => v.id !== current);
        mutated.variantSelection[comp] = others[Math.floor(rng() * others.length)]!.id;
      }
    }
  }

  // 2. Weight perturbation
  const rawWeights = COMPONENTS.map((comp) => {
    if (rng() < config.mutationRate) {
      const noise = gaussianRandom(rng) * config.mutationStrength * 20; // ±~2 points
      return mutated.componentWeights[comp] + noise;
    }
    return mutated.componentWeights[comp];
  });
  mutated.componentWeights = repairWeights(rawWeights);

  // 3. Parameter perturbation
  for (const variant of getAllVariants()) {
    for (const pDef of variant.parameterDefs) {
      const key = `${variant.id}:${pDef.name}`;
      if (rng() < config.mutationRate) {
        const range = pDef.max - pDef.min;
        const noise = gaussianRandom(rng) * config.mutationStrength * range;
        let newVal = (mutated.variantParams[key] ?? pDef.default) + noise;
        newVal = Math.max(pDef.min, Math.min(pDef.max, newVal));
        if (pDef.integer) newVal = Math.round(newVal);
        mutated.variantParams[key] = newVal;
      }
    }
  }

  return mutated;
}

// ─── MAIN EVOLUTION LOOP ─────────────────────────────────────

export function runEvolution(
  config: EvolutionConfig,
  candles: number[][],
): PopulationState {
  console.log('='.repeat(60));
  console.log('EVOLUTIONARY SCORING OPTIMIZER');
  console.log('='.repeat(60));
  console.log(`Population: ${config.populationSize}`);
  console.log(`Max generations: ${config.maxGenerations}`);
  console.log(`Stagnation limit: ${config.stagnationLimit}`);
  console.log(`Eval rounds/strat/tf: ${config.evalRoundsPerStratPerTf}`);
  console.log(`Variants: ${getAllVariants().length} total (${getVariantsForComponent('direction').length}×${getVariantsForComponent('magnitude').length}×${getVariantsForComponent('turningPoints').length}×${getVariantsForComponent('volatility').length} = ${getVariantsForComponent('direction').length * getVariantsForComponent('magnitude').length * getVariantsForComponent('turningPoints').length * getVariantsForComponent('volatility').length} combinations)`);
  console.log(`Data: ${candles.length.toLocaleString()} candles`);
  console.log('='.repeat(60));
  console.log('');

  const rng = mulberry32(config.seed);

  // Initialize population
  console.log('Initializing population...');
  const genomes: Genome[] = [];

  // Seed genome (current config)
  genomes.push(createSeedGenome());

  // Near-mutants of seed
  for (let i = 0; i < 4; i++) {
    const nearMutant = mutate(createSeedGenome(), { ...config, mutationRate: 0.3, mutationStrength: 0.05, variantSwapRate: 0 }, rng);
    nearMutant.id = `seed_mut_${i}`;
    nearMutant.generation = 0;
    genomes.push(nearMutant);
  }

  // Random genomes
  for (let i = 5; i < config.populationSize; i++) {
    genomes.push(createRandomGenome(generateId(0, i), 0, rng));
  }

  // Evaluate initial population
  console.log(`Evaluating generation 0 (${genomes.length} genomes)...`);
  const population: EvaluatedGenome[] = genomes.map((g, i) => {
    const fitness = evaluateGenome(g, candles, config.evalRoundsPerStratPerTf, Math.floor(rng() * 1e9));
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`  ${i + 1}/${genomes.length}\r`);
    }
    return { genome: g, fitness };
  });
  console.log(`  ${genomes.length}/${genomes.length} done`);

  // Sort by fitness
  population.sort((a, b) => b.fitness.compositeScore - a.fitness.compositeScore);

  const state: PopulationState = {
    generation: 0,
    population,
    bestEver: population[0]!,
    generationsSinceImprovement: 0,
    startTime: Date.now(),
    totalEvaluations: population.length,
    history: [],
  };

  // Log generation 0
  const gen0Summary = buildGenerationSummary(state);
  state.history.push(gen0Summary);
  appendGenerationLog(gen0Summary, config.logPath);
  console.log(`  Gen 0: best=${gen0Summary.bestFitness.toFixed(2)}, avg=${gen0Summary.avgFitness.toFixed(2)}, diversity=${gen0Summary.diversity}`);

  // Evolution loop
  for (let gen = 1; gen <= config.maxGenerations; gen++) {
    state.generation = gen;

    // Create next generation
    const nextGen: Genome[] = [];

    // Elitism: keep top N
    for (let i = 0; i < config.eliteCount && i < state.population.length; i++) {
      const elite = { ...state.population[i]!.genome };
      elite.id = generateId(gen, i);
      elite.generation = gen;
      nextGen.push(elite);
    }

    // Fill rest with crossover + mutation
    while (nextGen.length < config.populationSize) {
      const idx = nextGen.length;

      if (rng() < config.crossoverRate) {
        // Crossover
        const parentA = tournamentSelect(state.population, config.tournamentSize, rng);
        const parentB = tournamentSelect(state.population, config.tournamentSize, rng);
        let child = crossover(parentA.genome, parentB.genome, generateId(gen, idx), gen, rng);
        child = mutate(child, config, rng);
        nextGen.push(child);
      } else {
        // Clone + mutate
        const parent = tournamentSelect(state.population, config.tournamentSize, rng);
        let child = mutate(parent.genome, config, rng);
        child.id = generateId(gen, idx);
        child.generation = gen;
        nextGen.push(child);
      }
    }

    // Evaluate new population
    const evalStart = Date.now();
    const newPopulation: EvaluatedGenome[] = nextGen.map((g) => {
      const fitness = evaluateGenome(g, candles, config.evalRoundsPerStratPerTf, Math.floor(rng() * 1e9));
      return { genome: g, fitness };
    });
    state.totalEvaluations += newPopulation.length;

    // Sort
    newPopulation.sort((a, b) => b.fitness.compositeScore - a.fitness.compositeScore);
    state.population = newPopulation;

    // Check for improvement
    const genBest = newPopulation[0]!;
    if (genBest.fitness.compositeScore > state.bestEver.fitness.compositeScore) {
      state.bestEver = genBest;
      state.generationsSinceImprovement = 0;
    } else {
      state.generationsSinceImprovement++;
    }

    // Log
    const summary = buildGenerationSummary(state);
    state.history.push(summary);
    appendGenerationLog(summary, config.logPath);

    const evalTime = ((Date.now() - evalStart) / 1000).toFixed(1);
    console.log(`  Gen ${gen}: best=${summary.bestFitness.toFixed(2)}, avg=${summary.avgFitness.toFixed(2)}, bestEver=${summary.bestEverFitness.toFixed(2)}, diversity=${summary.diversity}, stagnation=${state.generationsSinceImprovement}, time=${evalTime}s`);

    // Checkpoint report
    if (gen % config.checkpointInterval === 0) {
      writeCheckpointReport(state, config.reportPath);
      console.log(`  → Checkpoint saved to ${config.reportPath}`);
    }

    // Early stopping
    if (state.generationsSinceImprovement >= config.stagnationLimit) {
      console.log(`\nStopping: no improvement for ${config.stagnationLimit} generations`);
      break;
    }
  }

  // Final validation
  console.log(`\nValidating best genome with ${config.validationRounds} rounds/strat/tf...`);
  const validatedFitness = evaluateGenome(
    state.bestEver.genome,
    candles,
    config.validationRounds,
    42424242,
  );
  state.bestEver = { genome: state.bestEver.genome, fitness: validatedFitness };

  console.log(`  Validated composite: ${validatedFitness.compositeScore.toFixed(2)}`);

  // Final report
  writeFinalReport(state, validatedFitness, config.reportPath);
  console.log(`\nFinal report: ${config.reportPath}`);
  console.log(`Progress log: ${config.logPath}`);

  return state;
}
