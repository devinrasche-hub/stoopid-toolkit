# OVERNIGHT OPERATOR: STOOPID AFTER HOURS 05

*THE STOOPID SHOW.* A 120-second browser cinematic (16:9, designed for 1920×1080), and the first of the creepypasta run. Each episode in the run is an original story built on a classic pasta *shape*, with no borrowed characters or stories. This one's shape is the night-shift rules. Three.js draws the picture and Web Audio generates the whole soundtrack. `npm run build` produces one self-contained HTML file that needs no CDN to play.

> Every rule was written by someone who learned it the hard way.

A laminated card is taped to the console: RULES FOR WHOEVER RUNS THE STATION AFTER MIDNIGHT. The station tests the rules one at a time:

- The test pattern turns into the room, filmed from behind you.
- The studio chair turns to face you.
- The talkback asks if you're there.
- A microwave beeps down the hall.
- The request line rings.

You obey every rule. Rule 7 is scratched out. At 4:58 a hand comes in with a marker and writes it back: "IF YOU ARE READING THIS, YOU ARE THE OPERATOR NOW."

- **Published film:** [`/stoopid_overnight_operator.html`](../../stoopid_overnight_operator.html) (VAULT item 037).
- **Installments:** [`/stoopid_after_hours.html`](../../stoopid_after_hours.html) lists 01–05.
- **Background:** the locked brief is in `BRIEF.md`, and the method is in `../PLAYBOOK.md`.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/index.html, copied to /stoopid_overnight_operator.html
```

## Playback

The controls, keys, URL options and capture are the same as in 01–04 (see `../signal-received/README.md`). The opening screen offers:

- sound
- quality
- reduced motion
- reduced flicker
- clean capture
- links to all five films

**Reduced motion** keeps the hand writing and the final turn of the chair, because those moves carry the story.

## Capture

The talkback captions and the title are drawn into the picture, so every capture method includes them. The card, the clock and the CRT texts are part of the scene. Use REC for a real-time WebM/MP4 or WAV for the soundtrack. For a frame-accurate PNG sequence:

```
npm i -D playwright && npm run build
node scripts/render-frames.mjs --fps 30 --quality high --to 120 --out frames
ffmpeg -framerate 30 -i frames/%05d.png -i overnight-operator-soundtrack.wav -c:v libx264 -pix_fmt yuv420p -crf 14 -c:a aac -b:a 320k overnight-operator.mp4
```

Checking tools:

- `npm run snapshot -- --t 23,33,46,58,72,82,95,101,108` writes stills, a contact sheet and any console errors.
- `npm run audio-levels` prints peak and RMS for each second.

If Playwright can't find its own browser, set `CHROMIUM_PATH` to a Chromium binary.

## Voice slots (optional)

Only the talkback speaks, and only as wavering station captions. To add recordings, put files named after these ids in a folder (`.mp3`, `.wav` or `.ogg`) and open the page with `?vo=that/folder/`.

| Slot | At | Line |
|---|---|---|
| T01 | 44.2 | "Operator?" |
| T02 | 47.0 | "I can see you're there." |

## How it's built

| File | Role |
|---|---|
| `src/timeline.js` | Beats (`CUE`), the two handwritten lines (`WRITE`), 14 shots, the talkback captions |
| `src/card.js` | The laminated card: the rules' layout, the scratched rule 7, the handwriting a letter at a time, and where the pen is |
| `src/world.js` | The control room (console, main CRT, three monitors, the lamp, the talkback panel, the request-line phone, the LED clock, 01's chair), the studio through the glass, the hall, the marker and the last operator's hand |
| `src/director.js` | Maps `t` to state: the test pattern and the feed from behind you, the studio chair, the talkback lamp, the line light, the break-room light, the clock, the pen and the hand, the chair turning |
| `src/shots.js` | Camera per shot: the operator, standing at the console, reading the card |
| `src/cards.js` | Talkback captions and the title and credits |
| `src/audio.js` | Hum, air handler, the lamp's ballast, pressure, the open talkback line, the held request line, the microwave (behind you, down the hall), marker squeaks, and a master gate for rule 4's silence |

The engine files (`crt.js`, `fx.js`, `post.js`, `textures.js`, `util.js`, `main.js`) are 04's, with the scene swapped.

### Continuity
- **The chair** is 01's operator's chair, pushed back and askew. 05 is the night before 01: the chair turns to face you at 5:00.
- **The hold melody** from 02 is what's playing on the request line after somebody else picks up.

## Limits (what's placeholder and what wasn't verified)

- **Simple hand.** The last operator's hand is a loose fist made of soft shapes around the marker, with a dark sleeve. It works at the edge of frame in lamplight. Don't push in on it.
- **Handwriting font.** The new rule 7 uses whatever handwriting-style system font is available (Marker Felt, Chalkboard, Comic Sans, Segoe Print), jittered per letter. On machines with none of them, it falls back to a bold sans. Every check here used the fallback.
- **No GPU test.** Real-time frame rate on a real GPU is untested. Every check ran in headless Chromium with software WebGL.
- **Not heard.** The sound was measured, not listened to:
  - Rule 4's silence (56–60.4 s) reads true digital silence.
  - The microwave beeps at 60.5 s peak around −28 dBFS, alone in the quiet.
  - The loudest peak is −10.9 dBFS, at the opening relay.
- **The older films' opening screens** still list 01–04. The series page and THE VAULT list 05.
