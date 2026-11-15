-- Rollback for 0002_backfill_and_youtube.sql. Run 0002's rollback before 0001's.
--   npx wrangler d1 execute stoopid_credits --remote --file rollback/0002_backfill_and_youtube.down.sql
--   npx wrangler d1 execute stoopid_credits --remote --command "DELETE FROM d1_migrations WHERE name='0002_backfill_and_youtube.sql'"
-- Loses only: the list of imported feed commits (re-import is harmless) and YouTube check results.
DELETE FROM integrations WHERE provider = 'beans_history';
ALTER TABLE submissions DROP COLUMN yt_checked_at;
ALTER TABLE submissions DROP COLUMN yt_status;
DROP TABLE IF EXISTS beans_backfill_seen;
