# Draw The Chart

Draw The Chart (DTC) is a BTC price-path prediction game where the player draws the expected future move instead of placing a binary bet or managing a leveraged position.

The current repo is a sandbox-first MVP focused on the hardest parts of the product:

- drawing interaction
- deterministic scoring
- payout transparency
- backtest calibration

## Stack

- TypeScript
- React frontend
- Node / Express sandbox API
- `lightweight-charts` for chart rendering
- Vitest for scoring and constraint tests

## Product Scope

Current MVP scope:

- BTC only
- fixed horizons: `15m`, `1h`, `6h`, `24h`, `7d`
- historical sandbox rounds
- freehand future-path drawing normalized into control points
- score breakdown and payout preview
- shareable seed-based sandbox rounds
- JSON replay export after settlement
- local sandbox journal / leaderboard backed by real browser-saved rounds

## Key Directories

- `src/scoring`: pure scoring engine and payout logic
- `src/backtest`: calibration harness and baseline strategies
- `src/ui`: app shell, pages, chart overlays, and drawing UX
- `src/server`: sandbox API
- `WHITEPAPER.md`: full product whitepaper

## Local Development

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

Run the sandbox API:

```bash
npm run server
```

## Core Scripts

- `npm run dev`: start the Vite app
- `npm run server`: start the sandbox API on port `3001`
- `npm test`: run scoring and drawing-constraint tests
- `npm run backtest`: run the scoring calibration harness
- `npm run economics`: print scoring baselines plus payout-retention / bankroll-risk metrics
- `npm run whitepaper:export`: export markdown, HTML, and DOCX whitepaper artifacts into `public/`
- `npm run build`: build server types, export docs, and build the frontend

## Sandbox API Surfaces

Useful sandbox endpoints:

- `GET /health`
- `GET /config`
- `GET /protocol/manifest`
- `GET /rounds`
- `GET /rounds/:id/replay`
- `GET /rounds/:id/verify`

## Whitepaper Artifacts

The whitepaper source of truth is `WHITEPAPER.md`.

`npm run whitepaper:export` generates:

- `public/WHITEPAPER.md`
- `public/whitepaper-full.html`
- `public/DrawTheChart_Whitepaper_v1.1.docx`

This keeps the in-app links and downloadable docs aligned with the repo source.

## Current State

Strongest parts today:

- calibrated scoring baselines
- payout curve tuned against retention and tail-risk guardrails
- sandbox reveal flow
- deterministic seed-based round reproduction
- protocol manifest and commitment verification endpoints
- improved chart and draw interaction
- more deliberate product visual language

Still not production-ready:

- live bankroll and exposure management
- persistence
- wallets and balances
- production oracle / settlement pipeline
- exchange-grade licensed charting stack
