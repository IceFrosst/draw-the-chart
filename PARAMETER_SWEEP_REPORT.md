# Parameter Sweep Report

**Generated**: 2026-03-09T00:55:42.801Z
**Total configurations tested**: 560
**Estimated total scoring runs**: ~1507k

## 1. Current Config vs Best Found

| Metric | Current Config | Best Found | Delta |
|--------|---------------|------------|-------|
| Composite Score | 77.25 | 82.82 | 5.57 |
| Random Walk Mean | 34.0 | 34.2 | 0.2 |
| Flat Line Mean | 25.4 | 29.6 | 4.1 |
| Naive Trend Mean | 38.0 | 42.1 | 4.1 |
| Perfect Mean | 100.0 | 100.0 | 0.0 |
| Inverse Mean | 13.9 | 13.4 | -0.4 |
| Score Spread | 86.1 | 86.6 | 0.4 |
| Monotonicity Violation | 1.2% | 1.2% | 0.0% |
| Dir×Mag Correlation | 0.795 | 0.773 | -0.023 |
| Baselines Pass | YES | YES | - |

## 2. Best Configuration Parameters

```typescript
export const DEFAULT_CONFIG: ScoringConfig = {
  N: 120,
  directionMaxScaleLevel: 3,
  directionDecayBase: 3,
  magnitudeLambda: 1.4,
  magnitudeBiasWeight: 0.3,
  magnitudeTrackingWeight: 0.5,
  magnitudeVolFloor: 1e-8,
  turningPointSmoothingFraction: 0.046667,
  turningPointProminenceMultiple: 0.3,
  turningPointTimeTolerance: 0.05,
  turningPointHallucinationPenalty: 0.35,
  turningPointMissPenalty: 0.08,
  turningPointTimeWeight: 0.5,
  turningPointAmplitudeWeight: 0.5,
  volatilityMu: 1,
  volatilityQuarters: 4,
  volatilityFloor: 1e-8,
};
```

**Changes from current:**
- `magnitudeLambda`: 1.35 → 1.4
- `directionDecayBase`: 2 → 3
- `volatilityMu`: 1.8 → 1
- `magnitudeBiasWeight`: 0.5 → 0.3
- `turningPointSmoothingFraction`: 0.05 → 0.046667
- `turningPointTimeTolerance`: 0.1 → 0.05
- `turningPointHallucinationPenalty`: 0.2 → 0.35
- `turningPointMissPenalty`: 0.15 → 0.08
- `directionMaxScaleLevel`: 4 → 3

## 3. Phase-by-Phase Results

### Phase 1: Core Sensitivity
- Best composite: 80.40
- Config: {"magnitudeLambda":1.4,"directionDecayBase":3,"volatilityMu":1}
- Baselines: PASS

### Phase 2: Secondary Parameters
- Best composite: 77.96
- Config: {"magnitudeLambda":1.4,"directionDecayBase":3,"volatilityMu":1,"magnitudeBiasWeight":0.3,"turningPointSmoothingFraction":0.046667,"turningPointProminenceMultiple":0.3}
- Baselines: PASS

### Phase 3: Fine-Tuning
- Best composite: 82.14
- Config: {"magnitudeLambda":1.4,"directionDecayBase":3,"volatilityMu":1,"magnitudeBiasWeight":0.3,"turningPointSmoothingFraction":0.046667,"turningPointProminenceMultiple":0.3,"turningPointTimeTolerance":0.05,"turningPointHallucinationPenalty":0.35,"turningPointMissPenalty":0.08,"directionMaxScaleLevel":3}
- Baselines: PASS

## 4. Top 10 Configurations

| Rank | ID | Composite | RW | Flat | Trend | Mono% | Dir×Mag | Spread | Pass |
|------|----|-----------|----|------|-------|-------|---------|--------|------|
| 1 | p3_36 | 82.14 | 34.5 | 29.5 | 40.5 | 1.2 | 0.771 | 86.6 | Y |
| 2 | p3_37 | 81.87 | 34.5 | 29.5 | 40.5 | 1.2 | 0.775 | 86.6 | Y |
| 3 | p3_84 | 81.85 | 34.7 | 29.5 | 40.5 | 1.2 | 0.771 | 86.4 | Y |
| 4 | p3_38 | 81.79 | 34.5 | 29.5 | 40.5 | 1.2 | 0.776 | 86.6 | Y |
| 5 | p3_24 | 81.77 | 34.8 | 29.5 | 40.5 | 1.2 | 0.771 | 86.6 | Y |
| 6 | p3_132 | 81.60 | 34.9 | 29.5 | 40.5 | 1.2 | 0.771 | 86.2 | Y |
| 7 | p3_85 | 81.59 | 34.7 | 29.5 | 40.5 | 1.2 | 0.775 | 86.4 | Y |
| 8 | p3_86 | 81.51 | 34.7 | 29.5 | 40.5 | 1.2 | 0.776 | 86.4 | Y |
| 9 | p3_25 | 81.51 | 34.7 | 29.5 | 40.5 | 1.2 | 0.775 | 86.6 | Y |
| 10 | p3_72 | 81.44 | 35.0 | 29.5 | 40.5 | 1.2 | 0.771 | 86.4 | Y |

## 5. Parameter Sensitivity Analysis

How much each parameter affects the composite score (higher impact = more sensitive):

| Parameter | Range Tested | Impact on Composite |
|-----------|-------------|-------------------|
| magnitudeLambda | 0.8 – 2.2 | 33.75 pts (best at 1.2) |
| turningPointMissPenalty | 0.08 – 0.25 | 20.93 pts (best at 0.136667) |
| turningPointHallucinationPenalty | 0.1 – 0.35 | 17.19 pts (best at 0.35) |
| turningPointSmoothingFraction | 0.03 – 0.08 | 7.95 pts (best at 0.046667) |
| turningPointProminenceMultiple | 0.2 – 0.5 | 7.47 pts (best at 0.3) |
| magnitudeBiasWeight | 0.3 – 0.7 | 7.43 pts (best at 0.3) |
| turningPointTimeTolerance | 0.05 – 0.15 | 5.35 pts (best at 0.05) |
| directionDecayBase | 1.5 – 3 | 2.72 pts (best at 2.7) |
| volatilityMu | 1 – 3 | 1.66 pts (best at 1.8) |
| directionMaxScaleLevel | 3 – 5 | 0.81 pts (best at 4) |

## 6. Configuration Space Analysis

- **Configs that pass all baselines**: 129/560 (23.0%)
- **Configs that fail baselines**: 431/560

Among passing configs:
- Mean composite: 79.07
- Best composite: 82.14
- Worst composite: 76.31
- Std: 1.28

## 7. Recommendations

**Significant improvement found** (+5.57 composite points). The suggested parameters substantially improve scoring quality. Recommended to update config.ts.

