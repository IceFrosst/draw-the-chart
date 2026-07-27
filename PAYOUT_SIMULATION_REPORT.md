# Payout Curve Simulation Report

**Generated**: 2026-03-09T00:48:30.903Z
**Total rounds simulated**: 100,000

## 1. Payout Configuration

| Parameter | Value |
|-----------|-------|
| House Edge | 2.0% |
| Break-Even Score | 60 |
| Min Multiplier | 0.4x |
| Max Multiplier | 25x |
| Refund Exponent | 1.45 |
| Profit Growth K | 3.25 |

## 2. Player Skill Distribution

| Tier | Population % | Score Mean | Score Std |
|------|-------------|-----------|----------|
| Novice | 40% | 32 | 8 |
| Intermediate | 35% | 45 | 10 |
| Advanced | 18% | 58 | 12 |
| Expert | 7% | 72 | 10 |

## 3. Overall Simulation Results

| Metric | Value |
|--------|-------|
| Average Score | 44.2 |
| Average Multiplier | 1.0786x |
| **Expected House Edge** | **-7.86%** |
| Median Multiplier | 0.7437x |
| Profitable Round % | 16.2% |
| Break-Even or Better % | 16.2% |

## 4. Score Distribution

| Percentile | Score |
|------------|-------|
| p5 | 22.5 |
| p10 | 26.0 |
| p25 | 32.6 |
| p50 | 41.8 |
| p75 | 53.9 |
| p90 | 66.4 |
| p95 | 73.6 |

## 5. Multiplier Distribution

| Percentile | Multiplier |
|------------|-----------|
| p5 | 0.5399x |
| p10 | 0.5728x |
| p25 | 0.6396x |
| p50 | 0.7437x |
| p75 | 0.8965x |
| p90 | 1.6476x |
| p95 | 2.9514x |
| p99 | 7.3568x |

## 6. Per-Tier Analysis

| Tier | Avg Score | Avg Multiplier | House Edge | Profitable % |
|------|----------|---------------|-----------|-------------|
| Novice | 32.0 | 0.6384x | 36.16% | 0.0% |
| Intermediate | 45.1 | 0.8205x | 17.95% | 6.5% |
| Advanced | 58.1 | 1.5456x | -54.56% | 42.6% |
| Expert | 72.0 | 3.6291x | -262.91% | 87.6% |

**Interpretation:**
- **Warning**: Expert tier has negative house edge (-262.91%). Experts are expected to profit on average.
- This is by design if expert population is small, but monitor closely.

## 7. Bankroll & Ruin Analysis

Simulated 1000 paths of 10000 rounds each, with $100 fixed bets.

| Starting Bankroll | Ruin Probability | Median Drawdown | 95th% Drawdown | Max Drawdown | Avg Time to Ruin |
|-------------------|-----------------|----------------|----------------|-------------|-----------------|
| $10,000 | 100.0% | 101.9% | 109.9% | 121.6% | 1472 rounds |
| $50,000 | 95.8% | 100.4% | 102.3% | 104.3% | 6847 rounds |
| $100,000 | 2.3% | 72.8% | 94.6% | 101.1% | 9537 rounds |
| $500,000 | 0.0% | 14.5% | 19.0% | 22.1% | N/A |

**Recommended minimum bankroll**: $500,000 (< 1% ruin probability over 10k rounds with $100 bets).

## 8. Optimal Max Bet % of Bankroll

Simulated 500 paths of 5000 rounds each, starting with $100k bankroll.

| Bet % | Ruin Prob | Expected Log Growth | Kelly Fraction |
|-------|----------|-------------------|---------------|
| 0.5% | 0.0% | -1.8843 | 0.00% |
| 1% | 0.0% | -4.0809 | 0.00% |
| 2% | 0.0% | -9.1893 | 0.00% |
| 3% | 0.0% | -16.1392 | 0.00% |
| 5% | 87.0% | -5.2125 | 0.00% |
| 7% | 99.8% | -1.0872 | 0.00% |
| 10% | 100.0% | -1.0000 | 0.00% |
| 15% | 100.0% | -1.0000 | 0.00% |
| 20% | 100.0% | -1.0000 | 0.00% |

**Optimal max bet**: 0.5% of bankroll (highest growth with < 1% ruin risk).

## 9. Kelly Criterion Analysis

From the perspective of the **house** (not the player):

- Win probability (for house): 83.8%
- Average house win per round: -7.86% of stake
- **Full Kelly fraction**: 0.00% of bankroll per round
- **Half Kelly (conservative)**: 0.00% of bankroll per round

**Warning**: Kelly fraction is zero or negative, indicating the house edge may be insufficient to guarantee long-term growth.

## 10. Parameter Adjustment Recommendations

- **House edge too low** (-7.86%). Consider increasing `houseEdge` or lowering `breakEvenScore` to ensure sustainable economics.
- **Expert tier bleeds house** (edge: -262.91%). If expert population grows, this could become a problem. Consider capping `maxMultiplier` or adjusting `profitGrowthK`.
- Recommended minimum bankroll: $500,000 for < 0.5% ruin probability with $100 bets.
