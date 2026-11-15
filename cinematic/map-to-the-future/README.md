# A MAP TO THE FUTURE

*THE STOOPID SHOW.* A 150-second browser explainer (16:9, designed for 1920×1080) on ideas taught by Dr. Joe Dispenza. Three.js draws every picture and Web Audio generates the whole soundtrack. `npm run build` produces one self-contained HTML file that needs no CDN to play.

> The brain you wake up with is a record of the past, and rehearsal can turn it into a map to the future.

- **Published film:** [`/stoopid_map_to_the_future.html`](../../stoopid_map_to_the_future.html) (VAULT item 034).
- **Background:** the request and the brief made from it are in `BRIEF.md`; the method is in `../PLAYBOOK.md`.
- Not affiliated with or endorsed by Dr. Joe Dispenza. The narration paraphrases his ideas and attributes them; it is not medical advice.

## The four chapters

| Time | Chapter | What you see |
|---|---|---|
| 0–43 s | 01 THE LOOP | Black, an alarm, a phone lighting the dark at 6:02. Every notification is the past. Push into the screen until a red ring fills it; the ring becomes the loop THOUGHTS → CHOICES → BEHAVIORS → EXPERIENCES → EMOTIONS. A light runs it, faster every lap, and the ring thickens. The camera swings to the side: the loop is a coil, the same past repeating into the future. Dive through it. |
| 43–72 s | 02 THE MECHANICS | Split screen. Left, ANALYTICAL MIND: a wall of shuffling blocks, a busy red beta wave, JUDGING / PLANNING / WORRYING. Right, MEDITATION: the same wall, but the wave slows to alpha (violet) and theta (teal), the blocks drift apart, and the camera passes through to THE PROGRAM, a knot of habit. The right side takes the frame. |
| 72–107 s | 03 MENTAL REHEARSAL | "Close your eyes." Eyelids close and open inside a neural network wired in amber: A RECORD OF THE PAST. Four rehearsals sweep through it, each wiring new teal and violet connections. The whole network changes colour: A MAP TO THE FUTURE. Pull back to the whole brain. |
| 107–150 s | 04 VICTIM → CREATOR | A board: SOMETHING OUT THERE strikes HOW YOU FEEL; then THE JOB, THE NEWS and THEM knock it around (OUTSIDE → INSIDE). The board dissolves into a quantum field. The ball rises and lights: CLEAR INTENTION (teal), ELEVATED EMOTION (violet). A coherent wave orders the field and lays a path ahead (INSIDE → OUTSIDE). CREATOR, in Burnt Orange. Morning: the phone lies face down. Eyes close. Title. |

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/index.html, copied to /stoopid_map_to_the_future.html
```

The opening screen shows **Preparing…** while it renders each space once off-screen, then **Start** begins playback and turns on audio.

## Playback

| Key | Action |
|---|---|
| Space | Play / pause |
| R | Restart |
| ← / → | Seek 5 s (Shift: 1 s) |
| , / . | Step one frame (paused) |
| M | Mute |
| C | Narrator captions |
| F | Fullscreen |
| H / Esc | Clean capture mode: no interface or cursor; captions and sound stay |

URL options: `?capture=1`, `?quality=high|medium|low`, `?t=96` (start time), `?cc=0`, `?mute=1`, `?vo=folder/`.

**Reduced motion** removes camera drift and shortens the dive through the coil. The other moves stay, because they carry the explanation.

## Capture

Captions, diagram labels, chapter cards, eyelids and the title are painted on a layer composited into the picture, so every capture method includes them. `C` turns off only the narrator captions; the diagram labels are part of the picture.

- **REC** records the film in real time to WebM (or MP4 where supported), picture and mixed soundtrack. Dropped frames are recorded as dropped; use 720p if it stutters.
- **WAV** renders the soundtrack offline, 48 kHz stereo.
- **Frame-accurate PNG sequence:**
  ```
  npm run build
  node scripts/render-frames.mjs --fps 30 --quality high --out frames
  ffmpeg -framerate 30 -i frames/%05d.png -i a-map-to-the-future-soundtrack.wav -c:v libx264 -pix_fmt yuv420p -crf 14 -c:a aac -b:a 320k a-map-to-the-future.mp4
  ```

If Playwright's own browser isn't installed, point the scripts at any Chromium with `CHROMIUM_PATH=/path/to/chrome`.

Checking tools: `npm run snapshot -- --t 6,22,38,50,63,82,97,117,133,143` (stills + contact sheet + console errors) and `npm run audio-levels` (peak/RMS per second).

## Voice slots (optional)

No voice is included and none is synthesized. Every narrator line is a timed caption (`src/timeline.js`, `NARRATION`, ids N01–N27). To add a recorded read, put `N01.mp3` … `N27.mp3` (or `.wav`/`.ogg`) in a folder and open the page with `?vo=that/folder/`. Each file starts at its caption's start time.

## How it's built

| File | Role |
|---|---|
| `src/timeline.js` | Every cue, the shots, chapters, narration, and the loop's accelerating angle (shared by picture and sound) |
| `src/world.js` | The five spaces: bed (phone UI drawn live on a canvas), loop + coil, gate (built twice for the split), brain (1,250 neurons, nearest-neighbour wiring), field (22,500 points) |
| `src/shots.js` | One camera function per shot; the split screen returns two views |
| `src/cards.js` | Overlay: captions, chapter cards, projected labels, split divider, eyelids, fades, title |
| `src/post.js` | DOF, bloom, grade, grain; renders split-screen views into one frame with scissor rectangles |
| `src/audio.js` | Beds per space, alarm and pings, a pulse for every lap of the loop, beta buzz left / slowing buzz right, a 6 Hz theta difference between the ears, rehearsal arpeggios, record (A minor) and map (A major) pads, clacks, the field's air, blooms at coherence and CREATOR, morning birds |

## Limits

- **The source video wasn't watched.** The timestamps in the request point to a video that wasn't available here. The script follows the requested structure and Dispenza's widely published ideas, not that video's exact words.
- **No borrowed visuals.** "Based off existing visual explainers" was taken to mean the genre's vocabulary (glowing loops, neural nets, brain waves, particle fields), all generated in code. No footage or artwork from other explainers is used.
- **No people.** There is no figure or face; the person is the first-person camera and the phone.
- **No GPU test.** All checks ran in headless Chromium with software WebGL, which shows composition, not frame rate. The field (22,500 points updated per frame) and brain are the heaviest moments; drop to 720p if they stutter.
- **Not heard.** The sound was measured, not listened to. Loudest peak is about −9 dBFS.
