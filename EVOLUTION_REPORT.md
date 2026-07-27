# Evolutionary Scoring Optimization — Final Report

**Date**: 2026-03-09T19:09:05.981Z
**Generations**: 191
**Total Evaluations**: 19200
**Duration**: 29m 51s

## Executive Summary

Best composite fitness: **66.58**
Baselines passed: **Yes**

| Metric | Value |
|--------|-------|
| Random Walk | 33.2 (target: 30-35) |
| Flat Line | 30.0 (target: 25-35) |
| Naive Trend | 40.8 (target: 35-50) |
| Perfect | 100.0 (target: ~100) |
| Inverse | 13.6 (target: <15) |
| Score Spread | 86.4 |
| Monotonicity Violations | 22.0% |
| Dir x Mag Correlation | 0.858 |

## Best Genome Configuration

**ID**: g91_55
**Generation**: 91
**Composite Score**: 66.58

**Variants**:
- Direction: `direction.multiScale`
- Magnitude: `magnitude.timeWeightedError`
- Turning Points: `turningPoints.hungarianMatch`
- Volatility: `volatility.multiScaleVol`

**Weights**:
- Direction: 39.2
- Magnitude: 21.5
- Turning Points: 33.9
- Volatility: 5.5

## How to Apply

The best genome uses the following variant selections and weights.
To integrate into the live scoring system, update `computeScore` to use
the variant-aware scorer with this genome's configuration.

```typescript
// Variant selections:
//   direction: 'direction.multiScale'
//   magnitude: 'magnitude.timeWeightedError'
//   turningPoints: 'turningPoints.hungarianMatch'
//   volatility: 'volatility.multiScaleVol'
//
// Component weights:
//   direction: 39.2
//   magnitude: 21.5
//   turningPoints: 33.9
//   volatility: 5.5
```

### Variant Parameters

**direction.multiScale**:
  - maxScaleLevel: 5.000000
  - decayBase: 1.000000

**magnitude.timeWeightedError**:
  - lambda: 2.625827
  - decayDirection: 2.000000
  - volFloor: 0.000000

**turningPoints.hungarianMatch**:
  - smoothingFraction: 0.048378
  - prominenceMultiple: 0.108839
  - timeTolerance: 0.190938
  - hallucinationPenalty: 0.050000
  - missPenalty: 0.084529
  - timeWeight: 0.200000
  - amplitudeWeight: 0.528950

**volatility.multiScaleVol**:
  - maxScaleLevel: 4.000000
  - decayBase: 3.192899
  - mu: 1.554466

## Convergence History

| Gen | Best | Avg | Diversity | Stagnation |
|-----|------|-----|-----------|------------|
| 0 | 49.82 | 16.09 | 59 | 0 |
| 5 | 62.09 | 27.42 | 29 | 2 |
| 10 | 60.52 | 28.73 | 14 | 3 |
| 15 | 64.23 | 30.79 | 18 | 1 |
| 20 | 64.88 | 41.54 | 17 | 1 |
| 25 | 66.49 | 45.61 | 17 | 1 |
| 30 | 67.71 | 49.66 | 13 | 2 |
| 35 | 67.73 | 50.93 | 14 | 7 |
| 40 | 73.34 | 55.24 | 13 | 0 |
| 45 | 70.04 | 55.04 | 8 | 5 |
| 50 | 70.33 | 52.78 | 11 | 10 |
| 55 | 74.83 | 56.11 | 9 | 0 |
| 60 | 72.60 | 57.61 | 10 | 5 |
| 65 | 72.10 | 54.74 | 13 | 10 |
| 70 | 71.23 | 53.24 | 13 | 15 |
| 75 | 72.19 | 53.85 | 16 | 4 |
| 80 | 77.20 | 56.89 | 10 | 0 |
| 85 | 73.08 | 60.04 | 14 | 5 |
| 90 | 71.06 | 56.71 | 17 | 1 |
| 95 | 73.78 | 57.41 | 16 | 4 |
| 100 | 71.35 | 57.41 | 14 | 9 |
| 105 | 74.92 | 57.45 | 16 | 14 |
| 110 | 76.36 | 59.50 | 15 | 19 |
| 115 | 71.25 | 59.14 | 13 | 24 |
| 120 | 73.02 | 58.00 | 10 | 29 |
| 125 | 74.74 | 57.09 | 16 | 34 |
| 130 | 73.02 | 58.85 | 16 | 39 |
| 135 | 72.12 | 59.98 | 12 | 44 |
| 140 | 71.97 | 60.39 | 15 | 49 |
| 145 | 77.36 | 58.28 | 15 | 54 |
| 150 | 73.49 | 59.75 | 13 | 59 |
| 155 | 73.11 | 57.06 | 14 | 64 |
| 160 | 75.19 | 60.20 | 14 | 69 |
| 165 | 74.74 | 59.65 | 11 | 74 |
| 170 | 80.31 | 57.02 | 18 | 79 |
| 175 | 75.78 | 58.89 | 14 | 84 |
| 180 | 75.27 | 56.46 | 21 | 89 |
| 185 | 71.71 | 53.94 | 17 | 94 |
| 190 | 76.26 | 58.52 | 14 | 99 |
| 191 | 74.56 | 57.67 | 16 | 100 |

## Variant Survival Analysis

Which variants survived evolution:

**direction**:
  - direction.multiScale: 97/100 (97%)
  - direction.correlationBased: 2/100 (2%)
  - direction.dtwDirection: 1/100 (1%)

**magnitude**:
  - magnitude.biasRmse: 44/100 (44%)
  - magnitude.timeWeightedError: 40/100 (40%)
  - magnitude.dtwDistance: 16/100 (16%)

**turningPoints**:
  - turningPoints.hungarianMatch: 94/100 (94%)
  - turningPoints.crossCorrelation: 4/100 (4%)
  - turningPoints.simplified: 2/100 (2%)

**volatility**:
  - volatility.multiScaleVol: 56/100 (56%)
  - volatility.quarterBased: 27/100 (27%)
  - volatility.rollingWindow: 17/100 (17%)

*Report generated at 2026-03-09T19:09:05.981Z*