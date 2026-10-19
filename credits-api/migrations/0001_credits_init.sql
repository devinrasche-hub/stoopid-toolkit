-- THE CREDITS DEPARTMENT — initial schema.
-- Apply:    npx wrangler d1 migrations apply stoopid_credits --remote
-- Rollback: rollback/0001_credits_init.down.sql (drops only the tables created here).
-- Times are ISO-8601 UTC strings. Booleans are 0/1.

-- ── identity ────────────────────────────────────────────────────────────────
CREATE TABLE contributors (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name   TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  visibility     TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','anonymous','private')),
  consent_public INTEGER NOT NULL DEFAULT 0,
  consent_link   INTEGER NOT NULL DEFAULT 0,
  link_url       TEXT,
  link_approved  INTEGER NOT NULL DEFAULT 0,
  bio            TEXT,
  avatar_url     TEXT,
  private_note   TEXT,
  merged_into    INTEGER REFERENCES contributors(id),
  is_sample      INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX idx_contributors_name ON contributors(display_name);

CREATE TABLE external_accounts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  contributor_id INTEGER NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL CHECK (provider IN ('x','youtube','web','other')),
  handle         TEXT NOT NULL,          -- normalised: lowercase, no @
  url            TEXT,
  verification   TEXT NOT NULL DEFAULT 'manual' CHECK (verification IN ('verified','manual','self_reported')),
  source         TEXT NOT NULL DEFAULT 'admin',
  created_at     TEXT NOT NULL,
  UNIQUE (provider, handle)
);
CREATE INDEX idx_accounts_contributor ON external_accounts(contributor_id);

CREATE TABLE recognition_consents (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  contributor_id INTEGER NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  consent_public INTEGER NOT NULL,
  consent_link   INTEGER NOT NULL,
  visibility     TEXT NOT NULL,
  source         TEXT NOT NULL,          -- admin | join_form | withdrawal | import
  note           TEXT,
  recorded_by    TEXT NOT NULL,
  recorded_at    TEXT NOT NULL
);
CREATE INDEX idx_consents_contributor ON recognition_consents(contributor_id, id);

-- ── categories ──────────────────────────────────────────────────────────────
CREATE TABLE credit_categories (
  key             TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  tagline         TEXT NOT NULL DEFAULT '',
  kind            TEXT NOT NULL CHECK (kind IN ('rotating','creators','leaderboard','episode','curated')),
  enabled         INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  cap             INTEGER NOT NULL DEFAULT 12,
  segment_seconds REAL NOT NULL DEFAULT 8,
  public_section  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE category_memberships (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  contributor_id INTEGER NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  category_key   TEXT NOT NULL REFERENCES credit_categories(key),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','former')),
  verification   TEXT NOT NULL DEFAULT 'manual' CHECK (verification IN ('verified','manual','self_reported')),
  featured       INTEGER NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  label          TEXT,                   -- e.g. creator's kind of work
  reason         TEXT,                   -- public: why Devin supports them
  private_note   TEXT,
  since          TEXT,
  until          TEXT,
  source         TEXT NOT NULL DEFAULT 'admin',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  UNIQUE (contributor_id, category_key)
);
CREATE INDEX idx_memberships_category ON category_memberships(category_key, status);

CREATE TABLE contributions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  contributor_id INTEGER NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  category_key   TEXT NOT NULL DEFAULT 'human_resources' REFERENCES credit_categories(key),
  episode_id     INTEGER REFERENCES episodes(id) ON DELETE SET NULL,
  role           TEXT NOT NULL,
  description    TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_contributions_episode ON contributions(episode_id);

-- ── episodes & immutable credit versions ────────────────────────────────────
CREATE TABLE episodes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  number          INTEGER NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  season          INTEGER NOT NULL DEFAULT 1,
  published_on    TEXT,
  episode_url     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final')),
  theme           TEXT NOT NULL DEFAULT 'terminal',
  draft_json      TEXT NOT NULL DEFAULT '{}',
  current_version INTEGER,
  snapshot_id     INTEGER,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE credit_versions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id    INTEGER NOT NULL REFERENCES episodes(id),
  revision      INTEGER NOT NULL,
  reason        TEXT NOT NULL,
  sequence_json TEXT NOT NULL,
  report_json   TEXT NOT NULL,
  snapshot_id   INTEGER,
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  UNIQUE (episode_id, revision)
);

