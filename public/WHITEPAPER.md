# Draw The Chart

## Whitepaper

Version 1.1  
Date: March 8, 2026  
Status: Sandbox-first product paper

## Disclaimer

This document describes the product vision, current implementation, launch architecture, scoring model, and live rollout design for Draw The Chart (DTC). It is not investment advice, not a promise of future token issuance, and not a solicitation to participate in any regulated product in any jurisdiction where such participation would be restricted.

Where relevant, this paper explicitly distinguishes between:

- what is implemented today in the sandbox product
- what is intended for the live product

That distinction matters. The credibility of DTC depends on being precise about what exists, what is calibrated, and what still needs to be built.

## 1. Abstract

Draw The Chart is a crypto prediction game in which the player expresses a market thesis by drawing the future price path rather than selecting a binary outcome or opening a leveraged position.

A round begins at a fixed market anchor. The player sees the historical BTC chart up to that anchor, then draws an expected future path over a fixed horizon such as 15 minutes, 1 hour, 6 hours, 24 hours, or 7 days. That path is normalized into a valid prediction shape, scored against the realized market path in log-return space, and mapped to a transparent payout curve.

The core idea is simple: crypto users already think in charts, draw scenarios, and debate path shape. Existing products compress that behavior into "up or down," or force the user into a full trading workflow with leverage, liquidation risk, order management, and unnecessary complexity. DTC turns the chart itself into the game object.

The product is designed to sit between prediction markets and trading:

- more expressive than binary prediction markets
- simpler than leveraged trading
- more skill-flavored than pure casino mechanics
- more bounded and transparent than a traditional perp position

The MVP is intentionally narrow. It focuses on BTC only, five fixed horizons, sandbox rounds first, deterministic scoring, and a calibrated payout engine. The hard problem is not adding more assets or screens; it is making the draw-feel, scoring logic, and economic loop trustworthy enough to survive scrutiny.

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

1. Prediction markets  
Strong on event resolution, weak on path expression.

2. Perp DEXs and margin venues  
Strong on execution flexibility, weak on accessibility and bounded simplicity.

3. Social charting  
Strong on expression, weak on economic closure.

4. Casino-style convex products  
Strong on excitement, weak on perceived skill.

DTC combines pieces of all four:

- the expressive input of charting
- the finality of a settled game
- the convex upside of a gambling product
- the market context of trading

This is why the product should not feel like a casino skin wrapped around a random number generator. The chart is not a theme. It is the mechanic.

## 3. Product Definition

### 3.1 One-sentence definition

Draw The Chart is a house-vs-player BTC price-path prediction game where users draw an expected future path and receive a score-based payout.

### 3.2 MVP scope

The MVP is intentionally constrained:

- asset: BTC/USDT
- horizons: 15m, 1h, 6h, 24h, 7d
- chart mode: historical candles plus future draw zone
- prediction input: continuous line, normalized into control points
- settlement mode: historical sandbox first
- score output: 0 to 100 with component breakdown
- payout model: transparent multiplier curve

### 3.3 Current implementation status

As of this version of the paper, the repo implements:

- a standalone pure-function scoring engine
- backtesting on local BTC 1-minute candle data
- calibrated payout curve logic
- sandbox rounds on historical BTC data
- candlestick history and future-zone drawing UI
- deterministic score breakdown and reveal flow
- sandbox API endpoints for round lifecycle testing

The repo does not yet implement:

- wallet connection
- live bankroll-backed settlement
- real-time round orchestration
- persistent user accounts or balances
- production risk controls
- licensed third-party full charting suites

### 3.4 Why the product is house-vs-player

The product is intentionally house-vs-player rather than peer-matched.

That choice has several advantages:

- immediate liquidity
- consistent round availability
- clear exposure accounting
- no dependency on matching opposing views
- simpler product UX

The tradeoff is that the house must actively manage bankroll risk. That is acceptable because DTC is not trying to be a venue for price discovery. It is a structured prediction game with a transparent scoring and payout engine.

## 4. Design Principles

The product is built around seven principles.

### 4.1 Expressiveness over compression

The user should be able to express:

