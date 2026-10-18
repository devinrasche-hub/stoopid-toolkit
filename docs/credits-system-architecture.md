# THE CREDITS DEPARTMENT — system architecture

*Official Department of Unnecessary Appreciation. Form CD-001: "What Is Actually Here."*

This document records what the investigation found before anything was built, the decisions that follow from it, and how the pieces fit together. Read it before changing the credits system.

---

## 1. Findings: what exists today (investigated 2026-10-18)

| Question | Finding |
|---|---|
| **stoopidtv.com** | A **Wix** site (response headers `server: Pepyaka`, `x-wix-*`, Wix Velo code bundles). Pages include `/arcade`, `/beans`, `/episodes`, `/earn`, `/donate`. Its Velo source, CMS collections and member system are **not in any repository this project can reach**, and Wix cannot be edited from here. |
| **This repo (`stoopid-toolkit`)** | Static GitHub Pages site (`.github/workflows/deploy-pages.yml` uploads the repo root). Every tool is a self-contained `stoopid_*.html`. No framework, no bundler, no CDN at runtime. Vanilla JS + `<canvas>`. |
| **Backend infrastructure** | Two **Cloudflare Worker + D1** services already live here: `ask-dev-api/` (write-only inbox, deployed by `.github/workflows/deploy-ask-dev.yml` with `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` repo secrets) and `registry/` (global hi-scores for STOOPID DEFENSE, `stoopid-signal-registry.stoopidshow.workers.dev`). Workers live on the `stoopidshow.workers.dev` subdomain. |
| **Authentication** | **None exists.** The toolkit is deliberately account-free. Ask Dev avoids needing auth by never reading data back out. Wix has a member system, but it is unreachable from code here. |
| **Admin interfaces** | None. Ask Dev requests are read in the Cloudflare D1 console. |
| **Arcade** | Games are single HTML files (`stoopid_snake.html`, `stoopid_defense.html`, `stoopid_clash.html`, `stoopid_trail.html`, `stoopid_mine.html`, …). Snake keeps a local top-10 in `localStorage`; Defense posts 3-letter scores to the `registry` Worker. These are **game hi-scores, not Beans.** |
| **Beans** | Beans are tallied **off-repo** by a nightly process (the local `STOOPID_VAULT`) and published as `beans-leaderboard.json` to the public repo **`STOOPIDshow/beans-feed`**, which feeds `stoopidtv.com/beans`. Feed fields per player: `h` (𝕏 handle), `life` (lifetime Beans), `bal` (balance), `rank`, `title`, `streak`, `fire`, `best`, `pos` (position). Header: `v`, `updated`, `asof`, `players`, `beans`. The feed began 2026-10-11; its git history (7 commits) is the only historical record. |
| **User/account model** | Beans players are identified by 𝕏 handle. There is no other account model. |
| **Styling system** | "SIGNAL palette v2 — locked" in `index.html`: `--teal #00FFC6`, `--purple #8A2BE2`, `--red #FF2D2D`, `--orange #CC5500`, `--pink #FF40CD`, `--blue #4aa8ff`, lines `#262626`, dims `#666/#444`. Black background, `'Courier New', monospace`, CRT scanline overlay, glitch wordmark, corner-bracket cards. |
| **Rendering/media** | Canvas 2D, Three.js (bundled into cinematics), Web Audio, `MediaRecorder` WebM capture (Credits Machine, Signal Acknowledged, cinematics). The cinematics playbook's render-and-look loop (`cinematic/PLAYBOOK.md`) renders frames headlessly and inspects them. |
| **Existing credits tools** | `stoopid_credits_roll.html` (THE CREDITS MACHINE, paste names → roll) and `stoopid_signal_ack.html` (subscriber shout-out). Both are paste-in toys with no data model; they stay as they are. |
| **Jobs/integrations** | GitHub Actions (Pages deploy, Ask Dev deploy). Cloudflare Cron Triggers are available on Workers. No scheduled jobs exist yet. |
| **𝕏 API** | Pay-per-use API. **No documented endpoint lists a creator's paid subscribers or the creators an account pays for.** → manual entry + CSV import. |
| **YouTube Data API** | Channel subscriber lists are not generally available (`mySubscribers` returns only public subscriptions, capped). A *viewer* can prove their own subscription via OAuth (`subscriptions.list?mine=true&forChannelId=…`, sensitive scope `youtube.readonly`, requires a verified Google OAuth app). → voluntary self-reported enrollment now, OAuth verification as a documented adapter slot. |

