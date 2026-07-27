# Draw The Chart

## Whitepaper

Version 2.0  
Date: April 9, 2026  
Status: Friends-and-early-testers product paper

## Disclaimer

This document describes the product vision, current implementation, scoring model, optimization methodology, live rollout design, and economic findings for Draw The Chart (DTC). It is not investment advice, not a promise of future token issuance, and not a solicitation to participate in any regulated product in any jurisdiction where such participation would be restricted.

Where relevant, this paper explicitly distinguishes between:

- what is implemented today in the testing product
- what is intended for the live product

That distinction matters. The credibility of DTC depends on being precise about what exists, what is calibrated, and what still needs to be built.

---

## 1. Abstract

Draw The Chart is a crypto prediction game in which the player expresses a market thesis by drawing the future price path rather than selecting a binary outcome or opening a leveraged position.

A round begins at a fixed market anchor. The player sees the historical BTC chart up to that anchor, then draws an expected future path over a fixed horizon such as 15 minutes, 1 hour, 6 hours, 24 hours, or 7 days. That path is normalized into a valid prediction shape, scored against the realized market path in log-return space, and mapped to a transparent payout curve.

The core idea is simple: crypto users already think in charts, draw scenarios, and debate path shape. Existing products compress that behavior into "up or down," or force the user into a full trading workflow with leverage, liquidation risk, order management, and unnecessary complexity. DTC turns the chart itself into the game object.

The product is designed to sit between prediction markets and trading:

- more expressive than binary prediction markets
- simpler than leveraged trading
- more skill-flavored than pure casino mechanics
- more bounded and transparent than a traditional perp position

As of this version, DTC has progressed beyond the original sandbox MVP. The scoring engine has been rigorously optimized through a combination of parameter sweeps across 2.7 million candles and a genetic evolutionary optimizer across 19,200 candidate configurations. The product is deployed in a friends-only testing phase. Human feedback is being collected to further refine scoring fairness.

---

## 2. Why This Product Should Exist

### 2.1 The behavior already exists

Crypto users already perform the core DTC action informally:

- they draw trend lines and target paths on charts
- they post "BTC to here first, then retrace" scenarios on social platforms
- they argue about timing, not just direction
- they think in shape, structure, and volatility regimes

This is already a game. It just is not captured natively by a product.

### 2.2 Existing products do not capture the full thesis

Most market products force a richer thesis into a poorer input format.

Prediction markets reduce a view to a yes/no proposition:

- "Will BTC be above X by date Y?"
- "Will candidate Z win?"

That structure is useful for event resolution, but it does not capture path shape. A player may believe BTC rallies first, then fades, then finishes slightly above the threshold. In a binary market, all of that nuance is discarded.

Perpetual trading captures more than a binary market, but it creates a different set of frictions:

- leverage selection
- position sizing
- entry execution
- liquidation management
- stop-loss and take-profit management
- funding-rate considerations

This is appropriate for traders. It is excessive for someone who wants to express a directional and structural thesis on the chart itself.

Pure gambling products sit at the other extreme. They offer immediacy and convex payouts but usually remove the feeling of analytical agency. DTC is built on the belief that perceived agency matters. Players want the experience to feel like "I read the chart well," not "I clicked a coin flip."

### 2.3 The gap DTC fills

DTC fills a specific gap:

- house-vs-player simplicity
- chart-native input
- deterministic scoring
- bounded downside
- transparent upside curve
- replayable and reviewable outcomes

The value proposition is not "predict the future perfectly." The value proposition is "express more of your thesis than a binary bet allows, and get paid if that thesis was meaningfully right."

### 2.4 Competitive positioning

DTC should be understood relative to four adjacent categories:

1. Prediction markets — strong on event resolution, weak on path expression.
2. Perp DEXs and margin venues — strong on execution flexibility, weak on accessibility and bounded simplicity.
3. Social charting — strong on expression, weak on economic closure.
4. Casino-style convex products — strong on excitement, weak on perceived skill.

DTC combines pieces of all four:

- the expressive input of charting
- the finality of a settled game
- the convex upside of a gambling product
- the market context of trading

This is why the product should not feel like a casino skin wrapped around a random number generator. The chart is not a theme. It is the mechanic.

---

## 3. Product Definition

### 3.1 One-sentence definition

Draw The Chart is a house-vs-player BTC price-path prediction game where users draw an expected future path and receive a score-based payout.

### 3.2 MVP scope

- asset: BTC/USDT
- horizons: 15m, 1h, 6h, 24h, 7d
- chart mode: historical candles plus future draw zone
- prediction input: continuous freehand line, normalized into control points
- settlement mode: historical sandbox, transitioning to live rounds
- score output: 0 to 100 with four-component breakdown
- payout model: transparent two-zone multiplier curve

