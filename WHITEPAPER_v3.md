# Draw The Chart

## Whitepaper v3.0 — Field-Relative Scoring

Version 3.0
Date: June 9, 2026
Status: Architecture specification for the production rebuild

---

## Disclaimer

This document specifies the product vision, the scoring and payout architecture, and the economic model for Draw The Chart (DTC). It supersedes Whitepaper v2.0. It is not investment advice and not a solicitation to participate in any regulated product in any jurisdiction where such participation would be restricted.

Unlike v2.0, this document is written as a **buildable specification**: every formula has defaults, every claim has an acceptance test, and every design decision is justified against measured failures of the previous system. It is intended to be handed to an engineering team (human or AI) and implemented without further design work.

---

## 1. Abstract

Draw The Chart is a crypto prediction game in which the player expresses a market thesis by **drawing the future price path** instead of choosing a binary outcome or opening a leveraged position. The player sees BTC history up to a locked anchor, draws an expected path over a fixed horizon (15m, 1h, 6h, 24h, 7d), stakes an amount, and is paid by how good the prediction was.

Version 3.0 replaces the previous absolute-similarity scoring model with a **three-layer field-relative architecture**:

1. **Layer 1 — Similarity.** A perceptual closeness measure between the drawn path and the realized path, designed to agree with the human eye: tolerant of small timing errors, free of scoring cliffs, free of double penalties.
2. **Layer 2 — Percentile.** The player's similarity is ranked against a **synthetic field**: ~1,500 zero-information baseline paths (random walks, flat lines, trend extrapolations, mean reverters, bootstrapped history) generated deterministically from the round's commitment hash and scored against the same realized path. The player's result is a percentile: *"You beat 87% of the field."*
3. **Layer 3 — Payout.** The multiplier is a published function of the percentile, constructed so that its average over the percentile range is exactly `1 − h`. A player with no predictive skill earns a uniformly distributed percentile, so **the house edge `h` holds exactly, by construction, in every market regime** — it is a design constant, not an emergent accident of parameter tuning.

This architecture simultaneously fixes the two failures observed in the v0.2 testing phase: scores that feel arbitrary to players (random drawings sometimes outscoring visually close ones), and a payout curve with a *negative* expected house edge.

---

## 2. The Product

### 2.1 Why this product should exist

Crypto users already perform the core DTC action informally: they draw trend lines and target paths, post "BTC to here first, then retrace" scenarios, and argue about timing, not just direction. The behavior is already a game; no product captures it natively.

Existing products compress or complicate the thesis:

- **Prediction markets** reduce a path thesis to yes/no. "Rallies first, fades, finishes slightly above" becomes "above X by date Y?" — the nuance is discarded.
- **Perpetual trading** captures more but demands leverage selection, position sizing, liquidation management, and execution skill. A thesis can be right and still lose to mechanics.
- **Casino-style products** (e.g., Crash) offer convex payouts and immediacy but remove analytical agency.

DTC occupies the gap: house-vs-player simplicity, chart-native input, deterministic scoring, bounded downside, convex upside, replayable outcomes. The chart is not a theme; it is the mechanic.

### 2.2 One-sentence definition

DTC is a house-vs-player BTC price-path prediction game where users draw an expected future path and receive a payout based on how much of the simulated field of naive forecasts they outperformed.

### 2.3 The core loop

1. Select BTC and a timeframe.
2. View history up to a locked anchor; the round is committed cryptographically.
3. Enter a stake.
4. Draw the expected path; submit.
5. The horizon elapses (or replays instantly in sandbox).
6. Reveal: realized path animates in, the synthetic field renders as a translucent band, the player's rank within the field counts up.
7. Payout: percentile → multiplier → settlement.
8. Replay and compare: the player can inspect the field paths that beat them.

The reveal in step 6 is the signature product moment. "You beat 1,289 of 1,500 simulated traders — top 14% — 1.66×" is more legible, more credible, and more shareable than an opaque "score: 61/100."

### 2.4 Design principles (carried forward and extended)

1. **Expressiveness over compression** — direction, timing, magnitude, and structure are all expressible in one stroke.
2. **Determinism over mystique** — every number on screen is reproducible from public code, the committed round payload, and the realized prices.
3. **Fairness is perceptual, not just statistical** — if a drawing that looks better scores worse, the system is wrong even if its math is internally consistent. This is now an acceptance-tested requirement (Section 10), not an aspiration.
4. **The house edge is a constant, not a hope** — economics must hold by construction under a zero-skill null, with skill exposure measured and bounded separately.
5. **Bounded downside, convex upside** — known floor, published curve, capped maximum.
6. **Chart feel is product-critical** — the drawing interaction is the product. (The v0.2 drawing UI is validated and carries over unchanged.)
7. **Narrow first** — BTC only, five horizons, until scoring fairness and economics are proven with real users.

---

## 3. What v0.2 Taught Us (Post-Mortem)

The v0.2 engine implemented four absolute similarity components (Direction 39, Magnitude 22, Turning Points 34, Volatility 5), tuned through a 560-configuration sweep and a 19,200-evaluation genetic search against 2.7M historical 1-minute candles. All 108 automated tests pass. The code is correct; **the model is wrong**. Real-user testing surfaced the exact failure the architecture predicts: visually close drawings sometimes lose to random scribbles.

