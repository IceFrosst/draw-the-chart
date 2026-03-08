# DTC — Project Status & Handoff Document

> Last updated: 2026-03-08
> Purpose: Enable a new agent/session to pick up where the previous one left off.

---

## What This Project Is

**Draw The Chart (DTC)** is a BTC price-path prediction game. Instead of placing binary bets ("up or down"), players draw the expected future price path freehand on a chart. A deterministic scoring engine evaluates accuracy across 4 dimensions, and a published payout curve converts the score into a multiplier.

The current repo is a **sandbox-mode MVP** — a fully working web app backed by historical BTC data. No real money, no blockchain, no accounts. It's designed as a portfolio/resume piece demonstrating the full game loop.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Language | TypeScript (strict mode, `noUncheckedIndexedAccess`) |
| Frontend | React 19, Vite 7, Tailwind 4 |
| Charts | lightweight-charts 5 (TradingView open-source) |
| Backend | Express 5 (in-memory sandbox API) |
| Testing | Vitest 4 (50 tests, 9 test files) |
| Data | Binance 1-minute BTC/USDT candles (7.6MB JSON, Aug 2025 – Mar 2026) |

---

## Project Structure

```
src/
├── scoring/           # Pure scoring engine (no side effects)
│   ├── score.ts          # Main entry: computeScore(), pricesToLogReturns(), resamplePath()
│   ├── directionScore.ts # Component A: Directional Accuracy (0–40 pts)
│   ├── magnitudeScore.ts # Component B: Magnitude Accuracy (0–30 pts)
│   ├── turningPoints.ts  # Component C: Turning Points (0–20 pts)
│   ├── volatilityRegime.ts # Component D: Volatility Regime (0–10 pts)
│   ├── payout.ts         # Two-zone payout curve (refund + profit zones)
│   ├── config.ts         # Tuned scoring parameters (validated via backtest)
│   ├── types.ts          # LogReturnPath, ScoringConfig, ScoreBreakdown
│   ├── index.ts          # Barrel export
│   ├── scoring.test.ts   # 28 unit tests for all components
│   └── payout.test.ts    # 6 payout curve tests
│
├── backtest/          # Calibration & economics harness
│   ├── harness.ts        # Runs N rounds of each strategy against historical data
│   ├── strategies.ts     # Baseline strategies: Random Walk, Flat Line, Naive Trend, Mean Reversion, Near Perfect
│   ├── economics.ts      # Payout economics analysis (retention, bankroll risk)
│   ├── fairness.ts       # Ranking ladder tests (better strategy → higher score)
│   ├── harness.test.ts   # Calibration band assertions
│   ├── economics.test.ts # Payout economics guardrails
│   ├── fairness.test.ts  # Ranking order assertions
│   ├── run.ts            # CLI runner for backtests
│   └── runFairness.ts    # CLI runner for fairness analysis
│
├── ui/                # React frontend
│   ├── App.tsx           # Router: 6 routes, lazy-loaded pages, meta tags
│   ├── main.tsx          # Entry point
│   ├── index.css         # Global theme (CSS custom properties, component classes)
│   ├── components/
│   │   ├── DrawingChart.tsx    # Main chart + freehand drawing overlay (~1530 lines)
│   │   ├── Navbar.tsx          # Top nav with responsive mobile menu
│   │   ├── PayoutCurve.tsx     # Interactive payout curve visualization
│   │   ├── ValidationChart.tsx # Side-by-side prediction comparison charts
│   │   ├── TAToolbar.tsx       # Technical analysis toolbar (SMA, EMA, Bollinger, RSI)
│   │   └── TAOverlay.tsx       # TA indicator rendering on chart
│   ├── pages/
│   │   ├── Landing.tsx    # Hero page with live BTC ticker, CTA
│   │   ├── Game.tsx       # Game state machine: Setup → Draw → Reveal
│   │   ├── FAQ.tsx        # How It Works (scoring explanation, payout table)
│   │   ├── Leaderboard.tsx # Local round journal (browser-persisted)
│   │   ├── Whitepaper.tsx  # Full product paper with downloadable artifacts
│   │   └── Validate.tsx    # Human scoring comparison tool
│   ├── hooks/
│   │   └── usePriceData.ts # Binance API + local JSON fallback
│   └── lib/
│       ├── drawingConstraints.ts # Control point validation (spacing, slope caps)
│       ├── roundHistory.ts       # localStorage round persistence
│       ├── roundInsights.ts      # Score insights / streak tracking
│       ├── validationStorage.ts  # Validation session persistence
│       ├── validationPairs.ts    # Pre-generated prediction pairs for validation
│       ├── marketConstants.ts    # BTC/USDT market params
│       └── payoutPresentation.ts # UI-friendly payout formatting
│
├── server/            # Sandbox API
│   ├── index.ts          # Express server (in-memory Map<string, Round>)
│   ├── protocol.ts       # Commitment hashing, seed derivation, verification
│   └── protocol.test.ts  # 5 protocol tests
│
└── data/
    └── fetchBtcData.ts   # Historical data fetcher script
```