- direction
- timing
- magnitude
- turning points
- volatility structure

If the product reduces all of that to a yes/no choice, it has failed its premise.

### 4.2 Determinism over mystique

Every score must come from documented, deterministic logic. "The engine decided" is not good enough. A user should be able to inspect why a path scored well or badly.

### 4.3 Calibration over intuition

A scoring system that sounds elegant in prose but produces absurd baseline distributions is not valid. DTC treats backtest calibration as a first-class requirement, not a later polish step.

### 4.4 Bounded downside, convex upside

The user should know the downside floor and the upside shape before participating. This is both a product-quality and trust requirement.

### 4.5 Chart feel is product-critical

The drawing interaction is the product. If it feels laggy, unintuitive, or visually fake, the product loses its edge. A weak input experience cannot be rescued by good math.

### 4.6 Transparency about scope

The sandbox, scoring engine, and payout curve should be auditable even before the live product exists. Users should not have to trust future promises in order to understand the present system.

### 4.7 Narrow first, then deepen

BTC only is not a limitation of ambition. It is a deliberate decision to harden the hardest parts first:

- input quality
- scoring validity
- payout economics
- trust model

## 5. Core Product Loop

The player loop is:

1. Select BTC and a timeframe.
2. View the historical chart up to a locked anchor.
3. Enter a stake amount.
4. Draw the expected future path.
5. Submit the prediction.
6. Reveal the realized path.
7. Receive a component score and payout outcome.
8. Replay the round and learn from the result.

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

This is the intended learning loop:

- not merely "won or lost"
- but "which part of the thesis was correct"

## 6. Input Model and Chart Interaction

### 6.1 Why the user draws a line, not candles

The chart history is shown as candles because the market is observed through OHLC data. The prediction is expressed as a continuous path because the thesis is not about future candle opens and closes; it is about expected price movement through time.

The product separates:

- historical market representation
- predictive thesis representation

This is a useful distinction. A player's thesis usually sounds like:

- "push higher first"
- "retest the low"
- "grind sideways then expand"

Those are path statements, not future-candle statements.

### 6.2 Future zone

The input area opens as a fixed future zone to the right of the anchor. This has several purposes:

- it preserves context from the historical chart
- it makes the anchor visually explicit
- it cleanly separates known data from player expression
- it allows reveal animation to happen on the same canvas

### 6.3 Freehand capture and normalized structure

The live interaction captures a freehand stroke first. The system does not score the raw stroke directly. Instead, it normalizes the path into a constrained prediction shape.

This design choice serves two goals at once:

- the interaction can feel fluid and expressive
- the scored output can remain deterministic and resistant to exploitative edge cases

### 6.4 Control-point constraints

The current MVP uses horizon-specific control-point limits:

- 15m: 8
- 1h: 12
- 6h: 16
- 24h: 16
- 7d: 16

The normalized path must satisfy:

- first point fixed at the anchor
- last point fixed at the horizon end
- strictly increasing time
- minimum time spacing between control points
- maximum slope between consecutive points

The max slope is bounded relative to historical BTC hourly movement so that an input cannot jump from a plausible market thesis into absurd vertical spikes.

### 6.5 Technical analysis tools

Technical analysis tools are present because users expect a charting environment to support reference structure:

- trend lines
- rays
- horizontal levels
- Fibonacci tools

These tools are for player interpretation. They are not part of the scored path unless explicitly integrated into a future game mode. That separation matters. The score must be derived from one authoritative prediction path, not from ambiguous layers of annotations.

### 6.6 Why the interface should resemble a market terminal

The TA shell, candles, timeframes, and dense numeric framing are not cosmetic. They create the correct mental model:

- the player is making a market call
- the product is chart-first, not roulette-first
- the outcome should feel reviewable

That said, the interface should not merely mimic a perp DEX. DTC is a distinct product. It should borrow the clarity and density of exchange interfaces while remaining clearly optimized for one action: drawing the forecast.

## 7. Data Model and Path Representation

### 7.1 Log-return space

All scoring is performed in log-return space:

`r(t) = ln(P(t) / P0)`

where:

