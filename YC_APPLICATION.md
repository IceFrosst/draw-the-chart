# YC Application — Draw The Chart

## "Describe what you do in 50 characters or less."

**Answer (44 chars):**

```
Prediction markets where you draw the chart.
```

### Why this one

- **Anchors a category the reader already values.** "Prediction markets" is the fastest-growing consumer finance category in crypto. The reader assigns a market size before finishing the sentence — no education needed.
- **States the wedge in four words.** "where you draw the chart" is the entire product differentiation: binary markets take one bit of a user's thesis (up/down, above/below X); we take the whole path — direction, timing, magnitude, turning points, volatility shape.
- **Implies the business without saying it.** Prediction market = stakes, settlement, house edge. The revenue model is inferred, not explained. (Ours: 2% edge, break-even at score 60/100, downside floored at 0.40x, upside capped at 25x — all published in `WHITEPAPER.md` §10.)
- **Visual and specific.** "Draw the chart" is a physical action every trader has already done with their finger on a screen. That's what makes it click rather than just parse.

## Alternates

| Chars | Line | Trade-off |
|---|---|---|
| 44 | Prediction markets where you draw the chart. | **Recommended.** Category + wedge + implied business. |
| 35 | Polymarket, but you draw the chart. | Sharpest and most memorable, but leans on a competitor's brand for its meaning. |
| 43 | Draw BTC's next move. Get paid on accuracy. | Leads with the player experience and the payout. Weaker on category/market size. |
| 38 | Trading you play by drawing the chart. | Frames the bigger market (trading), but "play" reads more casino than fintech. |
| 43 | Chart-native prediction markets for crypto. | Most precise, least human. Reads like a whitepaper subtitle. |

## Supporting one-paragraph description (for the longer field that follows)

Draw The Chart is a prediction market where the input is a drawing instead of a yes/no click. A round opens at a locked BTC anchor; the player draws the price path they expect over a fixed horizon (15m to 7d), stakes on it, and a deterministic engine scores the drawn path against the realized market path in log-return space across four components — direction (40), magnitude (30), turning points (20), and volatility regime (10). The score maps to a published payout curve: below 60/100 is a partial refund with a 0.40x floor, above it is convex up to 25x, with a 2% house edge. The scoring engine is built and calibrated against 302k historical BTC candles (a random walk scores 30–35, a near-perfect path 98–100), and a full sandbox game loop is live at https://draw-the-chart-eight.vercel.app. What remains for the live product is settlement infrastructure — wallet auth, a price oracle, and bankroll controls — not the mechanic.

## Extended alternates (by strategic frame)

Each line sells a different company, not just a different sentence.

### The primitive reframe — names a new financial primitive
| Chars | Line |
|---|---|
| 39 | Prediction markets with partial credit. |
| 34 | Paid on how close you got, not if. |
| 40 | The first prediction market with a dial. |

Every prediction market is pass/fail; we are graded. Implies the category has been
rounding rich information down to one bit. Risk: abstract, no visual, doesn't say crypto.

### The data play — reframes gambling as a proprietary dataset
| Chars | Line |
|---|---|
| 35 | A market for human price forecasts. |

Highest ceiling. Every round yields a stake-weighted, timestamped, fully specified
human forecast auto-graded against ground truth, accruing at zero marginal cost while
the house edge funds operations. Risk: reads B2B, must answer "who buys the data?"

### Comp positioning — cheapest market-size transfer
| Chars | Line |
|---|---|
| 40 | Polymarket for chart shapes, not yes/no. |
| 29 | TradingView meets Polymarket. |

Risk: X-meets-Y implies charting infrastructure we don't build.

### Wallet-share honesty — names who we take volume from
| Chars | Line |
|---|---|
| 38 | Perps without leverage. You just draw. |
| 30 | Options trading with a pencil. |

"Perps without leverage" is WHITEPAPER.md §14.2 compressed: no liquidations, judged on
thesis not execution. Avoid the "options" line in this field — it is the one word here
that changes which regulator the reader imagines.