### 3.3 Current implementation status (v0.2-testing)

As of this version, the repo implements:

- a standalone pure-function scoring engine, rigorously optimized
- backtesting on 2.7 million BTC/USDT 1-minute candles (January 2021 – March 2026)
- an evolutionary optimizer for discovering superior scoring configurations
- a human feedback collection and analysis system
- a calibrated two-zone payout curve
- sandbox rounds on historical BTC data with animated reveal
- candlestick history and future-zone freehand drawing UI
- deterministic score breakdown and reveal flow
- Supabase-backed persistence for rounds and feedback data
- admin analytics dashboard for monitoring user behavior and scoring patterns
- password-gated friends-only testing deployment on Vercel

The repo does not yet implement:

- wallet connection
- live bankroll-backed settlement
- real-time round orchestration
- production risk controls
- licensed third-party charting suites

### 3.4 Why the product is house-vs-player

The product is intentionally house-vs-player rather than peer-matched.

That choice has several advantages:

- immediate liquidity
- consistent round availability
- clear exposure accounting
- no dependency on matching opposing views
- simpler product UX

The tradeoff is that the house must actively manage bankroll risk. That is acceptable because DTC is not trying to be a venue for price discovery. It is a structured prediction game with a transparent scoring and payout engine.

---

## 4. Design Principles

### 4.1 Expressiveness over compression

The user should be able to express direction, timing, magnitude, turning points, and volatility structure. If the product reduces all of that to a yes/no choice, it has failed its premise.

### 4.2 Determinism over mystique

Every score must come from documented, deterministic logic. "The engine decided" is not good enough. A user should be able to inspect why a path scored well or badly.

### 4.3 Calibration over intuition

A scoring system that sounds elegant in prose but produces absurd baseline distributions is not valid. DTC treats backtest calibration as a first-class requirement, not a later polish step. The scoring engine has undergone two rounds of systematic optimization: a 560-configuration parameter sweep and a genetic evolutionary search across 19,200 candidate configurations.

### 4.4 Bounded downside, convex upside

The user should know the downside floor and the upside shape before participating. This is both a product-quality and trust requirement.

### 4.5 Chart feel is product-critical

The drawing interaction is the product. If it feels laggy, unintuitive, or visually fake, the product loses its edge. A weak input experience cannot be rescued by good math.

### 4.6 Transparency about scope

The sandbox, scoring engine, and payout curve should be auditable even before the live product exists. Users should not have to trust future promises in order to understand the present system.

### 4.7 Narrow first, then deepen

BTC only is not a limitation of ambition. It is a deliberate decision to harden the hardest parts first: input quality, scoring validity, payout economics, trust model.

---

## 5. Core Product Loop

The player loop is:

1. Select BTC and a timeframe.
2. View the historical chart up to a locked anchor.
3. Enter a stake amount.
4. Draw the expected future path.
5. Submit the prediction.
6. Reveal the realized path.
7. Receive a component score and payout outcome.
8. Optionally provide feedback on scoring fairness.
9. Replay the round and learn from the result.

That loop should feel short, self-explanatory, and repeatable. It is closer to "place your thesis" than "configure a trading setup."

### 5.1 Example round walkthrough

Consider a 1-hour sandbox round:

- BTC is locked at $102,125.22 at the anchor.
- The player believes price will break upward quickly, top out midway through the hour, then fade slightly but remain above the start.
- The player draws a sharp rally into the future zone, then a moderate pullback.
- The actual path rises more gradually, chops sideways, and ends modestly above the anchor.

The round is scored as follows:

- direction: relatively strong, because the broad thesis was upward
- magnitude: mixed, because the player overshot the rally amplitude
- turning points: mixed, because the player anticipated one major turn but mis-timed the local structure
- volatility regime: moderate, because the player predicted a more explosive first half than actually occurred

Suppose the final score is 73.0. Under the current payout curve, that maps to a multiplier above 1.0x and therefore a profit. The player can then review both paths and see where the thesis was right and where it was too aggressive.

The intended learning loop is not merely "won or lost" but "which part of the thesis was correct."

---

## 6. Input Model and Chart Interaction

### 6.1 Why the user draws a line, not candles

The chart history is shown as candles because the market is observed through OHLC data. The prediction is expressed as a continuous path because the thesis is not about future candle opens and closes; it is about expected price movement through time.

The product separates historical market representation from predictive thesis representation. A player's thesis usually sounds like "push higher first," "retest the low," or "grind sideways then expand." Those are path statements, not future-candle statements.

### 6.2 Future zone

The input area opens as a fixed future zone to the right of the anchor. This preserves context from the historical chart, makes the anchor visually explicit, cleanly separates known data from player expression, and allows the reveal animation to happen on the same canvas.

