-- stoopidtv.com sign-ups: the footer newsletter box and the Earn early-access form.
-- Write-only from the site. Nothing here is ever served back out.
CREATE TABLE IF NOT EXISTS signups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL,             -- ISO 8601, UTC
  list        TEXT NOT NULL,             -- newsletter | earn
  email       TEXT NOT NULL,             -- lower-cased
  first_name  TEXT NOT NULL DEFAULT '',
  hangout     TEXT NOT NULL DEFAULT '',  -- Earn: "Where do you mainly hang out?"
  UNIQUE (list, email)
);
CREATE INDEX IF NOT EXISTS idx_signups_created ON signups(created_at DESC);