### Plain-English expressiveness — no jargon, no comps
| Chars | Line |
|---|---|
| 41 | Bet on the shape, not just the direction. |
| 26 | The chart is the bet slip. |

### Bonus — sells time-to-first-bet
| Chars | Line |
|---|---|
| 37 | Draw a chart. That's the whole trade. |
| 39 | Sketch the chart. Stake it. Get scored. |

### Verdict

The recommended line sells **category**. "Prediction markets with partial credit."
sells **insight**. "Perps without leverage. You just draw." sells **substitution**
against a market doing >$100B/mo. Any of the three is defensible; pick based on which
story the rest of the application tells.

## "What is your company going to make? Please describe your product and what it does or will do."

### Recommended answer (~230 words)

Draw The Chart is a prediction market where you bet on the shape of a price path instead of a yes/no outcome.

A round opens at a locked BTC price. You see the historical chart up to that moment, pick a horizon (15 minutes to 7 days), stake an amount, and draw the path you think BTC will take — freehand, directly on the chart. When the horizon closes, a deterministic engine scores your drawing against what BTC actually did, in log-return space, across four components: direction (40 points), magnitude (30), turning points (20), and volatility regime (10). The score maps to a published payout curve — below 60/100 you get a partial refund, floored at 0.40x; above it the multiplier goes convex to a 25x cap. It's house-vs-player, so rounds are always available with no need to match an opposing view. The house edge is 2% and every parameter is public.

The scoring engine is built and calibrated against 302,000 historical BTC candles: a random walk scores 30-35, a flat line 23-35, a near-perfect path 98-100. The full loop is playable today in sandbox at draw-the-chart-eight.vercel.app, and every round we run captures whether the player thought the score was fair, what they'd have scored it themselves, and whether they'd have staked real money on it.

Three things stand between the sandbox and a live product: wallet auth, a price oracle for settlement, and bankroll risk controls. The mechanic is done — the scoring engine is the hard part and it works.

### Short version (~110 words)

Draw The Chart is a prediction market where you bet on the shape of a price path, not a yes/no outcome.

A round opens at a locked BTC price. You pick a horizon (15 minutes to 7 days), stake an amount, and draw the path you expect — freehand, on the chart. A deterministic engine scores your drawing against the real path across four components: direction, magnitude, turning points, and volatility regime. Below 60/100 is a partial refund floored at 0.40x; above it the payout goes convex to 25x. House edge is 2%, every parameter public.

The engine is calibrated against 302,000 BTC candles — a random walk scores 30-35, a near-perfect path 98-100 — and the full loop is playable in sandbox today. Wallet auth, a settlement oracle, and bankroll controls are what's left.

### Notes on the choices

- **Specific numbers over adjectives.** The component weights and calibration bands prove the thing is built and that real decisions were made. "A random walk scores 30-35" is the single most load-bearing sentence — it shows the scoring isn't arbitrary.
- **Honest closing gap list.** Naming the three missing pieces (wallet auth, oracle, bankroll controls) reads as competence and signals that none of the remaining work is the risky part. Claiming more than the sandbox delivers would be contradicted by the live link.
- **Feedback instrumentation is called out** because `supabase/migrations/001_initial_schema.sql` really does capture `fairness_vote`, `self_assessed_score`, and `would_bet_real_money` per round — evidence we are measuring the risk that actually kills this product (players perceiving the score as unfair) before taking money.
- **Licensing/jurisdiction deliberately omitted.** The field asks what the product is; raising regulation here spends the strongest paragraph on defense. Answer it where YC asks directly, but have a real answer prepared.

### Revised opening (comp + why-now, resequenced)

Draw The Chart is a prediction market where you bet on the shape of a price path instead of a yes/no outcome — TradingView meets Polymarket.

Two things make this the moment for it. Retail traders already draw on charts; it's a habit they perform for free, every day, on every charting app. And prediction markets have become one of the fastest-growing categories in consumer finance. Nobody has connected the two — the drawing stays a screenshot, and the market stays a yes/no. We make the drawing itself the position.

