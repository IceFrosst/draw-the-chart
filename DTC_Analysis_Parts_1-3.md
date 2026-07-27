# Draw The Chart — Deep Analysis & Mechanism Refinement

## Part 1: Brutal Critique

### What's Strong

The core insight is genuinely good: crypto users already draw chart predictions socially, and no product captures that action as a game mechanic. The "one drawing = one thesis" loop is more expressive than binary prediction markets and more accessible than leveraged trading. The psychological framing — people want to feel like they're trading, not gambling — is a real product insight that most crypto gambling products ignore.

The v0.1 draft is structurally sound. The returns-space normalization, commit-reveal scheme, multi-venue oracle index, and two-zone multiplier curve are all correct instincts. The raw notes contain several strong ideas that didn't make it into v0.1 (more on that below).

### What's Weak

**1. The scoring algorithm is underspecified and brittle.**
This is the single biggest weakness. The four-component scoring system (Direction 40, Magnitude 30, Turning Points 20, Shape 10) sounds reasonable in prose but has serious problems:

- **Direction score is noisy at high frequency.** Comparing sign(Δa_i) to sign(Δp_i) at every sample step means that in a 15-minute round with 120 samples (one every 7.5 seconds), most consecutive moves are noise. A random drawing would score ~50% on direction by chance. A flat line would score ~50% too. This means the direction component doesn't differentiate skill from randomness nearly as much as the 40-point weight implies.

- **Turning point detection is fragile.** "Detect turning points on a smoothed series" is hand-waved. What smoothing? What prominence threshold? What matching window? Different choices here produce wildly different scores for the same drawing. This is exactly the kind of thing a sophisticated attacker would probe — submit many drawings targeting the boundary conditions of the turning point detector.

- **The magnitude score punishes everything equally.** RMSE normalized by realized volatility treats a drawing that's consistently 2% too high the same as one that oscillates wildly around the actual path. The first is clearly a better prediction. A directional bias penalty vs. a variance penalty should be separated.

- **Shape score (10 points) is too vague.** "Compare volatility over quarters" is a weak signal. Four quarters is extremely coarse. And what does "penalize mismatch" mean precisely? This component either does almost nothing or does something arbitrary.

**2. The payout curve has no worked examples.**
The two-zone multiplier curve formula is written down, but there's no example calculation showing what a score of 45, 62, 75, or 92 actually pays. Without this, the reader (and any potential builder, investor, or user) can't evaluate whether the economics make sense. The preliminary parameters in the notes (h=2%, x_be=0.62, M_max=50x) should have been accompanied by a table.

**3. The difficulty adjustment is vague and dangerous.**
"Adjust max upside by realized difficulty" sounds smart but creates a serious problem: the difficulty is only known after the round ends. So the player doesn't know their max possible payout when they enter. This contradicts the "transparent multiplier curve" promise. The draft doesn't address this contradiction.

**4. Bankroll risk analysis is shallow.**
The exposure limit formula (max payout = min(stake × M_max_eff, bankroll × L_entry)) is stated but not analyzed. What happens if 50 players simultaneously enter 24h rounds on BTC during a clear trend? They could all score >80. The correlation risk between concurrent rounds is never discussed. The circuit breaker ("pause if net loss exceeds 2% of bankroll in 24h") is a blunt tool — what about a 7-day timeframe where losses arrive after the circuit breaker window?

**5. The competitive landscape section is missing entirely.**
V0.1 never mentions Polymarket, Azuro, prediction markets, Crash games, or any competitor. A whitepaper that doesn't acknowledge the existing landscape looks naive.

**6. No example round walkthrough.**
The draft explains the mechanics abstractly but never walks through a concrete example: "Alice picks BTC/1h, locks at $95,000, draws a path that rises to $95,800 then pulls back to $95,400. BTC actually goes to $96,100 and retraces to $95,700. Her direction score is X, magnitude score is Y, total score is Z, payout is W." This is critical for making the product feel concrete rather than academic.

**7. User psychology section is too thin.**
The "what DTC sells" section is two paragraphs. The raw notes contain a much richer articulation of why this product is psychologically different from binary bets — the "feeling of agency," the comparison to Crash games, the idea that losing 20% of your stake feels different from losing 100%. This deserves a full section.