### 6.3 Freehand capture and normalized structure

The live interaction captures a freehand stroke first. The system does not score the raw stroke directly. Instead, it normalizes the path into a constrained prediction shape.

This design choice serves two goals:

- the interaction can feel fluid and expressive
- the scored output can remain deterministic and resistant to exploitative edge cases

### 6.4 Control-point constraints

The current MVP uses horizon-specific control-point limits:

- 15m: 8 control points
- 1h: 12 control points
- 6h: 16 control points
- 24h: 16 control points
- 7d: 16 control points

The normalized path must satisfy:

- first point fixed at the anchor
- last point fixed at the horizon end
- strictly increasing time
- minimum time spacing between control points
- maximum slope between consecutive points

The maximum slope is bounded relative to historical BTC hourly movement so that an input cannot jump from a plausible market thesis into absurd vertical spikes.

### 6.5 Technical analysis tools

Technical analysis overlays are present because users expect a charting environment to support reference structure: moving averages, Bollinger Bands, RSI, trend lines, and horizontal levels. These tools are for player interpretation. They are not part of the scored path.

### 6.6 Why the interface should resemble a market terminal

The TA shell, candles, timeframes, and dense numeric framing are not cosmetic. They create the correct mental model: the player is making a market call. The interface communicates analytical play even though the product ultimately settles as a house-vs-player game. DTC borrows the clarity and density of exchange interfaces while remaining clearly optimized for one action: drawing the forecast.

---

## 7. Data Model and Path Representation

### 7.1 Log-return space

All scoring is performed in log-return space:

`r(t) = ln(P(t) / P0)`

where P0 is the round's locked starting price and `r(T0) = 0`.

This choice is important because it makes paths comparable across different BTC price levels. A $500 move means different things when BTC is at $20,000 versus $110,000. Log returns normalize that difference.

### 7.2 Resampling

Both the predicted path and the realized path are resampled to N = 120 evenly spaced points before scoring.

This standardization ensures all horizons are comparable under one scoring framework, reduces sensitivity to arbitrary draw resolution, and ensures every scoring component operates on a consistent representation.

### 7.3 Market data resolution

The sandbox uses BTC historical data at different display resolutions depending on horizon:

- 1-minute candles for 15m and 1h rounds
- 5-minute candles for 6h rounds
- 15-minute candles for 24h rounds
- 1-hour candles for 7d rounds

This keeps the displayed chart legible while preserving meaningful market structure for the timeframe being played.

### 7.4 Display path versus scored path

The product clearly communicates the difference between the path the user visually drew, the normalized path that was scored, and the realized path that settled the round. The reveal animation shows both paths on the same canvas, turning a black-box score into an inspectable result.

---

## 8. Scoring Engine

The scoring engine produces a total score from 0 to 100:

`S = DirectionScore + MagnitudeScore + TurningScore + VolatilityScore`

The implementation is a pure TypeScript module with no side effects. It is testable independently from UI or backend state. The module currently passes 107 automated tests across all components.

### 8.1 Component A: Directional Accuracy (0–39 points)

Naive point-by-point sign matching is too noisy. DTC instead uses a multi-scale direction score.

The horizon is split into increasingly fine segments: halves, quarters, eighths. At each scale, the system compares the sign of the net move in each predicted segment against the corresponding actual segment. Coarser scales are weighted more heavily using geometric decay.

`DirectionScore = 39 × Σ(w_l × H_l) / Σ(w_l)`

where `H_l` is the fraction of correctly signed segments at scale level l, and the weight `w_l = decayBase^(maxLevel - l)` so that large structural direction matters more than noise.

**Tuned parameters:** maxScaleLevel = 3, decayBase = 3.0.

### 8.2 Component B: Magnitude Accuracy (0–22 points)

Magnitude accuracy is split into two types of error:

- bias: the prediction is systematically too high or too low
- tracking error: the prediction shape diverges from the realized path even after removing bias

Both are normalized by realized volatility σ so that error is judged relative to how much the market actually moved.

`MagnitudeScore = 22 × exp(-λ × (w_b × |bias|/σ + w_t × RMSE_debiased/σ))`

This distinguishes "I got the path but overshot the level" from "I drew the wrong shape entirely."

**Tuned parameters:** λ = 1.4, biasWeight = 0.3, trackingWeight = 0.7.

### 8.3 Component C: Turning Points (0–34 points)

Turning points carry the most weight in the current configuration. This reflects a key finding from the evolutionary optimizer: predicting the shape and timing of market reversals is the most informative and fairly measurable dimension of path prediction.

The implementation:

1. Smooths both predicted and actual paths with a Gaussian kernel (width = horizon/20 samples).
2. Detects local extrema above a prominence threshold of 0.3σ.
3. Matches predicted extrema to actual extrema using the Hungarian algorithm (optimal bipartite matching).
4. Scores each match by time offset (tolerance = 5% of horizon) and amplitude similarity.
5. Penalizes unmatched predicted turns (hallucinated) and unmatched actual turns (missed).
6. When neither path has detectable extrema (smooth trend), falls back to Pearson correlation between smoothed paths, preventing straight-line predictions from receiving inflated scores.

`TurningScore = 34 × max(0, matchQuality − hallucinationPenalty − missPenalty)`

**Tuned parameters:** smoothingFraction = 0.047, prominenceMultiple = 0.3, timeTolerance = 0.05, hallucinationPenalty = 0.35, missPenalty = 0.08, timeWeight = 0.5, amplitudeWeight = 0.5.

### 8.4 Component D: Volatility Regime (0–5 points)

The horizon is split into four equal quarters. Predicted path volatility is compared with realized path volatility for each quarter.

`VolatilityScore = 5 × exp(-μ × mean(|vol_pred_q − vol_actual_q| / vol_actual_q))`

The evolutionary optimizer substantially reduced the weight of this component from 10 points to 5, reflecting the finding that volatility regime matching provides limited additional signal once direction and turning points are correctly measured.

**Tuned parameters:** μ = 1.0, quarters = 4.

### 8.5 Why these weights: 39 / 22 / 34 / 5

The weights are the result of a genetic evolutionary search across 19,200 candidate configurations, not intuition. The key insight is that getting the shape and reversals right matters far more than hitting exact price levels, and volatility regime adds minimal discriminating power at its previous weight. See Section 9 for the full methodology.

### 8.6 Score interpretation

| Range | Meaning |
|---|---|
| 0–25 | Thesis was meaningfully wrong |
| 25–40 | Weak or partially lucky structure |
| 40–60 | Some useful information content, not payout-profitable |
| 60–80 | Broadly strong forecast |
| 80–95 | Very strong forecast |
| 95+ | Exceptional path accuracy |

The break-even threshold (60) is not the same as "good call." It is the economic threshold where the payout curve crosses from refund to profit.

---

## 9. Scoring Optimization Methodology

DTC has undergone two rounds of rigorous quantitative optimization. This section documents both in full.

### 9.1 Why systematic optimization is necessary

Intuition-derived scoring weights are unreliable. A parameter that seems reasonable in isolation may interact poorly with others. The only honest way to evaluate a scoring configuration is to test it against thousands of real market episodes using known synthetic strategies.

The composite fitness function measures five properties simultaneously:

| Property | Weight | Description |
|---|---:|---|
| Baseline compliance | 40% | Do known-quality strategies score in expected bands? |
| Monotonicity | 20% | Does a slightly better drawing reliably score higher? |
| Score spread | 15% | Does the engine discriminate well between strong and weak forecasts? |
| Component independence | 15% | Are direction and magnitude measuring distinct things? |
| Inverse penalty | 10% | Does an intentionally wrong prediction score near zero? |

A perfect composite score of 100 would mean all five properties are simultaneously met. In practice there are tensions between them.

### 9.2 Phase 1: Parameter sweep

The first optimization pass tested 560 configurations in a three-phase grid search.

**Data**: 2.7 million BTC/USDT 1-minute candles, January 2021 through March 2026 — covering the 2021 bull run, the 2022 bear market, the 2023 recovery, the 2024–2025 bull cycle, and recent conditions.

**Result**: Composite score improved from 77.25 to 82.82 (+5.57).

**Key discoveries**:

- Fewer direction scale levels (3 not 4) are better — the very fine segments add noise
- Higher direction decay base (3.0 not 2.0) correctly emphasizes macro over micro direction
- Stricter turning point time tolerance (0.05 not 0.1) reduces false matches
- Higher hallucination penalty (0.35 not 0.20) correctly punishes predicted turns with no real counterpart
- Lower magnitudeBiasWeight (0.3 not 0.5) correctly de-emphasizes level prediction
- More lenient volatility decay (μ = 1.0 not 1.8) reduces false penalization on regime transitions

### 9.3 Phase 2: Evolutionary algorithm

The second optimization pass explored algorithm variants in addition to parameter values.

**Variant system**: A pluggable architecture was built with 3 variants per component (12 total). New variants implemented include:

- *Direction*: correlationBased (Pearson at multiple scales), dtwDirection (DTW-aligned direction matching)
- *Magnitude*: dtwDistance (DTW-normalized path distance), timeWeightedError (exponential temporal weighting)
- *Turning Points*: crossCorrelation (sliding window on derivatives), simplified (greedy count-based matching)
- *Volatility*: rollingWindow (sliding window correlation), multiScaleVol (multi-scale vol comparison)