A round opens at a locked BTC price. You see the historical chart up to that moment, pick a horizon (15 minutes to 7 days), stake an amount, and draw the path you think BTC will take — freehand, directly on the chart. When the horizon closes, a deterministic engine scores your drawing against what BTC actually did, in log-return space, across four components: direction (40 points), magnitude (30), turning points (20), and volatility regime (10). The score maps to a published payout curve — below 60/100 you get a partial refund, floored at 0.40x; above it the multiplier goes convex to a 25x cap. It's house-vs-player, so rounds are always available with no need to match an opposing view. The house edge is 2% and every parameter is public.

The scoring engine is built and calibrated against 302,000 historical BTC candles: a random walk scores 30-35, a flat line 23-35, a near-perfect path 98-100. The full loop is playable today in sandbox at draw-the-chart-eight.vercel.app, and every round we run captures whether the player thought the score was fair, what they'd have scored it themselves, and whether they'd have staked real money on it.

Three things stand between the sandbox and a live product: wallet auth, a price oracle for settlement, and bankroll risk controls. The mechanic is done — the scoring engine is the hard part and it works.

### Flow notes on the revision

- **Comp attached to the definition, not standalone.** As its own sentence ("Imagine TradingView meets Polymarket") it is a speed bump — the reader holds two brands before knowing why. Attached with a dash it compresses the sentence just read, which is a comp's actual job. "Imagine" dropped: it asks the reader to do work instead of telling them.
- **Tailwinds labeled as a pair.** "Two things make this the moment for it" signals a list, so both facts land as evidence rather than loose assertions.
- **Circular ending replaced with a bridge.** "This is where Draw The Chart comes" restarts the paragraph and repeats the company name. "Nobody has connected the two → we make the drawing itself the position" names the gap, closes it, and hands off to the mechanic.
- **Quantify the growth claim.** Replace "one of the fastest-growing categories" with a real volume figure, or use "gone from niche to mainstream in two years." An unquantified superlative reads worse than a number to a reader who already knows the number.

### Tension-first alternative (more persuasive, slower)

Retail traders draw on charts all day and get nothing for it. Prediction markets took off by letting people bet on outcomes, but only in yes/no form. Draw The Chart is the product between those two facts: a prediction market where you bet on the shape of a price path.

Not recommended for this field — the question asks what you make, so definition-first serves it better.

### Merged version (founder draft + restored evidence) — USE THIS

Draw The Chart is a prediction market where you bet on the shape of a price path instead of a yes/no outcome. Imagine TradingView meets Polymarket.

The behavior already exists. Retail traders draw on charts every day, on every charting app, for free. And prediction markets have gone from niche to mainstream in two years. Nobody has connected the two: the drawing stays a screenshot, the market stays a yes/no. We make the drawing itself the position — a new instrument priced on the shape of a path rather than a binary outcome.

A round opens at a locked BTC price. You pick a horizon (15 minutes to 7 days), stake an amount, and draw the price action you expect. Our engine then scores your drawing against what really happened across four components — direction, magnitude, turning points, and volatility regime — and pays on accuracy: below 60/100 is a partial refund floored at 0.40x, above it the payout goes convex to a 25x cap, with a 2% house edge.

The engine is calibrated against 302,000 historical BTC candles — a random walk scores 30-35, a near-perfect path 98-100 — and the whole loop is playable in sandbox today. Wallet auth, a settlement oracle, and bankroll controls are what's left to go live.

### Edit rationale vs. the founder draft

Kept: "what really happened" (plainer than "what BTC actually did"), the shorter mechanic paragraph, and the "new instrument" ambition.

Changed:

