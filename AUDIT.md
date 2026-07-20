# PRODUCTION READINESS AUDIT — July 2026

Every tool page was loaded in headless Chromium (desktop 1440×900 **and** iPhone 13 touch emulation), then audited at source level. Every finding was independently re-verified by an adversarial pass before it was allowed to become a fix; every fix was re-verified at runtime; the whole diff then went through a three-lens adversarial review (correctness, end-to-end behavior, completeness). Numbers: **63 findings raised → 39 survived verification → all 39 fixed** (plus 10 issues the final review caught in the fixes themselves).

## What was broken and is now fixed

### High severity
- **Snake** — the global WASD key handler swallowed keystrokes inside the initials field: initials containing W, A, S, or D were impossible to type.
- **Flip Finder** — flip detection only matched straight apostrophes, so pasting a normal transcript with curly quotes (every phone, Google Docs, Word) silently found nothing. Input is now normalized.
- **The Courtroom (Live)** — the page had zero click/touch handlers: completely inert on phones. Tap-to-advance plus a touch button bar added; keyboard flow unchanged.
- **KWTF Dial** — drag-to-tune was mouse-only and every other control keyboard-only; dead on mobile. Now pointer-event driven with touch support, and power-on is a real focusable button.
- **Signal Acknowledged** — with more than ~22 handles, some subscribers were *never drawn* during the roll. Layout now fits all handles (up to 3 columns, scaled).

### Medium severity (selection)
- **Clash** — ending a raid with zero troops deployed cost −10 trophies; reloading mid-raid destroyed deployed troops with no result; backgrounded tabs lost resource production; the NEXT-match fee was bypassable (twice — the second bypass was caught by the review pass).
- **Trail** — the thief event could drive ammunition negative; travel legs couldn't be interrupted on touch devices.
- **Empress Heavy** — relaunch from orbit was unreachable (button never re-enabled); reset during countdown left two launch coroutines interleaved (fixed with a generation token).
- **Press Me Cube** — the fly-apart finale never ran (inline transforms overrode the `.open` CSS).
- **Verdict Cards / Invoices** — generated PNGs had text overlap in 16:9 / wide-unit cases.
- **Courtroom** — opening the custom-case overlay during voting and cancelling froze the case permanently.
- **Missing `<meta viewport>`** on Verdict Cards, Flip Finder, Courtroom, KWTF Dial, Credits Roll — those pages rendered at 980px desktop width on phones.

### Low severity
- Accessibility baseline across all tools: labels associated with inputs, live regions for status/verdict updates, canvases named, decorative ASCII hidden from screen readers, cube tiles announce coordinates.
- Social sharing: og/twitter meta (+ generated `assets/*_og.png` cards) on the share-focused tools; landing page got meta description + OG tags.
- Favicon (`favicon.svg`) linked from every page; branded `404.html`; landing-page contrast raised to WCAG AA.

### Registry (Cloudflare Worker)
- Rate-limit check-then-insert race replaced with a single atomic conditional INSERT (covered by SQL tests against the real schema).
- IP-hash salt moved to a Worker secret (`wrangler secret put IP_SALT`) — see `registry/README.md` for deployment; the old hardcoded salt remains only as a fallback until the secret is provisioned.
- The game's three registry fetches now carry 6-second timeouts, so the submit button can't hang forever when the Worker is unreachable.
- Validation logic extracted to `registry/src/validate.js` (unit-tested, byte-for-byte same behavior).

## Deliberately NOT changed
- The one-file-per-tool architecture and duplicated CSS across files — self-contained is the point.
- All show copy and brand voice.
- Registry plausibility gates (wave ≤ 99, score caps) — verified as intentional and consistent with the game's actual scoring.
- No score-table pruning — `/top` is index-bounded; growth is not a real problem at this scale.

## Verified-but-rejected findings
24 raised findings were refuted by the adversarial pass (e.g. "scores table grows without bound" — true but harmless; "/top cache staleness" — no cache in the real path honors it). They are intentionally unfixed.

## Test suite + CI (new)
- `npm test` — Playwright: every root page loads with zero console/page errors and zero failed requests (registry domain allowlisted) on desktop **and** mobile projects; mobile pages must not overflow horizontally; every relative link in `index.html`/`README.md` must resolve. 36 tests.
- `npm run test:registry` — `node:test`: validation gates with exact boundaries + the atomic rate-limit SQL run against `schema.sql` via `node:sqlite`. 17 tests.
- `.github/workflows/ci.yml` — runs both suites on every push and PR (Node 22).
- `.github/workflows/deploy-pages.yml` — now strips `registry/` from the Pages artifact.

## Only verifiable on a real phone
- Audio autoplay policies (KWTF dial static/music, gavel, trail loop) — iOS requires a user gesture; the start gates should satisfy it, but confirm by ear.
- Touch *feel* (drag-to-tune friction, snake button sizing under a thumb).
- MediaRecorder capture on iOS Safari (Signal Acknowledged now falls back to mp4 and fails gracefully, but actual capture quality needs a device check).
