# THE CREDITS DEPARTMENT — integrations

*Form CD-004: "What Talks To What, And What Is Just Devin."*

| Source | Mode | Status | Details |
|---|---|---|---|
| **Beans leaderboard** (`STOOPIDshow/beans-feed`) | **Automatic, read-only** | Working | The Worker reads `beans-leaderboard.json` (5-minute cache), validates every row, applies display moderation, freezes snapshots per episode, and saves a daily copy (cron 06:17 UTC). Past versions can be imported from the feed's public git history (**Arcade → IMPORT FEED GIT HISTORY**). It never writes to the feed or the arcade. |
| **𝕏 paid subscribers** | **Manual** (entry + CSV import) | Working | No official 𝕏 API endpoint lists a creator's paid subscribers (checked 2026-10-18 against the X API docs and changelog). No scraping. |
| **𝕏 creators you subscribe to** | **Manual curation** | Working | No official endpoint exposes the subscriptions an account pays for. |
| **YouTube subscribers** | **Voluntary self-report** at `/credits/join/` | Working | Labelled *self-reported*. Channel subscriber lists are not available via the YouTube Data API in a usable form (`mySubscribers` returns only public subscriptions, capped). |
| **YouTube OAuth verification** | Adapter slot | **Not implemented** | Possible in principle: the viewer signs in with Google and the server calls `subscriptions.list?mine=true&forChannelId=<channel>`. Needs a Google Cloud OAuth client and Google's verification for the sensitive `youtube.readonly` scope. Recorded as `integrations.youtube` with mode `manual`. |

Integration health (last check, last success, last error) is in **Overview → Integration health** and **Settings → Integrations**. Failures are recorded, never silent, and never publish partial data.

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
| `IP_SALT` | Worker secret (repo secret `IP_SALT`, shared with Ask Dev) | Salts the hashed IPs used for rate limiting. Raw IPs are never stored. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub repo secrets | Deploying. Already used by Ask Dev. |

Nothing secret is in the repository or the browser bundle (a browser test scans `credits/` for token patterns).
