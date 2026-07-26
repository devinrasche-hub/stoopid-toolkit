# STOOPID TOOLKIT — THE STOOPID STUDIO

Public brand tools for **THE STOOPID SHOW** (@stoopidshow) — hosted free on GitHub Pages.

**Live site:** https://devinrasche-hub.github.io/stoopid-toolkit/

The landing page is **THE STOOPID STUDIO** — a boot sequence, a glitch wordmark, signal dust, and **THE VAULT**: all 15 tools catalogued as artifacts across four wings (The Courthouse, The Arcade, The Broadcast Floor, The Writers Room), each with its own live animated preview. Every tool page carries a `◂ THE VAULT` tab back to the studio.

| # | Artifact | What it does |
|---|---|---|
| 001 | [Verdict Card Generator](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_verdict_cards.html) | STOOPID vs STUPID — type the behavior on trial, pick the verdict, download a share-ready card |
| 002 | [The Courtroom (Live)](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_courtroom_live.html) | Run your own STOOPID vs STUPID trials — streaming ballots, gavel sounds, verdict stamp with the margin |
| 003 | [No Touchy For Free™ Invoices](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_no_touchy_invoice.html) | Emotional labor has a cover charge — type what you carried, stamp it PAST DUE, download the bill |
| 004 | [Stoopid Snake](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_snake.html) | Eat the beans, the walls are not free — every death gets a verdict and a downloadable run report |
| 005 | [Stoopid Defense](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_defense.html) | Neon laser tower defense — defend the signal from waves of slop; every collapse gets a verdict |
| 006 | [Stoopid Clash](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_clash.html) | Build the base, wait the wait, raid the void — skipping a timer just costs an invoice |
| 007 | [The Stoopid Trail](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_trail.html) | The classic trail, one correction: the promised land is the World Famous Davenport, IA |
| 008 | [The Press Me Cube](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_press_me_cube.html) | Six faces, six clues, one goblin taking notes |
| 009 | [The Stoopid Mine](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_mine.html) | Eat the coin, re-mint the coin — an idle clicker that generates value from pure belief. Proof of Work is out, Proof of Stoopid is in. Blockchain not included |
| 010 | [KWTF 88.8 — The Dial](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_kwtf_dial.html) | The internet as an FM band — tune through the crazies, the hustle, the angels, the 2AM channel |
| 011 | [The Video Machine](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_video_machine.html) | Music video maker — load an mp3, pick a music-reactive scene, press REC, save the video |
| 012 | [Signal Acknowledged](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_signal_ack.html) | Subscriber shout-out generator — hot-pink name rain resolves into the roll, record the clip |
| 013 | [The Credits Machine](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_credits_roll.html) | Roll your own fake-serious end credits — paste names, SPACE, record the clip |
| 014 | [Empress Heavy](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_empress_heavy.html) | ASCII rocket launch — countdown, fireworks (GOOD LUCK EMPRESS HEAVY), zoom into space, star-shine vanish |
| 015 | [Flip Finder](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_flip_finder.html) | Paste a script, find the flip candidates (Hook → Escalation → Flip → Release) |

Everything is a single self-contained HTML file. No server, no accounts, no tracking, no API keys — safe to publish.

## How this repo works

- **Source of truth is the vault** (`C:\STOOPID_VAULT\`). Edit tools there first.
- To publish an update: copy the changed `stoopid_*.html` into this folder, then

  ```
  git add -A
  git commit -m "describe what changed"
  git push
  ```

  GitHub Pages redeploys the site automatically within a minute or two of every push.
- Every commit is a permanent snapshot — you can always see what changed, when, and roll back.
- New tool? Add it to the grid in `index.html` (give it an item number, a wing, and a `data-viz` preview) and to the table above.

## What does NOT go here

This repo is **public** — anyone can read every file in it, including old versions.

- No `.env` / API keys
- No `stoopid_vault.db`, transcripts, or episode files
- No unreleased Season 2 material (no S2 war room, no analyzer — the analyzer needs the local vault server anyway)

*Signal Received.*