CREATE TABLE episode_appearances (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id     INTEGER NOT NULL REFERENCES credit_versions(id),
  episode_id     INTEGER NOT NULL REFERENCES episodes(id),
  episode_number INTEGER NOT NULL,
  contributor_id INTEGER NOT NULL,
  category_key   TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_appearances_contributor ON episode_appearances(contributor_id, episode_number);

-- ── Beans (read-only mirror of STOOPIDshow/beans-feed) ──────────────────────
CREATE TABLE leaderboard_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id    INTEGER REFERENCES episodes(id),
  period        TEXT NOT NULL DEFAULT 'all',
  feed_asof     TEXT,
  feed_updated  TEXT,
  feed_players  INTEGER,
  top_n         INTEGER NOT NULL,
  supersedes    INTEGER REFERENCES leaderboard_snapshots(id),
  reason        TEXT,
  raw_json      TEXT NOT NULL,
  taken_by      TEXT NOT NULL,
  taken_at      TEXT NOT NULL
);

CREATE TABLE leaderboard_snapshot_entries (
  snapshot_id   INTEGER NOT NULL REFERENCES leaderboard_snapshots(id),
  pos           INTEGER NOT NULL,
  handle        TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  beans         INTEGER NOT NULL,
  tied          INTEGER NOT NULL DEFAULT 0,
  excluded      INTEGER NOT NULL DEFAULT 0,
  exclusion_reason TEXT,
  featured      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (snapshot_id, handle)
);

CREATE TABLE beans_feed_history (
  asof        TEXT PRIMARY KEY,
  updated     TEXT,
  players     INTEGER,
  total_beans INTEGER,
  raw_json    TEXT NOT NULL,
  source      TEXT NOT NULL,          -- cron | backfill:<sha> | manual
  recorded_at TEXT NOT NULL
);

CREATE TABLE beans_name_rules (
  handle      TEXT PRIMARY KEY,       -- normalised, no @
  status      TEXT NOT NULL CHECK (status IN ('approved','excluded')),
  reason      TEXT,
  updated_by  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- ── recognition extras ──────────────────────────────────────────────────────
CREATE TABLE community_spotlights (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  contributor_id INTEGER NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  headline       TEXT NOT NULL,
  body           TEXT,
  starts_on      TEXT,
  ends_on        TEXT,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL
);

CREATE TABLE hall_of_fame (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  contributor_id INTEGER REFERENCES contributors(id) ON DELETE SET NULL,
  honoree        TEXT,                -- used when not tied to a contributor (e.g. a moment)
  title          TEXT NOT NULL,
  description    TEXT,
  season         INTEGER,
  achieved_on    TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  visible        INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL
);

CREATE TABLE jokes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT NOT NULL,
  themes     TEXT NOT NULL DEFAULT '*',   -- comma list of theme ids or *
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- ── community intake ────────────────────────────────────────────────────────
CREATE TABLE submissions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ref              TEXT NOT NULL UNIQUE,
  kind             TEXT NOT NULL DEFAULT 'join' CHECK (kind IN ('join','update')),
  display_name     TEXT NOT NULL,
  platform         TEXT,
  handle           TEXT,
  profile_url      TEXT,
  contribution     TEXT NOT NULL,
  consent_public   INTEGER NOT NULL,
  consent_link     INTEGER NOT NULL,
  note             TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  key_hash         TEXT NOT NULL,
  parent_ref       TEXT,
  contributor_id   INTEGER REFERENCES contributors(id) ON DELETE SET NULL,
  client_key       TEXT,
  iph              TEXT NOT NULL,
  reviewed_by      TEXT,
  reviewed_at      TEXT,
  created_at       TEXT NOT NULL
);
CREATE INDEX idx_submissions_status ON submissions(status, created_at);
CREATE UNIQUE INDEX idx_submissions_client ON submissions(client_key) WHERE client_key IS NOT NULL;

