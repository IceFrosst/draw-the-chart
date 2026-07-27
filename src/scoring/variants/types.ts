import type { LogReturnPath } from '../types.js';

/** A tunable parameter definition with bounds for the GA */
export interface ParameterDef {
  /** Parameter name, e.g. 'decayBase', 'lambda' */
  name: string;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Default/starting value */
  default: number;
  /** If true, values should be integers (e.g. maxScaleLevel) */
  integer?: boolean;
}

/** A scoring component variant — computes a normalized sub-score */
export interface ScoringVariant {
  /** Unique identifier, e.g. 'direction.multiScale' */
  id: string;
  /** Which component this variant belongs to */
  component: 'direction' | 'magnitude' | 'turningPoints' | 'volatility';
  /** Human-readable name */
  name: string;
  /** Parameter definitions with bounds (for the GA search space) */
  parameterDefs: ParameterDef[];
  /**
   * Compute the sub-score given predicted/actual log-return paths.
   * Must return a value in [0, 1] where 1 = perfect match.
   */
  compute(
    predicted: LogReturnPath,
    actual: LogReturnPath,
    params: Record<string, number>,
  ): number;
}

export type ComponentName = 'direction' | 'magnitude' | 'turningPoints' | 'volatility';
