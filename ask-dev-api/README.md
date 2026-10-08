# Ask Dev — backend

The private inbox behind [`ask-dev/`](../ask-dev/) (public page: `https://devinrasche-hub.github.io/stoopid-toolkit/ask-dev/`).

- **Cloudflare Worker** `ask-dev` → `https://ask-dev.stoopidshow.workers.dev`
- **D1 database** `ask_dev_requests`, table `requests` (see `schema.sql`)
- One endpoint: `POST /request`. It only writes. **Nothing in this Worker reads requests back out**, so there is no public list and no admin page to protect.
- Only pages on `https://devinrasche-hub.github.io` may submit (`ALLOWED_ORIGINS` in `wrangler.toml`).
- Server-side checks mirror the page: required fields, length limits, email-or-phone contact, contact type matches the preferred method.
- Spam: hidden honeypot field, minimum 3 s on the form, 6 requests per IP per hour (IP stored only as a salted hash).
- Duplicates: each filled-in form carries a `client_key`; a retry or double tap returns the same request ID.
- Notifications run **after** the row is saved. Their result lands in `notify_status`; a failure never removes the request.
- Requests whose name starts with `[TEST]` / `TEST` are saved with `is_test = 1` (and alerts say `[TEST]`).

## Go live (all doable from a phone browser)

1. **Cloudflare API token** — dash.cloudflare.com → My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers** → add permission **Account · D1 · Edit** → Create. Copy it.
2. **Account ID** — dash.cloudflare.com → Workers & Pages → the Account ID on the right (or in the URL after `dash.cloudflare.com/`).
3. **GitHub repo secrets** — github.com/devinrasche-hub/stoopid-toolkit → Settings → Secrets and variables → Actions → New repository secret:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - Notifications (pick one or both):
     - **Phone push (easiest):** install the free **ntfy** app, subscribe to a long random topic name (treat it like a password), and add it as `NTFY_TOPIC`. Pushes contain only the category, timeline and request ID — no names or contact details.
     - **Email with full details:** sign up at resend.com with the email you want alerts at, create an API key, and add `RESEND_API_KEY` and `NOTIFY_EMAIL` (that same address). Without your own verified domain, Resend's test sender can only email the account owner's address — which is what you want here. Optional `NOTIFY_FROM` once you verify a domain.
4. **Deploy** — Actions tab → **Deploy Ask Dev backend** → Run workflow. It creates the database if needed, applies the schema, deploys, sets the notification secrets and smoke-tests the endpoint. Re-run it any time you change a secret.
5. **Test** — open the page, submit with the name `[TEST] Dev`, check you got the alert, and look for the row (below).

## Reading requests

Cloudflare dashboard (works on a phone) → **Storage & databases → D1 → ask_dev_requests → Console**:

```sql
SELECT id, created_at, category, name, contact, contact_pref, timeline, budget, location, details
FROM requests WHERE is_test = 0 ORDER BY created_at DESC LIMIT 50;
```

Mark one handled: `UPDATE requests SET status = 'replied' WHERE id = 'AD-20261008-XXXXX';`
Clear test rows: `DELETE FROM requests WHERE is_test = 1;`
Check alerts: `SELECT id, notify_status FROM requests ORDER BY created_at DESC LIMIT 20;`

From a computer: `npx wrangler d1 execute ask_dev_requests --remote --command "SELECT * FROM requests ORDER BY created_at DESC"`.

## Local development

```
npm install
printf 'ALLOWED_ORIGINS="http://localhost:8080"\n' > .dev.vars
npx wrangler d1 execute ask_dev_requests --local --file schema.sql
npx wrangler dev --port 8787            # API
python3 -m http.server 8080 --directory ..   # page at http://localhost:8080/ask-dev/ (auto-targets the local API)
```