**Other important files:**
- `CLAUDE.md` — Scoring algorithm spec and architecture decisions
- `WHITEPAPER.md` — Full product paper (36KB, v1.1)
- `public/btc_1m_candles.json` — 7.6MB historical BTC data (302k candles)
- `index.html` — Entry HTML with OG meta tags, inline SVG favicon

---

## Scoring Engine (The Core IP)

All scoring is done in **log-return space**: `r(t) = ln(P(t) / P₀)`, anchored at `r(T₀) = 0`. Both predicted and actual paths are resampled to **N = 120 points**.

### Component A: Directional Accuracy (0–40 pts)
- Multi-scale direction matching at 4 levels (halves, quarters, eighths, sixteenths)
- Coarser scales weighted 2x more (geometric decay)
- Flat predictions get minimal abstention credit (~2/40)
- File: `src/scoring/directionScore.ts`

### Component B: Magnitude Accuracy (0–30 pts)
- Decomposes error into bias (mean signed error) and tracking error (RMSE after debiasing)
- Both normalized by realized volatility σ
- `MagnitudeScore = 30 × exp(-λ × (w_b × |bias|/σ + w_t × RMSE_debiased/σ))`
- File: `src/scoring/magnitudeScore.ts`

### Component C: Turning Points (0–20 pts)
- Gaussian smooth (σ = 6 samples) → find extrema with prominence > 0.3σ → Hungarian matching
- Match quality based on time offset and amplitude similarity
- Penalizes hallucinated (false positive) and missed (false negative) turns
- **Recent fix**: When actual has no detected extrema (smooth trend), uses Pearson correlation between smoothed paths instead of giving a free 20/20. Prevents straight-line predictions from getting inflated scores.
- File: `src/scoring/turningPoints.ts`

### Component D: Volatility Regime (0–10 pts)
- Splits horizon into 4 quarters, compares realized vol in each
- `ShapeScore = 10 × exp(-μ × mean(|vol_pred_q − vol_actual_q| / vol_actual_q))`
- File: `src/scoring/volatilityRegime.ts`

### Total Score
`S = A + B + C + D` (range 0–100)

### Calibrated Baselines (backtest-validated)
| Strategy | Expected Score |
|---|---|
| Random Walk | 30 – 35 |
| Flat Line | 23 – 35 |
| Naive Trend | 35 – 50 |
| Near Perfect | 98 – 100 |

### Payout Curve
Two-zone multiplier: refund zone below break-even, exponential profit zone above.
- House edge: 2%
- Break-even score: 60/100
- Min multiplier: 0.40x (worst score still returns 40% of stake)
- Max multiplier: 25x (hard cap)
- File: `src/scoring/payout.ts`

---

## Phase Completion Status

### Phase 1: Scoring Engine — COMPLETE
- 4-component scoring with 28 unit tests
- Backtesting harness with 5 baseline strategies
- Calibrated against 7 months of BTC data (302k candles)
- Economics analysis with retention and bankroll-risk guardrails
- Fairness tests ensuring ranking ladders are monotonic

### Phase 2: Drawing UI — COMPLETE
- Freehand drawing on lightweight-charts
- Mouse + touch event support (mobile-compatible)
- Drawing constraints: slope caps, spacing minimums, time-ordered control points
- Future zone visualization with gradient overlay
- Technical analysis toolbar (SMA, EMA, Bollinger, RSI)

### Phase 3: Game Loop — COMPLETE
- Full state machine: Setup → Draw → Submitted (Reveal)
- Animated price replay showing actual vs predicted
- Score breakdown display with 4-component bars
- Payout calculation and display
- Seed-based round reproduction (deterministic)
- Local round history persisted to localStorage
- Journal page with filtering, sorting, streak tracking

### Phase 4: Backend — PARTIAL (sandbox-only)
- Express API scaffolded with in-memory storage
- Commitment protocol: `hashCommitment()`, seed derivation, verification endpoints
- API endpoints: `/health`, `/config`, `/rounds`, `/rounds/:id/replay`, `/rounds/:id/verify`
- **NOT done**: Database persistence, wallet auth, blockchain settlement, live oracle

---

## Current App Pages (6 routes)

| Route | Page | Description |
|---|---|---|
| `/` | Landing | Hero with live BTC ticker, value props, CTA |
| `/play` | Trade (Game) | Main game: setup → draw → score → payout |
| `/faq` | Docs | How scoring works, payout table, FAQ |
| `/leaderboard` | Journal | Local round history with stats |
| `/whitepaper` | Paper | Full product paper with PDF/DOCX download |
| `/validate` | Validate | Human scoring comparison tool |

---

## Design System

- **Palette**: Dark theme with warm amber accent (`#d4a85c`)
- **Fonts**: DM Sans (body), JetBrains Mono (data/code)
- **Semantic colors**: Green (`#22c55e`) = profit, Red (`#ef4444`) = loss, Teal (`#67c1b4`) = actual line
- **CSS approach**: Tailwind 4 utility classes + CSS custom properties in `src/ui/index.css`
- **Component classes**: `.dtc-panel`, `.dtc-eyebrow`, `.dtc-chip`, `.dtc-button-primary`, `.dtc-data`, `.dtc-kbd`

