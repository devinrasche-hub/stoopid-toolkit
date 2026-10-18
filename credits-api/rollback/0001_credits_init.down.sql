-- Rollback for 0001_credits_init.sql. DESTROYS all credits data — export first:
--   curl -H "Authorization: Bearer $ADMIN_TOKEN" https://stoopid-credits.stoopidshow.workers.dev/admin/export > credits-backup.json
-- Then: npx wrangler d1 execute stoopid_credits --remote --file rollback/0001_credits_init.down.sql
--       npx wrangler d1 execute stoopid_credits --remote --command "DELETE FROM d1_migrations WHERE name='0001_credits_init.sql'"
-- Touches nothing outside the credits database (Beans, the arcade and Ask Dev live elsewhere).
DROP TABLE IF EXISTS rate_limits;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS integrations;
DROP TABLE IF EXISTS import_jobs;
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS jokes;
DROP TABLE IF EXISTS hall_of_fame;
DROP TABLE IF EXISTS community_spotlights;
DROP TABLE IF EXISTS beans_name_rules;
DROP TABLE IF EXISTS beans_feed_history;
DROP TABLE IF EXISTS leaderboard_snapshot_entries;
DROP TABLE IF EXISTS leaderboard_snapshots;
DROP TABLE IF EXISTS episode_appearances;
DROP TABLE IF EXISTS credit_versions;
DROP TABLE IF EXISTS contributions;
DROP TABLE IF EXISTS episodes;
DROP TABLE IF EXISTS category_memberships;
DROP TABLE IF EXISTS credit_categories;
DROP TABLE IF EXISTS recognition_consents;
DROP TABLE IF EXISTS external_accounts;
DROP TABLE IF EXISTS contributors;