-- ── operations ──────────────────────────────────────────────────────────────
CREATE TABLE import_jobs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind         TEXT NOT NULL,
  filename     TEXT,
  category_key TEXT,
  mapping_json TEXT NOT NULL,
  rows_total   INTEGER NOT NULL DEFAULT 0,
  created      INTEGER NOT NULL DEFAULT 0,
  updated      INTEGER NOT NULL DEFAULT 0,
  skipped      INTEGER NOT NULL DEFAULT 0,
  errors_json  TEXT NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL,
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE TABLE integrations (
  provider     TEXT PRIMARY KEY,
  mode         TEXT NOT NULL,          -- automatic | manual | disabled
  status       TEXT NOT NULL,          -- ok | error | manual | unchecked
  detail       TEXT,
  last_checked TEXT,
  last_ok      TEXT,
  last_error   TEXT
);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE audit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        TEXT NOT NULL,
  actor     TEXT NOT NULL,
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id TEXT,
  detail    TEXT
);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);

CREATE TABLE rate_limits (
  bucket TEXT NOT NULL,
  iph    TEXT NOT NULL,
  hour   INTEGER NOT NULL,
  hits   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, iph, hour)
);

-- ── defaults (configuration, not people) ────────────────────────────────────
INSERT INTO credit_categories (key, name, tagline, kind, sort_order, cap, segment_seconds) VALUES
  ('financially_irresponsible', 'THE FINANCIALLY IRRESPONSIBLE', 'Paid $2 a month to watch this on purpose.', 'rotating', 10, 18, 9),
  ('mutual_enablers',           'MUTUAL ENABLERS',               'Creators this show pays to watch. Go find them.', 'creators', 20, 6, 8),
  ('bean_counters',             'THE BEAN COUNTERS',             'The STOOPIDTV arcade, top of the board.', 'leaderboard', 30, 5, 8),
  ('human_resources',           'ACTUAL HUMAN RESOURCES',        'People who did real work on this episode.', 'episode', 40, 30, 7),
  ('emotional_support',         'THE DEPARTMENT OF EMOTIONAL SUPPORT', 'Kept the lights on in the parts that matter.', 'curated', 50, 10, 6),
  ('voluntary_witnesses',       'THE VOLUNTARY WITNESSES',       'Subscribed for free. Asked to be named. Brave.', 'rotating', 60, 18, 7);

INSERT INTO jokes (text, themes, created_at) VALUES
  ('THIS EPISODE WAS MADE POSSIBLE BY QUESTIONABLE DECISION-MAKING.', '*', '2026-10-18T00:00:00Z'),
  ('NO BEANS WERE CONSULTED DURING PRODUCTION.', '*', '2026-10-18T00:00:00Z'),
  ('YOUR PARTICIPATION HAS BEEN DOCUMENTED.', 'terminal,midnight', '2026-10-18T00:00:00Z'),
  ('THIS CREDIT HAS NOT BEEN APPROVED BY MANAGEMENT.', '*', '2026-10-18T00:00:00Z'),
  ('PLEASE REMAIN STOOPID. RESPONSIBLY.', '*', '2026-10-18T00:00:00Z'),
  ('THE ALGORITHM HAS DECLINED TO COMMENT.', 'terminal,midnight', '2026-10-18T00:00:00Z'),
  ('YOU ARE NOW LEGALLY PART OF THE PROBLEM. (NOT ACTUALLY.)', '*', '2026-10-18T00:00:00Z'),
  ('THANK YOU FOR EXISTING IN OUR GENERAL VICINITY.', 'midnight,beans', '2026-10-18T00:00:00Z'),
  ('VIEWER DISCRETION WAS ATTEMPTED.', '*', '2026-10-18T00:00:00Z'),
  ('ALL BEANS SHOWN ARE REAL BEANS. NO BEANS WERE SIMULATED.', 'beans', '2026-10-18T00:00:00Z');

INSERT INTO integrations (provider, mode, status, detail) VALUES
  ('beans_feed', 'automatic', 'unchecked', 'Reads STOOPIDshow/beans-feed/beans-leaderboard.json. Read-only.'),
  ('x_supporters', 'manual', 'manual', 'No official X API endpoint lists paid subscribers. Manual entry + CSV import.'),
  ('x_creators', 'manual', 'manual', 'No official X API endpoint lists accounts you subscribe to. Manual curation.'),
  ('youtube', 'manual', 'manual', 'Voluntary self-reported enrollment via /credits/join. OAuth verification not enabled.');