**8. The compliance section is a placeholder.**
"Legal structuring and licensing remain out of scope" is honest, but the whitepaper should at least discuss the relevant regulatory categories (gambling license, prediction market exemptions, crypto-native jurisdictions) even if it doesn't pick one.

### What Technical Readers Would Attack Immediately

1. "Your direction score is basically a coin flip at high sample rates."
2. "Show me the expected score distribution for a random drawing vs. a flat line vs. a naive trend-follower."
3. "What's the expected house edge after difficulty adjustment? You don't know, because difficulty is post-hoc."
4. "How do you handle correlated risk across concurrent rounds?"
5. "The turning point component is a black box inside a system that claims transparency."

### What From the Raw Notes Deserves Elevation

1. **The friend objections and responses** — these are gold. The objection "players don't know what they can win, scoring feels black-boxy" and the response (sandbox, example drawings, score breakdown) should be in the main whitepaper as a design philosophy section.

2. **The psychological framing note** — "People want to feel like they aren't gambling even though they are. The charting/TA wrapper is part of the product itself, not just a skin." This is the most important product insight in all your notes and it's buried.

3. **The "harder predictions should pay more" idea** — this is essentially the difficulty adjustment done right. Instead of adjusting M_max post-hoc, you reward drawings that predicted unusual moves. This can be folded into the scoring naturally (magnitude score already does this implicitly if realized vol is high and the player matched it).

4. **Stake limits depending on bankroll** — the notes mention $5-10 min, $5k-10k max, "depends on how large the house bankroll is." This is correct and should be formalized as a bankroll fraction rule.

5. **The comparison to Crash games** — DTC is structurally similar to Crash (house vs. player, convex upside, skill-flavored gambling). This is an excellent positioning reference that should be in the whitepaper.

---

## Part 2: Proposed Stronger Structure

### Recommended 10-15 Page Structure

**Title page** — Name, tagline, version, date, disclaimer.

**1. Abstract** (0.5 page) — What DTC is, one paragraph.

**2. The Opportunity** (1–1.5 pages)
- What crypto users already do (draw charts, post TA, argue about price paths)
- Why existing products fail to capture this (binary bets, leveraged trading, prediction markets)
- Brief competitive landscape: Polymarket (binary), Azuro (sports), Crash (house-vs-player but random), leveraged trading (liquidation risk)
- The gap DTC fills: expressive, skill-flavored, repeatable, social

**3. Product Design** (1.5 pages)
- One-line description
- Core loop (select → lock → draw → stake → wait → score → payout)
- Supported assets and timeframes
- House vs. Player model and why
- User psychology: why drawing feels different from betting

**4. Game Mechanics** (2 pages)
- Round lifecycle with concrete example walkthrough
- Start-time fairness mechanism
- Drawing format (control points MVP, freehand later)
- Path representation (returns space)
- Drawing constraints and validation

**5. Oracle and Market Data** (1 page)
- Index construction
- Sampling schedule
- Failure modes and refund policy

**6. Scoring Algorithm** (2–2.5 pages)
- Design principles
- Component scores with formulas AND worked examples
- Score distribution analysis (what does random get? flat line? naive trend?)
- Anti-exploit constraints
- Scoring versioning and upgrade path