**Genetic algorithm**: Population 100, up to 500 generations, tournament selection, uniform crossover, Gaussian mutation, top-5 elitism. 19,200 total configurations evaluated.

**Variant survival analysis**:

| Component | Dominant Variant | Survival Rate |
|---|---|---:|
| Direction | multiScale (original) | 97% |
| Magnitude | biasRmse (original) | 44% |
| Magnitude | timeWeightedError (new) | 40% |
| Turning Points | hungarianMatch (original) | 94% |
| Volatility | multiScaleVol (new) | 56% |

The original algorithms for direction and turning points dominated at 97% and 94%, validating that the existing algorithmic design is sound. The new variants could not beat them.

**Weight discovery** — the most significant finding:

| Component | Previous Weight | Evolutionary Weight | Applied |
|---|---:|---:|---:|
| Direction | 40 | 39.2 | 39 |
| Magnitude | 30 | 21.5 | 22 |
| Turning Points | 20 | 33.9 | 34 |
| Volatility | 10 | 5.5 | 5 |

The turning point component nearly doubled in weight while magnitude was reduced by more than a third. Shape accuracy — predicting reversals correctly — is the most meaningful dimension of path prediction.

### 9.4 Limits of automated optimization

Automated calibration cannot capture whether scores feel intuitively fair, whether a partially correct structural call feels rewarded, or whether scoring behavior shifts during unusual market regimes. The human feedback system (Section 13) addresses this gap.

---

## 10. Calibration and Backtesting

### 10.1 Why calibration matters

If a random drawing can score 55 on average, the system is broken. If a flat line scores almost the same as a strong trend thesis, the system is broken. If near-perfect paths fail to cluster near 100, the system is broken.

### 10.2 Backtest framework

The calibration harness evaluates the scoring engine against 2.7 million BTC/USDT 1-minute candles using synthetic player strategies:

| Strategy | Description |
|---|---|
| Random Walk | Brownian motion path scaled to BTC volatility |
| Flat Line | Predicts no price change |
| Naive Trend | Extrapolates recent momentum linearly |
| Mean Reversion | Predicts return toward recent average |
| Near Perfect | Actual path with 5–20% noise added |
| Perfect | Exact replay of realized path |
| Inverse | Exact mirror (intentionally wrong) |

### 10.3 Validated baseline bands

| Strategy | Target | Status |
|---|---|---|
| Random Walk | 30–35 | Pass |
| Flat Line | 25–35 | Pass |
| Naive Trend | 35–50 | Pass |
| Near Perfect | 98–100 | Pass |
| Inverse | <15 | Pass |

These bands are enforced as automated test assertions. Any scoring change that breaks a baseline fails the test suite.

---

## 11. Payout Engine

The payout curve maps score to multiplier. It is intentionally two-zoned:

- a refund zone below break-even
- a profit zone above break-even

### 11.1 Refund zone

For `x < x_be`:

`M(x) = M_min + (1 - h - M_min) × (x / x_be)^alpha`

A weak but non-zero thesis still recovers part of the stake. The refund zone matches the gradated nature of path prediction.

### 11.2 Profit zone

For `x >= x_be`:

`M(x) = min(M_max, (1 - h) × exp(k × (x - x_be) / (1 - x_be)))`

Convex upside makes strong forecasts matter. The hard cap limits the house's maximum liability per round.

### 11.3 Current parameters

| Parameter | Value |
|---|---:|
| House edge h | 0.02 |
| Break-even score x_be | 0.60 |
| Minimum multiplier M_min | 0.40 |
| Refund exponent alpha | 1.45 |
| Hard cap M_max | 25x |
| Profit growth rate k | 3.25 |

### 11.4 Payout table ($100 stake)

| Score | Multiplier | Payout | P&L |
|---:|---:|---:|---:|
| 0 | 0.40x | $40 | -$60 |
| 20 | 0.52x | $52 | -$48 |
| 40 | 0.72x | $72 | -$28 |
| 60 | 0.98x | $98 | -$2 |
| 70 | 2.21x | $221 | +$121 |
| 80 | 4.98x | $498 | +$398 |
| 90 | 11.22x | $1,122 | +$1,022 |
| 100 | 25.00x | $2,500 | +$2,400 |

---

## 12. House Economics and Bankroll Risk

### 12.1 Monte Carlo payout simulation

A 100,000-round Monte Carlo simulation was run to evaluate the economic sustainability of the payout curve under realistic player skill distributions.

**Skill tier assumptions**:

| Tier | Share | Score Distribution |
|---|---:|---|
| Novice | 40% | Mean 35, σ = 12 |
| Intermediate | 35% | Mean 50, σ = 12 |
| Advanced | 18% | Mean 62, σ = 10 |
| Expert | 7% | Mean 72, σ = 8 |