- `P0` is the round's locked starting price
- `r(T0) = 0`

This choice is important because it makes paths comparable across different BTC price levels. A $500 move means different things when BTC is at $20,000 versus $110,000. Log returns normalize that difference.

### 7.2 Resampling

Both the predicted path and the realized path are resampled to `N = 120` evenly spaced points before scoring.

This standardization solves three problems:

- it makes all horizons comparable under one scoring framework
- it reduces sensitivity to arbitrary draw resolution
- it ensures every scoring component operates on a consistent representation

### 7.3 Market data resolution

The sandbox uses BTC historical data at different display resolutions depending on horizon:

- 1-minute candles for short horizons
- 5-minute candles for 6-hour rounds
- 15-minute candles for 24-hour rounds
- 1-hour candles for 7-day rounds

This keeps the displayed chart legible while preserving meaningful market structure for the timeframe being played.

### 7.4 Display path versus scored path

The product should clearly communicate the difference between:

- the path the user visually drew
- the normalized path that was scored
- the realized path that settled the round

This is why the reveal state benefits from showing:

- the submitted drawing
- the normalized or resampled scored path
- the actual path

That visual separation turns a black-box score into an inspectable result.

## 8. Scoring Engine

The scoring engine produces a total score from 0 to 100:

`S = DirectionScore + MagnitudeScore + TurningScore + ShapeScore`

The implementation is a pure TypeScript module with no side effects. This is deliberate. Scoring should be testable independently from UI or backend state.

### 8.1 Component A: Directional Accuracy (0-40)

Naive point-by-point sign matching is too noisy. A user can match micro-sign changes by accident, especially at high sample rates. DTC instead uses a multi-scale direction score.

The horizon is split into increasingly fine segments:

- halves
- quarters
- eighths
- sixteenths

At each scale, the system compares the sign of the net move in each predicted segment against the corresponding actual segment. Coarser scales are weighted more heavily.

Conceptually:

`DirectionScore = 40 * sum(w_l * H_l) / sum(w_l)`

where:

- `H_l` is the fraction of correctly signed segments at scale level `l`
- `w_l` decays geometrically so that larger structural direction matters more than small noise

This rewards getting the broad thesis right.

### 8.2 Component B: Magnitude Accuracy (0-30)

Magnitude accuracy is intentionally split into two types of error:

- bias: the prediction is systematically too high or too low
- tracking error: the prediction shape diverges from the realized path even after removing bias

Both are normalized by realized volatility so that error is judged relative to how much the market actually moved.

Conceptually:

`MagnitudeScore = 30 * exp(-lambda * (w_b * |bias| / sigma + w_t * RMSE_debiased / sigma))`

This is better than a raw RMSE approach because it distinguishes:

- "I got the path but overshot the level"
- "I drew the wrong shape entirely"

### 8.3 Component C: Turning Points (0-20)

Turning points matter because a market thesis is not only about final direction. Timing of reversals is one of the most visible parts of chart reading.

The current implementation follows a documented structure:

1. Smooth both predicted and actual paths with a Gaussian kernel.
2. Detect local extrema above a prominence threshold tied to realized volatility.
3. Match predicted extrema to actual extrema.
4. Score the matches by time offset and amplitude similarity.
5. Penalize unmatched predicted turns and unmatched actual turns.

This component exists to reward meaningful structural insight without letting a player spray tiny wiggles into the path and receive credit for noise.

### 8.4 Component D: Volatility Regime (0-10)

The horizon is split into four equal quarters. Predicted path volatility is compared with realized path volatility for each quarter.

Conceptually:

`ShapeScore = 10 * exp(-mu * mean(|vol_pred_q - vol_actual_q| / vol_actual_q))`

This rewards matching the rhythm of the round:

- calm then expansion
- steady grind
- front-loaded impulse
- late volatility burst

### 8.5 Why the weights are 40 / 30 / 20 / 10

The weights reflect product priorities:

- direction matters most
- level and shape matter next
- timing of turns is important but should not dominate
- volatility regime is useful but should remain a smaller corrective signal

The weights are not sacred. They are calibrated against baseline behavior. If those baselines drift, the weights and parameters should be re-tuned openly.

