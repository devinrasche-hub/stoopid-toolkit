# PLEASE REMAIN SEEN

*THE STOOPID SHOW — STOOPID AFTER HOURS, Halloween special.*
A 90-second, automatically choreographed browser cinematic (16:9, 1920×1080). Three.js for the picture, Web Audio for a fully procedural soundtrack. No assets to download, no API keys, no CDN at playback: `npm run build` produces one self-contained HTML file.

Published copy: [`/stoopid_please_remain_seen.html`](../../stoopid_please_remain_seen.html) (served by GitHub Pages; it's item 030 in THE VAULT).

## Run it

```
npm install
npm run dev        # http://localhost:5173 — live-reloading development
npm run build      # dist/index.html, also copied to /stoopid_please_remain_seen.html
```

## Controls

The opening screen has the sound and quality toggles and clean-capture mode. One click on **Enter broadcast** starts playback and unlocks audio. The controls bar shows when you move the mouse and hides itself during playback.

| Key | Action |
|---|---|
| Space | Play / pause |
| R | Restart |
| ← / → | Seek 5 s (Shift: 1 s) |
| , / . | Step one frame (while paused) |
| M | Mute |
| C | Captions |
| F | Fullscreen |
| H / Esc | Toggle clean capture mode: every interface element and the cursor are hidden; captions and audio stay |

URL options: `?capture=1` (start in clean capture and go fullscreen on Enter), `?quality=high|medium|low`, `?t=49` (start time), `?cc=0`, `?mute=1`, `?vo=folder/` (recorded narration, see below).

## Capturing for the edit

- **REC** (controls bar): records the whole broadcast in real time, picture plus soundtrack, to `please-remain-seen.webm` at the selected render resolution. The 1080p setting needs a decent GPU to hold frame rate.
- **WAV**: renders the soundtrack offline, sample-accurate, to `please-remain-seen-soundtrack.wav` (48 kHz stereo).
- **Frame-accurate PNG sequence**, independent of GPU speed:
  ```
  npm i -D playwright && npm run build
  node scripts/render-frames.mjs --fps 30 --quality high --out frames
  ffmpeg -framerate 30 -i frames/%05d.png -i please-remain-seen-soundtrack.wav \
         -c:v libx264 -pix_fmt yuv420p -crf 14 -c:a aac -b:a 320k please-remain-seen.mp4
  ```
  Add `--cc 0` for textless frames, so captions can be added in the edit.

## Checking your work

```
npm i -D playwright
npm run snapshot -- --t 4.5,13,52,87 --quality low   # stills + contact sheet + console errors
npm run audio-levels                                 # peak / RMS per second of the soundtrack
```

The original prompt is in `BRIEF.md`. The method, the brief template and the lessons learned are in `../PLAYBOOK.md`.

## How it's built

Everything derives from timeline time `t`. Pausing, seeking, scrubbing, replaying and offline rendering all produce the same frame and the same sound. All randomness (flicker, grain, entity glitches, dust, cable layout, noise buffers) is seeded.

| File | Role |
|---|---|
| `src/timeline.js` | **The master timeline.** Named story beats (`CUE`), the shot list, and the narration cues. Retime a beat here and visuals and audio follow. |
| `src/shots.js` | Camera choreography per shot: dolly paths, lenses, focus pulls. |
| `src/director.js` | Turns `t` into world state: lights, props, CRT programs, entity placement, which live feeds to render. |
| `src/world.js` | The three environments: control room, studio (seen through the glass), the impossible corridor. |
| `src/entity.js` | The entity (a silhouette of misaligned, time-delayed slices carrying broadcast imagery) and the scanline hand. |
| `src/crt.js` | CRT model + screen shader (curvature, scanlines, slot mask, power-on/off collapse, live-feed input) and canvas overlays. |
| `src/fx.js` | Additive planar reflections (wet floors, glass), light shafts, light-gated dust, double-buffered in-world camera feeds. |
| `src/post.js` | Half-res bokeh depth of field, restrained bloom + red halation, ACES, grade, display-space grain, analog line instability, card layer with the paper-tear transition. |
| `src/cards.js` | The station card ("YOUR FEAR IS IMPORTANT TO US.") and the closing title. |
| `src/audio.js` | Procedural score: transformer hum, room/corridor tone, fluorescent buzz, low beating swells, CRT whine, relays, CRT power, distant metal, HRTF movement behind the listener, the chime, the tear. A gentle compressor/limiter keeps peaks around −6 dBFS. |

The monitors show real feeds. The CRTs display render targets from cameras placed in the world, so the hallway CRT really is watching from a few feet behind the lens. The cinematic camera exists as a physical rig that only those feeds can see (render layer 1), and so does the figure in the ident.

### Entity rules (as implemented)
1. During the ident it exists only in the CRT's feed (feed-only layer). The reverse angle shows the empty doorway.
2. Its shadow crosses the back wall, seen reflected in the studio glass, before its body is ever shown.
3. It only changes position on cuts or in the darkest frame after a light source dies.
4. When physically revealed, it always faces away from the lens and tracks the camera with a lag during the arc.
5. The final approach has no sting. The score thins out to silence.

### Adding recorded narration
Each caption in `NARRATION` (timeline.js) is also a voice-over slot with an id (`N01`…`N07`). Put `N01.mp3` (or `.wav`/`.ogg`) etc. in a folder next to the HTML and open `…?vo=thatfolder/`. Each file plays at its cue's start time, and seeking and offline WAV export include it. Nothing else needs to change.

No webcam, microphone, network calls or data collection: everything "observing" you is fiction.
