# Draw The Chart (DTC) — Agent Onboarding

Read this first. It is the single source of truth for project state. The deep
documents it points to: `WHITEPAPER_v3.md` (full architecture spec + design
rationale) and `DTC_Build_Handoff.pdf` (technical brief). Anything that
contradicts this file is outdated.

## What this is

A house-vs-player crypto prediction game. The player sees BTC history up to a
frozen anchor, freehand-draws the future price path over a horizon (15m / 1h /
6h / 24h / 7d), and is paid by how good the prediction was. Web app: React 19 +
TypeScript strict + Vite + Tailwind 4 + lightweight-charts; Supabase for
round/feedback persistence; deployed on Vercel from `master`
(https://draw-the-chart.vercel.app, password-gated for friends testing).

## The scoring model (v3, "field-relative") — CURRENT

Do NOT confuse this with the deprecated v0.2 absolute scoring (Direction 40 /
Magnitude 30 / Turning Points 20 / Volatility 10). That model measured absolute
similarity, was proven unfair (random scribbles beat good drawings in 6.9% of
rounds) and economically broken (−7.9% house edge). It survives only for legacy
Supabase persistence. All product logic uses v3, in `src/scoring/v3/`:

1. **Layer 1 — Similarity** (`similarity.ts`): perceptual closeness 0–100.
   Banded DTW shape/timing (50) + magnitude-weighted multi-scale direction (30)
   + level/endpoint (20). Smooth everywhere; no hard thresholds; used only to
   RANK, never to pay.
2. **Layer 2 — Field** (`field.ts`): B = 5,000 deterministic synthetic
   forecasts per round (block bootstrap 40%, GBM 20%, trend 15%, mean-revert
   10%, flat/drift 10%, smoothed replays 5%), seeded from the round, with
   antithetic mirroring. The player's percentile within the field IS the score
   (displayed ×100; break-even = 80).
3. **Layer 3 — Payout** (`payout.ts`): percentile → multiplier. Standard
   profile: h=4%, break-even at 0.80, floor 0.15x, jackpot tail from 0.99 to
   cap 12x, growth g=9.0944 solved so E[multiplier] = 1−h EXACTLY under a
   zero-skill player. The house edge holds by construction, not by tuning.

Single entry point: `scoreRoundV3({predictedPrices, actualPrices,
lookbackPrices, seed})` in `src/scoring/v3/index.ts` — pure function, ~100ms,
returns similarity breakdown, percentile, payout, and field context
(swarm/rival/median/tail-event) for the reveal UI.

## Hard constraints — do not violate

- Money flows through the percentile rank, never the raw similarity score.
- Every Layer-1 penalty must be a smooth function; no cliffs/thresholds.
- Each error type is penalized exactly once (no double-counting).
- The field is seeded from the round before the player draws; settlement must
  be reproducible from (seed, drawing, realized prices).
- Any payout-parameter change requires re-solving g (`solveGrowthRate`) so
  E[M] = 1−h stays exact.
- Every naive strategy must live inside the field mixture; if players exploit
  a pattern, add a generator for it rather than tweaking scores.
- `src/scoring/**` stays pure (no React, no browser, no side effects).
- Run `npm test` after ANY scoring change — `src/scoring/v3/v3.test.ts` is the
  fairness/economics contract (129 tests). If a fairness test fails, the change
  is wrong, not the test.

## Commands

- `npm test` — full suite (129). The historical suite auto-skips if `data/`
  is absent (it is NOT in git: 72MB of BTC 1m candles, local-only;
  `npm run fetch:data` rebuilds it from Binance).
- `npx tsx scripts/v3Probe.ts [roundsPerTF] [fieldB]` — deep fairness probe.
- `npm run dev` — Vite dev server (password `dtctest2026` via VITE_APP_PASSWORD).
- `npm run build:web` — production build (what Vercel runs; output `dist-web`).
- `npx tsc --noEmit` has PRE-EXISTING errors in supabase.ts / parameterSweep.ts
  / PasswordGate.tsx / Admin.tsx — ignore those; introduce no new ones.

## Repo map

- `src/scoring/v3/` — THE engine (see above) + `v3.test.ts` contract.
- `src/scoring/*` (rest) — legacy v0.2 engine + optimizer/backtest harness;
  still computed silently for Supabase continuity; do not extend.
- `src/ui/pages/Game.tsx` — round state machine, settle, reveal panels.
- `src/ui/components/DrawingChart.tsx` — chart + freehand capture + reveal
  overlays (field swarm, rival path). The drawing-capture logic is precious.
- `src/ui/pages/{Landing,FAQ,Leaderboard}.tsx` — public pages, protocol-style
  hairline design (`.dtc-strip`, `.dtc-hairline-top`, `.dtc-table-hairline`
  in `src/ui/index.css`). Design language: dark terminal, amber accent
  #d4a85c, JetBrains Mono for data, hairlines over boxes.
- `src/lib/roundPersistence.ts` — best-effort Supabase writes (must NEVER
  affect gameplay; keep try/catch).
- `scripts/` — probes, benchmarks, PDF generators.

## Project state

Done and live: v3 engine (validated on 1,200 historical rounds), fairness CI,
v3-only reveal with field swarm/rival/difficulty context, protocol-grade
public pages, Journal with v3 scores, persistence hardening.

Left to do, in order:
1. **Friends testing round 2** (user-driven): collect ~50–100 rounds of
   fairness feedback via the in-app form; compare against stored v0.2-era
   feedback.
2. **Supabase restore + v3 columns**: the Supabase project (okptljdiglihdqnqxgjx)
   auto-paused (free tier) — the user must restore it in the dashboard.
   After restore: add a migration for v3 fields (field_percentile, beaten,
   field_size, field_multiplier) and extend `persistRound` to write them
   (schema in `supabase/migrations/`).
3. **Real-money infrastructure** (gated on 1): wallet auth on Base, on-chain
   commit-reveal, server-side settlement at B=20k–50k, bankroll vault with
   quarter-Kelly stake caps (0.56% of bankroll), exposure reserves, oracle
   (multi-venue median + TWAP), legal/responsible-use. Spec: WHITEPAPER_v3.md
   §7–§9 and DTC_Build_Handoff.pdf §6.

Explicitly out of scope for now: tokens, non-BTC assets, PvP, early cash-out.

## Workflow

- Never commit directly to `master`: branch → PR → merge (Vercel deploys
  `master` automatically).
- Rollback checkpoints are git tags: `v0.3-stable`, `v0.4-stable`,
  `v0.5-stable` (latest = current design).
- Before shipping UI changes: run the app and play a full round; the reveal
  panel, journal entry, and payout numbers must agree.