## 2. Decisions that follow

1. **Backend = a third Cloudflare Worker + D1 (`credits-api/`)**, cloned from the Ask Dev pattern: same deploy workflow shape, same secrets, same `stoopidshow.workers.dev` subdomain, same IP-hash rate limiting. No new paid infrastructure (Workers free tier + D1 free tier cover this).
2. **Frontend = static pages under `credits/` on GitHub Pages**, vanilla JS ES modules, no CDN, SIGNAL palette. stoopidtv.com links to or embeds them (Wix can't be changed from here; see `credits-deployment.md`).
3. **Beans: read-only adapter over the existing feed.** The credits system never computes, awards or edits Beans. It reads `beans-leaderboard.json`, applies display moderation, and freezes snapshots. One Beans economy.
4. **Auth: a single admin bearer token** (`ADMIN_TOKEN` Worker secret, ≥32 random chars), checked server-side on every `/admin/*` call with a constant-time hash comparison and failed-attempt rate limiting. There was no auth to reuse; this is the smallest thing that is actually secure for a one-producer show. The admin page is public HTML but holds no data or secrets; everything is gated by the Worker.
5. **One renderer for preview and export.** `credits/engine/` is pure ES modules shared by the browser preview, the in-browser exporters, the Worker (selection rules), and the headless render command. Preview and export draw the same frames from the same stored sequence JSON.
6. **Video encoding happens locally**, not on the server (Workers can't run FFmpeg). `credits-render/` is a Node command that drives headless Chromium through the same engine and pipes frames into FFmpeg.

## 3. Component map

```
            ┌──────────────────────────── GitHub Pages (static) ───────────────────────────┐
            │ credits/              HALL OF STOOPID (public)                                │
 viewers ──▶│ credits/join/         opt-in + withdraw form                                  │
            │ credits/episodes/     archive (+ ?ep=N detail)                                │
            │ credits/creators/     creator directory                                       │
            │ credits/hall-of-fame/                                                         │
            │ credits/admin/        CREDITS DEPARTMENT (producer; token-gated by the API)   │
            │ credits/engine/       selection · sequence · themes · audio · export (shared) │
            └───────────────┬───────────────────────────────────────────────────────────────┘
                            │ fetch (CORS: allowed origins only)
            ┌───────────────▼─────────────── Cloudflare ───────────────────────────────────┐
            │ credits-api/ Worker  stoopid-credits.stoopidshow.workers.dev                 │
            │   /public/*  approved + consented data only                                  │
            │   /admin/*   Bearer ADMIN_TOKEN                                               │
            │   cron 06:17 UTC  record Beans feed history, integration health               │
            │ D1 stoopid_credits  (migrations/0001_credits_init.sql)                        │
            └───────────────┬───────────────────────────────────────────────────────────────┘
                            │ GET raw.githubusercontent.com (read-only)
                  STOOPIDshow/beans-feed/beans-leaderboard.json  ◀── nightly tally (STOOPID_VAULT)

 producer's PC:  credits-render/  node render.mjs  →  headless Chromium (same engine) → FFmpeg → MP4 / PNG / MOV
```

## 4. Data model (D1 / SQLite)

All tables are in `credits-api/migrations/0001_credits_init.sql`; rollback is `credits-api/rollback/0001_credits_init.down.sql`.

| Table | Purpose |
|---|---|
| `contributors` | **One identity per person.** Display name, slug, `visibility` (`public` / `anonymous` / `private`), `consent_public`, `consent_link`, public link (+ `link_approved`), bio, avatar URL (only if licensed), `merged_into`, `is_sample`. |
| `external_accounts` | Handles on 𝕏 / YouTube / Beans / web, normalised, with `verification` (`verified`, `manual`, `self_reported`) and `source`. Unique per provider+handle, so the same 𝕏 handle can never become two people. Beans players link here by 𝕏 handle. |
| `credit_categories` | The six default categories (configurable names, taglines, kind, caps, segment seconds, order, enabled). |
| `category_memberships` | Contributor ↔ category, `status` (`active`/`former`), `verification`, `featured`, `sort_order`, public `label`/`reason`, private note. **Membership ≠ visibility.** |
| `contributions` | Real production work (role, description), optionally tied to one episode. Drives ACTUAL HUMAN RESOURCES and episode-specific credits. |
| `recognition_consents` | Append-only consent history (public credit, link profile, source, who recorded it). The latest row is mirrored onto `contributors`. |
| `episodes` | Number, title, publication date, status (`draft`/`final`), theme, `draft_json` (producer's working choices), current version. |
| `credit_versions` | **Immutable** finalised credits: revision, reason, full resolved sequence JSON, selection report, leaderboard snapshot id. Corrections add a revision. |
| `episode_appearances` | Who was actually credited in which version. Feeds rotation fairness ("last shown", "times shown"). |
| `leaderboard_snapshots` / `leaderboard_snapshot_entries` | Frozen Beans standings for an episode, with feed `asof`/`updated`, and `supersedes` for audited corrections. |
| `beans_feed_history` | One row per feed `asof` (collected daily by cron; backfillable from the feed's git history). The only source for weekly/monthly views. |
| `beans_name_rules` | Moderation per handle: `approved` / `excluded`, reason. |
| `community_spotlights`, `hall_of_fame` | Spotlight rotation and permanent recognition. |
| `jokes` | The STOOPID HUMOR ENGINE library. |
| `submissions` | Public opt-in requests (pending → approved/rejected/withdrawn), withdrawal key stored only as a hash. |
| `import_jobs`, `integrations`, `settings`, `audit_log`, `rate_limits` | Operations. Every admin write lands in `audit_log`. |

ContributorProfile, CreditSequence and CreditSequenceVersion from the brief are folded into `contributors` and `credit_versions` to avoid redundant tables.

## 5. Rules that protect people

- Public endpoints return a contributor only if `visibility='public'` **and** `consent_public=1` **and** not merged **and** not sample data (unless `ALLOW_SAMPLE=1`, local only). `anonymous` contributors are counted, never named.
- Links are published only if `consent_link=1` **and** `link_approved=1` **and** the URL is `https:`. Rendered with `rel="noopener noreferrer ugc"`.
- Archived versions are immutable, but **withdrawal is honoured at read time**: names of contributors who withdrew consent are redacted from every public response, past episodes included.
- Beans names pass through `beans_name_rules` and the configurable blocklist; flagged names are excluded until approved. Excluding a name never changes positions; the feed's `pos` is the truth.
- No payment data, emails or billing information is stored anywhere in this system.

## 6. Fair Recognition Engine (summary)

`credits/engine/selection.js`, run by the Worker for previews and finalisation. Full rules in `credits-admin-guide.md` §6.

1. Episode-specific contributions are always credited (fixed).
2. Leaderboard positions are factual and always shown (top N, configurable; ties flagged).
3. Rotating categories: eligible = active membership + public consent. Order = featured → never shown → least recently shown → fewest appearances → longest-standing → seeded tiebreak. Each category has a cap; the rest are **deferred** to next episode and listed in the preview.
4. A person appears at most once across rotating sections (dedupe), but always keeps fixed credits.
5. Pagination never shrinks text: pages hold a fixed number of names; if a segment can't fit them at the minimum page time, the overflow is listed as "+N MORE IN THE ARCHIVE".

## 7. Sequence & rendering

- `credits/engine/sequence.js` turns selection output + timing config into a **sequence JSON** (segments → pages → items, durations, seed, theme). The sequence is what gets stored in `credit_versions`, so preview, export and the archive are all reading one record.
- `credits/engine/themes.js` draws any time `t` of a sequence onto a 1920×1080 canvas. Every visual (typing, static, counters) is a pure function of `t` and the seed, so scrubbing and frame-by-frame export match exactly.
- `credits/engine/audio.js` renders the soundtrack with `OfflineAudioContext` from the same timeline (preview plays the same buffer).
- Exports: in-browser PNG cards (ZIP), realtime WebM/MP4 capture, `sequence.json`; locally via `credits-render/`: H.264 MP4, PNG cards (opaque + alpha), ProRes 4444 MOV with alpha, VP9 WebM with alpha. See `credits-video-export.md` for what was tested.
