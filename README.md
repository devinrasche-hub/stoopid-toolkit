# STOOPID TOOLKIT

Public brand tools for **THE STOOPID SHOW** (@stoopidshow) — hosted free on GitHub Pages.

**Live site:** https://devinrasche-hub.github.io/stoopid-toolkit/

| Tool | What it does |
|---|---|
| [Verdict Card Generator](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_verdict_cards.html) | STOOPID vs STUPID — type the behavior on trial, pick the verdict, download a share-ready card |
| [Flip Finder](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_flip_finder.html) | Paste a script, find the flip candidates (Hook → Escalation → Flip → Release) |
| [Stoopid Defense](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_defense.html) | Neon laser tower defense — defend the signal from waves of slop; every collapse gets a verdict |
| [Empress Heavy](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_empress_heavy.html) | ASCII rocket launch — countdown, fireworks (GOOD LUCK EMPRESS HEAVY), zoom into space, star-shine vanish |
| [The Courtroom (Live)](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_courtroom_live.html) | Run your own STOOPID vs STUPID trials — streaming ballots, gavel sounds, verdict stamp with the margin |
| [KWTF 88.8 — The Dial](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_kwtf_dial.html) | The internet as an FM band — tune through the crazies, the hustle, the angels, the 2AM channel |
| [The Credits Machine](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_credits_roll.html) | Roll your own fake-serious end credits — paste names, SPACE, record the clip |
| [The Video Machine](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_video_machine.html) | Music video maker for your phone — load an mp3, pick a music-reactive scene (geometric or lofi), toggle waveform layers, press REC, save the video |

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

## What does NOT go here

This repo is **public** — anyone can read every file in it, including old versions.

- No `.env` / API keys
- No `stoopid_vault.db`, transcripts, or episode files
- No unreleased Season 2 material (no S2 war room, no analyzer — the analyzer needs the local vault server anyway)

*Signal Received.*