---

## Key Commands

```bash
npm run dev          # Start Vite dev server (port 5173)
npm run server       # Start sandbox API (port 3001)
npm test             # Run all 50 tests
npm run build        # Full production build (tsc + docs + vite)
npm run backtest     # Run scoring calibration harness
npm run economics    # Print payout economics analysis
npm run fairness     # Run ranking ladder fairness tests
```

---

## Known Issues / Tech Debt

1. **In-memory backend storage** — Rounds are lost on server restart. Intentional for sandbox.
2. **Touch drawing calibration** — First touch on mobile sometimes needs a crosshair interaction to calibrate `paneOffset`.
3. **Validate page in main nav** — Currently exposed for dev access. Should be moved to footer-only link or behind a dev flag for production.
4. **BTC price data** — 7.6MB JSON shipped in `public/`. Fine for sandbox; a production app should fetch on demand.
5. **No wallet connection** — "Connect Wallet" button shows nothing (sandbox mode). Not an issue for portfolio showcase.

---

## Recent Changes (this session, 2026-03-08)

1. **Turning point scoring fix**: The old code gave 20/20 when actual had no detected extrema after Gaussian smoothing (common on smooth BTC trends). A trivial straight line would get 65+ total score. Fixed by using Pearson correlation between smoothed paths — near-perfect trackers still get ~20/20, flat lines get ~10/20. All 50 tests pass.

2. **Anchor alignment fix** (from Codex review): `Game.tsx` scoring now correctly prepends `anchorPrice` to `actualPrices` before computing log-returns, matching the backtest harness behavior. Previously, predicted and actual paths had different P₀ reference frames.

3. **TypeScript strict fixes**: `validationStorage.ts` non-null assertions for indexed access patterns.

4. **Color palette finalization**: Settled on warm amber (`#d4a85c`) after trying steel blue and sage green. All hardcoded color references updated across DrawingChart.tsx, PayoutCurve.tsx, Game.tsx, App.tsx, index.html favicon.

5. **Polish pass**: Mobile menu opacity fix, "Brief" → "Setup" label, consistent `max-w-4xl` page widths, consistent footer text, sandbox badge tooltip, BTC price loading states.

---

## Phase 2: Production Gambling Product

If building this out for real users with real money, here's what's needed:

### Must-Have (Blocking)

| Item | Description | Complexity |
|---|---|---|
| **Database** | Replace in-memory `Map<string, Round>()` with Postgres/Supabase. Schema: users, rounds, bets, settlements. | Medium |
| **Wallet auth** | Solana or EVM wallet adapter (Phantom, MetaMask). Sign-message auth to prove ownership. | Medium |
| **USDC deposits** | On-chain deposit/withdrawal flow. Smart contract escrow for player funds. | High |
| **Commit-reveal on-chain** | `protocol.ts` already has `hashCommitment()`. Needs on-chain commit so house can't front-run. | High |
| **Live price oracle** | Pyth Network or Chainlink for trusted settlement price. Replace historical data round source. | Medium |
| **Bankroll management** | Smart contract holding house bankroll. Automated settlement based on oracle price + score. | High |

### Should-Have (Important for retention)

| Item | Description | Complexity |
|---|---|---|
| **Rate limiting / anti-bot** | Prevent automated high-frequency play. Proof-of-humanity or stake-gating. | Medium |
| **Round history API** | Persist rounds server-side. Let users review past rounds with full chart replay. | Medium |
| **Real leaderboard** | Replace mock/local data with actual player stats from database. | Low |
| **Mobile drawing polish** | Touch calibration is functional but could be tighter. Haptic feedback, palm rejection. | Medium |
| **Real-time multiplayer** | Show other players' predictions after settlement (social proof, competition). | High |
| **Email/notification** | Round settlement notifications. Weekly digest of performance. | Low |

### Nice-to-Have (Growth features)

| Item | Description | Complexity |
|---|---|---|
| **Additional assets** | ETH, SOL, other majors. Scoring engine is asset-agnostic already. | Low |
| **Custom timeframes** | Let users pick any duration beyond the 5 fixed presets. | Low |
| **Social sharing** | Screenshot + share prediction results to Twitter/Discord. | Low |
| **Referral system** | House edge rebate for referrals. Trackable links. | Medium |
| **Analytics dashboard** | Player retention curves, score distributions, bankroll health over time. | Medium |
| **Tournament mode** | Fixed-entry tournaments with prize pools. | High |

---

## Portfolio / Resume Talking Points

- "Full-stack prediction game with a deterministic 4-component scoring engine"
- "Scoring validated against 7 months of historical BTC data via automated backtesting"
- "Hungarian algorithm for turning point matching, Gaussian smoothing for noise reduction"
- "50 automated tests including fairness tests and economic guardrail assertions"
- "Provable payout curve with published house edge (2%) and break-even score (60/100)"
- "Freehand drawing UI with touch support, technical analysis overlays, animated replay"
- "Seed-based deterministic round reproduction for auditability"
