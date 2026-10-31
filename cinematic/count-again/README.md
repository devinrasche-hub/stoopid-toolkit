# COUNT AGAIN: STOOPID AFTER HOURS 07

*THE STOOPID SHOW.* A 120-second browser cinematic (16:9, designed for 1920×1080). It's the third film in the creepypasta run, built on the endless-rooms shape: every door opens onto the same place, a little worse each time. The story is original and borrows no names, places or text from its sources. Three.js draws the picture and Web Audio generates the whole soundtrack. `npm run build` produces one self-contained HTML file that plays with no CDN.

> You get out by noticing what's wrong, not by running.

It's 4:58. A mug steams beside the card. The operator walks out the back door and down the hall, opens a door, and steps into the control room again. The clock reads 4:58, the chair faces the door, and the coffee is cold. It happens again: the room is dimmer, the bars run backwards, and rule 9's ink is wet. Back in the hall, the break-room microwave says FISH. In the third copy there are four monitors. Rule 5 says "If you count four, count again." The fourth monitor turns out to be a window onto the real room, where the mug is still warm and someone new in an orange hood is reading the card. The hood looks up at us, then looks away. The window fills with snow and goes black. The clock turns to 4:59.

- **Published film:** [`/stoopid_count_again.html`](../../stoopid_count_again.html) (VAULT item 039).
- **Installments:** [`/stoopid_after_hours.html`](../../stoopid_after_hours.html) lists 01–07.
- **Background:** the locked brief is in `BRIEF.md`; the method, plus questions for finding anchors, is in `../PLAYBOOK.md`.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/index.html, copied to /stoopid_count_again.html
```

Playback, keys, URL options and capture work as in 01–06 (see `../signal-received/README.md`). Reduced motion keeps the count, the push into the window and the 4:59 tilt. If Playwright can't find its browser, set `CHROMIUM_PATH`.

- `npm run snapshot -- --t 11,18,24,31,44,55,63,76,92,100,110.5` writes stills and a contact sheet.
- `npm run audio-levels` prints peak and RMS for each second.

## Voice slots (optional)

| Slot | At | Line |
|---|---|---|
| A01 | 23.4 | "Welcome back." |
| A02 | 59.0 | "Welcome back." |

## How it's built

| File | Role |
|---|---|
| `src/timeline.js` | Beats (`CUE`), which room you're in (`roomAt`), 15 shots, captions |
| `src/director.js` | `setRoom(k)` applies each copy's wrongness: the chair, the light, the bars, the wet ink, the cold coffee, the fourth monitor, the clock. It also runs the new operator, the window feed, the microwave and the steam |
| `src/world.js` | 05's station plus the break room and its microwave, the mug and its steam, the fourth monitor, and the new operator |
| `src/shots.js` | Walks (keyed paths with a step bob) and the cuts through the same doorway |
| `src/main.js` | Feeds can now carry `pre()` / `post()`, so a feed can render the room in another state |
| `src/audio.js` | Room beds that drop lower in each copy, the hall's buzz, footsteps, doors and latches, the microwave up close, the snow, and a master gate after FISH |

## Limits

- **The new operator** is a plain hooded shape: a capsule body, a sphere head, a dark opening where a face would be. They're only seen small, through the window, lit from one side.
- **Each copy is the same set** with state changes. Nothing is geometrically impossible, and nothing needs a portal.
- **No GPU test.** All checks ran in headless Chromium with software WebGL.
- **Not heard.** The sound was measured, not listened to:
  - After FISH (53–58 s) the sound is true digital silence.
  - The loudest peak is −16.9 dBFS, at the microwave.
- **The older films' opening screens** don't list 05–07. The series page and THE VAULT do.
