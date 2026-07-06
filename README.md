# STOOPID TOOLKIT

Public brand tools for **THE STOOPID SHOW** (@stoopidshow) — hosted free on GitHub Pages.

**Live site:** https://devinrasche-hub.github.io/stoopid-toolkit/

| Tool | What it does |
|---|---|
| [Verdict Card Generator](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_verdict_cards.html) | STOOPID vs STUPID — type the behavior on trial, pick the verdict, download a share-ready card |
| [Flip Finder](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_flip_finder.html) | Paste a script, find the flip candidates (Hook → Escalation → Flip → Release) |
| [Stoopid Defense](https://devinrasche-hub.github.io/stoopid-toolkit/stoopid_defense.html) | Neon laser tower defense — defend the signal from waves of slop; every collapse gets a verdict |

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
