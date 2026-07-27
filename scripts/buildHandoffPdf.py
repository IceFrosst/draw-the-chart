#!/usr/bin/env python3
"""Build the internal Build Handoff / Technical Spec PDF for Draw The Chart.

A complete, self-contained brief that an AI (or engineer) can read cold and
start building from. Covers: current state, the full v3 scoring internals
with exact formulas + parameters, what is left to do, and how to rebuild
cleanly.

Usage: python3 scripts/buildHandoffPdf.py
Output: public/DTC_Build_Handoff.pdf
"""

import os

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, HRFlowable, NextPageTemplate, PageBreak,
    PageTemplate, Paragraph, Preformatted, Spacer, Table, TableStyle,
)

# ── fonts ────────────────────────────────────────────────────────────
SUP = "/System/Library/Fonts/Supplemental"
pdfmetrics.registerFont(TTFont("Georgia", f"{SUP}/Georgia.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Bold", f"{SUP}/Georgia Bold.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-Italic", f"{SUP}/Georgia Italic.ttf"))
pdfmetrics.registerFont(TTFont("Georgia-BoldItalic", f"{SUP}/Georgia Bold Italic.ttf"))
pdfmetrics.registerFont(TTFont("Arial", f"{SUP}/Arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", f"{SUP}/Arial Bold.ttf"))
pdfmetrics.registerFontFamily(
    "Georgia", normal="Georgia", bold="Georgia-Bold",
    italic="Georgia-Italic", boldItalic="Georgia-BoldItalic",
)

NAVY = colors.HexColor("#16243d")
ACCENT = colors.HexColor("#2456a6")
GREEN = colors.HexColor("#1f7a4d")
RED = colors.HexColor("#b03a3a")
GREY = colors.HexColor("#5a6472")
LIGHT = colors.HexColor("#eef1f6")
CODEBG = colors.HexColor("#f4f6fa")
RULE = colors.HexColor("#c9d2e0")

# ── styles ───────────────────────────────────────────────────────────
body = ParagraphStyle("body", fontName="Georgia", fontSize=9.8, leading=14.2,
                      alignment=TA_JUSTIFY, textColor=colors.HexColor("#1c2430"), spaceAfter=7)
bullet = ParagraphStyle("bullet", parent=body, leftIndent=15, bulletIndent=4, spaceAfter=3.5)
h1 = ParagraphStyle("h1", fontName="Arial-Bold", fontSize=15, leading=18.5, textColor=NAVY,
                    spaceBefore=18, spaceAfter=7)
h2 = ParagraphStyle("h2", fontName="Arial-Bold", fontSize=11.3, leading=14.5, textColor=ACCENT,
                    spaceBefore=12, spaceAfter=4)
formula = ParagraphStyle("formula", parent=body, fontName="Georgia-Italic", alignment=TA_CENTER,
                         spaceBefore=3, spaceAfter=7, textColor=NAVY)
caption = ParagraphStyle("caption", parent=body, fontName="Georgia-Italic", fontSize=8.6,
                         alignment=TA_CENTER, textColor=GREY, spaceBefore=2, spaceAfter=9)
code = ParagraphStyle("code", fontName="Courier", fontSize=8.2, leading=11.2,
                      textColor=colors.HexColor("#1c2430"))
tbl_cell = ParagraphStyle("tcell", parent=body, fontSize=8.7, leading=11.5, spaceAfter=0, alignment=TA_LEFT)
tbl_cell_c = ParagraphStyle("tcellc", parent=tbl_cell, alignment=TA_CENTER)
tbl_head = ParagraphStyle("thead", parent=tbl_cell, fontName="Arial-Bold", textColor=colors.white,
                          alignment=TA_CENTER)
callout = ParagraphStyle("callout", parent=body, fontSize=9.4, leading=13.6, leftIndent=8,
                         rightIndent=8, spaceBefore=2, spaceAfter=2)


def P(text, style=body):
    return Paragraph(text, style)


def Bu(items):
    return [Paragraph(t, bullet, bulletText="–") for t in items]


