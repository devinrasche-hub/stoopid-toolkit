-- ASK DEV — private request-for-quote inbox. Nothing here is ever served back out.
CREATE TABLE IF NOT EXISTS requests (
  id            TEXT PRIMARY KEY,          -- AD-20261008-7K3QX
  created_at    TEXT NOT NULL,             -- ISO 8601, UTC
  category      TEXT NOT NULL,             -- local | business | creative | other
  details       TEXT NOT NULL,
  timeline      TEXT NOT NULL DEFAULT '',  -- asap | weeks | flexible | exploring | ''
  budget        TEXT NOT NULL DEFAULT '',
  location      TEXT NOT NULL DEFAULT '',
  name          TEXT NOT NULL,
  contact       TEXT NOT NULL,
  contact_type  TEXT NOT NULL,             -- email | phone
  contact_pref  TEXT NOT NULL DEFAULT '',  -- email | text | call | ''
  is_test       INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'new',
  notify_status TEXT NOT NULL DEFAULT 'pending',
  client_key    TEXT NOT NULL UNIQUE,      -- one per filled-in form; makes retries idempotent
  iph           TEXT NOT NULL DEFAULT '',  -- salted hash of IP, for rate limiting only
  hour          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_requests_created ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_iph ON requests(iph, hour);
