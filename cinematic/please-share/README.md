# PLEASE SHARE: STOOPID AFTER HOURS 06

*THE STOOPID SHOW.* A 120-second browser cinematic (16:9, designed for 1920×1080) and the second film in the creepypasta run. The pasta shape here is the cursed image. The story is original and borrows nothing from smile.jpg. Three.js draws the picture and Web Audio generates the whole soundtrack. `npm run build` produces one self-contained HTML file that needs no CDN to play.

> The only way to get rid of it is to give it to someone.

It's the next night in 05's control room. A message arrives: "SUBJECT: please share". The image in it loads from the top and stops at 18%: "This image must be shared to finish loading." The Algorithm shares it to all three monitors, and each share loads more of it. Then a share sheet opens, and the cursor drifts by itself to KIDDO ("night dad. one more minute?"). The operator takes the trackball and fights the cursor up to CANCEL. The image stays, now complete on every screen. Then the operator writes rule 9 on the card in the last operator's marker: "IF IT WANTS TO BE SHARED, KEEP IT."

- **Published film:** [`/stoopid_please_share.html`](../../stoopid_please_share.html) (VAULT item 038).
- **Installments:** [`/stoopid_after_hours.html`](../../stoopid_after_hours.html) lists 01–06.
- **Background:** the locked brief is in `BRIEF.md`; the method is in `../PLAYBOOK.md`.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/index.html, copied to /stoopid_please_share.html
```

Playback, keys, URL options and capture work the same as in 01–05 (see `../signal-received/README.md`). With reduced motion on, the trackball fight, the pull-back to every screen, and rule 9 being written all keep their camera moves.

Checking tools:

- `npm run snapshot -- --t 12,22,33,40,50,62,78,90,99,103,110` writes stills, a contact sheet and any console errors.
- `npm run audio-levels` prints peak and RMS for each second.

If Playwright can't find its browser, set `CHROMIUM_PATH`.

## Voice slots (optional)

Only The Algorithm speaks, and only as captions. To add recorded lines, put files named after these ids in a folder and open the page with `?vo=that/folder/`.

| Slot | At | Line |
|---|---|---|
| A01 | 9.6 | "Here's something you might like." |
| A02 | 30.6 | "It's already doing so well." |
| A03 | 38.5 | "Share it, and it goes away." |
| A04 | 64.0 | "Send it to someone you love. It loads faster." |
| A05 | 98.5 | "It will stay with you now." |

## How it's built

| File | Role |
|---|---|
| `src/timeline.js` | Beats (`CUE`), how far the image has loaded over time (`LOAD`), the handwriting (rule 7 from 05, rule 9 tonight), 11 shots, captions |
| `src/image.js` | The image: a procedural flash photo, degraded in 8×8 blocks, drawn loaded from the top with the last row smeared down |
| `src/card.js` | 05's card, taller, with rule 7 already written and room for rule 9 |
| `src/director.js` | The message, the viewer, the shares to each monitor, the share sheet and its cursor, the trackball hand, the marker and rule 9 |
| `src/world.js` | 05's station plus a trackball and the palm-on-ball hand |
| `src/shots.js` | Camera per shot |
| `src/cards.js` | The notice (the one joke), The Algorithm's captions, title and credits |
| `src/audio.js` | 05's room beds, a data chirp under every load, a whoosh per share, the trackball, CANCEL, a swell, marker squeaks, and a master gate for the notice's silence |

### Continuity
- **The set** is 05's control room. The card still has rule 7 in the last operator's handwriting, and the marker lies where they left it.
- **KIDDO** is the child from 03. "One more minute" is 03's bedtime ritual.

## Limits (what's placeholder and what wasn't verified)

- **Simple hands.** The marker grip and the palm on the trackball are built from a few soft shapes with a dark sleeve. They read at the edge of frame; don't push in on them.
- **The image is procedural.** It's a 160×120 canvas drawing, not a photograph. That's deliberate: nothing in it is a real person.
- **Handwriting font.** Same as 05: whatever handwriting-style system font is available, jittered per letter. Every check here used the bold sans fallback.
- **No GPU test.** All checks ran in headless Chromium with software WebGL.
- **Not heard.** The sound was measured, not listened to:
  - The notice's silence (46–50 s) is true digital silence.
  - Its chime peaks at −13.1 dBFS, the loudest moment in the film.
- **The older films' opening screens** don't list 06. The series page and THE VAULT do.