### 3.1 Measured failures

A probe against the full 2021–2026 dataset (1,500 rounds across all five timeframes, `scripts/fairnessProbe.ts`) compared "visually close" drawing archetypes against pure random-walk drawings under the deployed config:

| Archetype (visually close drawing) | Mean score | 5th pct | Median | Random walk **beats it** head-to-head |
|---|---:|---:|---:|---:|
| Lagged copy (reality shifted 8% of horizon) | 59.1 | 34.5 | 60.5 | **6.9%** of rounds |
| Damped copy (right shape, 70% amplitude) | 80.2 | 58.1 | 82.9 | 0.3% |
| Time-warped copy (turns mistimed ±7%) | 75.4 | 53.1 | 77.8 | 0.7% |
| Smoothed copy (right macro shape) | 68.3 | 41.8 | 70.3 | 2.9% |
| *Random walk baseline* | *30.2* | *8.6* | *27.9* | — |

Two facts stand out:

- A drawing that is a **near-perfect copy of reality, merely 8% late**, scores in the 30s in its worst 5% of rounds — indistinguishable from a random scribble — while a random scribble reaches 54.7 at its 95th percentile. One round in fourteen, the scribble wins outright. This is precisely the "random beats close" complaint from testers.
- The same fixed drawing quality produces wildly different scores depending on the round's market regime. **Score variance is dominated by the market, not the player.**

Separately, the 100,000-round Monte Carlo payout simulation measured an expected house edge of **−7.86%**, with the expert tier extracting 3.63× average multipliers, and bankroll ruin probabilities of 100%/96% at $10k/$50k.

### 3.2 Root causes

**D1 — Absolute scores are regime-relative.** Every error is normalized by realized volatility σ of the round. In a quiet round, σ is tiny, so a visually fine drawing produces enormous normalized errors and a low score; in a violent round, a sloppy drawing scores well. The human eye judges closeness in price space; the engine judges it in σ-units that change every round. No constant parameters can fix this, because the correct normalization *is the round itself*.

**D2 — Turning-point cliffs and double jeopardy.** The heaviest component (34 pts) matches predicted extrema to actual extrema with a hard time tolerance of 5% of the horizon and hard cost cutoffs. A single turn mistimed by 7% of the horizon falls off the cliff: it is counted **both** as a hallucinated turn (−0.35 penalty) **and** as a missed actual turn (−0.16), destroying ≈ 17 of 34 points for one slightly-late reversal. Meanwhile a drawing with *no* turns pays only the small miss penalty per actual turn. The optimal strategy under this rubric is to draw less detail — the opposite of the product's premise. This is why the damped copy (mean 80.2) crushes the lagged copy (59.1): the engine punishes a small timing error roughly four times harder than a 30% amplitude error, while the human eye barely notices the former.

**D3 — Correlated components double-count errors.** Direction × Magnitude correlation is 0.77–0.86. The same mistake is penalized in multiple components, amplifying regime luck and making the 100-point breakdown misleading as an explanation.

**D4 — The deployed config is an unvalidated hybrid.** The live parameters combine the grid-sweep optimum (tuned for weights 40/30/20/10, e.g. timeTolerance 0.05, hallucinationPenalty 0.35) with the genetic optimizer's *weights* (39/22/34/5) — but the genome that justified those weights used entirely different turning-point parameters (timeTolerance 0.19, hallucinationPenalty 0.05) and itself exhibited a 22% monotonicity violation rate. The combination shipped without re-auditing. This is not a process accident to be fixed by more discipline; it is evidence that a 16-parameter coupled objective is too fragile to govern money.

**D5 — Payout is decoupled from the score distribution.** The curve maps score → multiplier with hand-set break-even (60) and growth constants. Nothing ties the curve to the actual achieved score distribution, so the edge is an emergent property that silently changes whenever scoring is retuned or the market regime shifts. The measured result was a negative edge. Calibrating the curve to "observed player scores" (the v2.0 plan) would chase a moving target forever.

### 3.3 The meta-lesson

All five defects share one root: **the score tried to be an absolute measure of forecast quality, but both fairness and economics are relative questions.** "Was this a good drawing?" only has a meaning relative to *what was achievable in this round*, and "what should it pay?" only has a meaning relative to *what a no-skill player would have earned*. Version 3.0 makes both comparisons explicit and exact.

What v0.2 validated and v3.0 keeps: log-return space, N=120 resampling, the pure-function scoring module pattern, the multi-scale direction idea (97% survival in the genetic search), the drawing UI, commit-reveal, the Supabase feedback loop, and the backtesting harness with 2.7M candles of data.

---

## 4. Architecture Overview

```
                       ┌──────────────────────────────────────────┐
 player's drawing ───► │ LAYER 1: Similarity S ∈ [0,100]          │──► shown as "Accuracy"
 realized path    ───► │ perceptual, smooth, time-tolerant        │    + component breakdown
                       └────────────────────┬─────────────────────┘
                                            │ same metric applied to…
                       ┌────────────────────▼─────────────────────┐
 commit hash ────────► │ LAYER 2: Synthetic field (B ≈ 1,500      │──► percentile U ∈ (0,1)
 (deterministic seed)  │ zero-information paths) scored against   │    "beat 87% of field"
 anchor market state ─►│ the same realized path; rank the player  │
                       └────────────────────┬─────────────────────┘
                                            │
                       ┌────────────────────▼─────────────────────┐
 stake ──────────────► │ LAYER 3: Payout M(U), ∫₀¹M(u)du = 1−h    │──► settlement
                       │ exact house edge under zero-skill null   │
                       └──────────────────────────────────────────┘
```