**Simulation findings**:

- Average house edge under these assumptions: **-7.86%** (negative)
- Expert tier average multiplier: 3.63x
- $100k bankroll ruin probability: 2.3%
- $50k bankroll ruin probability: 96%

**Important caveat**: The skill distributions used in this simulation are deliberately generous. Real early-testing data shows typical players scoring significantly lower — most experienced players average 40–60, not 72. The simulation is therefore a stress test, not a realistic scenario.

The actual house edge under observed real player distributions is expected to be positive. However, the simulation identified a structural vulnerability: if a meaningful fraction of players consistently scored above 65, the current curve would become economically unsustainable.

### 12.2 Required action before production

**The payout curve must be recalibrated based on observed real player score distributions before accepting real-money wagers.** The recommended process:

1. Collect 200+ real rounds from the testing phase
2. Measure actual score distribution across player types
3. Re-run the Monte Carlo with empirically-derived distributions
4. Adjust x_be, k, and M_max until house edge is stably positive under realistic scenarios
5. Re-validate against calibration baselines

### 12.3 Required live controls

The live product must enforce:

- minimum and maximum stake limits per round
- per-round maximum payout reserve
- total reserved exposure across open rounds
- correlation-aware exposure limits by horizon
- automatic throttling when bankroll stress rises
- daily and per-user loss limits

### 12.4 Bankroll correlation risk

If BTC enters a strong clean trend, many players may independently draw similar paths. Those predictions become correlated against the house. The risk is not one player scoring high — it is many players doing so simultaneously.

The live risk engine should track open exposure across all horizon types simultaneously and reserve against directional clustering.

---

## 13. Fairness, Verification, and Human Feedback

### 13.1 Current trust model

The testing product provides:

- deterministic scoring with visible four-component breakdown
- animated reveal showing predicted and actual paths on the same canvas
- replayable historical rounds
- transparent payout curve with preview before submission
- Supabase-backed round persistence with full path storage
- post-round feedback collection

### 13.2 Human feedback system

After each round, players are asked:

- Did the scoring feel fair?
- Self-assessed score (0–100)
- Which component felt wrong, if any?
- Would you bet real money at this scoring?

This data is stored alongside the full round record: predicted path, actual path, score breakdown, market context.

The feedback learning system analyzes accumulated responses to detect:

- correlation between algorithm scores and human self-assessments
- fairness rates by score band
- component complaint rates
- calibration drift

Target: after 50–100 rounds of feedback, run the analysis and make targeted parameter adjustments where algorithmic and human assessments diverge.

### 13.3 Admin dashboard

An operational analytics dashboard at `/admin` provides real-time visibility into:

- fairness vote distribution
- algorithm score vs. self-assessed score scatter plot
- component-level complaint breakdown
- score histogram across all rounds
- difficulty vs. score relationship
- real-money willingness over time
- timeframe distribution

### 13.4 Target live trust model

The live product will settle using a commit-reveal protocol:

1. Before the round begins, the system commits to the round payload using a cryptographic hash.
2. The player submits without seeing future data.
3. After the horizon ends, the system reveals the payload and the realized path.
4. The user can verify that the settled round matches the commitment.

The commitment protocol is already implemented in the sandbox API.

---

## 14. Market Data and Oracle Design

### 14.1 Data requirements

The live settlement path needs reliable timestamped BTC price data, consistent sampling rules, resilience to venue-specific anomalies, and public explainability.

### 14.2 Target live oracle approach

The live product should use an index-style construction:

- sample from multiple liquid venues simultaneously
- median or robust-aggregate the prices
- use short TWAP windows where appropriate
- document the exact sampling cadence publicly

### 14.3 Why oracle quality is critical for path games

A path-scoring game is significantly more sensitive to settlement quality than a simple "final price above threshold" market. Bad data can distort multiple scoring components simultaneously. A single price spike can falsely create or erase turning points, alter magnitude scores, and change volatility sub-scores. The oracle is core game infrastructure, not a peripheral concern.

---

## 15. Product Psychology

### 15.1 A single stroke expresses more than one bet

A drawn path encodes direction, conviction, timing, expected smoothness, and expected expansion or compression. That makes the user's input feel more intelligent than a binary button press.

### 15.2 Bounded loss changes the emotional texture

In leveraged trading, a thesis can be right in spirit and still fail due to leverage, execution, or noise. DTC removes those variables. The user is judged on the thesis path, not on execution mechanics. This creates less frustration from execution details and more focus on whether the read was correct.

### 15.3 It should feel like charting, not like spinning

