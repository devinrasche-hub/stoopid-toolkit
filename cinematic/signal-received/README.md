# SIGNAL RECEIVED: STOOPID AFTER HOURS 04

*THE STOOPID SHOW.* The last installment: a 120-second browser cinematic (16:9, designed for 1920×1080). It opens on the last frame of [STILL HERE](../still-here/), "THE STOOPID SHOW / STILL HERE / END.". Three.js draws the picture and Web Audio generates the whole soundtrack. `npm run build` produces one self-contained HTML file that needs no CDN to play.

> What you make keeps traveling after you're gone.

The audience was never on Earth. A round, dark room a long way off is full of tall, faceless watchers. When Stoo comes on their screen, his orange light shows that every one of them has a bowl cut. The signal they're watching left Earth forty years ago. They watch it end, they rewind to the bedside minute, they cry for Stoo, and they send a reply that will never arrive: "SIGNAL RECEIVED."

- **Published film:** [`/stoopid_signal_received.html`](../../stoopid_signal_received.html) (VAULT item 036).
- **Installments:** [`/stoopid_after_hours.html`](../../stoopid_after_hours.html) lists 01–04. This film's opening screen links all four.
- **Background:** the locked brief is in `BRIEF.md`; the method is in `../PLAYBOOK.md`.
- **Stoo:** bowl cut Stoo is Dev's own avatar, supplied for this film (`src/assets/stoo.jpg`, downscaled to 512 px and bundled into the page).

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/index.html, copied to /stoopid_signal_received.html
```

The opening screen shows **Preparing…** while it compiles every shader and renders each shot once off-screen. Then **Start** begins playback and turns on audio.

## Playback

Same as 01–03. The opening screen has these options:
- sound on/off
- quality (1080p/720p/540p)
- **reduced motion**
- **reduced flicker**
- clean capture
- links to all four films

**Reduced motion** shrinks camera moves toward each shot's resting framing. It keeps the flip shot and the look up at the sky, because those carry the story.

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
- `?t=88` (start time)
- `?cc=0`
- `?mute=1`
- `?vo=folder/`

## Capture

**Captions, the region card and the title and credits are drawn into the picture**, so every capture method includes them. For a textless master, turn captions off with C, or pass `--cc 0` when rendering frames. The CRT texts are part of the scene and always show.

- **REC** records the film in real time to WebM, or to MP4 where the browser supports it. Because recording is real time, any frames your GPU drops are dropped from the recording too; use 720p if it stutters.
- **WAV** renders the soundtrack offline, sample-accurate, 48 kHz stereo.
- **Frame-accurate PNG sequence** (does not depend on GPU speed):
  ```
  npm i -D playwright && npm run build
  node scripts/render-frames.mjs --fps 30 --quality high --out frames
  ffmpeg -framerate 30 -i frames/%05d.png -i signal-received-soundtrack.wav -c:v libx264 -pix_fmt yuv420p -crf 14 -c:a aac -b:a 320k signal-received.mp4
  ```

Checking tools:
- `npm run snapshot -- --t 27,31,57,70,85,93,110` writes stills, a contact sheet and any console errors.
- `npm run audio-levels` prints peak and RMS for each second.

## Voice slots (optional)

Only The Algorithm speaks, and only as captions. The watchers never speak; their humming is a synthesized tone, not words. To add recordings, put files named after these ids in a folder (`.mp3`, `.wav` or `.ogg`) and open the page with `?vo=that/folder/`.

| Slot | At | Line |
|---|---|---|
| A01 | 12.0 | "Here we observe an audience in its natural habitat." |
| A02 | 19.0 | "It has been watching for a very long time." |
| A03 | 59.0 | "This is the last thing it sent." |
| A04 | 71.0 | "It ended forty years ago. They found out tonight." |
| A05 | 93.0 | "He made it anyway." |
| A06 | 96.0 | "He thought nobody was watching." |

## How it's built

| File | Role |
|---|---|
| `src/timeline.js` | Beats (`CUE`), 13 shots, The Algorithm's captions and voice slots |
| `src/world.js` | The watchers' round room: the set, the mast, the ring of screens, the watchers (instanced coat and bowl-cut meshes), the sky with Sol and the third planet, the long hand, drops of light. Also 03's bedside room, unchanged |
| `src/director.js` | Maps `t` to state: what the set shows, the screen cascade, the room light, the head that turns, the hand, the tears, the blue point going out, the reply beam. It also renders 03's bedside live into the set |
| `src/shots.js` | Camera per shot; reduced-motion damping |
| `src/cards.js` | 03's END card full frame (a raster creeps in), the region notice, The Algorithm's captions, the title and credits |
| `src/audio.js` | Room air and pressure, the set's hum, Stoo's warm tone, static, the bedside heard through a small speaker, the chime, a master gate for the silence after NO SIGNAL, and the watchers humming the four-note hold melody |

### Continuity
- **Opening:** the first frame is 03's last card, exactly as 03 drew it.
- **Last transmission:** the bedside room on their CRT *is* 03's bedside room: the same scene and quilt, his hand and hers, rendered live from where he sat. So the quilt is still breathing when it goes white.
- **Callbacks:** the hand on top of the set is film 01's scanline hand resting on its CRT. The hum is 02's four-note hold melody, finally sung back. The Algorithm's first line answers film 01: "Here we observe a creator in its natural habitat."

## Limits (what's placeholder and what wasn't verified)

- **Simple watchers.** They are deliberately plain: coat, shoulders, neck, a featureless head and a bowl cut. They work as backlit silhouettes. The close shots at 89–100 s show their backs and the backs of their heads, not a true side profile.
- **Stylized sky.** It's a field of points, a sprite for Sol and a sprite for Earth, with no physical scale.
- **No GPU test.** Real-time frame rate on a real GPU is untested. Every check ran in headless Chromium with software WebGL.
- **Not heard.** The sound was measured, not listened to:
  - True digital silence from just after NO SIGNAL (64.4 s) until 68 s.
  - The humming at 91–100 s is the loudest bed, at about −26 dB RMS.
  - The loudest peak is −12.6 dBFS, at the region-card chime.
- **WebM only tested.** MP4 recording is only offered when the browser reports support.