**Why this fixes D1:** the field experiences the same round, the same σ, the same trendiness. If the round was easy, the field also scores high and the bar rises. Difficulty normalization is automatic and exact — no difficulty parameter exists to mistune.

**Why this fixes D2/D3:** Layer 1 no longer needs to be a perfectly calibrated absolute grade; it only needs to *rank* closeness the way a human would. That allows a radically simpler, smoother metric with no cliffs. The detailed turning-point analysis survives as an explanation overlay in the reveal UI, where it belongs — it just doesn't move money anymore.

**Why this fixes D4:** Layer 1 has ~6 parameters instead of 16, and miscalibrating them degrades *display quality*, not economics. The economically load-bearing object is the percentile, which is parameter-light (field composition + B).

**Why this fixes D5:** Layer 3's expected multiplier is an integral the house chooses. Under the null hypothesis "the player has no edge over the field," U is uniform, so the expected payout is exactly `1 − h` per round, in every regime, before any skill. The only residual house risk is *genuine player skill*, which is measurable (Section 8.3) and bounded by caps.

**Player legibility:** percentile is the most intuitive score that exists ("top 14% of the field"), and it doubles as an honest difficulty display: the UI can show the field's path band while drawing, so the player sees what they must beat.

---

## 5. Layer 1 — Similarity Model

### 5.1 Representation (unchanged from v0.2)

- All paths are converted to log-return space: `r(t) = ln(P(t)/P0)`, anchored `r(T0) = 0`.
- Predicted and realized paths are resampled to **N = 120** evenly spaced points by linear interpolation.
- The drawing UI's normalization (control points, slope caps, spacing rules) carries over unchanged from v0.2 (Appendix C).

### 5.2 Effective volatility (fixes D1 within Layer 1)

All normalizations use a **hybrid effective σ**:

```
σ_eff = max(σ_realized, 0.5 × σ_typical(timeframe))
```

where `σ_realized = std(actual resampled path)` and `σ_typical(timeframe)` is the trailing 30-day median of `σ_realized` for that horizon, published per round. This prevents abnormally quiet rounds from exploding normalized errors. (Layer 2 removes most regime sensitivity anyway; σ_eff keeps the *displayed* accuracy stable too.)

### 5.3 Component S1 — Shape & Timing (0–50 points)

Replaces both the turning-point component and the tracking-error half of magnitude. Uses **banded Dynamic Time Warping**, which is the formal version of what the human eye does: it aligns the two paths allowing small timing shifts, then measures remaining distance.

- Compute DTW distance `D` between predicted and actual resampled paths with a Sakoe-Chiba band of `w = 12` samples (= 10% of the horizon). Within the band, timing shifts cost nothing extra; alignment beyond the band is impossible, so larger mistimings show up as amplitude error — a smooth, monotone degradation with no cliff.
- Normalize: `d = D / (N × σ_eff)`.
- Score: `S1 = 50 × exp(−λ_shape × d)`, default `λ_shape = 2.2`.

Properties: a lagged copy (lag ≤ 10% of horizon) scores near-perfect on S1, as it should; a mistimed turn loses credit *continuously* in proportion to how mistimed it is; there is no hallucination/miss double-counting because DTW has no discrete "turn objects."

Implementation note: standard O(N·w) DTW with the band; at N=120, w=12 this is ~1,400 cells — microseconds.

### 5.4 Component S2 — Direction (0–30 points)

Multi-scale net-move sign agreement (the v0.2 design that won the genetic search), with one fix: **segments are weighted by the size of the actual move**, eliminating coin-flip noise on segments where the market barely moved (and eliminating the `NEUTRAL_PREDICTION_CREDIT` special case entirely).

For scale levels `l = 1, 2, 3` (halves, quarters, eighths):

```
H_l = Σ_seg |Δa_seg| × 1[sign(Δp_seg) = sign(Δa_seg)]  /  Σ_seg |Δa_seg|
S2  = 30 × Σ_l w_l × H_l / Σ_l w_l,   w_l = 2.5^(3−l)
```

where `Δp_seg`, `Δa_seg` are net predicted/actual moves over the segment. A flat prediction gets no special credit and no special penalty: its sign matches nothing, but on segments where the market didn't move, the weight is ~0 anyway.

### 5.5 Component S3 — Level (0–20 points)

The bias half of the old magnitude component, plus explicit endpoint credit (players care a lot about "where it ends"):

```
bias  = |mean(p_i − a_i)| / σ_eff
end   = |p_N − a_N| / σ_eff
S3    = 20 × exp(−λ_level × (0.5 × bias + 0.5 × end))      λ_level = 1.2
```

### 5.6 Total and design rules

```
S = S1 + S2 + S3   ∈ [0, 100]
```

The volatility-regime component is **deleted** (the genetic search already drove it to 5 points; DTW shape distance subsumes most of its signal).

Three rules are binding on any future modification of Layer 1:

