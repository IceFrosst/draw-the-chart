#!/usr/bin/env python3
"""Build the public-facing Draw The Chart whitepaper PDF (v3.0).

Usage: python3 scripts/buildWhitepaperPdf.py
Output: public/DrawTheChart_Whitepaper_v3.0.pdf
"""

import math
import os

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, HRFlowable, PageBreak, PageTemplate, Paragraph,
    Spacer, Table, TableStyle, KeepTogether, Flowable,
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
GREY = colors.HexColor("#5a6472")
LIGHT = colors.HexColor("#eef1f6")
RULE = colors.HexColor("#c9d2e0")

# ── styles ───────────────────────────────────────────────────────────
body = ParagraphStyle(
    "body", fontName="Georgia", fontSize=9.8, leading=14.4,
    alignment=TA_JUSTIFY, textColor=colors.HexColor("#1c2430"), spaceAfter=7,
)
bullet = ParagraphStyle("bullet", parent=body, leftIndent=16, bulletIndent=5, spaceAfter=3.5)
h1 = ParagraphStyle(
    "h1", fontName="Arial-Bold", fontSize=15.5, leading=19, textColor=NAVY,
    spaceBefore=20, spaceAfter=8,
)
h2 = ParagraphStyle(
    "h2", fontName="Arial-Bold", fontSize=11.5, leading=15, textColor=ACCENT,
    spaceBefore=13, spaceAfter=5,
)
formula = ParagraphStyle(
    "formula", parent=body, fontName="Georgia-Italic", alignment=TA_CENTER,
    spaceBefore=4, spaceAfter=8, textColor=NAVY,
)
caption = ParagraphStyle(
    "caption", parent=body, fontName="Georgia-Italic", fontSize=8.6,
    alignment=TA_CENTER, textColor=GREY, spaceBefore=3, spaceAfter=10,
)
tbl_cell = ParagraphStyle("tcell", parent=body, fontSize=8.8, leading=12, spaceAfter=0, alignment=0)
tbl_cell_c = ParagraphStyle("tcellc", parent=tbl_cell, alignment=TA_CENTER)
tbl_head = ParagraphStyle(
    "thead", parent=tbl_cell, fontName="Arial-Bold", textColor=colors.white, alignment=TA_CENTER,
)


def P(text, style=body):
    return Paragraph(text, style)


def B(items):
    return [Paragraph(t, bullet, bulletText="–") for t in items]


def TBL(headers, rows, widths, align_center=True):
    cell = tbl_cell_c if align_center else tbl_cell
    data = [[Paragraph(h, tbl_head) for h in headers]]
    for r in rows:
        data.append([Paragraph(str(c), cell) for c in r])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="CENTER")
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.4, RULE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), LIGHT))
    t.setStyle(TableStyle(style))
    return t


# ── architecture diagram flowable ────────────────────────────────────
class ArchDiagram(Flowable):
    def __init__(self, width=15.6 * cm, height=7.4 * cm):
        super().__init__()
        self.width, self.height = width, height

    def draw(self):
        c = self.canv
        w, h = self.width, self.height
        bw, bh = 9.6 * cm, 1.55 * cm
        bx = (w - bw) / 2
        gap = (h - 3 * bh - 0.6 * cm) / 2
        boxes = [
            ("LAYER 1 — SIMILARITY", "Perceptual closeness S (0–100) between drawn and realized path",
             "drawn path + realized path"),
            ("LAYER 2 — SYNTHETIC FIELD", "Player ranked against ~1,500 zero-information forecasts: percentile U",
             "commitment-seeded ensemble"),
            ("LAYER 3 — PAYOUT", "Published curve M(U) with mean payout fixed at 1 − h",
             "stake × multiplier settlement"),
        ]
        y = h - bh - 0.3 * cm
        for i, (title, sub, side) in enumerate(boxes):
            c.setFillColor(LIGHT if i % 2 == 0 else colors.white)
            c.setStrokeColor(NAVY)
            c.setLineWidth(1.1)
            c.roundRect(bx, y, bw, bh, 6, stroke=1, fill=1)
            c.setFillColor(NAVY)
            c.setFont("Arial-Bold", 9.5)
            c.drawCentredString(bx + bw / 2, y + bh - 0.55 * cm, title)
            c.setFillColor(GREY)
            c.setFont("Georgia", 8)
            c.drawCentredString(bx + bw / 2, y + bh - 1.05 * cm, sub)
            c.setFont("Georgia-Italic", 7.6)
            c.setFillColor(ACCENT)
            c.drawString(bx + bw + 0.35 * cm, y + bh / 2 - 3, side)
            if i < 2:
                ax = bx + bw / 2
                c.setStrokeColor(ACCENT)
                c.setLineWidth(1.2)
                c.line(ax, y, ax, y - gap + 4)
                c.setFillColor(ACCENT)
                p = c.beginPath()
                p.moveTo(ax - 4, y - gap + 6)
                p.lineTo(ax + 4, y - gap + 6)
                p.lineTo(ax, y - gap)
                p.close()
                c.drawPath(p, stroke=0, fill=1)
            y -= bh + gap