**7. Payout Engine and House Economics** (2 pages)
- Multiplier curve with formula AND table of example payouts
- House edge mechanics
- Difficulty adjustment (or argument for why it's deferred)
- Bankroll exposure and risk controls
- Concurrent round correlation risk
- Circuit breakers

**8. Liquidity Vault** (0.5–1 page)
- Purpose and mechanics
- LP risk disclosure
- Withdrawal delay rationale

**9. Trust and Verifiability** (1 page)
- Open-source scoring
- Commit-reveal
- Replayable settlement
- Sandbox/tutorial mode as trust-building

**10. Security and Anti-Cheat** (0.5–1 page)
- Threat model
- Input constraints
- Bot defenses
- Bug bounty

**11. Compliance and Responsible Use** (0.5 page)
- Regulatory positioning
- Geo-blocking
- Age gating
- Responsible gambling controls

**12. Token** (0.25 page)
- Not required; deferred until PMF
- If included, bounded utility only

**13. Roadmap** (0.5 page)
- MVP → V1 → V2 with concrete scope per phase

**14. Key Risks and Mitigations** (0.5 page)
- Table format: risk → mitigation → residual risk

**Appendix A** — Open parameters
**Appendix B** — Concept extensions
**Appendix C** — Preliminary parameter defaults

---

## Part 3: Mechanism Refinement

### Scoring Framework — Refined

The four-component structure is correct in spirit but needs tightening. Here is the refined version:

**Component A: Directional Accuracy (0–40 points)**

The problem with step-by-step sign comparison at high frequency is that it's dominated by noise. Fix: use a **multi-scale direction score**. Split the horizon into segments of increasing granularity (e.g., halves, quarters, eighths, sixteenths) and compare the sign of the net move in each segment. Weight coarser segments more heavily.

Concretely: for scale level l (where l=1 means 2 segments, l=2 means 4, etc., up to L levels), compute the fraction of segments where predicted net move matches actual net move sign. Then DirectionScore = 40 × weighted_average across scales, with weights declining geometrically (coarser = more important). This rewards getting the big moves right more than matching tick-by-tick noise.

**Component B: Magnitude Accuracy (0–30 points)**

Split RMSE into two sub-components:
- **Bias** (mean signed error): measures whether the prediction is systematically too high or too low. Penalizes directional bias.
- **Tracking error** (RMSE after removing bias): measures how well the prediction tracks the actual path's fluctuations.

MagnitudeScore = 30 × exp(−λ × (w_bias × |bias|/σ + w_track × tracking_RMSE/σ))

This separates "I was right about the direction but off on the level" from "I was all over the place." Both matter, but distinguishing them makes the score more interpretable.

**Component C: Timing / Turning Points (0–20 points)**

Replace the vague "detect turning points on smoothed series" with a concrete algorithm:
1. Smooth both series with a Gaussian kernel of width = horizon/20 (fixed, documented).
2. Identify local extrema with prominence > 0.3σ (where σ is realized volatility).
3. Use the Hungarian algorithm to optimally match predicted extrema to actual extrema.
4. Score each match based on time offset (within tolerance = horizon/10) and amplitude similarity.
5. Penalize unmatched predicted extrema (hallucinated turns) and unmatched actual extrema (missed turns).

This is fully deterministic, documented, and auditable.

**Component D: Volatility Regime (0–10 points)**

Replace "compare volatility over quarters" with: split horizon into 4 equal segments. In each, compute realized vol of predicted path and actual path. Score = 10 × exp(−μ × mean(|vol_pred − vol_actual| / vol_actual)). This at least has a concrete formula.

**Baseline analysis (must be published):**
- Random walk drawing: expected score ~30–35.
- Flat line: expected score ~25–35 (depends on market regime).
- Naive trend extrapolation: expected score ~35–50.
- Perfect prediction: score = 100.

These baselines must be computed via simulation on historical data and published alongside the scoring documentation.

### Payout Framework — Refined

The two-zone curve is a good structure. But the difficulty adjustment needs rethinking.

**Pre-round vs. post-round difficulty:**
The fundamental tension is that difficulty (realized volatility) is unknown when the player enters. Two options:

**Option A: No difficulty adjustment at launch.** Calibrate the base curve conservatively enough to handle all regimes. Accept that sideways markets are slightly easier to score well in (since a flat-line prediction does okay). This is simpler, more transparent, and avoids the "I didn't know my max payout" problem. Recommended for MVP.

**Option B: Pre-round difficulty estimate.** Use trailing realized volatility (e.g., last 24h) as a proxy for expected difficulty. Display the effective M_max before the player enters. This is honest because the player sees what they can win. The risk is that vol changes during the round — but that's symmetric risk (could help or hurt).

**Recommendation: Option A for MVP, Option B for V1.**

**Example payout table (using preliminary parameters h=2%, x_be=0.62, M_min=0.30, M_max=50x, alpha=1.8, k=3.93):**

| Score | Multiplier | $100 stake pays |
|-------|-----------|----------------|
| 0     | 0.30×     | $30            |
| 20    | 0.38×     | $38            |
| 40    | 0.57×     | $57            |
| 55    | 0.82×     | $82            |
| 62    | 0.98×     | $98            |
| 70    | 1.30×     | $130           |
| 80    | 2.16×     | $216           |
| 90    | 4.70×     | $470           |
| 95    | 9.20×     | $920           |
| 99    | 32.5×     | $3,250         |
| 100   | 50.0×     | $5,000         |

(These are illustrative. Actual values require simulation calibration.)

### Bankroll / Risk Controls — Refined

**Per-entry cap:** Max payout = min(stake × M_max, bankroll × 0.15%). This means a $1M bankroll caps any single payout at $1,500 regardless of stake × multiplier. If a player stakes $100 and scores perfectly (50×), payout = $5,000 — but only if $5,000 < bankroll × 0.15%.

**Concurrent exposure tracking:** The house must track total potential exposure across all open rounds. If a player enters a 7d round with a $1,000 stake and max payout of $50,000, that $50,000 is reserved against the bankroll immediately. New entries are rejected if total reserved exposure exceeds, say, 10% of bankroll.

**Circuit breakers (layered):**
- Tier 1: If realized net loss in rolling 24h exceeds 1% of bankroll → reduce max stake by 50%.
- Tier 2: If realized net loss exceeds 2% → pause new entries, settle existing rounds normally.
- Tier 3: If realized net loss exceeds 5% → emergency pause, manual review.

**Correlation risk:** During strong trends, many players may submit similar directional predictions and all score well simultaneously. This is the crypto equivalent of "everyone betting on red and winning." Mitigations: the per-entry cap limits individual payouts; the concurrent exposure reserve limits total exposure; and the house edge ensures that over many rounds, the house is profitable in expectation.

### Anti-Exploit Constraints — Refined

Control-point MVP constraints:
1. K control points, where K is fixed per timeframe (e.g., 8 for 15m, 12 for 1h, 16 for 6h+).
2. Time coordinates must be strictly increasing and span the full horizon.
3. First point must be at T0 with value 0 (current price in returns space).
4. Last point must be at T_end.
5. Maximum slope between consecutive points is capped at 3× historical max hourly move for the asset.
6. No two points within horizon/K/2 of each other in time (prevents clustering).

These are simple, documented, and hard to exploit.

### Oracle Design — Refined

No major changes needed. The multi-venue median approach is industry-standard. One addition:

**TWAP sampling:** Instead of point-in-time samples, use short TWAP windows (e.g., 5-second TWAP centered on each sample point). This smooths out microsecond spikes and makes manipulation harder.

**Oracle commitment:** At round start, commit to the oracle configuration (venue list, aggregation method, sampling schedule). This prevents the house from retroactively choosing the oracle that gives a worse score.

### Start-Time Fairness — Refined

The proposed mechanism (next discrete tick boundary) is correct. One refinement:

**Tick boundary should be coarser than the sampling interval.** If samples are every 7.5 seconds, the start tick should snap to the next 15-second or 30-second boundary. This ensures the player doesn't see a partial move between their click and T0. The drawing window W should be at most 60 seconds for ≤1h timeframes and 120 seconds for longer ones.

### Early Cash-Out — Recommendation

**Defer to V1.5 or later.** Early cash-out requires a partial-score model that estimates final score from elapsed data. This is essentially a prediction about the prediction, and getting it wrong (too generous or too stingy) erodes trust. The MVP should be simple: enter, wait, settle. If players want to hedge, they can trade the actual asset.

---

## Summary of Biggest Upgrades vs. v0.1

- Multi-scale direction scoring replaces noisy step-by-step comparison
- Magnitude score split into bias and tracking error
- Turning point detection specified concretely (Gaussian smoothing, Hungarian matching)
- Difficulty adjustment deferred to V1 for transparency (Option A for MVP)
- Payout table with worked examples added
- Concurrent exposure tracking added to bankroll risk controls
- Layered circuit breaker system
- Competitive landscape section added
- Example round walkthrough added
- User psychology elevated to full section
- Baseline score distributions (random, flat, trend) required
- Anti-exploit constraints made concrete (slope caps, spacing rules)

## Biggest Unresolved Decisions

- **Exact payout parameters** — h, x_be, alpha, k, M_max must be calibrated via historical simulation. No shortcut.
- **Oracle venue set** — which exchanges, whether Chainlink is primary or fallback.
- **Bankroll source for launch** — treasury, outside investors, LP vault from day 1?
- **Regulatory jurisdiction** — gambling license, prediction market exemption, or crypto-native jurisdiction?
- **Freehand mode timeline** — when is scoring robust enough to handle arbitrary polylines?
- **PvP mode design** — pool structure, matching, timing (deferred but needs design before V2).
- **Chain selection** — Base is mentioned in notes; needs evaluation against alternatives.
- **Turning point detection parameters** — smoothing width and prominence threshold need tuning.