The product needs candle context, TA tools, dense numerical framing, and a clear before/after comparison. The interface communicates analytical play even though the product settles as a house-vs-player game.

### 15.4 The feedback loop is part of the product

Players who receive a score breakdown can learn. They can replay the round, see where their shape diverged, and form a hypothesis about what they should have drawn. That learning loop distinguishes DTC from pure chance products and is worth designing around explicitly.

---

## 16. Architecture

### 16.1 Frontend

React and TypeScript application featuring:

- lightweight-charts candlestick canvas
- freehand drawing overlay with mouse and touch support
- TA overlays (SMA, EMA, Bollinger Bands, RSI)
- animated score reveal with path comparison
- payout visualization
- post-round feedback form

### 16.2 Scoring module

The scoring engine is a standalone pure module — one of the most important architecture decisions in the project. This enables unit testing in isolation, automated calibration backtesting, the evolutionary optimization pipeline, and future independent verification.

### 16.3 Variant system

The evolutionary optimization work produced a pluggable variant architecture beneath the scoring engine. Each scoring component has a registry of algorithm implementations that can be swapped without changing the public interface. This allows future exploration of new algorithms without disrupting existing tests, A/B testing against human feedback, and self-describing parameter spaces for each variant.

### 16.4 Backend

Node and Express API with Supabase persistence. Exposes health, config, round lifecycle (start, submit, settle), round replay, and verification endpoints. The production backend will add wallet authentication, live oracle integration, and on-chain settlement.

### 16.5 Persistence layer

Supabase stores:

- `rounds`: predicted path, actual path, score breakdown, market metrics, timeframe, anchor price, player session
- `round_feedback`: fairness vote, self-assessed score, component complaint, real-money willingness, notes

---

## 17. Current Product Status

### 17.1 Phase completion

| Phase | Status |
|---|---|
| Scoring Engine | Complete — 107 tests, two rounds of optimization |
| Drawing UI | Complete — freehand, touch, TA overlays, animated reveal |
| Game Loop | Complete — draw → score → payout → feedback |
| Backend | Partial — Supabase persistence, sandbox API; no live settlement |

### 17.2 Optimization milestones

| Milestone | Score | Method |
|---|---:|---|
| Initial implementation | 77.25 | Manual parameters |
| Parameter sweep | 82.82 | 560-config grid search |
| Evolutionary optimizer | ~83.97 | 19,200-config genetic search |

### 17.3 What is strong

- Core mechanic is differentiated and functional
- Scoring engine is implemented, tested, and systematically optimized
- Optimization methodology is documented and reproducible
- Payout curve is explicit and visible before each round
- Calibration baselines pass automated assertions
- Admin dashboard provides real-time scoring behavior monitoring
- Human feedback system is collecting data for the next tuning iteration

### 17.4 What is unfinished

- Live bankroll management and smart contract escrow
- Wallet authentication
- Production oracle integration
- Payout curve recalibration against real player data
- On-chain commit-reveal settlement

---

## 18. Roadmap

### Phase 1: Scoring engine — Complete

Pure scoring functions, calibration harness, 560-config parameter sweep, 19,200-config evolutionary optimizer, variant system.

### Phase 2: Drawing UI — Complete

Freehand capture, normalized constraints, reveal animation, TA overlays, mobile touch support.

### Phase 3: Game loop — Complete

Four-component score output, payout preview, round history, Supabase persistence, human feedback collection, admin analytics dashboard.

### Phase 4: Live infrastructure — In progress

Real-time round lifecycle with production oracle, wallet integration (Base network), on-chain commit-reveal settlement, bankroll management smart contract, payout curve recalibration.

### Phase 5: Depth after core trust

More assets, social sharing and shareable replays, public performance leaderboards, tournaments, advanced round formats.

---

## 19. Risks and Open Questions

### 19.1 Interaction quality

If the input does not feel precise and natural, the product loses credibility immediately.

### 19.2 Scoring opacity

Even deterministic scoring can feel black-box if the user cannot connect the result to the reveal visually.

### 19.3 Payout sustainability

The Monte Carlo simulation identified a structural vulnerability at high player skill levels. Payout recalibration against real player data is mandatory before production.

### 19.4 Oracle quality

Path-based settlement is sensitive to data integrity. Multi-venue index and conservative void/refund policy for anomalies.

### 19.5 Bankroll correlation

Overlapping rounds can become correlated during strong BTC regimes. Reserve accounting and conservative initial exposure limits required.

### 19.6 Fairness perception

Scoring can be technically correct while feeling unfair in edge cases. The human feedback system is designed to surface these and drive iterative adjustment.

### 19.7 Regulatory

DTC sits near gambling, prediction, and market-participation categories. Staged launch, legal review, and geo restrictions required before real-money rollout.

---

