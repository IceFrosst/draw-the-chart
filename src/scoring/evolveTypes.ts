/**
 * Types for the evolutionary scoring optimizer.
 */

export interface Genome {
  /** Unique ID for tracking */
  id: string;
  /** Generation this genome was created in */
  generation: number;

  /** Which variant to use for each component */
  variantSelection: {
    direction: string;
    magnitude: string;
    turningPoints: string;
    volatility: string;
  };

  /** Component weights — must sum to 100, each >= 5 */
  componentWeights: {
    direction: number;
    magnitude: number;
    turningPoints: number;
    volatility: number;
  };

  /** Parameters for ALL variants (keyed as "variantId:paramName") */
  variantParams: Record<string, number>;
}

export interface FitnessResult {
  compositeScore: number;
  baselinesPassed: boolean;
  rwMean: number;
  flatMean: number;
  trendMean: number;
  perfectMean: number;
  inverseMean: number;
  scoreSpread: number;
  monotonicity: number;
  dirMagCorrelation: number;
  evaluationTimeMs: number;
}

export interface EvaluatedGenome {
  genome: Genome;
  fitness: FitnessResult;
}

export interface GenerationSummary {
  generation: number;
  timestamp: string;
  elapsedSeconds: number;
  bestFitness: number;
  avgFitness: number;
  worstFitness: number;
  bestEverFitness: number;
  bestGenomeId: string;
  bestVariants: Record<string, string>;
  bestWeights: Record<string, number>;
  /** Number of unique variant combinations in population */
  diversity: number;
  generationsSinceImprovement: number;
}

export interface PopulationState {
  generation: number;
  population: EvaluatedGenome[];
  bestEver: EvaluatedGenome;
  generationsSinceImprovement: number;
  startTime: number;
  totalEvaluations: number;
  history: GenerationSummary[];
}

export interface EvolutionConfig {
  /** Population size (default: 60) */
  populationSize: number;
  /** Number of elite genomes preserved each generation (default: 5) */
  eliteCount: number;
  /** Tournament selection size (default: 3) */
  tournamentSize: number;
  /** Probability of crossover vs cloning (default: 0.8) */
  crossoverRate: number;
  /** Probability of mutating each gene (default: 0.15) */
  mutationRate: number;
  /** Std dev of Gaussian perturbation as fraction of range (default: 0.1) */
  mutationStrength: number;
  /** Probability of swapping a variant selector per component (default: 0.05) */
  variantSwapRate: number;
  /** Max generations (default: 200) */
  maxGenerations: number;
  /** Stop after N gens with no improvement (default: 30) */
  stagnationLimit: number;
  /** Rounds per strategy per timeframe for fitness eval (default: 20) */
  evalRoundsPerStratPerTf: number;
  /** Full validation rounds for final best genome (default: 200) */
  validationRounds: number;
  /** PRNG seed */
  seed: number;
  /** Path for JSONL progress log */
  logPath: string;
  /** Path for markdown reports */
  reportPath: string;
  /** Checkpoint every N generations */
  checkpointInterval: number;
}
