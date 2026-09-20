# YOUR LIFE AT LIGHT SPEED

A 19-second hand-drawn film. Every frame is drawn by JavaScript on a plain
Canvas 2D — no images, no libraries, no video model. Drawn on twos at 12 fps,
packed out at 24 fps, 1080×1920.

One photon leaves a person's feet and runs, in a straight line, all the way to
the Sun. The camera never stops backing away. The photon's speed never changes
for one frame of the film. The room does.

Built with the `hand-drawn-canvas-animation` skill vendored at
`.claude/skills/hand-drawn-canvas-animation/` (MIT, Ishaan Kalra), which was
itself measured off Kevin Ngo's frame-by-frame JS films.

## The beats

| t | scene | what it shows |
|---|---|---|
| 0.0 | title | the title letters draw on; the photon is born as a seed dot |
| 1.5 | you | a hatched figure on warm paper; the photon runs feet to head |
| 4.0 | card 1 | ink-blot wipe to blueprint: **1.8 m · 6 nanoseconds** |
| 4.5 | earth | the ground curves away underneath until it is a whole globe |
| 7.5 | card 2 | iris to blueprint: **12,742 km · 42 milliseconds** |
| 8.0 | moon | Earth shrinks, the Moon comes in at the top, the photon crawls |
| 11.0 | card 3 | flash cut: **384,400 km · 1.3 seconds** |
| 11.5 | sun | a near-empty frame. The emptiness is the shot. |
| 15.5 | crossover | **SLOWED** struck through, then **SPED UP 145×** |
| 17.0 | sign-off | *Light never slowed down. Space just kept going.* → SIGNAL RECEIVED |

**Anchor** (skill rule 11): the photon. One pink dot, in all 228 frames, never
leaves, and keeps its two inks even on the blueprint cards where the palette
changes underneath it.

## The numbers are real

All computed from c = 299,792,458 m/s.

| | distance | light takes | the film runs it at |
|---|---|---|---|
| you | 1.8 m | 6 nanoseconds | slowed 532,964,370× |
| Earth | 12,742 km | 42 milliseconds | slowed 72× |
| the Moon | 384,400 km | 1.3 seconds | slowed 2.5× |
| the Sun | 149.6 million km | 8 min 19 s | **sped up 145×** |

That flip from *slowed* to *sped up* is the reveal, and it gets its own shot.

## Rendering

The skill ships `scripts/render.mjs` (puppeteer-core). It does not run in the
Claude Code web container — Chrome there needs flags the sandbox will not pass,
and the bundled ffmpeg is a stripped build with no H.264. `pwrender.mjs` here is
a drop-in replacement that drives the same page hooks (`window.__ready`,
`__NDRAW`, `__frame(i)`, `__grid(n)`, `__wav()`) through Playwright's Chromium.

```sh
npm i playwright @ffmpeg-installer/ffmpeg
node pwrender.mjs lightspeed.html --grid 24     # 24-frame sheet, look at this first
node pwrender.mjs lightspeed.html --only 0,30   # spot frames, full size
node pwrender.mjs lightspeed.html               # all frames -> mp4 + contact sheet + score
```

Outputs land in `out/`: the frames, `lightspeed.mp4`, `lightspeed-contact.jpg`,
`lightspeed-score.wav`, and `lightspeed-final.mp4` with the score muxed in.

Use the skill's own `render.mjs` on a normal machine; `pwrender.mjs` is only for
this container.

## Two known deviations

1. **Text.** The skill's checklist says the only text a film needs is the
   sign-off. This one is a quantitative piece, so the three blueprint interludes
   carry hand-lettered numbers. The eight drawn scenes stay wordless.
2. **Fonts.** `handText` and `signOff` use core.js's `HAND_FONT` stack, which
   is all faces this container does not have, so captions fall back to a serif.
   Fixed here by installing Caveat (OFL) and pointing fontconfig at it for the
   missing handwriting families — container-only, so a machine with real Bradley
   Hand or Comic Sans still wins. Re-rendering elsewhere needs some handwriting
   face installed, or the captions come out as Times.
