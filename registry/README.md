# stoopid-signal-registry

Cloudflare Worker + D1 backing the global hi-score board in **Stoopid Defense**
(`stoopid_defense.html`). All scores are self-reported. Like engagement.

## Deploy

```
cd registry
npx wrangler d1 execute stoopid_defense_scores --file=schema.sql   # first time only
npx wrangler secret put IP_SALT                                    # REQUIRED — see below
npx wrangler deploy
```

### IP_SALT is required

Submissions are rate-limited per hashed client IP (`iph` column). The hash is
`SHA-256(IP_SALT + "::" + ip)`. If the `IP_SALT` secret is not provisioned, the
Worker falls back to a hardcoded salt that is public in this repo, which makes
stored `iph` values reversible by brute force. **Always run
`wrangler secret put IP_SALT` (any long random string) before/after deploying.**

Rotation caveat: changing `IP_SALT` changes every future `iph`, so existing
rows no longer count against the same client's rate limit for the current hour.
That is harmless — rotate freely; just don't expect old `iph` values to match.

## Test

From the repo root: `npm run test:registry` (plain `node --test`, no deps).
