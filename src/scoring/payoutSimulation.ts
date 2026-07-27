/**
 * Payout Curve Simulation — Monte Carlo analysis of house economics.
 *
 * Simulates 100k rounds with realistic player skill distributions
 * (novice/intermediate/expert mix) using current scoring params.
 *
 * Computes:
 *   - Expected house edge per round
 *   - Bankroll standard deviation over time
 *   - Probability of ruin at various bankroll sizes
 *   - Optimal max bet % of bankroll
 *   - Kelly criterion analysis
 *
 * Usage: npx tsx src/scoring/payoutSimulation.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_PAYOUT_CONFIG, computePayoutMultiplier } from './payout.js';
import type { PayoutConfig } from './payout.js';

// ─── PRNG ───────────────────────────────────────────────────────

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

// ─── PLAYER SKILL MODEL ─────────────────────────────────────────

interface SkillTier {
  name: string;
  fraction: number;
  scoreMean: number;
  scoreStd: number;
}

const SKILL_TIERS: SkillTier[] = [
  { name: 'Novice', fraction: 0.40, scoreMean: 32, scoreStd: 8 },
  { name: 'Intermediate', fraction: 0.35, scoreMean: 45, scoreStd: 10 },
  { name: 'Advanced', fraction: 0.18, scoreMean: 58, scoreStd: 12 },
  { name: 'Expert', fraction: 0.07, scoreMean: 72, scoreStd: 10 },
];

function sampleScore(rng: () => number): number {
  const tierRoll = rng();
  let cumulative = 0;
  let tier = SKILL_TIERS[0]!;
  for (const t of SKILL_TIERS) {
    cumulative += t.fraction;
    if (tierRoll <= cumulative) {
      tier = t;
      break;
    }
  }

  const raw = tier.scoreMean + gaussianRandom(rng) * tier.scoreStd;
  return Math.max(0, Math.min(100, raw));
}

// ─── SIMULATION ─────────────────────────────────────────────────

interface SimulationResult {
  totalRounds: number;
  config: PayoutConfig;
  skillTiers: SkillTier[];

  // Per-round stats
  avgScore: number;
  avgMultiplier: number;
  avgHouseEdge: number;
  medianMultiplier: number;
  profitableRoundPct: number;
  breakEvenOrBetterPct: number;

  // Per-tier breakdown
  tierStats: {
    name: string;
    avgScore: number;
    avgMultiplier: number;
    avgHouseEdge: number;
    profitablePct: number;
  }[];

  // Bankroll trajectory
  bankrollAnalysis: {
    size: number;
    ruinProbability: number;
    medianDrawdown: number;
    maxDrawdown: number;
    p95Drawdown: number;
    timeToRuin: number | null;
  }[];

  // Max bet analysis
  maxBetAnalysis: {
    betPct: number;
    ruinProb10k: number;
    expectedGrowth: number;
    kellyFraction: number;
  }[];

  // Score distribution
  scorePercentiles: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };

  // Multiplier distribution
  multiplierPercentiles: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)]!;
}

export function runPayoutSimulation(
  numRounds: number = 100000,
  seed: number = 777777,
  payoutConfig: PayoutConfig = DEFAULT_PAYOUT_CONFIG,
): SimulationResult {
  const rng = mulberry32(seed);

  // ─── Generate scores ───
  const scores: number[] = [];
  const multipliers: number[] = [];
  const tierScores: Record<string, number[]> = {};
  const tierMultipliers: Record<string, number[]> = {};

  for (const t of SKILL_TIERS) {
    tierScores[t.name] = [];
    tierMultipliers[t.name] = [];
  }

  for (let i = 0; i < numRounds; i++) {
    // Determine tier
    const tierRoll = rng();
    let cumulative = 0;
    let tier = SKILL_TIERS[0]!;
    for (const t of SKILL_TIERS) {
      cumulative += t.fraction;
      if (tierRoll <= cumulative) {
        tier = t;
        break;
      }
    }

    const raw = tier.scoreMean + gaussianRandom(rng) * tier.scoreStd;
    const score = Math.max(0, Math.min(100, raw));
    const multiplier = computePayoutMultiplier(score / 100, payoutConfig);

    scores.push(score);
    multipliers.push(multiplier);
    tierScores[tier.name]!.push(score);
    tierMultipliers[tier.name]!.push(multiplier);
  }

  // ─── Basic stats ───
  const avgScore = scores.reduce((s, v) => s + v, 0) / numRounds;
  const avgMultiplier = multipliers.reduce((s, v) => s + v, 0) / numRounds;
  const avgHouseEdge = 1 - avgMultiplier;
  const profitableRounds = multipliers.filter((m) => m > 1).length;
  const breakEvenOrBetter = multipliers.filter((m) => m >= 1).length;

  const sortedScores = [...scores].sort((a, b) => a - b);
  const sortedMultipliers = [...multipliers].sort((a, b) => a - b);

  // ─── Per-tier stats ───
  const tierStats = SKILL_TIERS.map((t) => {
    const tScores = tierScores[t.name]!;
    const tMults = tierMultipliers[t.name]!;
    const n = tScores.length;
    if (n === 0) return { name: t.name, avgScore: 0, avgMultiplier: 0, avgHouseEdge: 0, profitablePct: 0 };

    const aScore = tScores.reduce((s, v) => s + v, 0) / n;
    const aMult = tMults.reduce((s, v) => s + v, 0) / n;
    return {
      name: t.name,
      avgScore: aScore,
      avgMultiplier: aMult,
      avgHouseEdge: 1 - aMult,
      profitablePct: tMults.filter((m) => m > 1).length / n,
    };
  });

  // ─── Bankroll simulation ───
  const bankrollSizes = [10000, 50000, 100000, 500000];
  const numPaths = 1000;
  const pathLength = 10000; // 10k rounds per path
  const betSize = 100; // fixed $100 bets

  const bankrollAnalysis = bankrollSizes.map((startingBankroll) => {
    let ruinCount = 0;
    const drawdowns: number[] = [];
    const ruinTimes: number[] = [];

    for (let p = 0; p < numPaths; p++) {
      const pathRng = mulberry32(seed + p * 13579 + startingBankroll);
      let bankroll = startingBankroll;
      let peak = startingBankroll;
      let maxDrawdown = 0;
      let ruined = false;

      for (let r = 0; r < pathLength; r++) {
        const score = sampleScore(pathRng);
        const mult = computePayoutMultiplier(score / 100, payoutConfig);
        // House perspective: house collects bet, pays out bet*mult
        // Net house P&L = bet * (1 - mult)
        const housePnl = betSize * (1 - mult);
        bankroll += housePnl;

        if (bankroll > peak) peak = bankroll;
        const dd = (peak - bankroll) / peak;
        if (dd > maxDrawdown) maxDrawdown = dd;

        if (bankroll <= 0) {
          ruined = true;
          ruinTimes.push(r);
          break;
        }
      }

      if (ruined) ruinCount++;
      drawdowns.push(maxDrawdown);
    }

    drawdowns.sort((a, b) => a - b);

    return {
      size: startingBankroll,
      ruinProbability: ruinCount / numPaths,
      medianDrawdown: percentile(drawdowns, 0.5),
      maxDrawdown: drawdowns[drawdowns.length - 1]!,
      p95Drawdown: percentile(drawdowns, 0.95),
      timeToRuin: ruinTimes.length > 0
        ? ruinTimes.reduce((s, v) => s + v, 0) / ruinTimes.length
        : null,
    };
  });

  // ─── Max bet % analysis ───
  const betPercentages = [0.5, 1, 2, 3, 5, 7, 10, 15, 20];
  const maxBetAnalysis = betPercentages.map((betPct) => {
    const fraction = betPct / 100;
    const numBetPaths = 500;
    const betPathLength = 5000;
    let ruinCount = 0;
    let totalGrowth = 0;

    for (let p = 0; p < numBetPaths; p++) {
      const pathRng = mulberry32(seed + p * 97531 + Math.floor(betPct * 1000));
      let bankroll = 100000; // start with 100k
      let ruined = false;

      for (let r = 0; r < betPathLength; r++) {
        // Max exposure = fraction of bankroll
        const maxExposure = bankroll * fraction;
        const score = sampleScore(pathRng);
        const mult = computePayoutMultiplier(score / 100, payoutConfig);
        // House perspective: when accepting a bet with max exposure,
        // the worst case is paying out maxExposure * mult
        // House P&L = maxExposure * (1 - mult)
        const pnl = maxExposure * (1 - mult);
        bankroll += pnl;

        if (bankroll <= 0) {
          ruined = true;
          break;
        }
      }

      if (ruined) ruinCount++;
      totalGrowth += ruined ? -1 : Math.log(bankroll / 100000);
    }

    return {
      betPct,
      ruinProb10k: ruinCount / numBetPaths,
      expectedGrowth: totalGrowth / numBetPaths,
      kellyFraction: 0, // computed below
    };
  });

  // ─── Kelly Criterion (house perspective) ───
  // From house perspective: house "wins" when player loses (mult < 1)
  // house "loses" when player wins (mult > 1)
  const houseWinRounds = multipliers.filter((m) => m < 1).length;
  const houseLoseRounds = multipliers.filter((m) => m >= 1).length;
  const pHouseWin = houseWinRounds / numRounds;
  const pHouseLose = 1 - pHouseWin;
  const houseWins = multipliers.filter((m) => m < 1);
  const houseLosses = multipliers.filter((m) => m >= 1);
  const avgHouseWin = houseWins.length > 0
    ? houseWins.reduce((s, m) => s + (1 - m), 0) / houseWins.length
    : 0;
  const avgHouseLoss = houseLosses.length > 0
    ? houseLosses.reduce((s, m) => s + (m - 1), 0) / houseLosses.length
    : 0;
  const kellyFraction = avgHouseWin > 0
    ? Math.max(0, (pHouseWin * avgHouseWin - pHouseLose * avgHouseLoss) / avgHouseWin)
    : 0;

  for (const entry of maxBetAnalysis) {
    entry.kellyFraction = Math.max(0, kellyFraction);
  }

  return {
    totalRounds: numRounds,
    config: payoutConfig,
    skillTiers: SKILL_TIERS,
    avgScore,
    avgMultiplier,
    avgHouseEdge,
    medianMultiplier: percentile(sortedMultipliers, 0.5),
    profitableRoundPct: profitableRounds / numRounds,
    breakEvenOrBetterPct: breakEvenOrBetter / numRounds,
    tierStats,
    bankrollAnalysis,
    maxBetAnalysis,
    scorePercentiles: {
      p5: percentile(sortedScores, 0.05),
      p10: percentile(sortedScores, 0.10),
      p25: percentile(sortedScores, 0.25),
      p50: percentile(sortedScores, 0.50),
      p75: percentile(sortedScores, 0.75),
      p90: percentile(sortedScores, 0.90),
      p95: percentile(sortedScores, 0.95),
    },
    multiplierPercentiles: {
      p5: percentile(sortedMultipliers, 0.05),
      p10: percentile(sortedMultipliers, 0.10),
      p25: percentile(sortedMultipliers, 0.25),
      p50: percentile(sortedMultipliers, 0.50),
      p75: percentile(sortedMultipliers, 0.75),
      p90: percentile(sortedMultipliers, 0.90),
      p95: percentile(sortedMultipliers, 0.95),
      p99: percentile(sortedMultipliers, 0.99),
    },
  };
}

// ─── REPORT GENERATION ──────────────────────────────────────────

export function generateSimulationReport(sim: SimulationResult): string {
  const lines: string[] = [];
  const w = (s: string) => lines.push(s);

  w('# Payout Curve Simulation Report');
  w('');
  w(`**Generated**: ${new Date().toISOString()}`);
  w(`**Total rounds simulated**: ${sim.totalRounds.toLocaleString()}`);
  w('');

  // ─── 1. Payout Config ───
  w('## 1. Payout Configuration');
  w('');
  w('| Parameter | Value |');
  w('|-----------|-------|');
  w(`| House Edge | ${(sim.config.houseEdge * 100).toFixed(1)}% |`);
  w(`| Break-Even Score | ${(sim.config.breakEvenScore * 100).toFixed(0)} |`);
  w(`| Min Multiplier | ${sim.config.minMultiplier}x |`);
  w(`| Max Multiplier | ${sim.config.maxMultiplier}x |`);
  w(`| Refund Exponent | ${sim.config.refundExponent} |`);
  w(`| Profit Growth K | ${sim.config.profitGrowthK} |`);
  w('');

  // ─── 2. Player Skill Model ───
  w('## 2. Player Skill Distribution');
  w('');
  w('| Tier | Population % | Score Mean | Score Std |');
  w('|------|-------------|-----------|----------|');
  for (const t of sim.skillTiers) {
    w(`| ${t.name} | ${(t.fraction * 100).toFixed(0)}% | ${t.scoreMean} | ${t.scoreStd} |`);
  }
  w('');

  // ─── 3. Overall Results ───
  w('## 3. Overall Simulation Results');
  w('');
  w('| Metric | Value |');
  w('|--------|-------|');
  w(`| Average Score | ${sim.avgScore.toFixed(1)} |`);
  w(`| Average Multiplier | ${sim.avgMultiplier.toFixed(4)}x |`);
  w(`| **Expected House Edge** | **${(sim.avgHouseEdge * 100).toFixed(2)}%** |`);
  w(`| Median Multiplier | ${sim.medianMultiplier.toFixed(4)}x |`);
  w(`| Profitable Round % | ${(sim.profitableRoundPct * 100).toFixed(1)}% |`);
  w(`| Break-Even or Better % | ${(sim.breakEvenOrBetterPct * 100).toFixed(1)}% |`);
  w('');

  // ─── 4. Score Distribution ───
  w('## 4. Score Distribution');
  w('');
  w('| Percentile | Score |');
  w('|------------|-------|');
  for (const [key, val] of Object.entries(sim.scorePercentiles)) {
    w(`| ${key} | ${val.toFixed(1)} |`);
  }
  w('');

  // ─── 5. Multiplier Distribution ───
  w('## 5. Multiplier Distribution');
  w('');
  w('| Percentile | Multiplier |');
  w('|------------|-----------|');
  for (const [key, val] of Object.entries(sim.multiplierPercentiles)) {
    w(`| ${key} | ${val.toFixed(4)}x |`);
  }
  w('');

  // ─── 6. Per-Tier Breakdown ───
  w('## 6. Per-Tier Analysis');
  w('');
  w('| Tier | Avg Score | Avg Multiplier | House Edge | Profitable % |');
  w('|------|----------|---------------|-----------|-------------|');
  for (const t of sim.tierStats) {
    w(`| ${t.name} | ${t.avgScore.toFixed(1)} | ${t.avgMultiplier.toFixed(4)}x | ${(t.avgHouseEdge * 100).toFixed(2)}% | ${(t.profitablePct * 100).toFixed(1)}% |`);
  }
  w('');

  w('**Interpretation:**');
  const noviceTier = sim.tierStats.find((t) => t.name === 'Novice');
  const expertTier = sim.tierStats.find((t) => t.name === 'Expert');
  if (noviceTier && expertTier) {
    if (noviceTier.avgHouseEdge > 0 && expertTier.avgHouseEdge > 0) {
      w('- House has positive edge across all skill tiers. Sustainable.');
    } else if (expertTier.avgHouseEdge < 0) {
      w(`- **Warning**: Expert tier has negative house edge (${(expertTier.avgHouseEdge * 100).toFixed(2)}%). Experts are expected to profit on average.`);
      w('- This is by design if expert population is small, but monitor closely.');
    }
  }
  w('');

  // ─── 7. Bankroll Analysis ───
  w('## 7. Bankroll & Ruin Analysis');
  w('');
  w(`Simulated ${1000} paths of ${10000} rounds each, with $100 fixed bets.`);
  w('');
  w('| Starting Bankroll | Ruin Probability | Median Drawdown | 95th% Drawdown | Max Drawdown | Avg Time to Ruin |');
  w('|-------------------|-----------------|----------------|----------------|-------------|-----------------|');
  for (const b of sim.bankrollAnalysis) {
    const ttr = b.timeToRuin !== null ? `${b.timeToRuin.toFixed(0)} rounds` : 'N/A';
    w(`| $${b.size.toLocaleString()} | ${(b.ruinProbability * 100).toFixed(1)}% | ${(b.medianDrawdown * 100).toFixed(1)}% | ${(b.p95Drawdown * 100).toFixed(1)}% | ${(b.maxDrawdown * 100).toFixed(1)}% | ${ttr} |`);
  }
  w('');

  // Find recommended bankroll
  const safeBankroll = sim.bankrollAnalysis.find((b) => b.ruinProbability < 0.01);
  if (safeBankroll) {
    w(`**Recommended minimum bankroll**: $${safeBankroll.size.toLocaleString()} (< 1% ruin probability over 10k rounds with $100 bets).`);
  } else {
    w('**Warning**: No tested bankroll size achieves < 1% ruin probability. Consider adjusting payout parameters.');
  }
  w('');

  // ─── 8. Max Bet Analysis ───
  w('## 8. Optimal Max Bet % of Bankroll');
  w('');
  w(`Simulated ${500} paths of ${5000} rounds each, starting with $100k bankroll.`);
  w('');
  w('| Bet % | Ruin Prob | Expected Log Growth | Kelly Fraction |');
  w('|-------|----------|-------------------|---------------|');
  for (const m of sim.maxBetAnalysis) {
    w(`| ${m.betPct}% | ${(m.ruinProb10k * 100).toFixed(1)}% | ${m.expectedGrowth.toFixed(4)} | ${(m.kellyFraction * 100).toFixed(2)}% |`);
  }
  w('');

  // Find optimal bet
  const safeBets = sim.maxBetAnalysis.filter((m) => m.ruinProb10k < 0.01);
  const optimalBet = safeBets.length > 0
    ? safeBets.reduce((best, m) => m.expectedGrowth > best.expectedGrowth ? m : best)
    : null;

  if (optimalBet) {
    w(`**Optimal max bet**: ${optimalBet.betPct}% of bankroll (highest growth with < 1% ruin risk).`);
  }
  w('');

  // ─── 9. Kelly Criterion ───
  w('## 9. Kelly Criterion Analysis');
  w('');
  w(`From the perspective of the **house** (not the player):`);
  w('');

  const kellyPct = sim.maxBetAnalysis[0]?.kellyFraction ?? 0;
  w(`- Win probability (for house): ${((1 - sim.profitableRoundPct) * 100).toFixed(1)}%`);
  w(`- Average house win per round: ${(sim.avgHouseEdge * 100).toFixed(2)}% of stake`);
  w(`- **Full Kelly fraction**: ${(kellyPct * 100).toFixed(2)}% of bankroll per round`);
  w(`- **Half Kelly (conservative)**: ${(kellyPct * 50).toFixed(2)}% of bankroll per round`);
  w('');

  if (kellyPct > 0) {
    w('The Kelly criterion suggests the maximum fraction of bankroll that can be risked on a single round while maintaining long-term growth. Half-Kelly is the standard conservative recommendation.');
  } else {
    w('**Warning**: Kelly fraction is zero or negative, indicating the house edge may be insufficient to guarantee long-term growth.');
  }
  w('');

  // ─── 10. Recommendations ───
  w('## 10. Parameter Adjustment Recommendations');
  w('');

  const recs: string[] = [];

  // House edge assessment
  if (sim.avgHouseEdge < 0.01) {
    recs.push('- **House edge too low** (' + (sim.avgHouseEdge * 100).toFixed(2) + '%). Consider increasing `houseEdge` or lowering `breakEvenScore` to ensure sustainable economics.');
  } else if (sim.avgHouseEdge > 0.10) {
    recs.push('- **House edge very high** (' + (sim.avgHouseEdge * 100).toFixed(2) + '%). May deter players. Consider reducing `houseEdge` or raising `breakEvenScore` for better player experience.');
  } else if (sim.avgHouseEdge >= 0.02 && sim.avgHouseEdge <= 0.06) {
    recs.push('- House edge of ' + (sim.avgHouseEdge * 100).toFixed(2) + '% is in the healthy range (2-6%). No changes needed.');
  }

  // Profitable round assessment
  if (sim.profitableRoundPct > 0.35) {
    recs.push('- **Too many profitable rounds** (' + (sim.profitableRoundPct * 100).toFixed(1) + '%). Consider raising `breakEvenScore` to reduce profitable outcome frequency.');
  } else if (sim.profitableRoundPct < 0.10) {
    recs.push('- **Very few profitable rounds** (' + (sim.profitableRoundPct * 100).toFixed(1) + '%). Players may feel the game is unfair. Consider lowering `breakEvenScore`.');
  }

  // Expert tier check
  if (expertTier && expertTier.avgHouseEdge < -0.10) {
    recs.push('- **Expert tier bleeds house** (edge: ' + (expertTier.avgHouseEdge * 100).toFixed(2) + '%). If expert population grows, this could become a problem. Consider capping `maxMultiplier` or adjusting `profitGrowthK`.');
  }

  // Max multiplier assessment
  if (sim.multiplierPercentiles.p99 >= sim.config.maxMultiplier * 0.9) {
    recs.push('- p99 multiplier is near max cap (' + sim.multiplierPercentiles.p99.toFixed(2) + 'x vs ' + sim.config.maxMultiplier + 'x cap). Consider whether this cap level is appropriate.');
  }

  // Bankroll recommendation
  const minSafeBankroll = sim.bankrollAnalysis.find((b) => b.ruinProbability < 0.005);
  if (minSafeBankroll) {
    recs.push('- Recommended minimum bankroll: $' + minSafeBankroll.size.toLocaleString() + ' for < 0.5% ruin probability with $100 bets.');
  }

  if (recs.length === 0) {
    w('No parameter changes recommended. Economics look healthy.');
  } else {
    for (const r of recs) {
      w(r);
    }
  }
  w('');

  return lines.join('\n');
}

// ─── CLI ENTRY POINT ────────────────────────────────────────────

if (process.argv[1]?.endsWith('payoutSimulation.ts') || process.argv[1]?.endsWith('payoutSimulation.js')) {
  const startTime = Date.now();

  console.log('Starting payout curve simulation (100k rounds)...\n');
  const sim = runPayoutSimulation(100000);
  const report = generateSimulationReport(sim);

  const reportPath = path.join(process.cwd(), 'PAYOUT_SIMULATION_REPORT.md');
  fs.writeFileSync(reportPath, report);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Simulation complete in ${elapsed}s.`);
  console.log(`Report written to ${reportPath}`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('SIMULATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Avg score: ${sim.avgScore.toFixed(1)}`);
  console.log(`Avg multiplier: ${sim.avgMultiplier.toFixed(4)}x`);
  console.log(`House edge: ${(sim.avgHouseEdge * 100).toFixed(2)}%`);
  console.log(`Profitable rounds: ${(sim.profitableRoundPct * 100).toFixed(1)}%`);
  console.log('');
  console.log('Per-tier:');
  for (const t of sim.tierStats) {
    console.log(`  ${t.name.padEnd(15)} avg=${t.avgScore.toFixed(1)}  mult=${t.avgMultiplier.toFixed(3)}x  edge=${(t.avgHouseEdge * 100).toFixed(1)}%  profit=${(t.profitablePct * 100).toFixed(0)}%`);
  }
  console.log('');
  console.log('Ruin probabilities (10k rounds, $100 bets):');
  for (const b of sim.bankrollAnalysis) {
    console.log(`  $${b.size.toLocaleString().padEnd(10)} ruin=${(b.ruinProbability * 100).toFixed(1)}%  maxDD=${(b.maxDrawdown * 100).toFixed(1)}%`);
  }
}