- **"The stars are aligned" → "The behavior already exists."** The only sentence asking the reader to take something on faith, sitting on top of two facts that are real evidence. The replacement is this repo's own WHITEPAPER.md §2.1 heading.
- **Restored the proof.** The draft cut the four components, calibration bands, payout curve, and sandbox link, leaving "our engine scores your drawing" — the exact hand-wave a skeptic attacks. "A random walk scores 30-35" is the only sentence that proves the scoring is not arbitrary.
- **"asset price" → "BTC price."** The product is BTC/USDT only (WHITEPAPER.md §3.2). Genericizing reads as hedging and is inaccurate; narrow-and-real beats broad-and-vague.
- **"From one minute to days" → "15 minutes to 7 days."** Actual horizons per Appendix A are 15m, 1h, 6h, 24h, 7d. No one-minute round exists — do not ship a fact-checkable error next to a live link.
- **"win or lose $ depending on your accuracy" → explicit floor and cap.** Fixes a stray placeholder and restores the asymmetry (0.40x floor, 25x cap, 2% edge), which is the answer to how the business earns.
- **"one of the fastest-growing categories" → "gone from niche to mainstream in two years."** The draft dropped the noun ("categories of what?"); the replacement avoids inviting a numbers correction from a reader who knows the volumes.
- **Cut "Until now."** It pre-announced the reveal the next clause delivers, making one point twice.
- **"new financial instrument" kept but attached to its definition.** "A new instrument priced on the shape of a path rather than a binary outcome" reads as precision instead of grandiosity, and is defensible: a payoff that is a function of an entire path is what an exotic derivative is.

### Alternatives to "a new financial instrument"

The closing clause of paragraph 2 needs the ambition of "new instrument" without the
follow-up question "which regulator classifies it as one?" Options, safest first:

| Replacement | Buys | Costs |
|---|---|---|
| (drop the noun) "...the position. The payout is priced on the shape of the path, not a binary outcome." | Nothing to attack; states the mechanism and lets the reader name it | Gives up the category-creation flourish |
| **a new market primitive** | Same ambition; "primitive" is design language, not a legal classification | Mild jargon, reads VC-fluent |
| partial credit instead of pass/fail | Ties to the tagline shortlist so the application argues one idea throughout | Slightly soft alone |
| a continuous payoff instead of a binary one | Most precise; the precision is itself credible | Technical register |
| a new bet type | Maximally plain | Pulls the frame toward gambling |
| a market on shape, not outcome | Compresses the thesis into five words | Abstract without the preceding sentence |
| a new contract type | Sounds substantial | "Contract" is also a regulated noun — same problem |
| a new asset class | Biggest claim available | Overreach, and keeps the regulatory question. Avoid |

**Recommended: "a new market primitive."** Preserves the signal that this is a category
rather than a feature, while swapping a legally loaded noun for one from product/design
vocabulary.

Paragraph 2 with the recommended swap:

The behavior already exists. Retail traders draw on charts every day, on every charting app, for free. And prediction markets have gone from niche to mainstream in two years. Nobody has connected the two: the drawing stays a screenshot, the market stays a yes/no. We make the drawing itself the position — a new market primitive, priced on the shape of a path rather than a binary outcome.

Zero-exposure variant:

...Nobody has connected the two: the drawing stays a screenshot, the market stays a yes/no. We make the drawing itself the position. The payout is priced on the shape of the path, not a binary outcome.

A reader who thinks in categories supplies "that's a new instrument" unprompted, and a
conclusion the reader reaches is worth more than an asserted one.

### FINAL phrasing decision: "a new financial primitive"

Chosen over both "instrument" and "market primitive."

- **Low regulatory exposure.** No regulator classifies "primitives," so the ambition of
  "instrument" survives without inviting the classification question.
- **Native vocabulary.** Standard phrasing for any reader who has looked at crypto;
  consistent with the fintech framing the rest of the answer uses.
- **Mildly worn phrase** (ubiquitous in 2020-2022 DeFi decks), but rescued here because
  the clause defines itself immediately — "priced on the shape of a path rather than a
  binary outcome" — instead of asking the phrase to carry meaning alone.
- **Accepted trade-off:** the fintech frame means regulatory and settlement answers get
  weighed more seriously than under a consumer-game framing. Higher-valuation frame, but
  the licensing answer needs to be ready wherever YC asks for it.

Final paragraph 2:

