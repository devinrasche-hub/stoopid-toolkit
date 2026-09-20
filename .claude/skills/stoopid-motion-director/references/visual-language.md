# Visual Language

The look. Read before choosing colors, type, texture or layout, and always before adapting
a piece to another aspect ratio.

## Contents
- [Palette](#palette)
- [Using color as structure](#using-color-as-structure)
- [Typography](#typography)
- [Texture and surface](#texture-and-surface)
- [Composition](#composition)
- [Aspects — re-block, never crop](#aspects--re-block-never-crop)
- [Safe areas](#safe-areas)
- [Chrome and watermark](#chrome-and-watermark)
- [Legibility and accessibility](#legibility-and-accessibility)
- [Boilerplate](#boilerplate)

---

## Palette

The documented SIGNAL palette — six colors, locked. Do not add colors; if a piece needs
another value, use opacity of an existing one.

| Token | Hex | Meaning |
|---|---|---|
| Black | `#000000` | base / void — the default background of everything |
| White | `#FFFFFF` | clarity / contrast — primary subject, primary text |
| Neon Teal | `#00FFC6` | digital / signal / glitch — systems, data, the machine |
| Neon Purple | `#8A2BE2` | surreal / philosophical — the uncanny, the inner layer |
| Red | `#FF2D2D` | absurd urgency — alarms, costs, failure states |
| Burnt Orange | `#CC5500` | **earned sincerity / the flip landing** — reserved |

Hard rules:
- **No gradients.** Flat fills, hard edges. Shading is done with opacity steps or dither/scanline, not with gradients.
- **Black is the stage.** Start black and add light. A light-background piece is off-brand unless the brief asks for it.
- **Burnt orange is rationed.** It appears at the flip, and effectively nowhere else. Spending it early costs the piece its punctuation. (`#FF8C00` is a vault-app utility color, not brand — don't reach for it in motion work.)
- Teal and purple are the workhorse accents; red is for cost and alarm; white carries the subject.
- Two accents per piece, maximum, plus the orange flip.

## Using color as structure

Color is a story device here, not decoration. A useful default assignment:

- **White** — the subject the audience identifies with (the calm anchor, the person, the thing being done to).
- **Teal** — the system, the feed, the machine, the data, the interface doing the escalating.
- **Red** — what it costs, arriving at the escalation rungs.
- **Purple** — the layer beneath the obvious: the uncanny, the philosophical widening, dream logic.
- **Burnt orange** — the flip, once.

A viewer who watches ten pieces learns this vocabulary without being told, which is the point
of having a locked palette at all.

## Typography

- **Display:** `Bebas Neue` — caps, tight, stamps, verdicts, big counts. Fallback: `Impact, 'Arial Narrow', sans-serif`.
- **Mono / UI:** `Share Tech Mono` or `Courier New` — labels, data, timecodes, credits, the fake-serious register. Fallback: `'Courier New', monospace`.
- Letter-spacing: display 8–14 px at 1080-wide scale; mono labels 1–3 px. Tracking is most of the house feel.
- **Caps for stamps and labels.** Sentence case only for a genuine sincere line at the release.
- On a 1080-wide stage: stamp/verdict 90–130 px · label 22–34 px · counter 60–110 px (tabular figures, comma-formatted).
- Never more than two type sizes on screen at once.
- **Load fonts, then warm them** before the first frame (an off-screen span in each face), or the first render shows the fallback — visible in a recording.

## Texture and surface

The surface is digital-degraded: VHS, scanlines, signal noise, corner brackets. All of it
subordinate to the motion.

- **Scanlines:** 2 px on / 2 px off, ≤6% white, continuous. Fine as permanent texture.
- **Noise/grain:** ≤5% opacity, animated at 12 fps so it doesn't strobe.
- **Corner brackets:** 1 px, teal or white at 40–60% opacity, framing the stage. House signature, cheap, effective.
- **Chromatic aberration / RGB split:** hit points only, 80–200 ms, ≤4 px offset.
- **Vignette:** allowed as a flat radial darkening at low opacity — the one exception to no-gradients, because it's a lens artifact, not a fill style.
- **Glow:** `shadowBlur` 12–24 px in the element's own color for neon. Use on accents, never on white body text (it goes mushy in compression).

## Composition

- **Silhouette first.** Every key element must read as a black-or-white shape at thumbnail size. If it needs color to be identified, redesign it.
- **One focal point per shot.** The eye should have exactly one place to be.
- **Center-weighted for social.** Phone viewers, cropped previews, and platform chrome all punish edge-placed subjects.
- **Negative space is the show's friend.** Empty black around a single moving object reads as deliberate and costs nothing to render.
- **Grid alignment.** Absurd content, rigorous layout — snap to an 8 px grid on a 1080 stage. Sloppy alignment reads as amateur, which undercuts "treat absurdity seriously."

## Aspects — re-block, never crop

An aspect change is a **re-staging**, not a crop. Motion axes and blocking change with the frame.

| | 9:16 (1080×1920) | 16:9 (1920×1080) | 1:1 (1080×1080) |
|---|---|---|---|
| Primary axis | **vertical** — stacking, falling, queues descending | **horizontal** — races, comparisons, side-by-side, travel | **radial** — orbit, growth from center, symmetry |
| Escalation reads as | height, stacking, drainage | distance, spread, a line marching right | scale from center, ring count |
| Comparison staging | stacked rows, one above the other | two lanes side by side | concentric or split-circle |
| Text placement | upper third (thumb covers the bottom) | lower third | center-bottom, tight |
| Typical shot count | more, shorter (feed pacing) | fewer, longer | fewest — one idea, one frame |
| Biggest risk | subject drifting into platform chrome | wasted side space | corners feel empty |

Practical method for adapting an existing piece:
1. Keep the beats and the clock identical — only geometry changes.
2. Re-choose the escalation axis to match the frame's long axis.
3. Re-block positions from the *center*, not from the previous frame's coordinates.
4. Re-size type for the new stage (a 90 px stamp on 1080-wide is not 90 px on 1920-wide).
5. Re-check silhouette and safe areas at the new ratio.

Implementation: build the stage at true pixel size with a `STAGE = {w, h}` constant and derive
every position from `STAGE.w`/`STAGE.h` (or fractions of them). Then an aspect switch is one
constant plus a re-blocking pass — which is exactly why hard-coded coordinates are banned.

## Safe areas

On a 1080×1920 stage, assume platform UI eats:
- **Top:** ~180 px (status bar, account chrome)
- **Bottom:** ~420 px (captions, buttons, the thumb)
- **Right:** ~160 px (action rail)

Keep anything load-bearing inside the middle ~60% vertically. The `@stoopidshow` watermark may
live in the top margin (house practice in existing artifacts). For 16:9 keep a 5% margin all
round; for 1:1 keep 6%.

## Chrome and watermark

- `@stoopidshow` watermark: mono, ~30 px on a 1080 stage, white at 35–45%, centered near the top. Present for the whole piece.
- A lower-left mono credit/label line (teal at ~55%) is house practice for titled pieces.
- Fake-serious labels (timecodes, item numbers, spec strings) are free character. Use them; keep them true to the piece.
- When a piece will live in the toolkit repo alongside the other artifacts, include the `◂ THE VAULT` return tab already used by every tool page.

## Legibility and accessibility

- Contrast: white or teal on black is safe; **purple on black is not** — outline it, back it with a flat panel, or use it only on large shapes.
- Never carry meaning by color alone — pair it with position, size, shape or label.
- **No full-frame strobing** (>3 flashes/second). Glitch bursts stay short, partial and infrequent — a real seizure risk, and it also compresses badly.
- Assume silence. Assume no captions. Assume a 4-inch screen in daylight.

## Boilerplate

The canonical head for a piece (matches the existing toolkit artifacts):

```html
<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>STOOPID — <piece name></title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Share+Tech+Mono&display=swap');
  html,body{margin:0;height:100%;background:#000;overflow:hidden;}
  #wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#000;}
  canvas{display:block;height:100vh;width:auto;max-width:100vw;background:#000;}
  #warm{position:absolute;left:-9999px;top:-9999px;}
</style></head>
<body>
<div id="wrap"><canvas id="c" width="1080" height="1920"></canvas></div>
<div id="warm"><span style="font-family:'Bebas Neue'">B</span><span style="font-family:'Share Tech Mono'">M</span></div>
<script>/* palette tokens, beat constants, clock, draw(t) */</script>
</body></html>
```

---

> **[CREATOR INPUT NEEDED]**
> - Confirm the type stack for motion work (existing artifacts use Bebas Neue + Share Tech Mono; the show's brief names Courier New/monospace — worth locking one default for animation).
> - Any established visual furniture that should appear by default (bracket style, watermark exact placement, an intro/outro convention) — captured from Dev's real pieces rather than invented here.