1. **No hard thresholds.** Every penalty must be a smooth function of error.
2. **No double-counting.** Each error type (timing, amplitude, direction, level) is penalized in exactly one component.
3. **Component correlation under the audit harness must stay < 0.7.** (S1/S2/S3 measure warped distance, signed structure, and level — empirically far less correlated than the old set; the audit asserts it.)

The Hungarian turning-point matcher from v0.2 is retained in the codebase as a **reveal-screen explainer** ("you called this top 9 minutes early") — it annotates, it does not score.

### 5.7 Role of Layer 1 in the economics

None, directly. Layer 1's only economic job is to **rank** paths sensibly — money flows through the percentile. This is why its 6 parameters (λ_shape, λ_level, band w, decay 2.5, and the 50/30/20 split) can be tuned for *human agreement* (Section 10.5) without ever touching the house edge.

---

## 6. Layer 2 — The Synthetic Field

### 6.1 Definition

For each round, generate `B = 1,500` baseline paths from the **field generator** `G(anchor state, seed)`. Score every field path with Layer 1 against the realized path, exactly as the player is scored. The player's result is the mid-rank percentile:

```
U = (#{field paths with S below player} + 0.5 × #{ties}) / B
```

`U ∈ (0,1)` with resolution 1/1500. Display as "You beat ⌊100·U⌋% of the field."

### 6.2 Field composition — the zero-information portfolio

The field must contain **every strategy a player without market insight could play**. This is the anti-exploit core: if a naive strategy is *in* the field, playing it earns a ~uniform percentile and therefore exactly the house edge. The default mixture:

| Share | Generator | Description |
|---:|---|---|
| 40% | Conditional block bootstrap | Contiguous blocks (length = horizon/8) of 1-minute log-returns sampled from the trailing 30 days, rescaled to EWMA vol (λ=0.94) at the anchor. Carries realistic fat tails, clustering, and microstructure. |
| 20% | GBM | Zero-drift geometric Brownian motion at EWMA anchor vol. |
| 15% | Trend extrapolators | Linear log-drift continuation of the lookback window over {0.5×, 1×, 2×} the horizon, each with bootstrap noise; includes damped (0.5×) and overshoot (1.5×) variants. |
| 10% | Mean reverters | Pull toward the lookback mean with OU-style reversion at 2–3 speeds, plus noise. |
| 10% | Flat & drift lines | Flat line, ±0.25σ and ±0.5σ end-drift lines, with small noise. |
| 5% | Smoothed/lagged replays | Heavily smoothed and slightly lagged transforms of bootstrap paths — populates the "looks plausible, low detail" region. |

All generator code, parameters, and the mixture are public and versioned (`field-v1`). Changing the field is a versioned event, never retroactive.

**Why the mixture matters:** a pure-GBM field would be beatable by playing "the center" (a flat-ish line is closer to a random target than a random draw is, on average) or by free-riding on momentum if returns trend. With flat lines, trend followers, and mean reverters *inside* the field, every such shortcut competes against itself. The field is the house's market model; if observed players systematically beat it, the honest response is to upgrade the field (Section 8.3), not to quietly re-tune scoring.

### 6.3 Determinism and verifiability

- Seed: `seed = SHA256(roundCommitment ‖ "field-v1")`, where `roundCommitment` is the existing commit-reveal hash published *before* the player draws. The player cannot know the field's realizations (they depend on the seed and the generator, and matter only relative to the unknown realized path); the house cannot regenerate a friendlier field (the seed is committed).
- After settlement, anyone can re-derive all 1,500 paths, re-score them, and reproduce `U` and the payout from published code. Settlement is a pure function: `settle(commitPayload, drawnPath, realizedPrices) → (S, U, M)`.
- Cost: 1,500 paths × (generation + Layer-1 scoring at N=120) ≈ low milliseconds in native JS/TS; trivially parallel.

### 6.4 Calibration requirement (acceptance-tested)

Run the historical harness (2.7M candles, all timeframes). For **each** named zero-information strategy (flat, RW, trend, mean-revert, damped/lagged variants), played as if by a player:

- `E[U] ∈ [0.45, 0.55]`
- `E[M(U)] ∈ [1−h−0.02, 1−h+0.01]`

If any naive strategy escapes this band, the field is missing a member or mis-weighted. This replaces v0.2's brittle "score band" baselines (RW 30–35, etc.) with a test that directly asserts the economic property we actually need.

### 6.5 What the player sees

- **While drawing:** an optional translucent "field band" (the 10th–90th percentile envelope of field paths) drawn from the *previous* round's generator parameters — an honest visualization of expected difficulty. (The current round's exact field is seed-committed but not displayed pre-draw, to keep mimicry uninteresting.)
- **At reveal:** realized path animates; the field renders as a faint swarm; the player's drawing is highlighted; a counter ranks them; the 2–3 field paths just above and below them are inspectable ("here is the bootstrap path that beat you").

---

## 7. Layer 3 — Payout

### 7.1 Curve family

Percentile → multiplier, three zones, published before every round:

```
Refund zone   (u < u_be):   M(u) = m_min + (1 − m_min) × (u / u_be)^α
Profit zone   (u_be ≤ u < u_J):   M(u) = exp(g × (u − u_be))
Jackpot zone  (u ≥ u_J):    M(u) = M(u_J) + (u − u_J)/(1 − u_J) × (M_max − M(u_J))
```

