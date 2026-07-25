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
