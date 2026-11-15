# PIP AND THE STATIC: STOOPID AFTER HOURS 08

*THE STOOPID SHOW.* A 120-second browser cinematic (16:9, designed for 1920×1080), and the fourth film in the creepypasta run. Its shape is the half-remembered kids' show: something everyone remembers watching that nobody can find. The story is original and takes no names, characters, lines or twist from its source. Three.js draws the picture and Web Audio generates the whole soundtrack. `npm run build` produces one self-contained HTML file that plays without a CDN.

> You remember it because it remembered you.

The film opens on a forum thread: "does anyone remember PIP AND THE STATIC?" The station's tape archive has the tape: "PIP — EP. 7 — DO NOT AIR". On the tape, a felt puppet with button eyes and antenna ears says hello to the friends on its chalkboard. A commercial break cuts in (THE STATIC: NOW IN GRAPE!). Pip says it kept the names of the friends who stopped watching. The tape pauses on Pip's face while the thread goes on. Then it plays again by itself, and Pip writes one more friend on the board: STOO. "He never stopped watching." The tape ends, and the archive CRT goes to the station's own test pattern. Someone has added a line to the label: "(AIRS NIGHTLY)".

- **Published film:** [`/stoopid_pip_and_the_static.html`](../../stoopid_pip_and_the_static.html) (VAULT item 040).
- **Installments:** [`/stoopid_after_hours.html`](../../stoopid_after_hours.html) lists 01–08.
- **Background:** the locked brief is in `BRIEF.md`, and the method is in `../PLAYBOOK.md`.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/index.html, copied to /stoopid_pip_and_the_static.html
```

Playback, keys, URL options and capture work as in 01–07 (see `../signal-received/README.md`). Reduced motion leaves the tape's zooms alone, because they belong to the tape. If Playwright can't find its browser, set `CHROMIUM_PATH`.

- `npm run snapshot -- --t 5,12,16.5,27,40,50,62,75,89,99,110` writes stills and a contact sheet.
- `npm run audio-levels` prints peak and RMS for each second.

## Voice slots (optional)

Only Pip speaks, and only in captions. To add recordings, put files named after these ids in a folder and open the page with `?vo=that/folder/`.

| Slot | At | Line |
|---|---|---|
| P01 | 26.0 | "Hi, friends! It's me, Pip!" |
| P02 | 30.5 | "Let's say hello to everybody." |
| P03 | 39.0 | "Hello, Sam. Hello, Noor. Hello, Eli…" |
| P04 | 60.0 | "Some friends stopped watching." |
| P05 | 64.4 | "That's okay. I kept their names." |
| P06 | 81.5 | "One more friend." |
| P07 | 91.5 | "He never stopped watching." |

## How it's built

| File | Role |
|---|---|
| `src/timeline.js` | Beats (`CUE`), the thread's posts, the friends' names, 13 shots, Pip's captions |
| `src/world.js` | Two scenes. The archive: shelves of instanced tapes, an AV cart, the deck and its label, the CRT, one bulb, the operator's hand. Pip's stage: a painted backdrop, the apron, the chalkboard, and Pip (felt, button eyes, antenna ears, a mouth that opens) |
| `src/director.js` | Tape time (frozen while paused). Pip's puppetry (pop-up, wave, touching each name, writing STOO in chalk), the board drawn in chalk, the thread on the CRT, the deck display, the label |
| `src/shots.js` | The archive camera, plus `tapeCam`: the studio camera that taped it, used for the close shots and for the feed |
| `src/cards.js` | Pip's captions, the tape's PLAY mark and tracking band, the cereal commercial, the title |
| `src/audio.js` | The bulb, the room, tape hiss with wow, the deck's motor and clunks, the toy-piano theme (02's hold melody), chalk, a master gate for the commercial |

## Limits

- **Pip is simple.** A cylinder, a sphere, two buttons and two felt tubes. That suits a cheap kids' show, but it's closer to cute than creepy up close. The tape's grain and the zooms carry the dread.
- **Handwriting fonts.** The names, STOO and the label use whatever handwriting-style system font is available, jittered per letter. Every check here used the fallback.
- **No GPU test.** Every check ran in headless Chromium with software WebGL.
- **Not heard.** The sound was measured, not listened to. The commercial (48–52 s) is true digital silence. The loudest peak is −18.1 dBFS.
- **The older films' opening screens** don't list 05–08. The series page and THE VAULT do.
