# STILL HERE: STOOPID AFTER HOURS 03

*THE STOOPID SHOW.* A 120-second browser cinematic (16:9, designed for 1920×1080). It begins on the last frame of [PLEASE HOLD](../please-hold/) ("AUTOPLAY STARTING…"). Three.js draws the picture and Web Audio generates the whole soundtrack. `npm run build` produces one self-contained HTML file that needs no CDN to play.

> Your family does not need an audience to notice your absence.

The station has built a home to keep you in: a living room, a hallway, a child's bedroom, all staged and lit for a camera. The viewer is the father, seen only through a first-person camera. He gets out by recognizing something the station never recorded: three knocks from behind a wall that has no door, and "You forgot our minute."

- **Published film:** [`/stoopid_still_here.html`](../../stoopid_still_here.html) (VAULT item 032).
- **Installments:** [`/stoopid_after_hours.html`](../../stoopid_after_hours.html) lists 01, 02 and 03. The film's opening screen also links all three, so each can still be played on its own.
- **Background:** the prompt that produced this film is in `BRIEF.md`; the method is in `../PLAYBOOK.md`.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/index.html, copied to /stoopid_still_here.html
```

Before playback, the opening screen shows **Preparing…** while it compiles every shader and renders each shot once off-screen. This stops the doorway reveals from stalling mid-film. **Start** then begins playback and turns on audio.

## Playback

The opening screen has these options:
- sound on/off
- quality (1080p/720p/540p)
- **reduced motion**
- **reduced flicker**
- clean capture
- links to all three installments

**Reduced motion** shrinks each camera move toward the shot's resting framing. It keeps the moves that carry the story: the turn toward the hallway, the turn toward the knocks, the turn back and then to the door, and walking in and sitting down.

**Reduced flicker** removes the station's raster instability and softens grain. The real room has neither in any mode.

| Key | Action |
|---|---|
| Space | Play / pause |
| R | Restart |
| ← / → | Seek 5 s (Shift: 1 s) |
| , / . | Step one frame (paused) |
| M | Mute |
| C | Captions |
| F | Fullscreen |
| H / Esc | Clean capture mode: no interface or cursor; captions and sound stay |

URL options:
- `?capture=1`
- `?quality=high|medium|low`
- `?t=96` (start time)
- `?cc=0`
- `?mute=1`
- `?vo=folder/`

## Capture

**Captions and title cards are drawn into the picture**, so every capture method includes them. For a textless master, turn them off with C, or pass `--cc 0` when rendering frames.

- **REC** records the film in real time to WebM, or to MP4 where the browser supports it. The recording includes picture, captions and the mixed soundtrack. The timeline is always exactly 120 s. Because recording is real time, any frames your GPU drops are dropped from the recording too; use 720p if it stutters.
- **WAV** renders the soundtrack offline, sample-accurate, 48 kHz stereo.
- **Frame-accurate PNG sequence** (does not depend on GPU speed):
  ```
  npm i -D playwright && npm run build
  node scripts/render-frames.mjs --fps 30 --quality high --out frames
  ffmpeg -framerate 30 -i frames/%05d.png -i still-here-soundtrack.wav -c:v libx264 -pix_fmt yuv420p -crf 14 -c:a aac -b:a 320k still-here.mp4
  ```
  `window.PRS.renderAt(t)` renders any timestamp exactly. The photo feeds and both doorways are settled first, so the result never depends on what was rendered before.

Checking tools:
- `npm run snapshot -- --t 6,17,30,42,55,69,80,98,110` writes stills, a contact sheet and any console errors.
- `npm run audio-levels` prints peak and RMS for each second.

## Voice slots (optional)

No voice recordings are included, and none are faked. Every line is a timed caption, and there is no speech synthesis. To add real recordings, put files named after the slot ids (`.mp3`, `.wav` or `.ogg`) in a folder and pass `?vo=that/folder/`. See `vo/README.md` for the list. Each file starts at its caption's start time.

| Slot | Who | At | Line |
|---|---|---|---|
| S01 | the station, imitating a child | 11.0 | "DAD?" |
| A01 | The Algorithm | 24.0 | "It has learned what makes you stay." |
| F01 | child, behind the wall | 48.0 | "Dad?" |
| F02 | child, behind the wall | 51.0 | "You forgot our minute." |
| A02 | The Algorithm | 60.0 | "That wasn't in the recording." |
| A03 | The Algorithm | 68.0 | "Someone noticed you were gone." |
| A04 | The Algorithm | 82.0 | "They can keep watching." |
| A05 | The Algorithm | 85.0 | "You can go." |
| S02 | the station | 92.0 | "WHO WILL YOU BE WITHOUT US?" (*inaudible by design: the mix is gated to silence 92–96 s*) |
| F03 | child, beyond the door | 96.4 | "Dad." |
| F04 | child | 108.0 | "Just a minute?" |
| F05 | the father | 111.0 | "I'm here." |

## False home and real home

| | False home (0–101 s) | Real room (101–120 s) |
|---|---|---|
| Composition | Centred, symmetrical, mechanically smooth moves | Handheld walk, an uneven sit-down, slight roll |
| Props | Two identical lamps, two identical mugs, shoes in a perfect row, a chair on a tape mark facing a camera | A patchwork quilt, a toy half under the bed, a sock on the floor, a glass of water on a coaster, a bent book, a crayon drawing, a sweater on the chair |
| Light | A set key no house has; warm light with teal shadows; teal after 74 s | One bedside lamp; no tally lights, screens or camera |
| Image | Station caption instability, grain, bloom | No instability, no halation, less grain, no slow motion, no glow |
| Sound | Hum with the four-note hold motif buried under it (8–44 s); relays | Ordinary room tone, a clock, breathing, a page turn; no music |

Captions follow the same split. The station's text wavers on its raster. Family lines are set in clean, stable type.

## How it's built

| File | Role |
|---|---|
| `src/timeline.js` | Beats (`CUE`), 13 shots (each marked as false or real world), captions and voice slots |
| `src/shots.js` | Camera per shot; reduced-motion damping |
| `src/director.js` | Maps `t` to state: TV program, photo feeds, recording light, tally texts, light strip and door seams, the door forming, teal switch, both doorways, the child's breathing and hand |
| `src/world.js` | The false home (living room, hallway, staged bedroom), the transmission chamber, the real bedroom |
| `src/fx.js` | Portal, feeds, dust (engine, unchanged from 02) |
| `src/post.js` | DOF, bloom, grade (with teal-shadow and warm-highlight controls), grain, caption and title layers |
| `src/cards.js` | The 02 autoplay card at full frame, then station, Algorithm and family captions; the closing title |
| `src/audio.js` | Beds, the buried hold motif, knocks, relay clicks, latch, room tone, breathing, clock, page; master gate for the silence at 92 s |

### Tricks behind the illusions
- **The hallway leads into the chamber.** When the camera turns back at 79 s, the hallway doorway behind it becomes a portal into the transmission chamber, and every screen shows "STAY.". The portal keeps the viewer's perspective, so nothing cuts or jumps.
- **The door opens into the real room.** At 96 s the doorway in the wall is a portal into a different scene. You see the real room from the threshold, then the film cuts inside at 101 s.
- **The photographs are live.** All three hallway pictures are cameras rendering the empty couch from slightly different angles.
- **The door only appears gradually.** Before 68.6 s the wall is one uniform surface. A strip of light appears under it, then the seams light up, then the panel darkens a shade and stands a few millimetres proud, and finally a handle grows out of it.

## Limits (what's placeholder and what wasn't verified)

- **No voice files.** The lines are captions only, with slots ready for recordings (see above). The station's "DAD?" at 11 s is caption-only too.
- **No photographs.** None were supplied, so none are used and no likenesses were made. The hallway pictures show the empty couch.
- **Simple bodies.** The child is a quilt shape over a curled body, with the back of a head on the pillow; there is no face. Both hands are simple rounded silhouettes: the child's comes out from under the quilt and rests near his at the edge of the frame. They hold up as shapes in lamplight but won't survive a close look.
- **No GPU test.** Real-time frame rate on a real GPU is untested. Every check ran in headless Chromium with software WebGL, which shows composition and correctness but not speed.
- **Not heard.** The sound was measured, not listened to. Peaks reach −7 dBFS at the knocks, and 93–95 s is digital silence.
- **WebM only tested.** MP4 recording is only offered when the browser reports support; WebM was the format available in testing.