### 8.6 Interpretation of score ranges

The score is not meant to be read as a grade in the abstract. It is a settlement metric. Still, the following interpretation is useful:

- 0-25: thesis was meaningfully wrong
- 25-40: weak or partially lucky structure
- 40-60: some useful information content, but not payout-profitable
- 60-80: broadly strong forecast
- 80-95: very strong forecast
- 95+: exceptional path accuracy

The break-even threshold is not the same thing as "good call." It is the economic threshold where the payout curve crosses from refund to profit.

## 9. Calibration and Backtesting

Calibration is central to DTC. A whitepaper claim about scoring quality means very little unless the engine is backtested against non-trivial baseline strategies.

### 9.1 Why calibration matters

If a random drawing can score 55 on average, the system is broken.  
If a flat line scores almost the same as a strong trend thesis, the system is broken.  
If near-perfect paths fail to cluster near 100, the system is broken.

The scoring engine is only valid if it separates signal from common failure modes in a stable and explainable way.

### 9.2 Current backtest framework

The repo includes a backtest harness using local BTC 1-minute candle data and synthetic player strategies. The calibration comments in the scoring config refer to roughly seven months of BTC/USDT 1-minute candles, about 302,000 candles from August 2025 through March 2026.

The harness evaluates the scoring engine across the full horizon set and across strategy archetypes such as:

- random walk prediction
- flat-line prediction
- naive trend extrapolation
- exploratory mean reversion
- near-perfect prediction

### 9.3 Target baseline bands

The intended target bands are:

- random walk: 30-35
- flat line: 25-35
- naive trend extrapolation: 35-50
- perfect prediction: 100

### 9.4 Current calibrated means

The current implementation reports overall means approximately at:

- Random Walk: 35.0
- Flat Line: 25.7
- Naive Trend: 39.5
- Near Perfect: 98.7

These are in-band for the baseline strategies that matter most. The near-perfect strategy is intentionally not a mathematically exact replay of reality, which is why it clusters just below 100 rather than exactly at 100.

### 9.5 What calibration does not solve

Backtests do not guarantee perfect fairness. They do not eliminate:

- regime shifts in BTC behavior
- exploit attempts around input constraints
- user frustration with score interpretation
- operational risk in live settlement

Calibration is necessary, not sufficient.

## 10. Payout Engine

The payout curve maps score to multiplier. It is intentionally two-zoned:

- a refund zone below break-even
- a profit zone above break-even

### 10.1 Refund zone

For `x < x_be`:

`M(x) = M_min + (1 - h - M_min) * (x / x_be)^alpha`

This means the player does not drop immediately to zero for a partially correct call. A weak but non-zero thesis still recovers part of the stake.

### 10.2 Profit zone

For `x >= x_be`:

`M(x) = min(M_max, (1 - h) * exp(k * (x - x_be) / (1 - x_be)))`

This creates convex upside for genuinely strong forecasts while preserving a hard cap on tail exposure.

### 10.3 Current parameter set

The current default configuration is:

- house edge `h = 0.02`
- break-even score `x_be = 0.60`
- minimum multiplier `M_min = 0.40`
- refund exponent `alpha = 1.45`
- hard cap `M_max = 25`
- profit growth `k = 3.25`

### 10.4 Example payout table for a $100 stake

| Score | Multiplier | Payout | Profit / Loss |
| --- | ---: | ---: | ---: |
| 0 | 0.40x | $40.00 | -$60.00 |
| 20 | 0.52x | $51.79 | -$48.21 |
| 30 | 0.61x | $61.23 | -$38.77 |
| 40 | 0.72x | $72.22 | -$27.78 |
| 45 | 0.78x | $78.22 | -$21.78 |
| 50 | 0.85x | $84.53 | -$15.47 |
| 55 | 0.91x | $91.13 | -$8.87 |
| 60 | 0.98x | $98.00 | -$2.00 |
| 70 | 2.21x | $220.85 | +$120.85 |
| 80 | 4.98x | $497.69 | +$397.69 |
| 90 | 11.22x | $1,121.55 | +$1,021.55 |
| 95 | 16.84x | $1,683.65 | +$1,583.65 |
| 99 | 23.30x | $2,330.22 | +$2,230.22 |
| 100 | 25.00x | $2,500.00 | +$2,400.00 |