The behavior already exists. Retail traders draw on charts every day, on every charting app, for free. And prediction markets have gone from niche to mainstream in two years. Nobody has connected the two: the drawing stays a screenshot, the market stays a yes/no. We make the drawing itself the position — a new financial primitive, priced on the shape of a path rather than a binary outcome.

## FINAL ANSWER — simple/generic version (founder's chosen direction)

Deliberately high-level: plain language, no component weights, no calibration figures.
The detailed evidence moves to "How far along are you?", where proof is what the question
is actually asking for.

Draw The Chart is a prediction market where you bet on the shape of a price path instead of a yes/no outcome. Imagine TradingView meets Polymarket.

The behavior already exists. Retail traders draw on charts every day, on every charting app, for free. And prediction markets have gone from niche to mainstream in two years. Nobody has connected the two: the drawing stays a screenshot, the market stays a yes/no. We make the drawing itself the position — a new financial primitive, priced on the shape of a path rather than a binary outcome.

A round opens at a locked asset price. You pick a time horizon (from minutes to days), stake an amount, and draw the price action you expect. Then our engine scores your drawing against what really happened, and you win or lose depending on your accuracy.

Optional closing line: It's playable today at draw-the-chart-eight.vercel.app.

### Edits applied to the mechanic paragraph (typos/accuracy only)

- Removed stray "$" placeholder — "win or lose $ depending on" read as an unfinished sentence.
- "From one minute to days" -> "from minutes to days". The shortest shipped round is 15
  minutes (Appendix A), so "one minute" is disprovable by clicking the demo link.
  "Minutes to days" is equally generic and accurate.
- Lowercased "from" inside the parenthesis.

No other changes: the generic register is intentional and preserved.

### Where the cut detail belongs instead

The four scoring components, the 302k-candle calibration (random walk 30-35, near-perfect
98-100), the payout floor/cap, and the round-feedback capture are the strongest material
in this repo. They answer "How far along are you?" rather than "What do you make?" — keep
them for that field.

## "Explain your decision regarding location." (Kaunas, Lithuania / Kaunas, Lithuania)

### Recommended answer (~160 words)

I'm from Kaunas — my team, network, and cost base are here, which means we can build for years on what a few months would cost in San Francisco. I'll be in SF full-time for the batch.

Staying afterward is deliberate, not default. Our product needs payments and licensing infrastructure, and Lithuania is the EU's largest fintech licensing hub: the Bank of Lithuania reviews e-money applications in about three months, several times faster than most EU regulators. The EU also gives us a clearer near-term path to a licensed launch than the US does.

And the ecosystem here is compounding. Lithuania's startup ecosystem passed €16.4B in value in 2025, VC funding grew 1.7x year over year, and it has grown 5.9x in five years — roughly four times the CEE average. Vinted and Nord Security both came out of a country of under 3 million people. Notably, only 26% of Lithuanian scaleups relocate their HQ, the lowest rate in the region: you can build a global company from here without leaving.

### Short version (~100 words)

I'm from Kaunas — team, network, and cost base are all here, so our runway goes much further than it would in SF. I'll be in San Francisco full-time for the batch.

Staying is deliberate. Lithuania is the EU's largest fintech licensing hub, and the Bank of Lithuania moves faster than most EU regulators — which matters for a product that needs payments and licensing. The ecosystem is compounding too: €16.4B in value in 2025, VC funding up 1.7x year over year, 5.9x growth in five years. Only 26% of Lithuanian scaleups move their HQ abroad, the lowest rate in the region.

### Supporting data

| Claim | Source |
|---|---|
| EUR 16.4B ecosystem value, 2025 | Dealroom report initiated by Startup Lithuania |
| EUR 131M -> 221M VC funding, 1.7x YoY | same |
| 5.9x growth over 5 years vs 1.6x CEE average | same |
| 26% HQ relocation, lowest in CEE (Estonia 50%, Latvia 70%) | same |
| Vilnius = EU's largest fintech hub by licences issued, 280+ fintechs | Bank of Lithuania / industry reporting |
| ~3-month EMI/PI review, 2-4x faster than most EU | Bank of Lithuania published service standard |