Continuous everywhere, `M(u_be) = 1` exactly (break-even at the published percentile). Given `h, u_be, m_min, α, u_J, M_max`, the growth rate `g` is **solved numerically** so that:

```
∫₀¹ M(u) du = 1 − h        (exact house margin under the zero-skill null)
```

The solver (bisection on the closed-form-integrable pieces) is part of the codebase; the resulting `g` is published per curve version.

### 7.2 Named profiles (solved, exact)

| | **Balanced** | **Standard** (recommended) | **Jackpot** |
|---|---:|---:|---:|
| House edge h | 4% | 4% | 5% |
| Break-even percentile u_be | 0.75 | 0.80 | 0.88 |
| Floor m_min | 0.20× | 0.15× | 0.10× |
| Refund exponent α | 1.6 | 1.8 | 2.0 |
| Jackpot zone starts u_J | — | 0.99 | 0.995 |
| Cap M_max | ~4.5× | 12× | 30× |
| Solved g | 5.988 | 9.094 | 21.234 |
| **E[M] (null)** | **0.9600** | **0.9600** | **0.9500** |
| SD of M per round | 0.95 | 1.34 | 2.16 |
| Rounds profitable (null) | 25% | 20% | 12% |

Standard profile payout table (per $100 stake, zero-skill expectations):

| Percentile U | Multiplier | Payout | P&L |
|---:|---:|---:|---:|
| 0.10 | 0.17× | $17 | −$83 |
| 0.25 | 0.26× | $26 | −$74 |
| 0.50 | 0.52× | $52 | −$48 |
| 0.65 | 0.74× | $74 | −$26 |
| **0.80** | **1.00×** | **$100** | **$0** |
| 0.85 | 1.58× | $158 | +$58 |
| 0.90 | 2.48× | $248 | +$148 |
| 0.95 | 3.91× | $391 | +$291 |
| 0.99 | 5.63× | $563 | +$463 |
| 0.999 | 11.36× | $1,136 | +$1,036 |
| 1.000 (best of field) | 12.00× | $1,200 | +$1,100 |

The jackpot zone gives "I beat the entire field" rounds a memorable payoff while contributing only ~1% of the curve's mass; the integral constraint absorbs it exactly.

### 7.3 Properties

- **Exact edge:** under the null (player exchangeable with field), `U` is uniform on the 1/B grid, so `E[M] = (1/B) Σᵢ M((i+0.5)/B) = 1 − h` up to < 0.1% discretization, every round, every regime.
- **Retuning-safe:** changing Layer 1 or the field re-shapes *who* gets which percentile, never the expected payout under the null. Scoring iteration is decoupled from solvency.
- **Bounded liability:** worst case per round is `(M_max − 1) × stake`, reserved at entry (Section 8.4).
- **Skill pays from a known budget:** a player who genuinely shifts their percentile distribution right is paid for it — that is the product promise — and the aggregate cost of skill is directly observable as `E[M_observed] − (1−h)` (Section 8.3).

---

## 8. House Economics and Risk

### 8.1 Per-round accounting

For stake `s`, house P&L per round is `s × (1 − M(U))` with `E = s·h` and `SD = s × SD[M]` (1.34 for Standard). All quantities are known in closed form before launch — no Monte Carlo dependence on guessed "skill tiers."

### 8.2 Stake caps and bankroll sizing (Kelly)

With edge `h` and variance `Var[M]`, the full-Kelly stake fraction is ≈ `h / Var[M]` of bankroll; DTC operates at **quarter-Kelly**:

| Profile | Full Kelly | Quarter-Kelly (operating cap) | Max stake at $250k bankroll |
|---|---:|---:|---:|
| Balanced | 4.45% | 1.11% | $2,780 |
| Standard | 2.23% | 0.56% | $1,400 |
| Jackpot | 1.07% | 0.27% | $675 |

Additional hard rules:

- Per-round reserved liability: `M_max × stake` is locked from the bankroll at entry; entries are rejected when **total reserved exposure > 25%** of bankroll.
- Horizon-bucket exposure: reserved exposure within any single horizon bucket (e.g., all open 24h rounds) ≤ 10% of bankroll, because same-horizon rounds settle on correlated market segments.
- Per-user daily stake and loss limits (responsible-use, Section 12).

### 8.3 Skill premium monitoring — the only real risk

The single residual economic risk is genuine, persistent player skill: a population whose `E[U] > 0.5`. Governance:

- Track rolling `Ē[U]` and realized margin `1 − M̄` overall, per horizon, per cohort, with confidence intervals (n is large; drift detection is fast).
- **Green:** realized margin ≥ h/2 → no action.
- **Yellow:** margin ∈ (0, h/2) for a 2-week window → publish notice; raise `u_be` by 0.02 or `h` by 1pt at the next curve version.
- **Red:** margin ≤ 0 → cap stakes at the floor minimum and ship a field upgrade: add generators that capture whatever structure players are exploiting (e.g., momentum-conditional bootstrap if trend-followers are winning). Upgrading the field raises the bar for everyone *honestly* — the exploited signal becomes table stakes.
- All changes are versioned, announced, and never retroactive to open rounds.

