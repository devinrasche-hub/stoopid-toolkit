# LOAD MORE REPLIES: STOOPID AFTER HOURS 09

*THE STOOPID SHOW.* A 120-second browser cinematic (16:9, designed for 1920×1080), and the fifth film in the creepypasta run. It uses the expedition-log shape: entry by entry, someone writes down how they went deeper into something that kept going. The story is original and takes no names, places, lines or images from its source. Three.js draws the picture and Web Audio generates the whole soundtrack. `npm run build` produces one self-contained HTML file that plays with no CDN.

> Every voice telling you to keep going is someone who kept going.

**The story.** At 1:12 AM the operator writes in the moderation log: "old ep, top comment. 1 reply won't load." The comment asks: "does anyone else hear something at 2:14?" With each LOAD MORE REPLIES, the thread goes down another level. Each level is narrower, as if the walls are closing in, and older: 7 years, 14 years, 52 years. The replies shrink to single words: "keep", "going", "it's", "fine". Then a wellbeing pop-up appears: "You've been scrolling for 47 minutes. Take a break?" KEEP SCROLLING.

At the bottom the thread opens out to one reply, posted just now: "you can come down now." A reply box under it types by itself, "keep going", and posts it as @overnight_operator. Back at the top, that's now the newest reply. The log's last entry stops mid-word: "2:16 · it's not so bad down h".

- **Published film:** [`/stoopid_load_more_replies.html`](../../stoopid_load_more_replies.html) (VAULT item 041).
- **Installments:** [`/stoopid_after_hours.html`](../../stoopid_after_hours.html) lists 01–09.
- **Background:** the locked brief is in `BRIEF.md`; the method is in `../PLAYBOOK.md`.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/index.html, copied to /stoopid_load_more_replies.html
```

Playback, keys, URL options and capture work as in 01–08 (see `../signal-received/README.md`). Nobody speaks, so there are no captions or voice slots: everything is on screen or in the log. If Playwright can't find its browser, set `CHROMIUM_PATH`.

- `npm run snapshot -- --t 5,15,26,38,50,57,65,80,85,90,100,110` writes stills and a contact sheet.
- `npm run audio-levels` prints peak and RMS for each second.

## How it's built

| File | Role |
|---|---|
| `src/timeline.js` | Beats (`CUE`), the log's entries, the thread (depth, author, age, text), the reply, 14 shots |
| `src/logbook.js` | The open moderation log: ruled pages, each entry written a letter at a time, and where the pen is |
| `src/director.js` | The thread: laid out once, scrolled by time, each level's margins closing in. The reply box, the rush back up, the top with your reply. The pen and hand, the palm on the trackball, the hand that stops being there |
| `src/world.js` | 07's station, with the logbook open on the console (the phone is put away) and a sharper main CRT |
| `src/shots.js` | Two places: the CRT, read closer the deeper it goes, and the log under the lamp |
| `src/cards.js` | The wellbeing pop-up (the one joke), the title |
| `src/audio.js` | The room, a draft that rises as the thread narrows and goes still where it opens out, trackball ticks, the pen, typing, the whoosh up, and a master gate under the pop-up |

## Limits

- **The hands are simple.** The pen grip and the palm are soft shapes that read at the edge of frame. Under the lamp the skin reads pale.
- **Handwriting font.** The log uses whatever handwriting-style system font is available. Every check here used the fallback.
- **No GPU test.** All checks ran in headless Chromium with software WebGL.
- **Not heard.** The sound was measured, not listened to. The pop-up (46–56.5 s) is true digital silence, and the loudest peak is −17.3 dBFS.
- **The older films' opening screens** don't list 05–09. The series page and THE VAULT do.