## 20. Responsible Use and Compliance Posture

DTC should not present itself as a substitute for investing or financial planning. It is a speculative entertainment product wrapped in a market-native interface.

The live product must include jurisdictional restrictions, age gating, self-exclusion tools, session and stake controls, and clear loss disclosure.

The fact that DTC feels more analytical than a casino product does not remove the need for responsible-use design.

---

## 21. Token Position

DTC does not require a token to work. The core loop stands on its own: draw, score, settle.

Adding a token before product-market fit would distract from the real work: hardening the mechanic, validating the economics, and building trust. Any future token design should be subordinate to the product, not central to it.

---

## 22. Conclusion

Draw The Chart exists because there is a real gap between what crypto users naturally do and what current products let them express.

Users already think in chart paths. They already make scenario calls. They already want the feeling of reading the market without the complexity of leveraged execution or the poverty of binary input.

What distinguishes this version from the original paper is the extent to which the core properties have been tested and optimized. The scoring engine has been subjected to 560 parameter configurations, a 19,200-evaluation genetic search, and is now being tested against real player behavior. That process has produced specific, non-obvious insights: turning point accuracy matters far more than previously assumed, exact price levels matter less, and the volatility regime component provides diminishing returns at its prior weight.

The concept is strong precisely because it is narrow. DTC creates a new product category at the overlap of trading, prediction markets, and social charting: a chart-native prediction game where being analytically right about the path — not just the direction — is the thing that gets rewarded.

The path to credibility remains narrow:

- make the drawing feel excellent
- keep the scoring honest and human-validated
- keep the economics empirically calibrated
- separate sandbox reality from live ambition clearly

---

## Appendix A: Current Timeframe Configuration

| Timeframe | Horizon | Display Candle Interval | Control Points |
|---|---:|---:|---:|
| 15m | 15 minutes | 1m | 8 |
| 1h | 60 minutes | 1m | 12 |
| 6h | 360 minutes | 5m | 16 |
| 24h | 1,440 minutes | 15m | 16 |
| 7d | 10,080 minutes | 1h | 16 |

---

## Appendix B: Current Scoring Parameters

| Component | Parameter | Value |
|---|---|---:|
| Global | Resample points N | 120 |
| Direction (0–39) | maxScaleLevel | 3 |
| Direction | decayBase | 3.0 |
| Magnitude (0–22) | lambda | 1.4 |
| Magnitude | biasWeight | 0.3 |
| Magnitude | trackingWeight | 0.7 |
| Magnitude | volFloor | 1e-8 |
| Turning Points (0–34) | smoothingFraction | 0.047 |
| Turning Points | prominenceMultiple | 0.3 |
| Turning Points | timeTolerance | 0.05 |
| Turning Points | hallucinationPenalty | 0.35 |
| Turning Points | missPenalty | 0.08 |
| Turning Points | timeWeight | 0.5 |
| Turning Points | amplitudeWeight | 0.5 |
| Volatility (0–5) | mu | 1.0 |
| Volatility | quarters | 4 |

---

## Appendix C: Scoring Optimization History

| Version | Method | Composite Score | Notes |
|---|---|---:|---|
| v1.0 | Manual / intuition | 77.25 | Original parameters from product spec |
| v1.1 | 560-config grid search | 82.82 | 3-phase parameter sweep, 2.7M candles |
| v2.0 | Evolutionary optimizer | ~83.97 | 19,200-config genetic search; weight rebalance applied |

---

## Appendix D: Payout Simulation Summary

| Metric | Value |
|---|---|
| Rounds simulated | 100,000 |
| Simulated house edge | -7.86% (generous skill assumptions) |
| Expert tier avg multiplier | 3.63x |
| $100k bankroll ruin probability | 2.3% |
| $50k bankroll ruin probability | 96% |
| Status | Requires recalibration before production |

The simulation assumed expert players (7% of population) with mean score 72. Real testing data suggests typical players score significantly lower. The actual house edge under real distributions is expected to be positive. Empirical calibration using real player data from the testing phase is required before setting production payout parameters.

---

## Appendix E: Production Launch Checklist

The live version of DTC should launch only when all of the following are simultaneously true:

- [ ] Draw interaction is robust across devices, including mobile
- [ ] Scoring model is calibrated and validated against human feedback data
- [ ] Payout curve recalibrated against real observed player score distribution
- [ ] Oracle and settlement pipeline are documented and tested
- [ ] Bankroll risk controls are implemented and enforced
- [ ] Commit-reveal integrity is verifiable on-chain
- [ ] Legal review completed for target jurisdictions
- [ ] Responsible-use controls implemented (self-exclusion, session limits, loss disclosure)

Until all conditions are met, the correct priority is not expansion. It is hardening.
