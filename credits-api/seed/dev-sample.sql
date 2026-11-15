-- SAMPLE DATA — LOCAL DEVELOPMENT ONLY. These people do not exist.
-- Every row is marked is_sample = 1, and the public API hides sample rows unless ALLOW_SAMPLE=1
-- (set only in a local .dev.vars). Never run this file with --remote.
INSERT INTO contributors (display_name, slug, visibility, consent_public, consent_link, link_url, link_approved, bio, is_sample, created_at, updated_at) VALUES
  ('SAMPLE Ada Beanworth', 'sample-ada', 'public', 1, 1, 'https://example.com/ada', 1, NULL, 1, '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'),
  ('SAMPLE Bo Static', 'sample-bo', 'public', 1, 0, NULL, 0, NULL, 1, '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'),
  ('SAMPLE Ça Va Clément', 'sample-clement', 'public', 1, 0, NULL, 0, NULL, 1, '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'),
  ('SAMPLE 小豆 Azuki', 'sample-azuki', 'public', 1, 0, NULL, 0, NULL, 1, '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'),
  ('SAMPLE Private Pat', 'sample-pat', 'private', 0, 0, NULL, 0, NULL, 1, '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'),
  ('SAMPLE Anon One', 'sample-anon', 'anonymous', 1, 0, NULL, 0, NULL, 1, '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'),
  ('SAMPLE Creator Cass', 'sample-cass', 'public', 1, 1, 'https://example.com/cass', 1, 'Draws tiny pixel worlds where everything is slightly wrong.', 1, '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'),
  ('SAMPLE Creator Dmitri', 'sample-dmitri', 'public', 1, 0, NULL, 0, 'Writes absurdist essays about bureaucracy.', 1, '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'),
  ('SAMPLE Writer Wren', 'sample-wren', 'public', 1, 0, NULL, 0, NULL, 1, '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'),
  ('SAMPLE Kind Kofi', 'sample-kofi', 'public', 1, 0, NULL, 0, NULL, 1, '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'),
  ('SAMPLE Witness Wu 🫘', 'sample-wu', 'public', 1, 0, NULL, 0, NULL, 1, '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z');
INSERT INTO category_memberships (contributor_id, category_key, status, verification, featured, label, reason, since, source, created_at, updated_at)
SELECT id, 'financially_irresponsible', 'active', 'manual', 0, NULL, NULL, '2026-09-01', 'seed', '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z' FROM contributors WHERE slug IN ('sample-ada','sample-bo','sample-clement','sample-azuki','sample-pat','sample-anon');
INSERT INTO category_memberships (contributor_id, category_key, status, verification, featured, label, reason, since, source, created_at, updated_at) VALUES
  ((SELECT id FROM contributors WHERE slug='sample-cass'), 'mutual_enablers', 'active', 'manual', 1, 'pixel art', 'Makes the internet feel handmade again.', '2026-09-01', 'seed', '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'),
  ((SELECT id FROM contributors WHERE slug='sample-dmitri'), 'mutual_enablers', 'active', 'manual', 0, 'absurdist essays', NULL, '2026-09-01', 'seed', '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'),
  ((SELECT id FROM contributors WHERE slug='sample-kofi'), 'emotional_support', 'active', 'manual', 0, NULL, NULL, '2026-09-01', 'seed', '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'),
  ((SELECT id FROM contributors WHERE slug='sample-wu'), 'voluntary_witnesses', 'active', 'self_reported', 0, NULL, NULL, '2026-09-01', 'seed', '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z');
INSERT INTO external_accounts (contributor_id, provider, handle, verification, source, created_at) VALUES
  ((SELECT id FROM contributors WHERE slug='sample-cass'), 'x', 'sample_cass', 'manual', 'seed', '2026-10-18T00:00:00Z'),
  ((SELECT id FROM contributors WHERE slug='sample-dmitri'), 'x', 'sample_dmitri', 'manual', 'seed', '2026-10-18T00:00:00Z');
INSERT INTO episodes (number, title, season, theme, draft_json, created_at, updated_at) VALUES (900, 'SAMPLE EPISODE', 1, 'terminal', '{}', '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z');
INSERT INTO contributions (contributor_id, category_key, episode_id, role, created_at) VALUES
  ((SELECT id FROM contributors WHERE slug='sample-wren'), 'human_resources', (SELECT id FROM episodes WHERE number=900), 'Writer', '2026-10-18T00:00:00Z');
INSERT INTO community_spotlights (contributor_id, headline, body, active, created_at) VALUES
  ((SELECT id FROM contributors WHERE slug='sample-cass'), 'Made a pixel bean so good the department framed it.', 'SAMPLE spotlight text for local development.', 1, '2026-10-18T00:00:00Z');
INSERT INTO hall_of_fame (contributor_id, honoree, title, description, season, achieved_on, created_at) VALUES
  (NULL, 'SAMPLE: The First Eight Players', 'FOUNDING BEAN COUNTERS', 'SAMPLE entry for local development.', 1, '2026-10-11', '2026-10-18T00:00:00Z');
