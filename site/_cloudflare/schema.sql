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

-- Requests to rent an arcade billboard (/api/billboard). No UNIQUE: one person may ask
-- for several slots, or ask again later.
CREATE TABLE IF NOT EXISTS billboard_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL,             -- ISO 8601, UTC
  slot        TEXT NOT NULL,             -- L1..L3, R1..R3, or "any"
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,             -- lower-cased
  promote     TEXT NOT NULL,             -- what they want to advertise
  link        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_billboard_created ON billboard_requests(created_at DESC);