# ── payout curve figure ──────────────────────────────────────────────
class PayoutFigure(Flowable):
    """Standard profile: h=0.04, u_be=0.80, m_min=0.15, alpha=1.8, u_J=0.99, M_max=12, g=9.0944."""

    U_BE, M_MIN, ALPHA, U_J, M_MAX, G = 0.80, 0.15, 1.8, 0.99, 12.0, 9.0944

    def __init__(self, width=14.8 * cm, height=7.6 * cm):
        super().__init__()
        self.width, self.height = width, height

    def M(self, u):
        if u < self.U_BE:
            return self.M_MIN + (1 - self.M_MIN) * (u / self.U_BE) ** self.ALPHA
        if u < self.U_J:
            return math.exp(self.G * (u - self.U_BE))
        m_uj = math.exp(self.G * (self.U_J - self.U_BE))
        return m_uj + (u - self.U_J) / (1 - self.U_J) * (self.M_MAX - m_uj)

    def draw(self):
        c = self.canv
        ml, mr, mb, mt = 1.5 * cm, 0.5 * cm, 1.15 * cm, 0.4 * cm
        pw, ph = self.width - ml - mr, self.height - mb - mt
        y_max = 12.5

        def X(u):
            return ml + u * pw

        def Y(m):
            return mb + (m / y_max) * ph

        # grid + axes
        c.setStrokeColor(RULE)
        c.setLineWidth(0.4)
        for m in range(0, 13, 2):
            c.line(X(0), Y(m), X(1), Y(m))
            c.setFillColor(GREY)
            c.setFont("Georgia", 7.5)
            c.drawRightString(X(0) - 4, Y(m) - 2.5, f"{m}×")
        for u in [0, 0.2, 0.4, 0.6, 0.8, 1.0]:
            c.line(X(u), Y(0), X(u), Y(0) - 3)
            c.setFillColor(GREY)
            c.drawCentredString(X(u), Y(0) - 12, f"{u:.1f}")
        c.setStrokeColor(GREY)
        c.setLineWidth(0.8)
        c.line(X(0), Y(0), X(1), Y(0))
        c.line(X(0), Y(0), X(0), Y(y_max))
        c.setFillColor(GREY)
        c.setFont("Georgia-Italic", 8)
        c.drawCentredString(ml + pw / 2, 2, "field percentile U")
        c.saveState()
        c.translate(8, mb + ph / 2)
        c.rotate(90)
        c.drawCentredString(0, 0, "multiplier M(U)")
        c.restoreState()

        # break-even reference lines
        c.setStrokeColor(GREY)
        c.setDash(2, 2)
        c.setLineWidth(0.6)
        c.line(X(self.U_BE), Y(0), X(self.U_BE), Y(y_max))
        c.line(X(0), Y(1), X(1), Y(1))
        c.setDash()
        c.setFillColor(GREY)
        c.setFont("Georgia-Italic", 7.5)
        c.drawRightString(X(self.U_BE) - 4, Y(y_max) - 8, "break-even (80th pct)")
        c.drawString(X(0.02), Y(1) + 3, "1.0×")

        # curve
        c.setStrokeColor(ACCENT)
        c.setLineWidth(1.6)
        p = c.beginPath()
        first = True
        n = 400
        for i in range(n + 1):
            u = i / n
            m = min(self.M(u), y_max)
            if first:
                p.moveTo(X(u), Y(m))
                first = False
            else:
                p.lineTo(X(u), Y(m))
        c.drawPath(p, stroke=1, fill=0)

        # zone labels
        c.setFillColor(NAVY)
        c.setFont("Arial-Bold", 7.8)
        c.drawCentredString(X(0.40), Y(1.9), "refund zone")
        c.drawCentredString(X(0.895), Y(4.6), "profit zone")
        c.drawString(X(0.842), Y(11.4), "jackpot tail (top 1%)")


# ── footer ───────────────────────────────────────────────────────────
def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(2.2 * cm, 1.55 * cm, A4[0] - 2.2 * cm, 1.55 * cm)
    canvas.setFont("Georgia", 8)
    canvas.setFillColor(GREY)
    canvas.drawString(2.2 * cm, 1.2 * cm, "Draw The Chart — Whitepaper v3.0")
    canvas.drawRightString(A4[0] - 2.2 * cm, 1.2 * cm, f"{doc.page}")
    canvas.restoreState()


def no_footer(canvas, doc):
    pass