This converts "experts bleed the house −263%" (v0.2's emergent disaster) into a measured, bounded, governable quantity.

### 8.4 Layered circuit breakers (carried from v2.0, now with exact triggers)

- Tier 1: rolling 24h realized net loss > 1% of bankroll → halve max stakes.
- Tier 2: > 2% → pause new entries; settle open rounds normally.
- Tier 3: > 5% → emergency pause, manual review, public incident note.

Because `SD[M]` is known, these thresholds correspond to computable z-scores given volume — triggers fire on genuine anomalies, not normal variance.

---

## 9. Game Integrity

### 9.1 Commit-reveal (extended)

Pre-round commitment now covers: anchor timestamp and price source config, horizon, scoring version, Layer-1 parameters, field generator version and mixture, payout curve version and solved `g`, and the field seed derivation rule. Post-settlement, the full payload is revealed; any party can recompute `S`, `U`, and `M` bit-for-bit.

### 9.2 Oracle

Index-style settlement price: median across ≥3 liquid venues, 5-second TWAP windows centered on each 1-minute sample, sampling schedule published in the commitment. Anomaly policy: if any venue deviates > 1.5% from the median during the round, it is dropped for those samples; if fewer than 2 venues remain valid for > 5% of samples, the round is **voided and fully refunded**. Path-scored games are more oracle-sensitive than endpoint markets — a single spoofed spike could create or erase structure — hence median + TWAP + void policy.

### 9.3 Threat model

| Attack | Defense |
|---|---|
| Play a naive archetype (flat, trend, center-of-mass) | It's in the field → E[M] = 1−h. Loses the edge like everything else. |
| Probe scoring cliffs with crafted paths | No cliffs exist; Layer 1 is smooth everywhere; money flows through rank, not raw score. |
| Regime sniping (only play quiet/volatile rounds) | Field is conditioned on the same regime; percentile difficulty is invariant. |
| Predict the field instead of the market | Field realizations depend on the committed seed (unknown pre-draw) and payout depends on rank against the *realized* path; mimicking the field's center is the naive-archetype case above. |
| House regenerates a friendlier field | Seed bound to pre-round commitment; settlement reproducible by anyone. |
| Multi-account spray (many accounts, random distinct drawings) | Each account independently faces E[M] = 1−h; spraying has negative EV. Caps + KYC tiers limit residual correlation abuse. |
| Genuine alpha (real forecasting skill) | The product pays it on purpose, within stake caps, monitored via skill premium governance (8.3). |
| Latency sniping (draw with newer info than anchor) | Anchor locks at commitment; draw window ≤ 60–120s; submissions hash the drawn path with a client timestamp inside the window. |

---

## 10. Validation Protocol (Acceptance Tests for the Rebuild)

These are the conditions under which the v3.0 engine is considered working. Each becomes an automated suite in CI; all run against the 2.7M-candle historical dataset.

**V1 — Zero-skill neutrality (economics).** Every named zero-information strategy, played as a player over ≥ 2,000 rounds per timeframe: `E[U] ∈ [0.45, 0.55]` and `E[M] ∈ [1−h−0.02, 1−h+0.01]`. *(Replaces the old score-band baselines.)*

**V2 — Perceptual monotonicity (fairness).** Build a graded distortion ladder from the realized path: lag ∈ {0, 4, 8, 12}% of horizon; amplitude ∈ {100, 85, 70, 50}%; warp ∈ {0, 4, 7, 10}%; additive noise ∈ {0, 0.25, 0.5, 1.0}σ. Requirements: (a) mean `U` strictly decreases along every ladder; (b) head-to-head inversion rate vs. a random-walk drawing, for any "visually close" archetype (lag ≤ 8%, amp ≥ 70%, warp ≤ 7%): **< 1%** (currently 6.9% for lag — the headline bug); (c) lagged copy at 8% must keep `E[U] ≥ 0.90`.

**V3 — Skill responsiveness (the game is winnable by insight).** Construct partial-information oracles: knows-direction-only, knows-endpoint-±0.25σ, knows-first-half-path, knows-realized-vol. Each must achieve `E[U]` materially > 0.5 and monotone in information content; document the implied multiplier ladder (this is also marketing material: "knowing only the direction is worth ≈ X%").

**V4 — Economic stress (solvency).** Monte Carlo with player mixes from 100% zero-skill to 30% skilled (V3 oracles): realized margin, drawdown distribution, ruin probability at candidate bankrolls under the stake/exposure rules of Section 8. Required: ruin < 0.1% over 100k rounds at launch bankroll with quarter-Kelly caps.

**V5 — Human alignment (the feel test).** Re-score all stored v0.2 testing rounds (paths are persisted in Supabase) with the v3.0 engine: correlation between `S` and players' self-assessed scores must exceed the v0.2 engine's correlation; fairness-vote "about right" share must improve on rounds where v0.2 was contested. Continue collecting feedback post-launch; Layer-1 λ's and the 50/30/20 split are the only knobs tuned from this data (economics are untouchable by construction).

**V6 — Engine invariants.** Determinism (same inputs → same outputs bit-for-bit), edge cases (empty/short/extreme paths), component correlation < 0.7, settlement reproducibility from commitment alone.

---

## 11. Implementation Plan

The rebuild is incremental — most of v0.2 survives.

### 11.1 Module map

```
src/scoring/
  similarity/            LAYER 1 (new)
    dtwShape.ts          banded DTW, S1
    direction.ts         magnitude-weighted multi-scale, S2
    level.ts             bias + endpoint, S3
    similarity.ts        S = S1+S2+S3, pure function
  field/                 LAYER 2 (new)
    generators/          bootstrap.ts, gbm.ts, trend.ts, meanRevert.ts, flat.ts, replay.ts
    field.ts             G(anchorState, seed) → B paths; versioned 'field-v1'
    percentile.ts        rank player among field, mid-rank ties
    seed.ts              SHA256(commitment ‖ version) → PRNG stream
  payout/                LAYER 3 (rewrite)
    curve.ts             three-zone M(u); numeric g-solver; profiles
    risk.ts              Kelly caps, exposure reserve accounting
  explain/
    turningPoints.ts     KEPT from v0.2 — reveal-screen annotations only
  validation/            V1–V6 suites (extends existing harness + fairnessProbe)
```

Kept unchanged: drawing UI and normalization, lightweight-charts integration, reveal animation shell (extended with field swarm), Supabase persistence (add columns: `percentile`, `field_version`, `curve_version`, `seed`), commit-reveal API, data pipeline, admin dashboard (add skill-premium panel: rolling Ē[U], realized margin).

Deleted from the scoring path: volatility regime component, turning-point scoring (→ explain/), score-based payout curve, `NEUTRAL_PREDICTION_CREDIT` and all special-case credits.

### 11.2 Build order (test-first)

1. **Layer 1** similarity + V2 perceptual ladder + V6 invariants — the ladder test is written *before* tuning λ's.
2. **Field generators** + seeding + V1 neutrality suite — iterate mixture weights until every naive strategy sits in the band.
3. **Percentile + payout** + V4 economics suite — solver, profiles, caps.
4. **Integration**: settlement pure function, commit payload extension, UI percentile reveal + field swarm.
5. **V5 re-scoring** of stored testing rounds; tune Layer-1 display constants against human feedback.
6. Live infra (unchanged roadmap): wallet auth on Base, on-chain commit-reveal, bankroll vault, oracle integration — gated by the launch checklist (Appendix D).

### 11.3 Default parameter sheet

| Layer | Parameter | Default |
|---|---|---:|
| 1 | N (resample points) | 120 |
| 1 | DTW band w | 12 samples (10%) |
| 1 | λ_shape | 2.2 |
| 1 | direction levels / decay | 3 / 2.5 |
| 1 | λ_level | 1.2 |
| 1 | weights S1/S2/S3 | 50/30/20 |
| 1 | σ_typical floor coefficient | 0.5 |
| 2 | B (field size) | 1,500 |
| 2 | mixture | 40/20/15/10/10/5 per §6.2 |
| 2 | bootstrap block length | horizon/8 |
| 2 | EWMA λ (vol) | 0.94 |
| 3 | profile | Standard: h=0.04, u_be=0.80, m_min=0.15, α=1.8, u_J=0.99, M_max=12, g=9.0944 |
| Risk | stake cap | 0.56% of bankroll (quarter-Kelly) |
| Risk | total / per-horizon reserved exposure | 25% / 10% of bankroll |

λ_shape and λ_level defaults are starting points; V2 fixes their acceptable region, V5 fine-tunes within it. Everything in Layers 2–3 is fixed by the acceptance suites, not by feel.

---

## 12. Compliance and Responsible Use

Unchanged in substance from v2.0, restated as launch requirements: jurisdictional gating and legal review before real-money rollout; age gating; self-exclusion; per-user session, stake, and loss limits; clear disclosure that expected return is `1 − h` absent genuine skill. The percentile framing helps here too: the product can honestly display "an average player loses 4% per round over time" because that number is now actually true and provable.

DTC remains a speculative entertainment product. The analytical interface does not change that and must not be marketed as investing.

---

## 13. Token Position

Unchanged: DTC does not require a token. The loop — draw, rank against the field, settle — stands alone. Any future token is subordinate to the product.

---

## 14. Risks and Open Questions

| Risk | Mitigation | Residual |
|---|---|---|
| Field mis-specification (a naive strategy escapes the band) | V1 suite over 5 years of data; versioned field upgrades | Low — detectable pre-launch |
| Persistent player skill | Exact measurement + governance ladder (8.3); stake caps bound bleed rate | Medium — this is also the product working |
| Correlated wins in strong trends | Trend extrapolators are in the field (trend rounds raise the bar automatically); horizon-bucket exposure caps | Low-medium |
| Oracle manipulation | Median + TWAP + void policy | Low |
| Perceptual misalignment survives DTW | V2 ladder + V5 human re-scoring before launch; Layer-1 tuning is economics-neutral | Low |
| Regulatory classification | Staged launch, legal review, geo-gating | Unchanged, jurisdiction-dependent |
| Percentile feels opaque ("who is the field?") | Field swarm visualization, inspectable rival paths, published generator code | UX problem — solvable, must be tested |

Open questions deliberately deferred: PvP pools (the percentile mechanic extends naturally to real-player fields — a future mode where the "field" is other players, parimutuel-style), early cash-out (requires partial-round percentile estimates; defer), multi-asset expansion (field generator is asset-agnostic by design; expand only after BTC economics are proven live).

---

## 15. Conclusion

Version 0.2 proved the product instinct: people enjoy drawing their market thesis, and the drawing interaction works. It also proved, with 2.7 million candles and a hundred thousand simulated rounds, that **absolute-similarity scoring cannot be made fair or solvent by parameter tuning** — a near-perfect drawing that is 8% late can lose to a scribble, and the payout curve bled an expected −7.9%.

Version 3.0 changes the question the game asks. Not *"how close was your drawing on an absolute scale that shifts with every regime?"* but *"did you beat the field of every naive strategy, on this round, under the same conditions?"* That question is fair by construction (the field absorbs difficulty), legible by construction ("top 14%"), exploit-resistant by construction (every naive strategy is in the field), and solvent by construction (the payout curve integrates to `1 − h` exactly).

What remains is execution: build Layer 1 to pass the perceptual ladder, build the field to pass the neutrality suite, wire the solved curve, and let the validation protocol — not intuition, and not a 16-parameter optimizer — decide when it ships.

---

## Appendix A — Evidence from the v0.2 Post-Mortem

### A.1 Fairness probe (1,500 rounds, all timeframes, deployed v0.2 config)

| Drawing | Mean | p5 | p50 | Beaten by random walk |
|---|---:|---:|---:|---:|
| Lagged copy (8% late) | 59.1 | 34.5 | 60.5 | 6.9% |
| Damped copy (70% amplitude) | 80.2 | 58.1 | 82.9 | 0.3% |
| Time-warped copy (±7% turns) | 75.4 | 53.1 | 77.8 | 0.7% |
| Smoothed copy | 68.3 | 41.8 | 70.3 | 2.9% |
| Random walk | 30.2 | 8.6 | 27.9 | — |
| Flat line | 31.1 | 20.1 | 31.7 | — |

Reproduce: `npx tsx scripts/fairnessProbe.ts`

### A.2 v0.2 economic simulation (100k rounds)

Expected house edge −7.86%; expert tier (7% of population) multiplier 3.63×, edge −263%; ruin probability 100%/96%/2.3% at $10k/$50k/$100k bankroll; Kelly fraction 0%.

### A.3 Worked example of defect D2 (turning-point double jeopardy)

1h round, one realized top at minute 24. Player draws the identical shape with the top at minute 29 (7% of horizon late, beyond the 5% tolerance → match cost > cutoff). Outcome under v0.2: the predicted turn is unmatched (hallucination, −0.35) *and* the actual turn is unmatched (miss, −0.16): −0.51 × 34 ≈ **−17.3 points for one slightly-late reversal**. A player who drew a featureless drift line through the same round loses only the miss penalty (−5.4). The rubric pays players to draw less detail. Under v3.0, the same error costs a smooth, small amount of DTW distance inside/near the band — and what it costs the player, it costs every field path equally.

---

## Appendix B — Payout Curve Mathematics

Zones per §7.1. Closed-form pieces of the integral:

```
∫ refund  = u_be × (m_min + (1 − m_min)/(α + 1))
∫ profit  = (exp(g × (u_J − u_be)) − 1) / g
∫ jackpot = (1 − u_J) × (exp(g × (u_J − u_be)) + M_max) / 2
```

Solve `g` by bisection so the sum equals `1 − h` (monotone increasing in `g`; unique root). Standard profile: g = 9.0944, E[M] = 0.9600, SD[M] = 1.339, verified by 400k-point numeric integration. Discretization over the B=1,500 percentile grid changes E[M] by < 0.1%; if desired, solve `g` directly against the grid sum for exactness to the satoshi.

House P&L per unit stake: mean h, variance Var[M]. Quarter-Kelly cap = h/(4·Var[M]).

---

## Appendix C — Drawing Constraints (unchanged from v0.2)

| Timeframe | Horizon | Display interval | Control points |
|---|---:|---:|---:|
| 15m | 15 min | 1m | 8 |
| 1h | 60 min | 1m | 12 |
| 6h | 360 min | 5m | 16 |
| 24h | 1,440 min | 15m | 16 |
| 7d | 10,080 min | 1h | 16 |

First point fixed at anchor; last at horizon end; strictly increasing time; min spacing horizon/K/2; max slope 3× historical max hourly move.

---

## Appendix D — Production Launch Checklist

- [ ] Layer 1 passes V2 perceptual ladder (inversion rate vs. random < 1%)
- [ ] Field passes V1 neutrality for all naive strategies over 5 years of data
- [ ] Payout solver verified; E[M] = 1−h on the live percentile grid
- [ ] V4 economic stress: ruin < 0.1% at launch bankroll with quarter-Kelly caps
- [ ] V5: stored testing rounds re-scored; human alignment improves on v0.2
- [ ] Settlement reproducible by a third party from commitment + public code
- [ ] Oracle (multi-venue median + TWAP + void policy) tested against recorded anomalies
- [ ] Exposure reserve accounting + circuit breakers enforced in the round lifecycle
- [ ] Skill-premium dashboard live (rolling Ē[U], realized margin, alerts)
- [ ] Legal review, geo-gating, responsible-use controls
- [ ] Drawing interaction robust on mobile

Until all boxes are checked, the correct priority is hardening, not expansion.
