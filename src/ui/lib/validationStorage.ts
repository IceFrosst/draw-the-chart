/**
 * localStorage persistence and statistics for human scoring validation judgments.
 */

export type HumanChoice = 'A' | 'B' | 'tie';

export interface ValidationJudgment {
  pairId: string;
  /** Algorithm scores */
  scoreA: number;
  scoreB: number;
  /** Strategy names (for analysis) */
  strategyA: string;
  strategyB: string;
  /** Human's choice */
  humanChoice: HumanChoice;
  /** Confidence 1-5 */
  confidence: number;
  /** Whether display was swapped (for debiasing) */
  swapped: boolean;
  timestamp: string;
}

export interface ValidationStats {
  total: number;
  /** How often the human agrees with the algorithm */
  agreementRate: number;
  /** Agreement broken down by score gap size */
  agreementByGap: {
    small: { count: number; agreement: number };   // |gap| < 5
    medium: { count: number; agreement: number };  // 5 <= |gap| < 15
    large: { count: number; agreement: number };   // |gap| >= 15
  };
  /** Win rate per strategy when it appears */
  strategyPreferences: Record<string, { humanWins: number; algoWins: number; appearances: number }>;
  /** Average confidence */
  avgConfidence: number;
  /** Agreement rate by confidence level */
  agreementByConfidence: Record<number, { count: number; agreement: number }>;
}

const STORAGE_KEY = 'dtc.validation.v1';
const MAX_ENTRIES = 500;

function isValidJudgment(value: unknown): value is ValidationJudgment {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ValidationJudgment>;
  return (
    typeof v.pairId === 'string' &&
    typeof v.scoreA === 'number' &&
    typeof v.scoreB === 'number' &&
    typeof v.strategyA === 'string' &&
    typeof v.strategyB === 'string' &&
    (v.humanChoice === 'A' || v.humanChoice === 'B' || v.humanChoice === 'tie') &&
    typeof v.confidence === 'number' &&
    typeof v.swapped === 'boolean' &&
    typeof v.timestamp === 'string'
  );
}

export function loadJudgments(): ValidationJudgment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidJudgment);
  } catch {
    return [];
  }
}

export function saveJudgments(entries: ValidationJudgment[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function appendJudgment(judgment: ValidationJudgment): ValidationJudgment[] {
  const existing = loadJudgments();
  const filtered = existing.filter((j) => j.pairId !== judgment.pairId);
  const merged = [judgment, ...filtered].slice(0, MAX_ENTRIES);
  saveJudgments(merged);
  return merged;
}

/** Determine what the algorithm would pick */
function algoChoice(scoreA: number, scoreB: number): HumanChoice {
  const gap = Math.abs(scoreA - scoreB);
  if (gap < 2) return 'tie';
  return scoreA > scoreB ? 'A' : 'B';
}

/** Check if human agrees with algo */
function isAgreement(human: HumanChoice, algo: HumanChoice): boolean {
  if (human === 'tie' || algo === 'tie') return human === algo;
  return human === algo;
}

export function computeValidationStats(judgments: ValidationJudgment[]): ValidationStats {
  if (judgments.length === 0) {
    return {
      total: 0,
      agreementRate: 0,
      agreementByGap: {
        small: { count: 0, agreement: 0 },
        medium: { count: 0, agreement: 0 },
        large: { count: 0, agreement: 0 },
      },
      strategyPreferences: {},
      avgConfidence: 0,
      agreementByConfidence: {},
    };
  }

  let agreements = 0;
  const gapBuckets = {
    small: { count: 0, agree: 0 },
    medium: { count: 0, agree: 0 },
    large: { count: 0, agree: 0 },
  };
  const stratPrefs: Record<string, { humanWins: number; algoWins: number; appearances: number }> = {};
  const confBuckets: Record<number, { count: number; agree: number }> = {};
  let totalConf = 0;

  for (const j of judgments) {
    const algo = algoChoice(j.scoreA, j.scoreB);
    const agrees = isAgreement(j.humanChoice, algo);
    if (agrees) agreements++;

    // Gap analysis
    const gap = Math.abs(j.scoreA - j.scoreB);
    const bucket = gap < 5 ? 'small' : gap < 15 ? 'medium' : 'large';
    gapBuckets[bucket].count++;
    if (agrees) gapBuckets[bucket].agree++;

    // Strategy preferences
    for (const strat of [j.strategyA, j.strategyB]) {
      if (!stratPrefs[strat]) stratPrefs[strat] = { humanWins: 0, algoWins: 0, appearances: 0 };
      stratPrefs[strat].appearances++;
    }

    // Track which strategy the human preferred vs algo
    if (j.humanChoice === 'A') {
      if (!stratPrefs[j.strategyA]) stratPrefs[j.strategyA] = { humanWins: 0, algoWins: 0, appearances: 0 };
      stratPrefs[j.strategyA].humanWins++;
    } else if (j.humanChoice === 'B') {
      if (!stratPrefs[j.strategyB]) stratPrefs[j.strategyB] = { humanWins: 0, algoWins: 0, appearances: 0 };
      stratPrefs[j.strategyB].humanWins++;
    }

    if (algo === 'A') {
      if (!stratPrefs[j.strategyA]) stratPrefs[j.strategyA] = { humanWins: 0, algoWins: 0, appearances: 0 };
      stratPrefs[j.strategyA].algoWins++;
    } else if (algo === 'B') {
      if (!stratPrefs[j.strategyB]) stratPrefs[j.strategyB] = { humanWins: 0, algoWins: 0, appearances: 0 };
      stratPrefs[j.strategyB].algoWins++;
    }

    // Confidence
    totalConf += j.confidence;
    if (!confBuckets[j.confidence]) confBuckets[j.confidence] = { count: 0, agree: 0 };
    confBuckets[j.confidence].count++;
    if (agrees) confBuckets[j.confidence].agree++;
  }

  const agreementByConfidence: Record<number, { count: number; agreement: number }> = {};
  for (const [conf, data] of Object.entries(confBuckets)) {
    agreementByConfidence[Number(conf)] = {
      count: data.count,
      agreement: data.count > 0 ? (data.agree / data.count) * 100 : 0,
    };
  }

  return {
    total: judgments.length,
    agreementRate: (agreements / judgments.length) * 100,
    agreementByGap: {
      small: {
        count: gapBuckets.small.count,
        agreement: gapBuckets.small.count > 0 ? (gapBuckets.small.agree / gapBuckets.small.count) * 100 : 0,
      },
      medium: {
        count: gapBuckets.medium.count,
        agreement: gapBuckets.medium.count > 0 ? (gapBuckets.medium.agree / gapBuckets.medium.count) * 100 : 0,
      },
      large: {
        count: gapBuckets.large.count,
        agreement: gapBuckets.large.count > 0 ? (gapBuckets.large.agree / gapBuckets.large.count) * 100 : 0,
      },
    },
    strategyPreferences: stratPrefs,
    avgConfidence: totalConf / judgments.length,
    agreementByConfidence,
  };
}

export function clearJudgments() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