# ── document ─────────────────────────────────────────────────────────
out = os.path.join(os.path.dirname(__file__), "..", "public", "DrawTheChart_Whitepaper_v3.0.pdf")
doc = BaseDocTemplate(
    os.path.abspath(out), pagesize=A4,
    leftMargin=2.2 * cm, rightMargin=2.2 * cm, topMargin=2.1 * cm, bottomMargin=2.0 * cm,
    title="Draw The Chart — Whitepaper v3.0",
    author="Draw The Chart",
    subject="A chart-native price-path prediction game with field-relative scoring",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([
    PageTemplate(id="title", frames=[frame], onPage=no_footer),
    PageTemplate(id="body", frames=[frame], onPage=footer),
])

story = []

# ════ TITLE PAGE ═════════════════════════════════════════════════════
title_style = ParagraphStyle(
    "title", fontName="Arial-Bold", fontSize=34, leading=40, textColor=NAVY, alignment=TA_CENTER,
)
sub_style = ParagraphStyle(
    "sub", fontName="Georgia-Italic", fontSize=13.5, leading=19, textColor=GREY,
    alignment=TA_CENTER, spaceBefore=14,
)
meta_style = ParagraphStyle(
    "meta", fontName="Arial", fontSize=10.5, leading=16, textColor=NAVY, alignment=TA_CENTER,
)
disc_style = ParagraphStyle(
    "disc", fontName="Georgia-Italic", fontSize=8.4, leading=12.4, textColor=GREY,
    alignment=TA_JUSTIFY,
)

story.append(Spacer(1, 4.6 * cm))
story.append(P("DRAW THE CHART", title_style))
story.append(Spacer(1, 0.25 * cm))
story.append(HRFlowable(width="42%", thickness=1.1, color=ACCENT, hAlign="CENTER"))
story.append(P("A Chart-Native Price-Path Prediction Game<br/>with Field-Relative Scoring", sub_style))
story.append(Spacer(1, 1.5 * cm))
story.append(P("Whitepaper — Version 3.0", meta_style))
story.append(P("June 2026", meta_style))
story.append(Spacer(1, 6.2 * cm))
story.append(HRFlowable(width="100%", thickness=0.5, color=RULE))
story.append(Spacer(1, 0.3 * cm))
story.append(P(
    "This document describes the product design, scoring architecture, and economic model of Draw The Chart "
    "(DTC). It is a concept and design paper: parameters given here are calibrated defaults and may be revised "
    "before and during live operation, with all changes versioned and announced. Nothing in this document is "
    "investment advice or a solicitation to participate in any regulated product in any jurisdiction where such "
    "participation would be restricted.", disc_style))
story.append(PageBreak())

# Switch to body template for the rest
from reportlab.platypus import NextPageTemplate  # noqa: E402
story.insert(-1, NextPageTemplate("body"))

# ════ 1. ABSTRACT ════════════════════════════════════════════════════
story.append(P("1.&nbsp;&nbsp;Abstract", h1))
story.append(P(
    "Draw The Chart is a house-versus-player crypto prediction game in which the player expresses a market "
    "thesis by <b>drawing the expected future price path</b> on the chart itself — rather than choosing a "
    "binary outcome or opening a leveraged position. The player sees BTC history up to a locked anchor, draws "
    "an expected path over a fixed horizon (15 minutes to 7 days), stakes an amount, and is paid according to "
    "the quality of the prediction."))
story.append(P(
    "The defining feature of DTC is its <b>field-relative scoring architecture</b>. A drawn prediction is not "
    "graded on an absolute scale; it is ranked against a <i>synthetic field</i> of roughly 1,500 zero-information "
    "forecasts — random walks, flat lines, trend extrapolations, mean reverters, and bootstrapped historical "
    "paths — generated deterministically from the round’s cryptographic commitment and scored against "
    "the same realized market path. The player’s result is a percentile: <i>“you beat 87% of the "
    "field.”</i> The payout multiplier is a published function of that percentile, constructed so that its "
    "average over the percentile range equals exactly 1 − h, where h is the house edge."))
story.append(P(
    "This architecture yields three properties simultaneously that absolute scoring systems cannot offer: "
    "<b>fairness</b> (round difficulty is normalized automatically, because the field faces the same market "
    "conditions as the player), <b>legibility</b> (a percentile against a visible field of competitors is the "
    "most intuitive score that exists), and <b>solvency</b> (a player with no predictive skill earns a uniformly "
    "distributed percentile, so the house edge holds exactly, by construction, in every market regime)."))

# ════ 2. MOTIVATION ══════════════════════════════════════════════════
story.append(P("2.&nbsp;&nbsp;Motivation", h1))
story.append(P("2.1&nbsp;&nbsp;The behavior already exists", h2))
story.append(P(
    "Crypto users already perform the core DTC action informally. They draw trend lines and target paths, post "
    "“BTC to here first, then retrace” scenarios, and argue about timing and structure — not just "
    "direction. The behavior is already a game; no product captures it natively."))
story.append(P("2.2&nbsp;&nbsp;The gap in existing products", h2))
story.append(P(
    "Existing products either compress the thesis or complicate it. Prediction markets reduce a path thesis to "
    "yes/no: “rallies first, fades, finishes slightly above” becomes “above X by date Y?”, and "
    "the nuance is discarded. Perpetual trading captures more, but demands leverage selection, position sizing, "
    "and liquidation management — a thesis can be right and still lose to execution mechanics. Casino-style "
    "products offer convex payouts and immediacy but remove analytical agency."))
story.append(TBL(
    ["Category", "Strength", "Weakness"],
    [
        ["Prediction markets", "Clean event resolution", "No path expression"],
        ["Perpetual / margin trading", "Full expressiveness", "Execution risk dominates the thesis"],
        ["Casino-style games (e.g. Crash)", "Excitement, convex upside", "No analytical skill expression"],
        ["Social charting", "Rich expression", "No economic closure"],
    ],
    [4.4 * cm, 5.6 * cm, 5.6 * cm], align_center=False))
story.append(Spacer(1, 6))
story.append(P(
    "DTC occupies the gap between these categories: house-versus-player simplicity, chart-native input, "
    "deterministic and reproducible scoring, bounded downside, convex upside, and replayable outcomes. The chart "
    "is not a theme — it is the mechanic."))

# ════ 3. PRODUCT OVERVIEW ════════════════════════════════════════════
story.append(P("3.&nbsp;&nbsp;Product Overview", h1))
story.append(P("3.1&nbsp;&nbsp;Definition", h2))
story.append(P(
    "DTC is a house-versus-player BTC price-path prediction game in which users draw an expected future path "
    "and receive a payout based on how much of a simulated field of naive forecasts they outperformed."))
story.append(P("3.2&nbsp;&nbsp;The core loop", h2))
story.extend(B([
    "Select BTC and a timeframe (15m, 1h, 6h, 24h, 7d).",
    "View history up to a locked anchor; the round is committed cryptographically.",
    "Enter a stake and draw the expected path; submit.",
    "The horizon elapses (or replays instantly in sandbox mode).",
    "Reveal: the realized path animates in, the synthetic field renders as a translucent swarm, and the "
    "player’s rank within the field counts up.",
    "Payout: percentile <font face='Arial'>→</font> multiplier <font face='Arial'>→</font> settlement. The player can inspect the field paths that beat them.",
]))
story.append(Spacer(1, 4))
story.append(P(
    "The reveal is the signature product moment. “You beat 1,289 of 1,500 simulated traders — top 14% "
    "— 1.66×” is more legible, more credible, and more shareable than an opaque score."))
story.append(P("3.3&nbsp;&nbsp;Design principles", h2))
story.extend(B([
    "<b>Expressiveness over compression.</b> Direction, timing, magnitude, and structure are all expressible in one stroke.",
    "<b>Determinism over mystique.</b> Every number on screen is reproducible from public code, the committed round payload, and realized prices.",
    "<b>Fairness is perceptual, not just statistical.</b> If a drawing that looks better scores worse, the system is wrong even if its math is internally consistent. This is an acceptance-tested requirement.",
    "<b>The house edge is a constant, not a hope.</b> Economics hold by construction under a zero-skill null; skill exposure is measured and bounded separately.",
    "<b>Bounded downside, convex upside.</b> Known floor, published curve, capped maximum.",
    "<b>Chart feel is product-critical.</b> The drawing interaction is the product.",
    "<b>Narrow first.</b> BTC only, five horizons, until fairness and economics are proven with real users.",
]))

# ════ 4. GAME MECHANICS ══════════════════════════════════════════════
story.append(P("4.&nbsp;&nbsp;Game Mechanics", h1))
story.append(P("4.1&nbsp;&nbsp;Drawing input", h2))
story.append(P(
    "The player draws a continuous freehand line over a fixed future zone to the right of the anchor. The raw "
    "stroke is normalized into a constrained prediction shape before scoring: a fixed number of control points "
    "per horizon, strictly increasing time coordinates spanning the full horizon, a minimum time spacing between "
    "points, and a maximum slope bounded by historical BTC movement. This keeps the interaction fluid while the "
    "scored object remains well-formed and resistant to degenerate inputs (Appendix C)."))
story.append(P("4.2&nbsp;&nbsp;Path representation", h2))
story.append(P(
    "All scoring is performed in log-return space, anchored at zero at the round start:"))
story.append(P("r(t) = ln( P(t) / P<sub>0</sub> ),&nbsp;&nbsp;&nbsp;r(T<sub>0</sub>) = 0", formula))
story.append(P(
    "Log returns make paths comparable across price levels and horizons. Both the predicted and realized paths "
    "are resampled to N = 120 evenly spaced points by linear interpolation, so every horizon is scored under an "
    "identical representation. Technical-analysis overlays (moving averages, bands, levels) are available for "
    "player interpretation but are never part of the scored path."))

# ════ 5. SCORING ARCHITECTURE ════════════════════════════════════════
story.append(P("5.&nbsp;&nbsp;Scoring Architecture", h1))
story.append(P(
    "Path-similarity metrics measured on an absolute scale are inherently regime-dependent: the same forecast "
    "quality produces different scores in calm and in volatile markets, because every error term is implicitly "
    "compared against conditions that change each round. Extensive backtesting across five years of BTC data "
    "(2.7 million one-minute candles, 2021–2026) showed that no fixed parameterization of an absolute "
    "similarity score can be simultaneously fair across regimes and economically stable. DTC therefore separates "
    "the problem into three layers: <b>similarity</b> (how close was the drawing, perceptually), <b>ranking</b> "
    "(how good is that closeness relative to what was achievable this round), and <b>payout</b> (what does that "
    "rank pay). Difficulty normalization and house economics are handled structurally rather than by parameter "
    "tuning."))
story.append(Spacer(1, 4))
story.append(ArchDiagram())
story.append(P("Figure 1 — The three-layer scoring architecture.", caption))

story.append(P("5.1&nbsp;&nbsp;Layer 1 — Similarity", h2))
story.append(P(
    "Layer 1 produces a perceptual closeness measure S (0–100) between the drawn path and the realized "
    "path. Its design goal is agreement with the human eye: tolerant of small timing errors, smooth everywhere "
    "(no scoring cliffs), and free of double-counted penalties. It is composed of three components."))
story.append(P(
    "<b>Shape &amp; timing (50 points).</b> Banded dynamic time warping (DTW) — the formal version of what "
    "the eye does when comparing two charts. The two paths are aligned allowing local timing shifts of up to 10% "
    "of the horizon (Sakoe–Chiba band, w = 12 of 120 samples); the remaining distance D is normalized and "
    "mapped through a smooth exponential:"))
story.append(P("S<sub>1</sub> = 50 · exp( −λ<sub>s</sub> · D / (N · σ<sub>eff</sub>) )", formula))
story.append(P(
    "A forecast with the right structure that is slightly mistimed loses credit continuously, in proportion to "
    "the mistiming — never discretely. There are no “turn objects” to hallucinate or miss."))
story.append(P(
    "<b>Direction (30 points).</b> Multi-scale net-move agreement. The horizon is split into halves, quarters, "
    "and eighths; in each segment, the sign of the predicted net move is compared with the realized net move, "
    "and each segment is weighted by the <i>size</i> of the realized move, so segments where the market barely "
    "moved contribute almost nothing. Coarser scales carry geometrically more weight (decay 2.5)."))
story.append(P(
    "<b>Level (20 points).</b> Bias (mean signed error) and endpoint error, each normalized by an effective "
    "volatility σ<sub>eff</sub> = max(σ realized, 0.5 · σ typical for the timeframe), "
    "mapped through a smooth exponential. The hybrid floor keeps displayed accuracy stable in unusually quiet "
    "rounds."))
story.append(P(
    "Three rules are binding on Layer 1: no hard thresholds, no double-counting (each error type is penalized in "
    "exactly one component), and component correlation below 0.7 under the audit harness. A turning-point "
    "matcher (Hungarian algorithm over detected extrema) is retained purely as a reveal-screen explainer "
    "— “you called this top 9 minutes early” — it annotates, it does not score. Layer 1 has "
    "no direct economic role: money flows through the percentile, so its parameters are tuned for human "
    "agreement without ever touching the house edge."))

story.append(P("5.2&nbsp;&nbsp;Layer 2 — The synthetic field", h2))
story.append(P(
    "For each round, B = 1,500 baseline paths are generated from a documented field generator conditioned on the "
    "anchor market state, scored with Layer 1 against the same realized path, and ranked together with the "
    "player. The player’s percentile is the mid-rank:"))
story.append(P("U = ( #{field below player} + ½ · #{ties} ) / B", formula))
story.append(P(
    "The field is a portfolio of <b>every strategy a player without market insight could play</b>. This is the "
    "anti-exploit core: if a naive strategy is in the field, playing it earns a near-uniform percentile and "
    "therefore exactly the house edge."))
story.append(TBL(
    ["Share", "Generator", "Description"],
    [
        ["40%", "Conditional block bootstrap",
         "Blocks of recent 1-minute returns (trailing 30 days), rescaled to EWMA volatility at the anchor; "
         "carries realistic fat tails and clustering"],
        ["20%", "Geometric Brownian motion", "Zero-drift GBM at EWMA anchor volatility"],
        ["15%", "Trend extrapolators", "Lookback drift continued over 0.5×/1×/2× windows, damped and "
         "overshoot variants, with noise"],
        ["10%", "Mean reverters", "Pull toward the lookback mean at several speeds, with noise"],
        ["10%", "Flat &amp; drift lines", "Flat line and small end-drift variants"],
        ["5%", "Smoothed / lagged replays", "Low-detail transforms populating the “plausible but lazy” region"],
    ],
    [1.4 * cm, 4.4 * cm, 9.8 * cm], align_center=False))
story.append(Spacer(1, 6))
story.append(P(
    "<b>Determinism and verifiability.</b> The field seed is derived from the round’s pre-draw commitment "
    "(seed = SHA-256(commitment  ||  field version)), so the house cannot regenerate a friendlier field and the "
    "player cannot anticipate field realizations. After settlement, anyone can re-derive all 1,500 paths from "
    "published code and reproduce the percentile and payout bit-for-bit. Generation plus scoring costs "
    "milliseconds. The generator is versioned; changes are announced and never retroactive."))
story.append(P(
    "<b>Why relative ranking solves difficulty.</b> The field experiences the same round — the same "
    "volatility, the same trendiness. If the round was easy, the field also scores high and the bar rises "
    "automatically. A given drawing quality maps to a similar percentile in calm and chaotic markets alike, "
    "which is precisely the fairness property an absolute score cannot provide."))

story.append(P("5.3&nbsp;&nbsp;Layer 3 — Payout", h2))
story.append(P(
    "The multiplier is a published three-zone function of the percentile — a refund zone below the "
    "break-even percentile, an exponential profit zone above it, and a linear jackpot tail for the top of the "
    "field:"))
story.append(P(
    "M(u) = m<sub>min</sub> + (1 − m<sub>min</sub>)(u/u<sub>be</sub>)<super>α</super> "
    "&nbsp;&nbsp;for u &lt; u<sub>be</sub>;&nbsp;&nbsp;&nbsp;&nbsp;"
    "M(u) = exp( g · (u − u<sub>be</sub>) ) &nbsp;&nbsp;for u<sub>be</sub> ≤ u &lt; u<sub>J</sub>", formula))
story.append(P(
    "with a linear ramp from M(u<sub>J</sub>) to M<sub>max</sub> on [u<sub>J</sub>, 1]. The curve is continuous, equals "
    "1.0× exactly at the break-even percentile, and the growth rate g is <b>solved numerically</b> so that "
    "the mean multiplier over the percentile range equals exactly 1 − h (Appendix B). Under the null "
    "hypothesis — a player no better than the field — the percentile is uniform, so the expected "
    "payout is exactly 1 − h per round, in every market regime. The house edge is a design constant, not an "
    "emergent property of tuning."))
story.append(Spacer(1, 4))
story.append(PayoutFigure())
story.append(P("Figure 2 — The Standard payout profile (h = 4%, break-even at the 80th percentile, cap 12×).", caption))
story.append(P(
    "Three solved profiles span the frequency-versus-magnitude spectrum; the expected multiplier is invariant "
    "across them:"))
story.append(TBL(
    ["", "Balanced", "Standard (default)", "Jackpot"],
    [
        ["House edge h", "4%", "4%", "5%"],
        ["Break-even percentile", "0.75", "0.80", "0.88"],
        ["Floor multiplier", "0.20×", "0.15×", "0.10×"],
        ["Cap", "≈4.5×", "12×", "30×"],
        ["Solved growth rate g", "5.988", "9.094", "21.234"],
        ["Mean multiplier (null)", "0.9600", "0.9600", "0.9500"],
        ["Std. dev. of multiplier", "0.95", "1.34", "2.16"],
        ["Rounds profitable (null)", "25%", "20%", "12%"],
    ],
    [4.4 * cm, 3.0 * cm, 4.0 * cm, 3.0 * cm]))
story.append(Spacer(1, 6))
story.append(P("Standard profile, per $100 stake:"))
story.append(TBL(
    ["Percentile", "Multiplier", "Payout", "P&amp;L"],
    [
        ["0.25", "0.26×", "$26", "−$74"],
        ["0.50", "0.52×", "$52", "−$48"],
        ["0.65", "0.74×", "$74", "−$26"],
        ["<b>0.80 (break-even)</b>", "<b>1.00×</b>", "<b>$100</b>", "<b>$0</b>"],
        ["0.90", "2.48×", "$248", "+$148"],
        ["0.95", "3.91×", "$391", "+$291"],
        ["0.99", "5.63×", "$563", "+$463"],
        ["1.00 (best of field)", "12.00×", "$1,200", "+$1,100"],
    ],
    [4.6 * cm, 2.8 * cm, 2.8 * cm, 2.8 * cm]))

# ════ 6. ECONOMICS ═══════════════════════════════════════════════════
story.append(P("6.&nbsp;&nbsp;House Economics and Risk Management", h1))
story.append(P("6.1&nbsp;&nbsp;Per-round accounting", h2))
story.append(P(
    "For stake s, house profit per round is s · (1 − M(U)) with mean s·h and a standard deviation "
    "known in closed form from the curve (1.34·s for the Standard profile). Because both moments are exact "
    "under the null, bankroll mathematics requires no assumptions about player skill distributions."))
story.append(P("6.2&nbsp;&nbsp;Stake caps and bankroll sizing", h2))
story.append(P(
    "With edge h and multiplier variance Var[M], the full-Kelly stake fraction is approximately h / Var[M] of "
    "bankroll. DTC operates at quarter-Kelly:"))
story.append(TBL(
    ["Profile", "Full Kelly", "Quarter-Kelly (operating cap)", "Max stake at $250k bankroll"],
    [
        ["Balanced", "4.45%", "1.11%", "$2,780"],
        ["Standard", "2.23%", "0.56%", "$1,400"],
        ["Jackpot", "1.07%", "0.27%", "$675"],
    ],
    [3.2 * cm, 2.8 * cm, 5.2 * cm, 4.4 * cm]))
story.append(Spacer(1, 6))
story.extend(B([
    "Per-round liability M<sub>max</sub> · stake is reserved from the bankroll at entry; entries are "
    "rejected when total reserved exposure exceeds 25% of bankroll.",
    "Reserved exposure within any single horizon bucket is capped at 10% of bankroll, because same-horizon "
    "rounds settle on correlated market segments.",
    "Layered circuit breakers: 24h realized net loss beyond 1% of bankroll halves max stakes; beyond 2% pauses "
    "new entries; beyond 5% triggers emergency review. Because the multiplier variance is known, these "
    "thresholds correspond to computable z-scores — they fire on genuine anomalies, not normal variance.",
]))
story.append(P("6.3&nbsp;&nbsp;Skill premium governance", h2))
story.append(P(
    "The single residual economic risk is genuine, persistent player skill: a population whose mean percentile "
    "exceeds 0.5. This is exactly measurable — the realized margin 1 − mean(M) is tracked with "
    "confidence intervals overall, per horizon, and per cohort. If the margin compresses below h/2 for a "
    "sustained window, the curve is re-versioned with notice (higher break-even percentile or edge). If it "
    "reaches zero, stakes are floored and the field is upgraded: generators are added that capture whatever "
    "structure players are exploiting, which raises the bar for everyone honestly. Skilled players being paid is "
    "the product working; the governance loop keeps the cost known and bounded. All changes are versioned, "
    "announced, and never retroactive to open rounds."))

# ════ 7. INTEGRITY ═══════════════════════════════════════════════════
story.append(P("7.&nbsp;&nbsp;Game Integrity", h1))
story.append(P("7.1&nbsp;&nbsp;Commit-reveal", h2))
story.append(P(
    "Before the player draws, the round payload is committed: anchor timestamp and price-source configuration, "
    "horizon, scoring version and parameters, field generator version and mixture, payout curve version and "
    "solved g, and the seed-derivation rule. After settlement the payload is revealed, and settlement is a pure "
    "function of (commitment, drawn path, realized prices) that any third party can recompute."))
story.append(P("7.2&nbsp;&nbsp;Oracle", h2))
story.append(P(
    "Settlement prices use an index construction: the median across at least three liquid venues, with "
    "5-second TWAP windows centered on each one-minute sample, on a sampling schedule fixed in the commitment. "
    "A venue deviating more than 1.5% from the median is dropped for those samples; if fewer than two valid "
    "venues remain for more than 5% of samples, the round is voided and fully refunded. Path-scored games are "
    "more oracle-sensitive than endpoint markets — a single spoofed spike could create or erase structure "
    "— hence median, TWAP, and a conservative void policy."))
story.append(P("7.3&nbsp;&nbsp;Threat model", h2))
story.append(TBL(
    ["Attack", "Defense"],
    [
        ["Play a naive archetype (flat line, trend, center-of-mass)",
         "It is in the field — expected payout is exactly 1 − h"],
        ["Probe for scoring discontinuities with crafted paths",
         "Layer 1 is smooth everywhere; money flows through rank, not raw score"],
        ["Regime sniping (only play quiet or volatile rounds)",
         "The field is conditioned on the same regime; percentile difficulty is invariant"],
        ["Predict the field instead of the market",
         "Field realizations depend on the committed seed, unknown pre-draw; mimicking its center is the naive-archetype case"],
        ["House regenerates a friendlier field",
         "Seed is bound to the pre-round commitment; settlement is reproducible by anyone"],
        ["Multi-account spraying of random drawings",
         "Each account independently faces expected payout 1 − h; spraying has negative expected value"],
        ["Draw with newer information than the anchor",
         "Anchor locks at commitment; the draw window is 60–120 seconds and submissions are hash-bound inside it"],
        ["Genuine forecasting skill",
         "Paid on purpose within stake caps; monitored via skill-premium governance (§6.3)"],
    ],
    [7.2 * cm, 8.4 * cm], align_center=False))

# ════ 8. VALIDATION ══════════════════════════════════════════════════
story.append(P("8.&nbsp;&nbsp;Calibration and Validation Methodology", h1))
story.append(P(
    "DTC treats calibration as a launch gate, not a polish step. All validation suites run against a historical "
    "dataset of 2.7 million BTC/USDT one-minute candles (January 2021 – March 2026) spanning a full bull "
    "run, a bear market, a recovery, and a halving cycle. The engine ships only when all of the following hold:"))
story.extend(B([
    "<b>Zero-skill neutrality.</b> Every named zero-information strategy, played as a player over thousands of "
    "rounds per timeframe, earns a mean percentile within [0.45, 0.55] and a mean multiplier within a tight band "
    "of 1 − h. This directly asserts the economic property the system is built on.",
    "<b>Perceptual monotonicity.</b> Across graded distortion ladders (timing lag, amplitude damping, time "
    "warping, additive noise applied to the realized path), the mean percentile must decrease strictly with "
    "distortion, and a visually close drawing must lose head-to-head against a random drawing in fewer than 1% "
    "of rounds.",
    "<b>Skill responsiveness.</b> Partial-information oracles (direction-only, endpoint within a band, first "
    "half of the path) must earn percentiles materially above 0.5, increasing with information content — "
    "the game must be winnable by insight.",
    "<b>Economic stress.</b> Monte Carlo across player mixes from 0% to 30% skilled: ruin probability below "
    "0.1% over 100,000 rounds at launch bankroll under the stake and exposure rules of §6.",
    "<b>Human alignment.</b> The displayed accuracy score must correlate with players’ self-assessed scores "
    "on collected feedback data, and improve on contested rounds across versions.",
    "<b>Engine invariants.</b> Bit-for-bit determinism, edge-case robustness, component correlation below 0.7, "
    "and third-party reproducibility of settlement from the commitment alone.",
]))

# ════ 9. ROADMAP ═════════════════════════════════════════════════════
story.append(P("9.&nbsp;&nbsp;Roadmap", h1))
story.append(TBL(
    ["Phase", "Scope", "Status"],
    [
        ["1 — Scoring engine", "Pure-function engine, field generator, payout solver, validation suites", "Specified; v0.2 engine and 5-year backtest infrastructure operational"],
        ["2 — Drawing experience", "Freehand chart drawing, mobile touch, reveal animation", "Built and validated in testing"],
        ["3 — Game loop", "Draw <font face='Arial'>→</font> rank <font face='Arial'>→</font> payout <font face='Arial'>→</font> replay; sandbox on historical data", "Built; migrating to field-relative scoring"],
        ["4 — Live infrastructure", "Wallet auth (Base), on-chain commit-reveal, oracle integration, bankroll vault, risk controls", "In design"],
        ["5 — Depth", "Leaderboards (percentile-fair across regimes), tournaments, PvP fields (rank against real players), additional assets", "After live economics are proven"],
    ],
    [3.4 * cm, 7.4 * cm, 4.8 * cm], align_center=False))

# ════ 10-12 ══════════════════════════════════════════════════════════
story.append(P("10.&nbsp;&nbsp;Compliance and Responsible Use", h1))
story.append(P(
    "DTC is a speculative entertainment product wrapped in a market-native interface, and is presented as such. "
    "The live product requires jurisdictional gating and legal review before real-money rollout, age gating, "
    "self-exclusion, and per-user session, stake, and loss limits. The field-relative design enables unusually "
    "honest disclosure: the product can truthfully state that the expected return of play without predictive "
    "skill is exactly 1 − h per round, because that number is enforced by construction rather than estimated."))
story.append(P("11.&nbsp;&nbsp;Token Position", h1))
story.append(P(
    "DTC does not require a token. The loop — draw, rank against the field, settle — stands alone on "
    "stablecoin rails. Any future token design would be subordinate to the product, bounded in utility, and "
    "deferred until product-market fit."))
story.append(P("12.&nbsp;&nbsp;Risks", h1))
story.append(TBL(
    ["Risk", "Mitigation", "Residual"],
    [
        ["Field mis-specification (a naive strategy escapes the neutrality band)",
         "Five-year backtest neutrality suite; versioned field upgrades", "Low"],
        ["Persistent player skill", "Exact measurement, governance ladder, stake caps", "Medium — also the product working"],
        ["Correlated wins in strong trends", "Trend generators inside the field raise the bar in trend rounds; horizon-bucket exposure caps", "Low–medium"],
        ["Oracle manipulation", "Multi-venue median, TWAP, void-and-refund policy", "Low"],
        ["Percentile feels opaque (“who is the field?”)", "Field swarm visualization, inspectable rival paths, published generator code", "UX risk; testable"],
        ["Regulatory classification", "Staged launch, legal review, geo-gating", "Jurisdiction-dependent"],
    ],
    [5.4 * cm, 6.8 * cm, 3.4 * cm], align_center=False))

# ════ 13. CONCLUSION ═════════════════════════════════════════════════
story.append(P("13.&nbsp;&nbsp;Conclusion", h1))
story.append(P(
    "Crypto users already think in chart paths, already make scenario calls, and already want the feeling of "
    "reading the market without the complexity of leveraged execution or the poverty of binary input. Draw The "
    "Chart turns that existing behavior into a game with a precise economic core."))
story.append(P(
    "The field-relative architecture changes the question the game asks. Not <i>“how close was your drawing "
    "on an absolute scale that shifts with every regime?”</i> but <i>“did you beat the field of every "
    "naive strategy, on this round, under the same conditions?”</i> That question is fair by construction "
    "(the field absorbs difficulty), legible by construction (“top 14% of the field”), exploit-resistant "
    "by construction (every naive strategy is in the field), and solvent by construction (the payout curve "
    "integrates to exactly 1 − h). What remains is execution against the validation gates of Section 8."))

# ════ APPENDICES ═════════════════════════════════════════════════════
story.append(P("Appendix A — Default Parameters", h1))
story.append(TBL(
    ["Layer", "Parameter", "Default"],
    [
        ["Similarity", "Resample points N", "120"],
        ["Similarity", "DTW band w", "12 samples (10% of horizon)"],
        ["Similarity", "Shape decay λ<sub>s</sub>", "2.2"],
        ["Similarity", "Direction scale levels / decay", "3 / 2.5"],
        ["Similarity", "Level decay λ<sub>l</sub>", "1.2"],
        ["Similarity", "Component weights (shape/direction/level)", "50 / 30 / 20"],
        ["Similarity", "Volatility floor coefficient", "0.5 · σ typical (timeframe)"],
        ["Field", "Field size B", "1,500"],
        ["Field", "Mixture", "40 / 20 / 15 / 10 / 10 / 5 (§5.2)"],
        ["Field", "Bootstrap block length", "horizon / 8"],
        ["Field", "EWMA volatility λ", "0.94"],
        ["Payout", "Profile (Standard)", "h = 0.04, u<sub>be</sub> = 0.80, m<sub>min</sub> = 0.15, α = 1.8, u<sub>J</sub> = 0.99, M<sub>max</sub> = 12, g = 9.0944"],
        ["Risk", "Stake cap", "0.56% of bankroll (quarter-Kelly)"],
        ["Risk", "Total / per-horizon reserved exposure", "25% / 10% of bankroll"],
    ],
    [2.6 * cm, 7.0 * cm, 6.0 * cm], align_center=False))

story.append(P("Appendix B — Payout Curve Mathematics", h1))
story.append(P(
    "The mean multiplier over the percentile range decomposes into closed-form pieces:"))
story.append(P("refund: u<sub>be</sub> · ( m<sub>min</sub> + (1 − m<sub>min</sub>)/(α + 1) )", formula))
story.append(P("profit: ( exp( g · (u<sub>J</sub> − u<sub>be</sub>) ) − 1 ) / g", formula))
story.append(P("jackpot: (1 − u<sub>J</sub>) · ( exp( g · (u<sub>J</sub> − u<sub>be</sub>) ) + M<sub>max</sub> ) / 2", formula))
story.append(P(
    "The growth rate g is solved by bisection so the sum equals 1 − h; the sum is monotone increasing in g, "
    "so the root is unique. For the Standard profile, g = 9.0944 gives a mean multiplier of 0.9600 with standard "
    "deviation 1.339 (verified by 400,000-point numeric integration). Because the live percentile is discrete "
    "(resolution 1/B), g may equivalently be solved against the grid sum directly, making the expected payout "
    "exact to the cent. The house profit per unit stake has mean h and variance Var[M], from which the "
    "quarter-Kelly stake cap h / (4 · Var[M]) follows."))

story.append(P("Appendix C — Timeframes and Drawing Constraints", h1))
story.append(TBL(
    ["Timeframe", "Horizon", "Display interval", "Control points"],
    [
        ["15m", "15 minutes", "1m", "8"],
        ["1h", "60 minutes", "1m", "12"],
        ["6h", "360 minutes", "5m", "16"],
        ["24h", "1,440 minutes", "15m", "16"],
        ["7d", "10,080 minutes", "1h", "16"],
    ],
    [3.2 * cm, 3.6 * cm, 4.0 * cm, 3.6 * cm]))
story.append(Spacer(1, 6))
story.append(P(
    "First point fixed at the anchor; last point at the horizon end; strictly increasing time coordinates; "
    "minimum spacing of horizon/K/2 between control points; maximum slope bounded at 3× the historical "
    "maximum hourly move."))

doc.build(story)
print(f"Wrote {os.path.abspath(out)}")