This parameter set is deliberately friendlier in the middle and stricter in the tail than earlier sandbox versions. On the current economics harness, flat-line predictions average about `0.57x`, random walk about `0.74x`, naive trend about `0.81x`, mean reversion about `0.84x`, and near-perfect paths about `23x` with the cap enforced at `25x`.

### 10.5 Why use a refund zone

The refund zone is not there to make the game soft. It exists because DTC is not a binary proposition. A player can be directionally right, structurally thoughtful, and still fall short of economic profitability.

A partial-refund structure serves several product goals:

- it better matches the gradated nature of path prediction
- it makes weak-but-nonzero insight feel recognized
- it creates a less punishing learning loop than all-or-nothing loss

### 10.6 Why use convex profit

If high-quality predictions only paid linearly, the product would under-reward the behavior it is trying to elicit. Convex upside makes strong forecasts matter.

The cap exists because the house is not an infinite balance sheet.

## 11. House Economics and Bankroll Risk

The live product only works if the payout curve is paired with disciplined bankroll management.

### 11.1 What the house is underwriting

The house is underwriting:

- variance of player skill
- variance of market regime
- correlation across overlapping rounds
- tail risk from very high scores

The live product should never behave as if each round is independent. In crypto, many rounds become correlated during strong directional regimes.

### 11.2 Required live controls

The live system should enforce at least:

- minimum and maximum stake limits
- per-round maximum payout reserve
- total reserved exposure across open rounds
- correlation-aware exposure limits by asset and horizon
- automatic throttling when bankroll stress rises

### 11.3 Why correlation matters

If BTC enters a strong clean trend, many players may independently draw similar upward or downward paths. Those predictions become correlated against the house. The risk is not merely one player scoring 90+. The risk is many players doing so in the same regime.

The live risk engine should therefore reserve against:

- open 1-hour rounds
- open 24-hour rounds
- open 7-day rounds
- clusters of similar directional exposures

### 11.4 Recommended live launch posture

The live launch should be conservative:

- BTC only
- small max stake
- low reserved exposure per round
- hard multiplier cap enforced at settlement
- manual operational monitoring

This is the correct sequence. DTC should not start by pretending to be a high-throughput casino. It should start as a tightly scoped product whose economics remain legible under stress.

## 12. Fairness, Verification, and Settlement

Trust is one of the main failure points for any gambling-adjacent crypto product. DTC should aim for trust through verifiability rather than slogans.

### 12.1 Current sandbox trust model

The current sandbox already provides useful trust-building pieces:

- deterministic scoring
- visible score breakdown
- replayable historical rounds
- transparent payout curve
- API exposure of config and sandbox round states

This allows a skeptical user to understand how the game works before any live money exists.

### 12.2 Target live trust model

The live product should settle using a commit-reveal model:

1. Before the round begins, the system commits to the round payload and start state using a cryptographic hash.
2. The player submits a prediction without seeing future data.
3. After the horizon ends, the system reveals the payload and the realized path used for settlement.
4. The user can verify that the settled round matches the earlier commitment.

### 12.3 Replayability

Each settled round should be replayable with:

- anchor price
- prediction path
- realized path
- scoring breakdown
- payout result
- reveal proof

The goal is that a user can inspect any controversial outcome after the fact rather than appealing to an opaque operator.

### 12.4 Failure handling

The live settlement engine should define explicit policies for:

- missing data
- stale data
- incomplete horizon data
- venue outages
- obviously corrupted samples

The default principle should be conservative:

- if settlement quality is compromised, refund or void rather than force a dubious score

## 13. Market Data and Oracle Design

The sandbox uses local historical BTC data. That is sufficient for calibration and interaction design. The live product will require a stronger data pipeline.

### 13.1 Data requirements

The live settlement path needs:

- reliable timestamped BTC price data
- consistent sampling rules
- resilience to venue-specific anomalies
- public explainability