### Notes

- **The 26% relocation stat is the strongest line in the answer.** It reframes staying in
  Lithuania from a limitation into the documented regional norm, and it directly answers
  the question being asked rather than deflecting it.
- **Only keep the SF sentence if it is true.** This field's real screen is willingness to
  attend in person — the batch opens with a 3-day retreat and runs weekly meetups in San
  Francisco. A mismatch discovered at interview costs more than the sentence gains.
- **The licensing claim is deliberately modest** ("a clearer near-term path"). EU gambling
  licences do not passport between member states, so a stronger claim invites a question
  that cannot be answered until the product's regulatory classification is settled.

## "What tech stack are you using? Include AI models and AI coding tools you use."

### Recommended answer

TypeScript end to end, strict mode. React 19 + Vite 7 + Tailwind 4 on the front end, with TradingView's open-source lightweight-charts for rendering and a custom freehand drawing layer on top. Express 5 for the round API, Supabase (Postgres) for rounds and player feedback, Vercel for hosting. Vitest for tests — 50 across 9 files, including calibration and economic guardrail assertions that fail if the payout curve drifts out of its tuned bands. Market data is Binance 1-minute BTC/USDT candles.

Deliberately no AI in the scoring path. Scores come from plain math — log-return resampling, Gaussian smoothing, and Hungarian matching for turning points — because a player staking money has to be able to see exactly why they scored what they did and reproduce it. A model in that loop would make payouts unexplainable, which is the fastest way to lose trust in a product like this.

For building: Claude Code as the main coding tool, with Codex for second-opinion review passes. That's how one person shipped a calibrated scoring engine, a backtest harness, and the full web app.

Longer term, every round produces a labeled human forecast graded against ground truth — a dataset nobody else has. That's a later product, not this one.

### Notes

- **The "no AI in scoring" paragraph is the point-scoring one.** The question invites
  AI-washing; the stronger answer is a confident refusal with a product reason behind it.
  It restates WHITEPAPER.md §4.2 ("Determinism over mystique") and differentiates from
  applications that claim a model for everything.
- **Confirm the AI tooling line against actual workflow** before submitting. Drafted from
  repo evidence (PROJECT_STATUS.md references a Codex review pass; `.claude/` is
  gitignored), but this is an easy detail to probe in an interview.
- **Test-count claim is now true from a clean clone.** See the harness data-path fix in
  this branch: 3 backtest tests previously failed on a fresh clone because `data/` is
  gitignored while the committed candle file lives in `public/`.

### Infrastructure notes (not for the application — for planning)

Hosting choice carries no weight in the application. Vercel is a normal production choice
and needs no defending. The real gaps are in what a live, real-money product requires:

- **Jurisdiction controls are a launch blocker and are missing from the PROJECT_STATUS
  must-have list.** EU gambling licences do not passport, so taking real stakes requires
  reliably blocking traffic from unlicensed jurisdictions *and* being able to evidence it.
  Country-level blocking plus WAF at the edge (Cloudflare) is the standard approach; doing
  it in application code is weaker and harder to prove to a regulator.
- **Bot/abuse mitigation.** A scored game with convex payouts invites scripted play farming
  for scoring exploits. Edge rate limiting plus Turnstile is cheap and standard.
- **Round orchestration needs a persistent process.** Rounds open, lock, wait a fixed
  horizon, then settle against an oracle price. Serverless is a poor fit for "wake up in six
  hours and settle"; live price streaming wants WebSockets. Either a small always-on service
  (Fly.io / Railway / Render / VPS) or Cloudflare Durable Objects — one object per round with
  alarms for settlement timing, which maps closely onto the existing round state machine.
- **Supabase stays.** Postgres is correct for auditable money-adjacent data.
- **Move `public/btc_1m_candles.json` (7.6MB) to object storage** before real traffic.
- **Log raw oracle feed data per round.** Settlement price disputes are an existential risk
  for this product; replayability is the defence.

### FINAL tech stack answer (concise, gaps patched)