def TBL(headers, rows, widths, center=True, head_bg=NAVY):
    cell = tbl_cell_c if center else tbl_cell
    data = [[Paragraph(h, tbl_head) for h in headers]]
    for r in rows:
        data.append([Paragraph(str(c), cell) for c in r])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    st = [("BACKGROUND", (0, 0), (-1, 0), head_bg),
          ("GRID", (0, 0), (-1, -1), 0.4, RULE),
          ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
          ("TOPPADDING", (0, 0), (-1, -1), 3.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
          ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6)]
    for i in range(1, len(data)):
        if i % 2 == 0:
            st.append(("BACKGROUND", (0, i), (-1, i), LIGHT))
    t.setStyle(TableStyle(st))
    return t


def Code(text):
    pre = Preformatted(text, code)
    t = Table([[pre]], colWidths=[16.0 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODEBG),
        ("BOX", (0, 0), (-1, -1), 0.5, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def Box(paragraphs, border=ACCENT, bg=colors.HexColor("#f0f4fb")):
    t = Table([[paragraphs]], colWidths=[16.0 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 1.0, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(2.0 * cm, 1.5 * cm, A4[0] - 2.0 * cm, 1.5 * cm)
    canvas.setFont("Georgia", 8)
    canvas.setFillColor(GREY)
    canvas.drawString(2.0 * cm, 1.15 * cm, "Draw The Chart — Build Handoff")
    canvas.drawRightString(A4[0] - 2.0 * cm, 1.15 * cm, str(doc.page))
    canvas.restoreState()


def no_footer(canvas, doc):
    pass


out = os.path.join(os.path.dirname(__file__), "..", "DTC_Build_Handoff.pdf")
doc = BaseDocTemplate(os.path.abspath(out), pagesize=A4,
                      leftMargin=2.0 * cm, rightMargin=2.0 * cm,
                      topMargin=1.9 * cm, bottomMargin=1.9 * cm,
                      title="Draw The Chart — Build Handoff & Technical Spec",
                      author="Draw The Chart")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([
    PageTemplate(id="title", frames=[frame], onPage=no_footer),
    PageTemplate(id="body", frames=[frame], onPage=footer),
])

S = []

# ════════ TITLE ════════
title = ParagraphStyle("t", fontName="Arial-Bold", fontSize=30, leading=35, textColor=NAVY, alignment=TA_CENTER)
sub = ParagraphStyle("s", fontName="Georgia-Italic", fontSize=13, leading=18, textColor=GREY, alignment=TA_CENTER, spaceBefore=12)
meta = ParagraphStyle("m", fontName="Arial", fontSize=10.5, leading=15, textColor=NAVY, alignment=TA_CENTER)

S.append(Spacer(1, 4.2 * cm))
S.append(P("DRAW THE CHART", title))
S.append(Spacer(1, 0.2 * cm))
S.append(HRFlowable(width="46%", thickness=1.1, color=ACCENT, hAlign="CENTER"))
S.append(P("Build Handoff &amp; Technical Specification", sub))
S.append(P("Everything built, everything left, and the full scoring internals", sub))
S.append(Spacer(1, 1.4 * cm))
S.append(P("Internal build document · Version 1.0 · June 2026", meta))
S.append(Spacer(1, 5.5 * cm))
S.append(Box([
    P("<b>How to use this document.</b> This is a self-contained brief for whoever builds the next "
      "version of Draw The Chart — a human engineer or an AI coding agent. It states the current "
      "state of the project, specifies the scoring engine precisely enough to re-implement it, lists "
      "what remains to be done in priority order, and explains how to rebuild the front-end cleanly "
      "while preserving the parts that matter. If you are an AI agent picking this up: read Sections 3 "
      "and 4 in full before writing any code, and treat Section 7 as hard constraints.", callout),
]))
S.append(NextPageTemplate("body"))
S.append(PageBreak())

# ════════ 1. WHAT THE PROJECT IS ════════
S.append(P("1.&nbsp;&nbsp;What the project is", h1))
S.append(P("Draw The Chart (DTC) is a house-versus-player crypto prediction game. The player sees the "
           "BTC price chart up to a frozen moment (the <i>anchor</i>), then <b>draws the future price "
           "path</b> they expect over a fixed horizon (15 minutes, 1 hour, 6 hours, 24 hours, or 7 days), "
           "stakes an amount, and is paid based on how good the prediction was. It sits between prediction "
           "markets (too simple — just yes/no) and leveraged trading (too complex — liquidations, "
           "sizing, execution). The chart is the game mechanic, not a decoration."))
S.append(P("The product is a web app: a React front-end, a pure-TypeScript scoring engine, and a thin "
           "backend (currently Supabase for storing rounds; on-chain settlement is future work). It is "
           "deployed on Vercel and gated behind a password for friends-only testing."))

# ════════ 2. CURRENT STATE ════════
S.append(P("2.&nbsp;&nbsp;Current state — what exists today", h1))
S.append(P("The project is past prototype. The core loop runs end to end in a sandbox against real "
           "historical BTC data. The list below is the honest status of each piece."))
S.append(TBL(
    ["Area", "Status", "Notes"],
    [["Scoring engine (v3)", "DONE + validated", "The new field-relative engine. Pure logic, fully tested against 5 years of data. The crown jewel."],
     ["Scoring engine (v0.2, old)", "DEPRECATED", "The original absolute-similarity engine. Still wired in for side-by-side comparison; to be deleted."],
     ["Drawing interaction", "DONE", "Freehand draw on chart, mobile touch, normalization into clean points. Good and reusable."],
     ["Game loop (sandbox)", "DONE", "Draw → submit → reveal → score → payout, on historical data, with replay animation."],
     ["Reveal / score display", "PARTIAL", "Shows the score and breakdown, but does not yet explain the field ranking. Highest-impact gap."],
     ["Front-end design / pages", "ROUGH", "Landing, FAQ, leaderboard, admin pages exist but are inconsistent. Intended for a clean rebuild."],
     ["Persistence (Supabase)", "PARTIAL", "Stores rounds + feedback. Needs v3 fields (percentile, seed, field version) added."],
     ["Wallet / real money", "NOT STARTED", "No wallet login, no on-chain settlement, no bankroll. All future work."],
     ["Deployment", "DONE", "Vercel auto-deploys from the master branch. Password-gated."]],
    [4.0 * cm, 3.0 * cm, 9.0 * cm], center=False))
S.append(Spacer(1, 4))
S.append(P("<b>In one line:</b> the hard math (fair + solvent scoring) is solved and proven; what remains "
           "is making the game <i>feel</i> right to players, then adding real-money infrastructure."))

# ════════ 3. REPOSITORY MAP ════════
S.append(P("3.&nbsp;&nbsp;Repository map — keep vs. discard", h1))
S.append(P("The architecture deliberately separates the scoring “brain” from the UI “face.” "
           "The brain (~630 lines) imports nothing from React or the browser; it is pure functions. This is "
           "why the entire front-end can be rebuilt while the engine is reused untouched."))
S.append(P("Keep (irreplaceable):", h2))
S.append(TBL(
    ["Path", "What it is", "Why keep"],
    [["src/scoring/v3/", "The v3 scoring engine: similarity.ts, field.ts, payout.ts, index.ts", "The core IP. Hard to recreate; fully portable."],
     ["src/scoring/score.ts", "Shared helpers (log-returns, resampling)", "Used by the engine."],
     ["scripts/v3Probe.ts", "Validation harness (fairness + economics)", "Proves the engine works; re-run after any change."],
     ["scripts/fairnessProbe.ts", "The original probe that found the old bug", "Reference / regression check."],
     ["data/ (local only)", "2.7M BTC 1-minute candles, 2021–2026", "Needed for all testing. NOT on GitHub — back it up."],
     ["WHITEPAPER_v3.md + this PDF", "Design spec and blueprint", "Tells the rebuild how it should work."],
     ["drawing-capture logic", "Inside DrawingChart.tsx: stroke → normalized points", "Fiddly to recreate; extract before scrapping the component."]],
    [3.7 * cm, 6.6 * cm, 5.7 * cm], center=False))
S.append(Spacer(1, 5))
S.append(P("Discard freely (rebuild cleanly):", h2))
S.append(P("All page layouts and styling, the navigation, the score/payout panels, and the "
           "Landing / FAQ / Leaderboard / Admin pages. None of it is precious. The look is the easy part "
           "to redo once the engine is preserved. The old v0.2 scoring files (everything in src/scoring "
           "<i>outside</i> v3, except the shared helpers) can also go once v3 is the only scorer."))

# ════════ 4. THE SCORING ENGINE ════════
S.append(P("4.&nbsp;&nbsp;The scoring engine (read this in full)", h1))
S.append(P("4.1&nbsp;&nbsp;The core idea, and why the old engine was broken", h2))
S.append(P("The original engine graded a drawing on an <b>absolute</b> scale: it measured how close the "
           "drawing was to reality and mapped that to 0–100. This failed for a structural reason: how "
           "“close” a fixed-quality drawing looks depends entirely on the market that round. In a calm "
           "market, small wiggles look like big errors; in a wild market, a sloppy drawing looks fine. The "
           "result, measured on real data: a near-perfect drawing that was merely 8% late in time lost "
           "head-to-head to a <i>random scribble</i> in 6.9% of rounds. Players felt this as “random "
           "drawings score better than good ones.” It could not be fixed by tuning — the broken "
           "assumption was the absolute scale itself."))
S.append(P("The v3 engine asks a <b>relative</b> question instead: <i>“given this exact round, did your "
           "drawing beat what a no-skill player would have drawn?”</i> It does this in three layers, "
           "each feeding the next:"))
S.append(Box([
    P("<b>Layer 1 – Similarity.</b> Measure how close the drawing is to what actually happened. "
      "Output: a number 0–100. (Used only to <i>rank</i> — it is not the final score.)", callout),
    Spacer(1, 3),
    P("<b>Layer 2 – Field.</b> Generate 5,000 fake “no-skill” forecasts for this exact round, "
      "score each with Layer 1, and rank the player among them. Output: a percentile, e.g. 0.77.", callout),
    Spacer(1, 3),
    P("<b>Layer 3 – Payout.</b> Convert the percentile to a money multiplier with a published curve "
      "whose average payout is mathematically locked to 1 − house edge.", callout),
]))
S.append(Spacer(1, 4))
S.append(P("Why this is fair and solvent <i>by construction</i>: the 5,000 fakes face the same market the "
           "player does, so round difficulty cancels out automatically — a given drawing quality earns "
           "a similar percentile whether the market was calm or chaotic. And because a no-skill player is, "
           "by definition, indistinguishable from the fakes, their percentile is random (uniform), so their "
           "average payout is exactly 1 − house edge. The house edge is a design constant, not a lucky "
           "outcome of tuning.", body))

S.append(P("4.2&nbsp;&nbsp;Layer 1 — Similarity (0–100)", h2))
S.append(P("All paths are first converted to <b>log-return space</b> (each point becomes ln(price / "
           "start price), so the path starts at 0) and resampled to <b>N = 120</b> evenly spaced points. "
           "All errors are scaled by an <b>effective volatility</b> so the score is read in units of how "
           "much the market actually moved:"))
S.append(P("sigma_eff = max( std(actual path), 0.5 &times; typical sigma for this timeframe )", formula))
S.append(P("Similarity is the sum of three components. Each measures one distinct thing, and no error is "
           "penalized twice (a deliberate fix — the old engine double-counted):"))
S.append(P("<b>Shape &amp; Timing (0–50)</b> — the heaviest, because shape matters most. Uses "
           "<b>banded Dynamic Time Warping (DTW)</b>: it lines up the two paths allowing small timing "
           "shifts (up to 10% of the horizon, a band of 12 of the 120 points), then measures the leftover "
           "distance. This is the formal version of what the human eye does. A drawing with the right shape "
           "but slightly mistimed loses credit <i>smoothly</i> — there are no cliffs, which is what made "
           "the old turning-point component feel random."))
S.append(P("S1 = 50 &times; exp( &minus; &lambda;_shape &times; D / (N &times; sigma_eff) ),&nbsp;&nbsp; "
           "&lambda;_shape = 2.2", formula))
S.append(P("<b>Direction (0–30)</b> — did the player get the up/down moves right? The horizon is "
           "split into halves, quarters, eighths; in each piece the sign of the predicted net move is "
           "compared to reality. Crucially each piece is <b>weighted by how much the market actually "
           "moved</b>, so calling the direction right on a big move counts far more than on a flat stretch "
           "(this kills the coin-flip noise the old engine had)."))
S.append(P("<b>Level (0–20)</b> — was the price level roughly right? Combines overall bias (was the "
           "whole drawing too high or too low) and endpoint error (where it finished), each scaled by "
           "sigma_eff and passed through a smooth exponential (&lambda;_level = 1.2)."))
S.append(P("A separate turning-point detector (Hungarian matching) is kept <b>only as a reveal-screen "
           "explainer</b> (“you called this top 9 minutes early”). It annotates; it does not affect "
           "the score or the money. This is intentional."))

S.append(P("4.3&nbsp;&nbsp;Layer 2 — The synthetic field", h2))
S.append(P("For each round, generate <b>B = 5,000</b> baseline forecasts from a fixed recipe, score every "
           "one with Layer 1 against the same realized path, and compute the player’s mid-rank "
           "percentile U = (count below player + 0.5 &times; ties) / B. The field is the set of "
           "<b>every strategy a player with no real insight could use</b> — so playing any of them earns "
           "a roughly average percentile and therefore exactly the house edge. The mixture:"))
S.append(TBL(
    ["Share", "Generator", "What it represents"],
    [["40%", "Block bootstrap", "Real recent price wiggles stitched together — realistic noise & fat tails"],
     ["20%", "Random walk (GBM)", "Pure randomness at the current volatility level"],
     ["15%", "Trend extrapolators", "“It has been going up, so it keeps going up” (several strengths)"],
     ["10%", "Mean reverters", "“It has moved a lot, so it pulls back”"],
     ["10%", "Flat &amp; drift lines", "“Not much will happen” ± small slopes"],
     ["5%", "Smoothed / lagged replays", "Plausible but low-effort shapes"]],
    [1.6 * cm, 4.4 * cm, 10.0 * cm], center=False))
S.append(Spacer(1, 4))
S.append(P("Two engineering details that matter:", body))
S.extend(Bu([
    "<b>Deterministic seeding.</b> The 5,000 paths are generated from a seed derived from the round’s "
    "commitment (a hash fixed <i>before</i> the player draws). This means the house cannot secretly pick a "
    "friendlier field, and anyone can re-generate the exact field afterward to verify the result. The "
    "settlement is reproducible by a third party.",
    "<b>Antithetic mirroring.</b> The random generators (bootstrap, GBM) emit each path together with its "
    "exact mirror image. This guarantees the random part of the field can never accidentally lean bullish "
    "or bearish in a given round — it removes a subtle source of per-round unfairness.",
]))

S.append(P("4.4&nbsp;&nbsp;Layer 3 — Payout", h2))
S.append(P("The percentile maps to a multiplier through a three-zone curve, published before each round:"))
S.extend(Bu([
    "<b>Refund zone</b> (below the break-even percentile): partial loss, softened by a floor.",
    "<b>Profit zone</b> (above break-even): exponential growth — strong forecasts pay well.",
    "<b>Jackpot tail</b> (top ~1%): a linear ramp up to the cap for beating essentially the whole field.",
]))
S.append(P("The growth rate g is <b>solved numerically</b> so the average multiplier over all percentiles "
           "equals exactly 1 &minus; h. The recommended (“Standard”) profile and its payout table:"))
S.append(TBL(
    ["Parameter", "Value", "", "Percentile", "Multiplier (per $100)"],
    [["House edge h", "4%", "", "0.50", "0.52&times; ($52)"],
     ["Break-even percentile", "0.80", "", "0.65", "0.74&times; ($74)"],
     ["Floor multiplier", "0.15&times;", "", "0.80 (break-even)", "1.00&times; ($100)"],
     ["Refund exponent", "1.8", "", "0.90", "2.48&times; ($248)"],
     ["Jackpot starts", "0.99", "", "0.95", "3.91&times; ($391)"],
     ["Cap", "12&times;", "", "0.99", "5.63&times; ($563)"],
     ["Solved growth g", "9.0944", "", "1.00 (beat all)", "12.00&times; ($1,200)"]],
    [3.8 * cm, 2.2 * cm, 0.5 * cm, 3.6 * cm, 5.0 * cm], center=False))
S.append(Spacer(1, 4))
S.append(P("<b>Score scale note for the UI:</b> displayed score = percentile &times; 100. So 50 is an "
           "average no-skill result, <b>80 is break-even</b>, and 99+ is jackpot territory. This is a "
           "tougher-looking scale than the old engine’s, but it is honest — a clearly wrong "
           "prediction should score low, not 40."))

S.append(P("4.5&nbsp;&nbsp;Proof it works (validation results)", h2))
S.append(P("Run with: <font name='Courier' size='8.5'>npx tsx scripts/v3Probe.ts 240</font> (1,200 "
           "historical rounds across all timeframes). Latest results:"))
S.append(TBL(
    ["Test", "Target", "Result"],
    [["Random scribble beats a good (8%-late) drawing", "&lt; 1% of rounds", "0.0%  (old engine: 6.9%)"],
     ["Random walk — average payout", "&le; 0.96 (no edge gained)", "0.92"],
     ["Trend-following — average payout", "&le; 0.96", "0.96 (exactly the edge)"],
     ["Good drawings (lagged / damped / warped copies)", "rank near top", "beat &ge; 99% of field"],
     ["Perfect / near-perfect drawings", "top of field", "100th percentile"]],
    [8.4 * cm, 4.0 * cm, 3.6 * cm], center=False))
S.append(Spacer(1, 4))
S.append(P("Interpretation: good drawings reliably win, no zero-skill strategy can beat the house edge, "
           "and the headline fairness bug is gone. One known and intentional behavior: a perfectly flat "
           "“no-thesis” line ranks low (around the 24th percentile), because most of the field "
           "expresses some view — the game rewards having one."))

S.append(P("4.6&nbsp;&nbsp;Full parameter sheet (current defaults)", h2))
S.append(Code(
    "LAYER 1  Similarity\n"
    "  N (resample points)        120\n"
    "  DTW band                   12 samples  (= 10% of horizon)\n"
    "  lambda_shape               2.2\n"
    "  direction levels / decay   3 / 2.5\n"
    "  lambda_level               1.2\n"
    "  weights  shape/dir/level   50 / 30 / 20\n"
    "  sigma_eff floor            0.5 * typical-sigma(timeframe)\n\n"
    "LAYER 2  Field\n"
    "  B (field size)             5000   (client)  /  20000-50000 (server, later)\n"
    "  mixture                    40 / 20 / 15 / 10 / 10 / 5  (see 4.3)\n"
    "  bootstrap block length     horizon / 8\n"
    "  EWMA volatility lambda      0.94\n"
    "  antithetic                 on, for bootstrap + GBM cohorts\n"
    "  seed                       SHA256(round commitment) — reproducible\n\n"
    "LAYER 3  Payout  (Standard profile)\n"
    "  house edge h               0.04\n"
    "  break-even percentile      0.80\n"
    "  min multiplier (floor)     0.15x\n"
    "  refund exponent            1.8\n"
    "  jackpot start              0.99\n"
    "  max multiplier (cap)       12x\n"
    "  growth rate g              9.0944  (solved so avg payout = 1 - h)\n"
    "  stake cap                  0.56% of bankroll  (quarter-Kelly)"
))

# ════════ 5. THE ENGINE API ════════
S.append(P("5.&nbsp;&nbsp;How to call the engine (the API)", h1))
S.append(P("The whole engine is reached through one function. A new UI only needs this:"))
S.append(Code(
    "import { scoreRoundV3 } from 'src/scoring/v3';\n\n"
    "const result = scoreRoundV3({\n"
    "  predictedPrices,   // number[] : the player's drawing as prices, anchor first\n"
    "  actualPrices,      // number[] : what really happened, anchor first, same length\n"
    "  lookbackPrices,    // number[] : prices before the anchor (used to build the field)\n"
    "  seed,              // number   : round seed (live: derived from commitment hash)\n"
    "  stake,             // number   : optional, default 100\n"
    "});\n\n"
    "// result contains:\n"
    "//   similarity   { shape, direction, level, total }   // Layer 1, 0-100\n"
    "//   percentile   0..1     -> displayed score = percentile * 100\n"
    "//   beaten       how many of the field the player beat\n"
    "//   fieldSize    5000\n"
    "//   multiplier   payout multiplier\n"
    "//   profit       stake * (multiplier - 1)\n"
    "//   fieldSimilarities  number[]  // every field score, for the swarm visualization"
))
S.append(P("It is a pure function: same inputs always give the same outputs, and it runs anywhere "
           "(browser or server) in about 100 milliseconds. Nothing else in the engine needs to be touched "
           "to build a new front-end.", body))

# ════════ 6. WHAT IS LEFT ════════
S.append(P("6.&nbsp;&nbsp;What is left to do (in order)", h1))
S.append(P("We are in <b>Phase 3 of 5: make the game feel right.</b> The engine (Phase 1) and the basic "
           "playable loop (Phase 2) are done. The remaining work, in the order it should be tackled:"))

S.append(P("Step 1 — Lock fairness into automatic tests", h2))
S.append(P("Today the fairness proof lives in a script run by hand. Port its checks into the automated "
           "test suite so any future change that breaks fairness or the house edge fails the build "
           "immediately. <i>Done when:</i> the test suite asserts “no zero-skill strategy beats the "
           "edge” and “good drawings beat random &gt; 99% of the time.” Effort: ~1 day."))

S.append(P("Step 2 — Make v3 the only score", h2))
S.append(P("The reveal screen currently shows two scores (old + new) for comparison. Remove the old one "
           "and its payout curve everywhere. Keep the turning-point detector only as an annotation. Fix "
           "all labels to the new scale (break-even = 80). <i>Done when:</i> one score, one payout, no "
           "contradictory numbers on screen. Effort: ~1 day."))

S.append(P("Step 3 — Make the reveal screen explain the ranking (highest impact)", h2))
S.append(P("This is the most important remaining piece. Players need to <i>see</i> why they ranked where "
           "they did, or the percentile feels arbitrary. Build: the field of 5,000 forecasts drawn faintly "
           "behind the chart (a “swarm”), a context line such as “field median accuracy 24/100 "
           "— almost nobody saw this move,” a tag for tail-event rounds, and the ability to inspect "
           "the few forecasts that just beat the player. The engine already returns the field scores needed "
           "for this. <i>Done when:</i> a confused tester can look at the reveal and understand who beat "
           "them and why. Effort: ~1 week."))

S.append(P("Step 4 — Rebuild the front-end cleanly &amp; re-test with friends", h2))
S.append(P("Rebuild the rough pages into a clean, consistent UI (see Section 8 for how). Add the v3 fields "
           "to storage (percentile, seed, field version). Point the leaderboard at percentile — because "
           "it is regime-fair, a leaderboard finally means something. Re-open to friends and compare "
           "fairness feedback against the old data already collected. <i>Done when:</i> more testers say "
           "“that felt fair” than before. Effort: 1–2 weeks of build + testing time."))

S.append(P("Step 5 — Real-money infrastructure (only after Step 4 confirms it feels right)", h2))
S.append(P("The largest chunk: wallet login, stablecoin betting on Base, a bankroll vault with the stake "
           "and exposure caps from the spec, the commit-reveal settlement that makes rounds verifiable, a "
           "price oracle (multi-venue median), and legal / responsible-use controls (geo-gating, limits, "
           "self-exclusion). The server runs the same engine function at a larger field size (20k–50k). "
           "<i>Done when:</i> a round can be played for real money and independently verified. This is "
           "where most future effort goes, and none of it should start before the game is trusted."))

S.append(P("Explicitly NOT now", h2))
S.append(P("Tokens, assets beyond BTC, player-vs-player mode, and early cash-out. All tempting, all "
           "distractions until the core is trusted. They become easier later and fix nothing now."))

# ════════ 7. HARD CONSTRAINTS ════════
S.append(P("7.&nbsp;&nbsp;Hard constraints (do not violate)", h1))
S.append(P("These are the rules that keep the system fair and solvent. They were learned the hard way from "
           "the old engine. An AI agent should treat them as non-negotiable.", body))
S.append(TBL(
    ["Do", "Don't"],
    [["Keep scoring a pure function, separate from UI", "Mix scoring logic into React components"],
     ["Let the money flow through the percentile rank", "Pay out directly off the raw 0–100 similarity"],
     ["Make every penalty smooth (no thresholds)", "Add hard cutoffs / cliffs (“within 5% or zero”)"],
     ["Penalize each error type exactly once", "Double-count (e.g. a late turn as both missed and fake)"],
     ["Seed the field from the pre-draw commitment", "Generate the field after seeing the outcome"],
     ["Re-solve g whenever a payout parameter changes", "Hand-pick a multiplier curve and hope the edge holds"],
     ["Re-run v3Probe after any scoring change", "Ship a scoring change without re-validating"],
     ["Keep all naive strategies inside the field", "Leave a naive strategy out (it becomes exploitable)"]],
    [8.0 * cm, 8.0 * cm], center=False, head_bg=NAVY))
S.append(Spacer(1, 4))
S.append(Box([
    P("<b>The single most important invariant:</b> the average payout to a no-skill player equals "
      "1 &minus; house edge, in every market regime, by construction. If a change could break that, it is "
      "wrong — no matter how good it looks. The economics live in Layers 2 and 3; Layer 1 can be tuned "
      "freely for how the score <i>feels</i>, because it only affects ranking, never the edge.", callout),
], border=RED, bg=colors.HexColor("#fbf0f0")))

# ════════ 8. HOW TO REBUILD CLEANLY ════════
S.append(P("8.&nbsp;&nbsp;How to rebuild the front-end cleanly", h1))
S.append(P("The recommended path for a clean rebuild, given the engine is already portable:"))
S.extend(Bu([
    "<b>Start a fresh project</b> (React + TypeScript + Vite, or your framework of choice).",
    "<b>Copy <font name='Courier' size='8.5'>src/scoring/</font> in untouched.</b> It works on day one "
    "because it never depended on the old UI. Add the v3Probe script too, and confirm it passes.",
    "<b>Build the round flow</b> around the single <font name='Courier' size='8.5'>scoreRoundV3()</font> "
    "call: setup → draw → submit → reveal. Reuse the drawing-capture logic extracted from the "
    "old DrawingChart component; rebuild the chart visuals fresh (lightweight-charts or similar).",
    "<b>Design the reveal screen first-class</b> (Section 6, Step 3) — it is the heart of the product, "
    "not an afterthought.",
    "<b>Keep pages minimal</b> to start: Play, and a simple How-It-Works. Add leaderboard / FAQ / admin "
    "later. Resist rebuilding everything at once.",
]))
S.append(P("Back up the <font name='Courier' size='8.5'>data/</font> folder before anything else — it "
           "is 65MB of historical candles that exists only locally (it is excluded from GitHub on purpose) "
           "and is needed to run the validation. Everything else is already safe in the repository.", body))

# ════════ 9. GLOSSARY ════════
S.append(P("9.&nbsp;&nbsp;Quick glossary", h1))
S.append(TBL(
    ["Term", "Plain meaning"],
    [["Anchor", "The frozen “now” moment the round starts from"],
     ["Horizon", "How far into the future the player predicts (15m … 7d)"],
     ["Log-return space", "Prices re-expressed as growth from the start, so different price levels compare fairly"],
     ["The field", "5,000 fake no-skill forecasts the player is ranked against each round"],
     ["Percentile (U)", "Fraction of the field the player beat; the basis of the score and payout"],
     ["House edge (h)", "The house’s guaranteed average cut, 4% in the Standard profile"],
     ["DTW", "Dynamic Time Warping — compares two paths allowing small timing shifts"],
     ["Antithetic", "Pairing each random path with its mirror so the field can’t lean directionally"],
     ["Commit-reveal", "Locking the round secretly first, revealing after, so results are verifiable"]],
    [3.6 * cm, 12.4 * cm], center=False))
S.append(Spacer(1, 8))
S.append(HRFlowable(width="100%", thickness=0.5, color=RULE))
S.append(Spacer(1, 4))
S.append(P("End of handoff. The fuller public-facing design rationale lives in WHITEPAPER_v3.md; the "
           "engine source is in src/scoring/v3/; the proof is scripts/v3Probe.ts. Start with Sections 3, 4, "
           "and 7.", caption))

doc.build(S)
print(f"Wrote {os.path.abspath(out)}")
