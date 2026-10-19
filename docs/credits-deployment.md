# THE CREDITS DEPARTMENT — deployment

*Form CD-005: "Turning It On."*

## What deploys where

| Piece | Host | How |
|---|---|---|
| Public pages + admin page (`credits/`) | GitHub Pages (existing) | Automatic on merge to `main` (`deploy-pages.yml`). |
| API (`credits-api/`) | Cloudflare Worker `stoopid-credits` + D1 `stoopid_credits` | `.github/workflows/deploy-credits-api.yml` on merge to `main` (or run it by hand). It runs the tests first. |
| Video export (`credits-render/`) | Your computer | `npm install` once. See `credits-video-export.md`. |
| stoopidtv.com links | Wix | Manual, see below. |

No new paid services. Workers free tier: 100k requests/day. D1 free tier: 5 GB.

## Go live (once)

1. **Repo secrets** (github.com → stoopid-toolkit → Settings → Secrets and variables → Actions → **Repository secrets**). Names must match exactly; a typo (e.g. `CLOUDFARE_…`) reaches the workflow as an empty value.
   - `CLOUDFLARE_API_TOKEN`: dash.cloudflare.com → My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers**, plus **Account · D1 · Edit**. Ask Dev's deploy uses the same secret.
   - `CLOUDFLARE_ACCOUNT_ID`: the 32-character ID in your dashboard URL (`dash.cloudflare.com/<account id>/…`), also shown under Workers & Pages. A wrong value fails with Cloudflare error 7003 ("Could not route…").
   - `CREDITS_ADMIN_TOKEN`: a long random string. On a computer: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Or use a password manager's generator (40+ characters). Keep it in your password manager; it's your admin sign-in.
   - `IP_SALT` (optional, may already exist from Ask Dev).
   - **Not needed:** a GitHub personal access token. Nothing here uses one.
2. **Merge** this branch into `main`. Pages redeploys and the *Deploy Credits API* workflow runs the tests, creates the database, applies the migrations (`0001`, `0002`), deploys, sets secrets and smoke-tests:
   - `GET /public/health` → 200
   - `GET /admin/overview` without a token → 401 (or 503 if the token secret is missing)
3. **Sign in** at `https://devinrasche-hub.github.io/stoopid-toolkit/credits/admin/`.
4. Beans history fills itself in: the nightly job imports the feed's git history in batches (**Arcade → IMPORT FEED GIT HISTORY** does it right away if you're impatient).
5. *(Optional)* switch on “Verify with YouTube”: `credits-integrations.md` → *Switching on Verify with YouTube*.
6. **Add people** (Contributors / Creators / Import), then make your first episode in **Produce**.

## Putting it on stoopidtv.com (Wix, manual)

stoopidtv.com is a Wix site, and Wix can't be changed from this repository. Two options in the Wix editor:

- **Link:** add a menu item *HALL OF STOOPID* pointing to `https://devinrasche-hub.github.io/stoopid-toolkit/credits/`. Simplest and fully functional.
- **Embed:** add a page with URL slug `credits`, then *Add → Embed Code → Embed a site* with the URL above, full width, about 3200 px tall. Repeat for `credits/join/` at slug `credits-join` if you like. The pages already allow `https://www.stoopidtv.com` as an origin.

Suggested Wix pages: `/credits` → `credits/` · `/credits/join` → `credits/join/` · `/credits/episodes` → `credits/episodes/`. The admin should **not** be embedded; open it directly.

## Local development

```
cd credits-api
npm install
printf 'ALLOWED_ORIGINS="http://localhost:8080"\nADMIN_TOKEN="local-dev-token-local-dev-token-0123456789"\nALLOW_SAMPLE="1"\n' > .dev.vars
npm run db:local                 # apply migrations to a local D1
npm run seed:local               # SAMPLE people (local only; hidden in production even if run there)
npx wrangler dev --port 8787     # API on :8787
python3 -m http.server 8080 --directory ..   # pages at http://localhost:8080/credits/ (auto-target the local API)
```

## Tests

```
cd credits-api && npm test       # 56 API + engine tests (real migrations on node:sqlite)
cd credits-render && npm test    # 14 browser tests (Chromium + FFmpeg): pages, admin, parity, legibility, YouTube flow, a real MP4 render, arcade regression
```

Both run in CI (`.github/workflows/credits-tests.yml`) on every PR touching the credits or the games.

## Database changes

- Migrations: `credits-api/migrations/NNNN_name.sql`, applied in order by `wrangler d1 migrations apply` (the deploy workflow). Add new files; never edit an applied one.
- Rollbacks, newest first: `credits-api/rollback/0002_backfill_and_youtube.down.sql`, then `0001_credits_init.down.sql` (drops only credits tables; take **Settings → FULL BACKUP** first). Both were run against a local D1.
- Backups: **Settings → FULL BACKUP (JSON)** (do this before risky changes), or Cloudflare D1 Time Travel point-in-time restore (retention depends on your Cloudflare plan): `npx wrangler d1 time-travel restore stoopid_credits --timestamp …`.

## Turning it off

Set **Settings → Accept recognition requests** off to close the join form, or **Public archive visible** off to hide the archive. To remove the Worker entirely: Cloudflare dashboard → Workers → `stoopid-credits` → Delete. The static pages then show their "office closed" notices, and Bean Legends keeps working from the raw feed.
