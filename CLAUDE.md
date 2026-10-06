# STOOPID TOOLKIT

Public brand tools for THE STOOPID SHOW, served by GitHub Pages from `main`.

- Every tool is one self-contained `stoopid_*.html` at the repo root. Nothing loads from a CDN at runtime. No keys, no tracking.
- New tool: add it to THE VAULT grid in `index.html` (item number, wing, `data-viz` preview), update the artifact counts there, and add a row to `README.md`.
- This repo is public. No secrets, no vault database, no unreleased Season 2 material.

## Cinematics

Browser films (Three.js + Web Audio) live in `cinematic/<slug>/` and build into a root `stoopid_<slug>.html`.

**Before building or changing any cinematic, read `cinematic/PLAYBOOK.md`.** It has the brief template, the engine reuse map, the render-and-look checking loop, and the lessons from PLEASE REMAIN SEEN. Start new films by copying `cinematic/please-remain-seen/`.
