# PLEASE HOLD — STOOPID AFTER HOURS 02

*THE STOOPID SHOW.* A 120-second browser cinematic (16:9, designed for 1920×1080), continuing directly from the last frame of [PLEASE REMAIN SEEN](../please-remain-seen/). Three.js for the picture, Web Audio for a fully procedural soundtrack. `npm run build` produces one self-contained HTML file with no CDN at playback.

The viewer stayed. The entity tries to guide them out through the station's backstage. The station has mistaken attention for permission to keep everyone inside.

- Published film: [`/stoopid_please_hold.html`](../../stoopid_please_hold.html) (VAULT item 031)
- Installment selector: [`/stoopid_after_hours.html`](../../stoopid_after_hours.html) — 01 and 02. The film's own opening screen also links both.
- The prompt that produced it: `BRIEF.md`. The method: `../PLAYBOOK.md`.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/index.html, copied to /stoopid_please_hold.html
```

The opening screen stays on **Preparing…** while every shader compiles and every shot is rendered once off-screen, so reveals don't stall mid-film. Then **Start** begins playback and unlocks audio.

## Playback

Opening screen: sound on/off, quality (1080p/720p/540p), **reduced motion**, **reduced flicker**, clean capture, and links to both installments. Reduced motion shrinks camera moves toward each shot's resting framing (the two turns that carry story information are kept). Reduced flicker removes fluorescent sags and analog line instability and softens grain. Both settings are remembered in this browser and follow `prefers-reduced-motion` by default.

The controls bar appears on mouse movement and hides during playback.

| Key | Action |
|---|---|
| Space | Play / pause |
| R | Restart |
| ← / → | Seek 5 s (Shift: 1 s) |
| , / . | Step one frame (paused) |
| M | Mute |
| C | Captions |
| F | Fullscreen |
| H / Esc | Clean capture mode: no interface, no cursor; captions and sound stay |

URL options: `?capture=1`, `?quality=high|medium|low`, `?t=72` (start time), `?cc=0`, `?mute=1`, `?vo=folder/`.

## Capture

**Captions and title cards are drawn into the picture**, not layered as HTML, so every capture path includes them. Turn them off with C (or `--cc 0` for frames) for a textless master.

- **REC**: records the whole film in real time to WebM (VP9/VP8 + Opus), or MP4 where the browser supports it, including picture, captions and mixed soundtrack. The timeline is always exactly 120 s. Recording is *real time*: if your GPU drops frames at the chosen quality, the recording drops them too. Use 720p if it stutters.
- **WAV**: renders the soundtrack offline, sample-accurate (48 kHz stereo).
- **Frame-accurate PNG sequence** (independent of GPU speed):
  ```
  npm i -D playwright && npm run build
  node scripts/render-frames.mjs --fps 30 --quality high --out frames
  ffmpeg -framerate 30 -i frames/%05d.png -i please-hold-soundtrack.wav -c:v libx264 -pix_fmt yuv420p -crf 14 -c:a aac -b:a 320k please-hold.mp4
  ```
  `window.PRS.renderAt(t)` renders any timestamp exactly. Monitors, the portal and reflections are settled, so the result never depends on what was rendered before.

Checking tools: `npm run snapshot -- --t 5,33,49,65,83,101,117` (stills + contact sheet + console errors) and `npm run audio-levels` (peak/RMS per second).

## How it's built

| File | Role |
|---|---|
| `src/timeline.js` | Beats (`CUE`), 15 shots, The Algorithm's captions (each also a voice-over slot `H01`…`H10`) |
| `src/shots.js` | Camera per shot; reduced-motion damping |
| `src/director.js` | `t` → state of the control room, the Continuity corridor, the lift and the chamber |
| `src/world.js` | The sets, the HOLD lamp motif, signs, the phone, the switch, the CRT audience |
| `src/fx.js` | Reflections (with hooks so a mirror can show an earlier layout), the **portal**, the **feed atlas**, light shafts, dust |
| `src/entity.js` | The scanline silhouette: posable arms and head, dithered fade (local and whole-body), shadow-only mode; the scanline hand |
| `src/post.js` | DOF, bloom, grade, grain, and the caption/title layers |
| `src/cards.js` | Captions (getting smaller and dimmer as the narrator gets quieter) and the closing title |
| `src/audio.js` | The four-note hold motif that loses notes, ring, contactors, structural creaks behind the listener, chamber reverb, morning, and a master gate for true silence |

### The illusions
- **The reflection keeps the old layout.** The control-room glass is a planar reflector with pre/post hooks: during its pass, the entity is swapped for an "echo" still standing at the CRT.
- **The elevator opens onto the room it left.** The doorway is a portal: the control room rendered from a camera with the same pose relative to a virtual doorway, sampled in screen space, with a clip plane. The control-room CRT shows a live feed of the corridor you're standing in. No recursion: the portal is never in the scene it shows.
- **The corridor changes while you look away.** The section behind the camera swaps from short to long during the locked-off elevator shot. The framed house's window goes dark at the same moment.
- **The wrong side of the glass.** The car's rear wall is a mirror that becomes a window into monitors. Six cameras render into one atlas texture, and an empty chair exists only where the cinematic camera is, visible only to those cameras.
- **A shadow of something no longer there.** A shadow-only copy of the entity stands in the morning light after the entity is gone.

### Not verified
- Real-time frame rate on a real GPU. All checks ran in headless Chromium with software WebGL, which shows composition and correctness, not speed.
- MP4 recording. It's only offered when the browser reports support; WebM was the format available in testing.
- Listening. The sound was checked by measuring it, not by ear: levels stay at or below about −7 dBFS, and the title holds digital silence except one click at 118 s.
