# Trailer source

The hero trailer is generated, not hand-animated, so it can be rebuilt whenever the product
or the featured round changes.

## Rebuild

```bash
npx tsx trailer/build-round.ts      # scores the featured round with scoreRoundV3 -> round.json
node trailer/render.mjs 32 30       # renders 960 frames at 1920x1080
ffmpeg -y -framerate 30 -start_number 0 -i frames/f%05d.jpg -frames:v 960 \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart hero.mp4
```

Vertical cut from the same master:

```bash
ffmpeg -y -i hero.mp4 -vf "crop=810:1080:555:0,scale=1080:1440,pad=1080:1920:0:240:color=#09090b" \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart vertical.mp4
```

## How it works

`trailer-hero.html` is a self-contained 1920x1080 stage exposing `window.__seek(t)`, which
positions every element deterministically for time `t` in seconds. `render.mjs` drives that
function frame by frame with Playwright and screenshots each one, so output is identical on
every run — no realtime capture, no dropped frames.

`round.json` holds the featured round: the lookback, the drawn path, the realized path, the
field swarm, and the result. It is produced by `build-round.ts` calling the real v3 engine,
so every number on screen is something the product actually returned.

## The featured round

Seed `445625`, stake `$250`: 88.7th percentile, beat 4,434 of 5,000, 2.20x, +$301.

Changing the round means re-running `build-round.ts`. Do not edit the numbers by hand — the
whole point is that they are reproducible.

## Not included

Sound. The film is delivered silent. Per `TRAILER_BRIEF.md` the casino feeling lives almost
entirely in the audio — reel-stop ticks on the score, a hard lock, the silence before the
reveal, one filtered chip on the payout. That needs a real sound pass against picture lock.
