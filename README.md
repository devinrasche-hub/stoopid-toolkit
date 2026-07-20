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
| [No Touchy For Free™ Invoices](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_no_touchy_invoice.html) | Emotional labor has a cover charge now. Type what you carried, stamp it PAST DUE, download the bill. Net 0 — due at the door |
| [The Press Me Cube](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_press_me_cube.html) | Six faces. Six clues. One goblin taking notes. Reality is user generated — so is this cube |
| [Stoopid Snake](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_snake.html) | Eat the beans. The walls are not free. Every death gets a verdict, a ruling, and a downloadable run report |
| [Stoopid Clash](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_clash.html) | Build the base. Wait the wait. Raid the void. Skipping a timer is free — it just costs an invoice. The walls are not free |
| [The Stoopid Trail](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_trail.html) | The classic trail, one correction: the promised land is the World Famous Davenport, IA. Depart from any city in America. Dysentery included |
| [Signal Acknowledged](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_signal_ack.html) | Subscriber shout-out generator. Paste your handles, watch the hot-pink name rain resolve into the roll, record the clip |

Everything runs as a single HTML file. No accounts, no tracking, no API keys — safe to publish. Two footnotes: The Stoopid Trail ships with one companion asset (`kwtf_trail_loop.mp3`, in this repo), and Stoopid Defense optionally talks to the `stoopid-signal-registry` Cloudflare Worker (source and deployment notes — including the required `IP_SALT` secret — in [registry/](registry/README.md)); it degrades gracefully and stays fully playable when the Worker is unreachable.

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