### 13.2 Target live oracle approach

The live product should use an index-style construction rather than a single venue last trade.

A robust approach is:

- sample from multiple liquid venues
- median or robust-aggregate the prices
- use short TWAP windows where needed
- document the exact sampling cadence

This reduces sensitivity to single-venue spikes and makes the settlement basis easier to defend.

### 13.3 Why this matters

A path-scoring game is more sensitive to settlement quality than a simple "final price above threshold" market. The shape matters. That means:

- bad data can distort several components at once
- path glitches can falsely create or erase turning points
- even short anomalies can change magnitude and volatility sub-scores

The oracle is therefore not a peripheral concern. It is core game infrastructure.

## 14. Product Psychology

DTC is not just a scoring engine. It is a product designed around how users want market participation to feel.

### 14.1 A single stroke expresses more than one bet

A drawn path can encode:

- direction
- conviction
- expected timing
- expected path smoothness
- expected expansion or compression

That makes the user's input feel more intelligent than a binary button press.

### 14.2 Bounded loss changes the emotional texture

In leveraged trading, a thesis can be right in spirit and still fail because:

- leverage was too high
- entry timing was poor
- noise caused liquidation
- risk management was misconfigured

DTC removes many of those variables. The user is judged on the thesis path, not on execution mechanics. That creates a different emotional profile:

- less frustration from execution details
- more focus on whether the read was correct
- stronger replay and learning loop

### 14.3 It should feel like charting, not like spinning

This is why the product needs:

- candle context
- TA support tools
- dense numerical framing
- clear before/after comparison

The interface should communicate analytical play even though the product ultimately settles as a house-vs-player game.

## 15. Architecture

### 15.1 Frontend

The frontend is a React and TypeScript application centered around:

- a chart canvas
- a future-zone draw overlay
- TA overlays
- score reveal states
- payout visualization

### 15.2 Scoring module

The scoring engine is a standalone pure module. This is one of the most important architecture decisions in the project. It enables:

- unit testing
- backtesting
- reproducibility
- future independent verification

### 15.3 Backend

The current backend is a simple Node and Express sandbox API. It exposes:

- health endpoint
- config endpoint
- round start
- round submit
- round settle
- round replay

The current implementation is deliberately in-memory and non-production. Its purpose is to support sandbox workflow validation, not to claim launch readiness.

## 16. Current Product Status

The current state of DTC can be summarized as follows.

### 16.1 What is already strong

- the core mechanic is differentiated
- the scoring engine is implemented and tested
- the payout curve is explicit
- the backtest calibration is in-band on key baselines
- the sandbox flow is credible enough to evaluate the product

### 16.2 What is still unfinished

- live bankroll management
- wallet and balance flows
- persistent accounts
- full settlement infrastructure
- stronger live oracle design
- production operational controls
- a chart stack comparable to licensed exchange-grade chart suites

That last point matters. Many perp venues use TradingView's full charting library stack. DTC currently uses a custom charting stack designed around the draw mechanic. That is the right choice for the MVP, but the product should remain honest about the difference.

## 17. Roadmap

### Phase 1: Scoring engine and backtesting

Completed or substantially completed:

- pure scoring functions
- tests for component behavior
- strategy harness
- baseline tuning

### Phase 2: Drawing UI

Substantially completed in sandbox form:

- candlestick history
- fixed future zone
- freehand prediction capture
- normalized path constraints
- reveal state and comparison

### Phase 3: Sandbox game loop

Implemented in MVP form:

- score output
- payout preview
- round reset and replay behavior
- TA overlays for user guidance

### Phase 4: Live infrastructure

Still to be built:

- real-time round lifecycle
- persistent storage
- wallet integration
- exposure management
- live settlement and payout execution
- verifiable production-grade oracle stack

### Phase 5: Depth after core trust

Only after the live core is trustworthy should DTC expand into:

- more assets
- social sharing
- public leaderboards tied to real performance
- tournaments
- advanced round formats

## 18. Risks and Open Questions

### 18.1 Interaction-quality risk

If the input does not feel precise and natural, the product loses credibility immediately. This is a product-quality risk, not merely a UI polish issue.

