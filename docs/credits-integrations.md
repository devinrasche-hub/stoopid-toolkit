# THE CREDITS DEPARTMENT — integrations

*Form CD-004: "What Talks To What, And What Is Just Devin."*

| Source | Mode | Status | Details |
|---|---|---|---|
| **Beans leaderboard** (`STOOPIDshow/beans-feed`) | **Automatic, read-only** | Working | The Worker reads `beans-leaderboard.json` (5-minute cache), validates every row, applies display moderation, freezes snapshots per episode, and saves a daily copy (cron 06:17 UTC). |
| **Beans history** (the feed's git history) | **Automatic** | Working (mocked GitHub in tests; see below) | Every night the cron imports past versions of the feed from GitHub's public API in batches of ~30, remembering which commits are done (`beans_backfill_seen`), until the whole history is on file. **Arcade → IMPORT FEED GIT HISTORY** does the same on demand. Unauthenticated GitHub API: 60 requests/hour, which this stays far below. |
| **𝕏 paid subscribers** | **Manual** (entry + CSV import) | Working | No official 𝕏 API endpoint lists a creator's paid subscribers (checked 2026-10-18 against the X API docs and changelog). No scraping. |
| **𝕏 creators you subscribe to** | **Manual curation** | Working | No official endpoint exposes the subscriptions an account pays for. |
| **YouTube subscribers** | **Voluntary self-report** at `/credits/join/` | Working | Labelled *self-reported*. Channel subscriber lists are not available via the YouTube Data API in a usable form (`mySubscribers` returns only public subscriptions, capped). |
| **YouTube subscription check** (“Verify with YouTube”) | **Optional, off until configured** | Built and tested against mocked Google | After filing a join request, a viewer may sign in with Google once. The Worker calls `subscriptions.list?part=id&mine=true&forChannelId=UC9vFe9XBT7lrvJ-uU4zjqtw` (youtube.com/@STOOPIDshow) with *their* token, revokes the token, and stores only `subscribed` / `not_subscribed` and the time. Approval then defaults to *verified*. Needs your Google OAuth client (below). |

Integration health (last check, last success, last error) is in **Overview → Integration health** and **Settings → Integrations**. Failures are recorded, never silent, and never publish partial data.

## Switching on “Verify with YouTube”

The code is done; Google needs to know about the app. About 20 minutes in a browser:

1. **console.cloud.google.com** → create a project (e.g. *STOOPID Credits*).
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **Google Auth Platform** (OAuth consent screen) → *External* → app name *STOOPID Credits*, your support email, privacy policy `https://devinrasche-hub.github.io/stoopid-toolkit/credits/privacy/`. **Data access** → add the scope `…/auth/youtube.readonly`.
4. **Clients → Create client → Web application** → *Authorized redirect URI*: `https://stoopid-credits.stoopidshow.workers.dev/public/youtube/callback`.
5. Copy the client ID and secret into GitHub repo secrets **`CREDITS_GOOGLE_CLIENT_ID`** and **`CREDITS_GOOGLE_CLIENT_SECRET`**, then run **Actions → Deploy Credits API**. The join page shows the button automatically once both are set.

**Who can use it:** while the app is in Google's *Testing* status, only the Google accounts you list under *Audience → Test users* (up to 100) can sign in, and they see an "unverified app" warning. `youtube.readonly` is a *sensitive* scope, so opening it to everyone means submitting the app for Google's verification. Google asks for a homepage and privacy policy on a domain you've verified ownership of, and `stoopidshow.workers.dev` / `github.io` may not qualify. In practice that may mean serving the API from a domain you own (e.g. `credits.stoopidtv.com`) before submitting. Until then, unverified requests simply stay *self-reported*, which is fine.

## How the Beans adapter fails safely

- Feed unreachable, not JSON, or any row with a bad handle, negative Beans or bad position → the whole feed is rejected (`integrations.beans_feed.status = error`, with the reason).
- The Hall shows the leaderboard from the raw feed directly if the API is down, and an "unreachable" notice if both are.
- Previews leave THE BEAN COUNTERS out with a warning; **finalising refuses** (HTTP 502) rather than publishing credits without a real snapshot.
- Weekly/monthly views say "not enough history" until real daily copies exist.

## Adding a real integration later

Provider-specific code is isolated: Beans in `credits-api/src/beans.js`; imports in `admin.js → importCsv`; join intake in `public.js → join`. To add, for example, an official subscriber sync:

1. Add a module `credits-api/src/<provider>.js` exposing `sync(env) → [{ display_name, handle, status, verification: 'verified' }]`.
2. Feed its rows through the same path as CSV import (match by `external_accounts (provider, handle)`, upsert membership, never change consent).
3. Store tokens as Worker secrets (`npx wrangler secret put …`), never in `wrangler.toml` or the browser.
4. Call it from `scheduled()` in `src/index.js` and record health with `setIntegration(env, '<provider>', ok, detail)`.
5. Set the row in `integrations` to `mode='automatic'`.

## Secrets

| Secret | Where | Purpose |
|---|---|---|
| `ADMIN_TOKEN` | Worker secret (from repo secret `CREDITS_ADMIN_TOKEN`) | Admin sign-in. 32+ random characters. Rotate by changing the repo secret and re-running the deploy workflow. |
| `IP_SALT` | Worker secret (repo secret `IP_SALT`, shared with Ask Dev) | Salts the hashed IPs used for rate limiting (kept ~48 h). Raw IPs are never stored. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Worker secrets (repo secrets `CREDITS_GOOGLE_CLIENT_ID` / `_SECRET`) | Optional: “Verify with YouTube”. Also signs the short-lived OAuth state. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub repo secrets | Deploying. Already used by Ask Dev. |

Nothing secret is in the repository or the browser bundle (a browser test scans `credits/` for token patterns).
