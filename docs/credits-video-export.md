# THE CREDITS DEPARTMENT — video export

*Form CD-003: "Moving Pictures Of Gratitude."*

Every export draws from **one sequence JSON** with **one renderer** (`credits/engine/themes.js`). The admin preview, the in-browser exporters, the headless render command and the public archive replay call the same `renderFrame(ctx, sequence, t)`. A browser test hashes preview frames against render-command frames to prove they're pixel-identical.

## What was tested (2026-10-18)

| Format | How | Tested result |
|---|---|---|
| **MP4 / H.264** | `credits-render` (local command) | ✅ 1920×1080, High profile, yuv420p, BT.709 tags, 30 fps, AAC 48 kHz stereo; duration exact (56.000 s for a 56 s sequence) |
| **PNG cards (opaque)** | admin *PNG CARDS* or `--formats cards` | ✅ one full-res PNG per page, plus `sequence.json`, ZIP verified |
| **PNG cards (transparent)** | admin *TRANSPARENT CARDS* or `--formats alpha-cards` | ✅ RGBA PNGs (colour type 6); ~92% fully transparent pixels on a names page |
| **ProRes 4444 + alpha (.mov)** | `--formats prores` | ✅ `prores` profile 4444, `yuva444p12le`; alpha plane decoded and measured (92% transparent / 2% opaque) |
| **QuickTime Animation + alpha (.mov)** | `--formats animation` | ✅ `qtrle`, `argb`, lossless; alpha measured (92% transparent); ~80 MB for 56 s (ProRes: ~935 MB) |
| **VP9 WebM + alpha** | `--formats webm-alpha` | ✅ `alpha_mode=1`; decoded with libvpx to RGBA, alpha measured |
| **Real-time browser recording** | admin *RECORD VIDEO* | ✅ in Chromium it produced `video/mp4` at 1920×1080. Other browsers fall back to WebM. Timing depends on the machine; use the render command for frame-exact output |
| 24 / 60 fps | `--fps` or episode setting | Rendering at any of 24/30/60 is the same code path. The full-length render was verified at 30 fps |

Not possible: transparent **MP4** (H.264 has no alpha). **Not yet confirmed: transparency inside CapCut.** CapCut can't run in the build environment, and its alpha support varies by version and platform. See *CapCut transparency test* below.

## The render command (frame-exact)

Needs Node 20+ and Chrome or Edge (or the bundled Playwright Chromium). FFmpeg comes from `ffmpeg-static` on `npm install`, or uses one on your PATH.

```
cd stoopid-toolkit/credits-render
npm install
node render.mjs --episode 23                                   # published episode, from the public API
node render.mjs --sequence stoopid_ep023_credits_terminal_sequence.json   # a draft (download SEQUENCE.JSON in Produce)
node render.mjs --episode 23 --formats mp4,cards,alpha-cards,prores,animation,webm-alpha --fps 60 --workers 6
```

Output goes to `./out/stoopid_ep023_credits_<theme>/`: the files, `sequence.json` (exactly what was rendered), and `manifest.json` (ffprobe results and any text-fit warnings).

Speed: frames render in parallel headless tabs (`--workers`, default half your CPU cores). On a 4-core cloud box, 56 s at 30 fps took about 2.5 min per pass. ProRes 4444 is large (~0.9 GB per minute) by design.

## CapCut

1. **Easiest:** import `…_1080p30.mp4` and drop it at the end of the timeline. Done.
2. **Over your own footage:** use **transparent PNG cards** (`cards_alpha/`). Import, place on an overlay track, and set each card's duration to match the page times in `sequence.json` (`segments[].duration ÷ pages`).
3. **Transparent video** (once the test below tells us which format your CapCut accepts): `--formats animation` (QuickTime Animation .mov, smallest lossless option) or `--formats prores`.
4. The soundtrack is mixed into the MP4. `…_audio.wav` is provided separately if you want it on its own track. Untick *Soundtrack* in Produce for silent exports.

### CapCut transparency test (2 minutes, once)

Import each file from the test pack (`A_prores4444.mov`, `B_quicktime_animation.mov`, `C_vp9_alpha.webm`, `D_transparent_card.png`) onto an overlay track above any clip. Note which ones show **the clip underneath through the black areas** and which show solid black. Whichever works becomes your default overlay format (`export_formats` in Settings). The PNG card is the fallback that works everywhere.

## DaVinci Resolve

1. **Opaque:** import the MP4 (H.264 High 4:2:0, Rec.709) into the media pool. It conforms to a 1080p timeline at the same frame rate.
2. **Overlay with alpha:** import `…_overlay_prores4444.mov` (or the smaller `…_overlay_animation.mov`). Resolve reads the alpha automatically. If not: clip attributes → *Alpha mode: Straight*. Put it on V2 above your footage.
3. Match the project frame rate to the export (`--fps 24|30|60`).

## Customising themes

Themes live in `credits/engine/themes.js`. Each is a `draw(ctx, seq, loc, o)` function plus capacities in `THEME_META` (`credits/engine/sequence.js`). To add one:

1. Add `THEME_META.mytheme = { name, namesPerPage, rolesPerPage, creatorsPerPage, boardRows, maxNameChars }`.
2. Add `THEMES.mytheme = { ...THEME_META.mytheme, id: 'mytheme', draw: drawMyTheme }`, using the shared helpers (`fit`, `typed`, `drawBoard`, `drawFinalLines`, `text` for alpha-safe outlines).
3. Optionally add cues in `credits/engine/audio.js`.
4. Keep every effect a pure function of `t` and `seq.seed` (no `Math.random()`, no clock), so scrubbing and exports stay identical. Keep names ≥ 40 px; the browser test checks this for every theme.

Contributor data never changes when you switch themes. Only pagination capacity can differ, and the preview shows it.

## Timing rules

Default template: ident 4 s · Financially Irresponsible 9 s · Mutual Enablers 8 s · Bean Counters 8 s · other categories as configured · Final Transmission 7 s. Pages split their segment evenly, and no page gets less than `minPageSeconds` (default 3). The end card's lines are timed as fractions of the final segment, so changing its length keeps the beats.
