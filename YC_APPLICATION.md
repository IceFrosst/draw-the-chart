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