Mitigation:

- continued iteration on draw mechanics
- aggressive browser testing
- direct user playtesting

### 18.2 Scoring-opacity risk

Even deterministic scoring can feel black-box if the user cannot visually connect the result to the reveal.

Mitigation:

- component breakdowns
- replay UI
- normalized-path visibility
- public scoring documentation

### 18.3 Oracle-quality risk

Path-based settlement is sensitive to data integrity.

Mitigation:

- multi-venue index
- documented rules
- conservative void or refund policy on anomalies

### 18.4 Bankroll-correlation risk

Overlapping rounds can become correlated during strong BTC regimes.

Mitigation:

- reserve accounting
- stake caps
- live throttles
- conservative initial launch size

### 18.5 Regulatory risk

DTC clearly sits near gambling, prediction, and market-participation categories. Jurisdictional treatment may vary.

Mitigation:

- staged launch
- legal review before real-money rollout
- geo restrictions where required
- responsible-use controls

## 19. Responsible Use and Compliance Posture

DTC should not present itself as a substitute for investing or financial planning. It is a speculative entertainment product wrapped in a market-native interface.

The live product should include, at minimum:

- jurisdictional restrictions
- age gating where required
- self-exclusion tools
- session and stake controls
- clear loss disclosure

The fact that DTC feels more analytical than a casino product does not remove the need for responsible-use design. If anything, it increases the obligation to be explicit.

## 20. Token Position

DTC does not require a token to work.

The core loop stands on its own:

- draw
- score
- settle

Adding a token before product-market fit would likely distract from the real work:

- hardening the mechanic
- validating the economics
- building trust

Any future token design should be considered optional and subordinate to the product, not central to it.

## 21. Conclusion

Draw The Chart exists because there is a real gap between what crypto users naturally do and what current products let them express.

Users already think in chart paths. They already make scenario calls. They already want the feeling of reading the market without necessarily taking on the full complexity of leveraged execution or the poverty of binary input formats.

DTC turns that behavior into a structured game:

- expressive input
- deterministic scoring
- calibrated baselines
- transparent payouts
- replayable outcomes

The concept is strong precisely because it is narrow. It does not try to replace trading, prediction markets, or social charting. It creates a new product category at their overlap: a chart-native prediction game.

The path to credibility is also narrow:

- make the drawing feel excellent
- keep the scoring honest
- keep the economics legible
- separate sandbox reality from live ambition

If those conditions are met, DTC can become a genuinely differentiated crypto product rather than another gambling surface dressed in market language.

## Appendix A: Current Timeframe Configuration

| Timeframe | Horizon | Display Candle Interval | Control Points |
| --- | ---: | ---: | ---: |
| 15m | 15 minutes | 1m | 8 |
| 1h | 60 minutes | 1m | 12 |
| 6h | 360 minutes | 5m | 16 |
| 24h | 1,440 minutes | 15m | 16 |
| 7d | 10,080 minutes | 1h | 16 |

## Appendix B: Current Scoring Parameters

| Component | Parameter | Value |
| --- | --- | ---: |
| Global | Resample points `N` | 120 |
| Direction | Max scale level | 4 |
| Direction | Decay base | 2.0 |
| Magnitude | Lambda | 1.35 |
| Magnitude | Bias weight | 0.5 |
| Magnitude | Tracking weight | 0.5 |
| Turning Points | Smoothing fraction | 0.05 |
| Turning Points | Prominence multiple | 0.3 |
| Turning Points | Time tolerance | 0.1 |
| Turning Points | Hallucination penalty | 0.2 |
| Turning Points | Miss penalty | 0.15 |
| Volatility | Mu | 1.8 |
| Volatility | Quarters | 4 |

## Appendix C: Launch Philosophy

The live version of DTC should launch only when the following are simultaneously true:

- the draw interaction feels robust across devices
- the scoring model remains calibrated under continued backtesting
- the oracle and settlement pipeline are documented
- bankroll risk controls are implemented and enforced
- the product can explain any score it produces

Until then, the correct priority is not expansion. It is hardening.
