-- 0002: resumable Beans history import + optional YouTube subscription verification.
-- Rollback: rollback/0002_backfill_and_youtube.down.sql

-- Which beans-feed commits have already been imported, so imports can run in small batches.
CREATE TABLE beans_backfill_seen (
  sha         TEXT PRIMARY KEY,
  asof        TEXT,
  imported_at TEXT NOT NULL
);

-- Result of the optional "Verify with YouTube" check on a join request. No Google tokens or
-- channel identifiers are stored: only whether the check found a subscription, and when.
ALTER TABLE submissions ADD COLUMN yt_status TEXT CHECK (yt_status IN ('subscribed','not_subscribed'));
ALTER TABLE submissions ADD COLUMN yt_checked_at TEXT;

INSERT INTO integrations (provider, mode, status, detail) VALUES
  ('beans_history', 'automatic', 'unchecked', 'Imports past versions of the Beans feed from its public git history, nightly, in small batches.');