TypeScript end to end, React and Vite on the front end, Express for the round API. TradingView's open-source charts for rendering, with a custom freehand drawing layer on top. Vercel for hosting, Supabase for the database, and Pyth or Chainlink as the oracle when we go live. 50 tests, including calibration guardrails that fail if the payout curve drifts.

Deliberately no AI in the scoring path. Scores come from plain math — log-return resampling, Gaussian smoothing, Hungarian matching for turning points. A model in that loop would make payouts unexplainable, which is the fastest way to lose trust in a product like this.

For building: Claude Code as the main tool, Codex and Grok for review passes.

### What the trimmed draft was missing

1. **The stack itself** — TypeScript, React, Vite, Express were all dropped, leaving a
   charting library as the opening and no statement of what the app is written in.
   TypeScript strict mode is a real signal for a product that moves money.
2. **The tests** — 50 tests with calibration and economic guardrails are the only part of
   the stack that *enforces* the "scoring isn't arbitrary" claim the whole pitch rests on.
3. **"Plain math" left unsupported** — naming log-return resampling, Gaussian smoothing,
   and Hungarian matching turns the assertion into a demonstrated decision.
4. **Oracle stated as shipped** — "our oracle" sat in a list with live services. It is
   planned, and the question explicitly permits "planning to use."
5. **"LLM" narrowed the argument** — any learned model makes the score unexplainable, not
   just language models. "A model in that loop" is the stronger claim.

Also: give each AI coding tool a one-word role. A flat list of three reads as collecting
rather than using.

## "How far along are you?"

### Recommended answer

The sandbox MVP is built and deployed. The full loop works end to end: pick a horizon, draw a path, submit, watch the real price replay against your drawing, get a component score and a payout. No real money, no wallets, no accounts yet, and no users beyond our own testing.

What's done is the hard part. The scoring engine is deterministic and calibrated against 302,000 historical BTC candles — a random walk scores 30-35, a flat line 23-35, a near-perfect path 98-100 — with 50 tests, including guardrails that fail if the payout curve drifts out of its tuned bands.

The idea is refined. We're deliberately not launching yet, because what kills this product isn't the math — it's a score that feels arbitrary. If a player reads the chart well and the engine disagrees, we lose them for good, and no payout curve fixes that. So we built two instruments for it. Every round captures whether the player thought the score was fair, what they'd have scored themselves, and whether they'd stake real money on it. And a side-by-side tool shows two predictions on the same price segment and asks a human which one is better, so we can measure how often the engine agrees with human judgment.

Next is a closed testing group to gather that data at volume, then real-money settlement. In parallel we're pursuing L1 ecosystem partnerships for distribution and settlement — a chart-native prediction primitive is the kind of thing chains want in their ecosystem, and their grant and developer programs give us reach that would otherwise cost paid acquisition.

### Notes

- **Both validation instruments are real code**, not aspiration: `round_feedback` in
  `supabase/migrations/001_initial_schema.sql` captures fairness_vote, self_assessed_score,
  confidence, wrong_components, difficulty_perception and would_bet_real_money per round;
  `src/ui/lib/validationPairs.ts` + `src/ui/pages/Validate.tsx` generate two scored
  predictions over the same segment for blind human comparison against the engine's ranking.
- **The L1 line is written as intent ("we're pursuing"), not fact.** Upgrade it only if real
  conversations exist, and name the chain and stage if so — "various L1s" invites a question
  that a specific name answers. Overstated partnerships are trivially checkable.
- **"No users beyond our own testing" stays in.** The following paragraph explains the
  sequencing, which makes the absence a decision rather than a gap. A vague answer about
  users unravels the moment someone asks for a number.
- **The demo is behind a password gate** (`src/ui/components/PasswordGate.tsx`). This answer
  claims a working end-to-end loop, so either drop the gate for the review window or include
  the password in the application.
- **Commit recency:** substantive work lands in March and May 2026. Nothing in the
  application asks, so do not raise it, but have a straight answer ready for "what have you
  been doing since May" if the repo is shared.
