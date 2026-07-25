# Draw The Chart

A BTC price-path prediction game where you draw the expected future move instead of placing a binary bet or managing a leveraged position.

**[Live Demo](https://drawthechart.xyz/play?tf=1h)**

---

## What It Is

Instead of clicking "up" or "down", you draw your thesis directly on the chart. A deterministic 4-component scoring engine evaluates your prediction against the realized BTC price path and maps the score to a transparent payout curve.

Scoring components:
- **Direction** (40 pts) — multi-scale directional accuracy across halves, quarters, eighths, sixteenths
- **Magnitude** (30 pts) — bias + tracking error, normalized by realized volatility
- **Turning Points** (20 pts) — Gaussian smoothing + Hungarian algorithm matching
- **Volatility Regime** (10 pts) — per-quarter volatility shape comparison

All scoring is done in log-return space. Both paths are resampled to 120 points before evaluation.

## Stack

- React 19 + TypeScript (strict mode)
- Vite 7 + Tailwind 4
- `lightweight-charts` 5 (TradingView open-source)
- Node / Express sandbox API
- Vitest — 50 tests across 9 test files
- Binance 1-minute BTC/USDT candles (7.6MB, Aug 2025–Mar 2026)

## Scoring Calibration

Validated via backtest harness against 302k historical candles:

| Strategy | Expected Score |
|---|---|
| Random Walk | 30–35 |
| Flat Line | 23–35 |
| Naive Trend | 35–50 |
| Near Perfect | 98–100 |

Break-even score: **60/100** — scores above this are profitable, below this return a partial refund (min 0.40x). Max multiplier: 25x.

## Project Structure

```
src/
├── scoring/    # Pure scoring engine — direction, magnitude, turning points, volatility
├── backtest/   # Calibration harness + 5 baseline strategies + economics analysis
├── ui/         # React app — chart drawing, game loop, leaderboard, FAQ, whitepaper
└── server/     # Express sandbox API with commit-reveal protocol
```

See `WHITEPAPER.md` for the full product paper and `PROJECT_STATUS.md` for current build status.

## Local Development

```bash
npm install
npm run dev       # Vite app on port 5173
npm run server    # Sandbox API on port 3001
npm test          # Run all 50 tests
npm run backtest  # Scoring calibration harness
npm run economics # Payout economics analysis
```

## Payout Curve (sample — $100 stake)

| Score | Multiplier | Return |
|---|---|---|
| 0 | 0.40x | $40 |
| 50 | 0.85x | $85 |
| 60 | 0.98x | $98 (break-even) |
| 70 | 2.21x | $221 |
| 80 | 4.98x | $498 |
| 90 | 11.22x | $1,122 |
| 100 | 25.00x | $2,500 |
