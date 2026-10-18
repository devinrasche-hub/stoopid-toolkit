// ADMIN ENDPOINTS — every handler here runs after requireAdmin(). Every write is audited.

import { cleanText, normalizeHandle, safeUrl, slugify } from '../../credits/engine/util.js';
import { creditedPeople, END_CARDS, THEME_META } from '../../credits/engine/sequence.js';
import { parseCsv, guessMapping, toCsv } from '../../credits/engine/csv.js';
import { json, fail, readJson, bool, int, oneOf, isoDate, now, audit, getSettings, DEFAULT_SETTINGS } from './lib.js';
import { moderatedLive, takeSnapshot, backfillHistory, recordHistory, liveFeed, periodLeaders } from './beans.js';
import { buildForEpisode, categories, parseDraft } from './data.js';

const VIS = ['public', 'anonymous', 'private'];
const VERIF = ['verified', 'manual', 'self_reported'];
const PROVIDERS = ['x', 'youtube', 'web', 'other'];
const NO_STORE = { 'cache-control': 'no-store' };
const ok = (data, status = 200) => json(data, status, NO_STORE);

// ── overview ────────────────────────────────────────────────────────────────
export async function overview(env) {
  const one = (sql, ...b) => env.DB.prepare(sql).bind(...b).first();
  const all = async (sql, ...b) => (await env.DB.prepare(sql).bind(...b).all()).results || [];
  const live = await moderatedLive(env);
  const next = await one("SELECT id, number, title, status, snapshot_id, current_version, updated_at FROM episodes ORDER BY (status = 'draft') DESC, number DESC LIMIT 1");
  return ok({
    publicContributors: (await one("SELECT COUNT(*) AS n FROM contributors WHERE merged_into IS NULL AND visibility = 'public' AND consent_public = 1")).n,
    totalContributors: (await one('SELECT COUNT(*) AS n FROM contributors WHERE merged_into IS NULL')).n,
    byCategory: await all(`SELECT k.key, k.name, k.kind, k.enabled, COUNT(m.id) AS members,
        SUM(CASE WHEN c.visibility = 'public' AND c.consent_public = 1 THEN 1 ELSE 0 END) AS public
      FROM credit_categories k LEFT JOIN category_memberships m ON m.category_key = k.key AND m.status = 'active'
      LEFT JOIN contributors c ON c.id = m.contributor_id AND c.merged_into IS NULL GROUP BY k.key ORDER BY k.sort_order`),
    pendingSubmissions: (await one("SELECT COUNT(*) AS n FROM submissions WHERE status = 'pending'")).n,
    unverifiedSupporters: (await one("SELECT COUNT(*) AS n FROM category_memberships WHERE category_key = 'financially_irresponsible' AND status = 'active' AND verification = 'self_reported'")).n,
    featuredCreators: await all("SELECT c.id, c.display_name FROM contributors c JOIN category_memberships m ON m.contributor_id = c.id AND m.category_key = 'mutual_enablers' AND m.featured = 1 AND m.status = 'active' WHERE c.merged_into IS NULL"),
    beans: live ? { asof: live.asof, updated: live.updated, players: live.players, top: live.entries.slice(0, 5), flagged: live.entries.filter((e) => e.flagged).length } : null,
    nextEpisode: next,
    integrations: await all('SELECT * FROM integrations ORDER BY provider'),
  });
}

// ── contributors ────────────────────────────────────────────────────────────
async function uniqueSlug(env, name, selfId = 0) {
  const base = slugify(name);
  for (let i = 0; i < 500; i++) {
    const s = i ? `${base}-${i + 1}` : base;
    const hit = await env.DB.prepare('SELECT id FROM contributors WHERE slug = ? AND id != ?').bind(s, selfId).first();
    if (!hit) return s;
  }
  return `${base}-${Date.now()}`;
}

function personFields(b, partial = false) {
  const f = {};
  if (!partial || 'display_name' in b) { f.display_name = cleanText(b.display_name, 80); if (!f.display_name) fail(422, 'A display name is required.', { field: 'display_name' }); }
  if (!partial || 'visibility' in b) f.visibility = oneOf(b.visibility, VIS, 'private');
  if (!partial || 'consent_public' in b) f.consent_public = bool(b.consent_public);
  if (!partial || 'consent_link' in b) f.consent_link = bool(b.consent_link);
  if ('link_url' in b || !partial) { f.link_url = b.link_url ? safeUrl(b.link_url) : null; if (b.link_url && !f.link_url) fail(422, 'Links must be https:// URLs.', { field: 'link_url' }); }
  if ('link_approved' in b || !partial) f.link_approved = bool(b.link_approved);
  if ('bio' in b || !partial) f.bio = cleanText(b.bio || '', 400) || null;
  if ('avatar_url' in b || !partial) { f.avatar_url = b.avatar_url ? safeUrl(b.avatar_url) : null; if (b.avatar_url && !f.avatar_url) fail(422, 'Avatar must be an https:// URL you have rights to use.'); }
  if ('private_note' in b || !partial) f.private_note = cleanText(b.private_note || '', 1000) || null;
  return f;
}

async function recordConsent(env, id, c, source, actor, note) {
  await env.DB.prepare('INSERT INTO recognition_consents (contributor_id, consent_public, consent_link, visibility, source, note, recorded_by, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, c.consent_public, c.consent_link, c.visibility, source, note || null, actor, now()).run();
}

async function addAccount(env, contributorId, a, source, actor) {
  const provider = oneOf(a.provider, PROVIDERS, null);
  if (!provider) fail(422, 'Account provider must be x, youtube, web or other.');
  const handle = provider === 'web' ? cleanText(a.handle || a.url || '', 200).toLowerCase() : normalizeHandle(a.handle);
  if (!handle) fail(422, 'Account handle is required.');
  const existing = await env.DB.prepare('SELECT contributor_id FROM external_accounts WHERE provider = ? AND handle = ?').bind(provider, handle).first();
  if (existing && existing.contributor_id !== contributorId) fail(409, `@${handle} on ${provider} already belongs to contributor #${existing.contributor_id}. Merge them instead.`, { existing: existing.contributor_id });
  if (existing) return;
  await env.DB.prepare('INSERT INTO external_accounts (contributor_id, provider, handle, url, verification, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(contributorId, provider, handle, safeUrl(a.url), oneOf(a.verification, VERIF, 'manual'), source, now()).run();
  await audit(env, actor, 'add_account', 'contributor', contributorId, { provider, handle });
}

async function upsertMembership(env, contributorId, m, source, actor) {
  const cat = await env.DB.prepare('SELECT key FROM credit_categories WHERE key = ?').bind(m.category_key).first();
  if (!cat) fail(422, `Unknown category "${m.category_key}".`);
  const t = now();
  await env.DB.prepare(`INSERT INTO category_memberships (contributor_id, category_key, status, verification, featured, sort_order, label, reason, private_note, since, until, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(contributor_id, category_key) DO UPDATE SET status = excluded.status, verification = excluded.verification, featured = excluded.featured,
      sort_order = excluded.sort_order, label = excluded.label, reason = excluded.reason, private_note = excluded.private_note,
      since = COALESCE(excluded.since, category_memberships.since), until = excluded.until, updated_at = excluded.updated_at`)
    .bind(contributorId, m.category_key, oneOf(m.status, ['active', 'former'], 'active'), oneOf(m.verification, VERIF, 'manual'), bool(m.featured), int(m.sort_order),
      cleanText(m.label || '', 60) || null, cleanText(m.reason || '', 280) || null, cleanText(m.private_note || '', 500) || null,
      isoDate(m.since) || t.slice(0, 10), isoDate(m.until), source, t, t).run();
  await audit(env, actor, 'set_membership', 'contributor', contributorId, { category: m.category_key, status: m.status || 'active' });
}

export async function createContributor(env, b, actor, source = 'admin') {
  const f = personFields(b);
  for (const a of b.accounts || []) {                       // duplicate check before writing anything
    const handle = a.provider === 'web' ? String(a.handle || '').toLowerCase() : normalizeHandle(a.handle);
    const hit = await env.DB.prepare('SELECT contributor_id FROM external_accounts WHERE provider = ? AND handle = ?').bind(a.provider, handle).first();
    if (hit) fail(409, `That ${a.provider} account already belongs to contributor #${hit.contributor_id}.`, { existing: hit.contributor_id });
  }
  const t = now();
  const r = await env.DB.prepare(`INSERT INTO contributors (display_name, slug, visibility, consent_public, consent_link, link_url, link_approved, bio, avatar_url, private_note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(f.display_name, await uniqueSlug(env, f.display_name), f.visibility, f.consent_public, f.consent_link,
    f.link_url, f.link_approved, f.bio, f.avatar_url, f.private_note, t, t).run();
  const id = r.meta.last_row_id;
  await recordConsent(env, id, f, source, actor, b.consent_note);
  for (const a of b.accounts || []) await addAccount(env, id, a, source, actor);
  for (const m of b.memberships || []) await upsertMembership(env, id, m, source, actor);
  await audit(env, actor, 'create', 'contributor', id, { name: f.display_name, visibility: f.visibility });
  return id;
}

export async function listContributors(env, url) {
  const q = cleanText(url.searchParams.get('q') || '', 80).toLowerCase();
  const cat = url.searchParams.get('category') || '';
  const vis = url.searchParams.get('visibility') || '';
  const where = ['c.merged_into IS NULL'], bind = [];
  if (q) { where.push('(lower(c.display_name) LIKE ? OR c.id IN (SELECT contributor_id FROM external_accounts WHERE handle LIKE ?))'); bind.push(`%${q}%`, `%${q.replace(/^@/, '')}%`); }
  if (cat) { where.push("c.id IN (SELECT contributor_id FROM category_memberships WHERE category_key = ? AND status = 'active')"); bind.push(cat); }
  if (VIS.includes(vis)) { where.push('c.visibility = ?'); bind.push(vis); }
  const { results } = await env.DB.prepare(`SELECT c.id, c.display_name, c.visibility, c.consent_public, c.consent_link, c.link_url, c.link_approved, c.is_sample, c.updated_at,
      (SELECT group_concat(category_key || ':' || verification || ':' || featured || ':' || status, '|') FROM category_memberships m WHERE m.contributor_id = c.id) AS cats,
      (SELECT group_concat(provider || ':' || handle, '|') FROM external_accounts a WHERE a.contributor_id = c.id) AS accts
    FROM contributors c WHERE ${where.join(' AND ')} ORDER BY lower(c.display_name) LIMIT 500`).bind(...bind).all();
  return ok({ contributors: (results || []).map((r) => ({ ...r,
    categories: r.cats ? r.cats.split('|').map((s) => { const [key, verification, featured, status] = s.split(':'); return { key, verification, featured: featured === '1', status }; }) : [],
    accounts: r.accts ? r.accts.split('|').map((s) => { const i = s.indexOf(':'); return { provider: s.slice(0, i), handle: s.slice(i + 1) }; }) : [],
    cats: undefined, accts: undefined })) });
}

export async function getContributor(env, id) {
  const c = await env.DB.prepare('SELECT * FROM contributors WHERE id = ?').bind(id).first();
  if (!c) fail(404, 'No such contributor.');
  const q = async (sql) => (await env.DB.prepare(sql).bind(id).all()).results || [];
  return ok({ contributor: c,
    accounts: await q('SELECT * FROM external_accounts WHERE contributor_id = ? ORDER BY provider'),
    memberships: await q('SELECT * FROM category_memberships WHERE contributor_id = ? ORDER BY category_key'),
    contributions: await q('SELECT x.*, e.number AS episode_number FROM contributions x LEFT JOIN episodes e ON e.id = x.episode_id WHERE x.contributor_id = ? ORDER BY x.id DESC'),
    consents: await q('SELECT * FROM recognition_consents WHERE contributor_id = ? ORDER BY id DESC'),
    appearances: await q('SELECT episode_number, category_key, version_id, created_at FROM episode_appearances WHERE contributor_id = ? ORDER BY episode_number DESC'),
    submissions: await q('SELECT ref, kind, status, contribution, created_at FROM submissions WHERE contributor_id = ? ORDER BY id DESC'),
    mergedFrom: await q('SELECT id, display_name FROM contributors WHERE merged_into = ?') });
}

export async function updateContributor(env, id, b, actor) {
  const c = await env.DB.prepare('SELECT * FROM contributors WHERE id = ?').bind(id).first();
  if (!c) fail(404, 'No such contributor.');
  if (c.merged_into) fail(409, `This record was merged into #${c.merged_into}; edit that one.`);
  const f = personFields(b, true);
  if (!Object.keys(f).length) return ok({ ok: true, unchanged: true });
  if (f.display_name && f.display_name !== c.display_name) f.slug = await uniqueSlug(env, f.display_name, id);
  const cols = Object.keys(f);
  await env.DB.prepare(`UPDATE contributors SET ${cols.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).bind(...cols.map((k) => f[k]), now(), id).run();
  const after = { ...c, ...f };
  if (after.visibility !== c.visibility || after.consent_public !== c.consent_public || after.consent_link !== c.consent_link) {
    await recordConsent(env, id, after, 'admin', actor, cleanText(b.consent_note || '', 200));
  }
  await audit(env, actor, 'update', 'contributor', id, { fields: cols });
  return ok({ ok: true });
}

/** Merge `id` into `into`: one person, one identity. History stays; the old record points at the new one. */
export async function mergeContributor(env, id, into, actor) {
  if (id === into) fail(422, 'Pick a different record to merge into.');
  const a = await env.DB.prepare('SELECT * FROM contributors WHERE id = ?').bind(id).first();
  const b = await env.DB.prepare('SELECT * FROM contributors WHERE id = ?').bind(into).first();
  if (!a || !b) fail(404, 'No such contributor.');
  if (a.merged_into || b.merged_into) fail(409, 'One of these records is already merged.');
  const t = now();
  await env.DB.batch([
    env.DB.prepare('UPDATE OR IGNORE external_accounts SET contributor_id = ? WHERE contributor_id = ?').bind(into, id),
    env.DB.prepare('DELETE FROM external_accounts WHERE contributor_id = ?').bind(id),
    env.DB.prepare('UPDATE OR IGNORE category_memberships SET contributor_id = ? WHERE contributor_id = ?').bind(into, id),
    env.DB.prepare('DELETE FROM category_memberships WHERE contributor_id = ?').bind(id),
    env.DB.prepare('UPDATE contributions SET contributor_id = ? WHERE contributor_id = ?').bind(into, id),
    env.DB.prepare('UPDATE community_spotlights SET contributor_id = ? WHERE contributor_id = ?').bind(into, id),
    env.DB.prepare('UPDATE hall_of_fame SET contributor_id = ? WHERE contributor_id = ?').bind(into, id),
    env.DB.prepare('UPDATE submissions SET contributor_id = ? WHERE contributor_id = ?').bind(into, id),
    env.DB.prepare('UPDATE contributors SET merged_into = ?, updated_at = ? WHERE id = ?').bind(into, t, id),
  ]);
  await audit(env, actor, 'merge', 'contributor', id, { into, from_name: a.display_name, into_name: b.display_name });
  return ok({ ok: true, into });
}

/** Privacy erasure: removes personal data; keeps an anonymous tombstone so archives can redact. */
export async function eraseContributor(env, id, actor) {
  const c = await env.DB.prepare('SELECT id FROM contributors WHERE id = ?').bind(id).first();
  if (!c) fail(404, 'No such contributor.');
  const t = now();
  const { results: xs } = await env.DB.prepare("SELECT handle FROM external_accounts WHERE contributor_id = ? AND provider = 'x'").bind(id).all();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM external_accounts WHERE contributor_id = ?').bind(id),
    env.DB.prepare('DELETE FROM category_memberships WHERE contributor_id = ?').bind(id),
    env.DB.prepare('DELETE FROM contributions WHERE contributor_id = ?').bind(id),
    env.DB.prepare('DELETE FROM community_spotlights WHERE contributor_id = ?').bind(id),
    env.DB.prepare('DELETE FROM recognition_consents WHERE contributor_id = ?').bind(id),
    env.DB.prepare('UPDATE hall_of_fame SET contributor_id = NULL, visible = 0 WHERE contributor_id = ?').bind(id),
    env.DB.prepare("UPDATE submissions SET display_name = '[erased]', handle = NULL, profile_url = NULL, note = NULL, status = 'withdrawn' WHERE contributor_id = ?").bind(id),
    env.DB.prepare("UPDATE contributors SET display_name = '[erased]', slug = ?, visibility = 'private', consent_public = 0, consent_link = 0, link_url = NULL, link_approved = 0, bio = NULL, avatar_url = NULL, private_note = NULL, updated_at = ? WHERE id = ?").bind(`erased-${id}`, t, id),
    ...(xs || []).map((x) => env.DB.prepare("INSERT INTO beans_name_rules (handle, status, reason, updated_by, updated_at) VALUES (?, 'excluded', 'withdrew recognition', ?, ?) ON CONFLICT(handle) DO UPDATE SET status = 'excluded', reason = 'withdrew recognition', updated_at = excluded.updated_at").bind(x.handle, actor, t)),
  ]);
  await audit(env, actor, 'erase', 'contributor', id, null);
  return ok({ ok: true, erased: id });
}

export async function exportContributor(env, id) {
  const r = await getContributor(env, id);
  return new Response(await r.text(), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="contributor-${id}.json"`, ...NO_STORE } });
}

// ── memberships, accounts, contributions ────────────────────────────────────
export async function setMembership(env, id, key, b, actor) {
  if (!(await env.DB.prepare('SELECT id FROM contributors WHERE id = ? AND merged_into IS NULL').bind(id).first())) fail(404, 'No such contributor.');
  await upsertMembership(env, id, { ...b, category_key: key }, 'admin', actor);
  return ok({ ok: true });
}
export async function removeMembership(env, id, key, actor) {
  await env.DB.prepare('DELETE FROM category_memberships WHERE contributor_id = ? AND category_key = ?').bind(id, key).run();
  await audit(env, actor, 'remove_membership', 'contributor', id, { category: key });
  return ok({ ok: true });
}
export async function postAccount(env, id, b, actor) { await addAccount(env, id, b, 'admin', actor); return ok({ ok: true }, 201); }
export async function deleteAccount(env, accountId, actor) {
  const a = await env.DB.prepare('SELECT * FROM external_accounts WHERE id = ?').bind(accountId).first();
  if (!a) fail(404, 'No such account.');
  await env.DB.prepare('DELETE FROM external_accounts WHERE id = ?').bind(accountId).run();
  await audit(env, actor, 'remove_account', 'contributor', a.contributor_id, { provider: a.provider, handle: a.handle });
  return ok({ ok: true });
}
export async function postContribution(env, b, actor) {
  const cid = int(b.contributor_id);
  if (!(await env.DB.prepare('SELECT id FROM contributors WHERE id = ? AND merged_into IS NULL').bind(cid).first())) fail(404, 'No such contributor.');
  const role = cleanText(b.role, 60);
  if (!role) fail(422, 'Role is required (e.g. Writer, Editor, Pixel art).');
  const epId = b.episode_id ? int(b.episode_id) : null;
  const cat = cleanText(b.category_key || 'human_resources', 60);
  if (!(await env.DB.prepare('SELECT key FROM credit_categories WHERE key = ?').bind(cat).first())) fail(422, 'Unknown category.');
  const r = await env.DB.prepare('INSERT INTO contributions (contributor_id, category_key, episode_id, role, description, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(cid, cat, epId, role, cleanText(b.description || '', 300) || null, now()).run();
  await audit(env, actor, 'add_contribution', 'contributor', cid, { episode_id: epId, role });
  return ok({ ok: true, id: r.meta.last_row_id }, 201);
}
export async function deleteContribution(env, id, actor) {
  const c = await env.DB.prepare('SELECT * FROM contributions WHERE id = ?').bind(id).first();
  if (!c) fail(404, 'No such contribution.');
  await env.DB.prepare('DELETE FROM contributions WHERE id = ?').bind(id).run();
  await audit(env, actor, 'remove_contribution', 'contributor', c.contributor_id, { role: c.role, episode_id: c.episode_id });
  return ok({ ok: true });
}

// ── categories & settings ───────────────────────────────────────────────────
export async function listCategories(env) { return ok({ categories: await categories(env) }); }

export async function putCategory(env, key, b, actor) {
  key = slugify(key).replace(/-/g, '_');
  const existing = await env.DB.prepare('SELECT * FROM credit_categories WHERE key = ?').bind(key).first();
  const v = {
    name: cleanText(b.name ?? existing?.name ?? '', 60).toUpperCase(), tagline: cleanText(b.tagline ?? existing?.tagline ?? '', 120),
    kind: existing ? existing.kind : oneOf(b.kind, ['rotating', 'curated', 'episode'], null),
    enabled: b.enabled == null ? (existing?.enabled ?? 1) : bool(b.enabled), sort_order: b.sort_order == null ? (existing?.sort_order ?? 100) : int(b.sort_order),
    cap: Math.max(1, Math.min(200, b.cap == null ? (existing?.cap ?? 12) : int(b.cap, 12))),
    segment_seconds: Math.max(2, Math.min(60, b.segment_seconds == null ? (existing?.segment_seconds ?? 7) : Number(b.segment_seconds) || 7)),
    public_section: b.public_section == null ? (existing?.public_section ?? 1) : bool(b.public_section),
  };
  if (!v.name) fail(422, 'Category name is required.');
  if (!v.kind) fail(422, 'New categories must be rotating, curated or episode.');
  await env.DB.prepare(`INSERT INTO credit_categories (key, name, tagline, kind, enabled, sort_order, cap, segment_seconds, public_section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET name = excluded.name, tagline = excluded.tagline, enabled = excluded.enabled, sort_order = excluded.sort_order, cap = excluded.cap, segment_seconds = excluded.segment_seconds, public_section = excluded.public_section`)
    .bind(key, v.name, v.tagline, v.kind, v.enabled, v.sort_order, v.cap, v.segment_seconds, v.public_section).run();
  await audit(env, actor, existing ? 'update' : 'create', 'category', key, v);
  return ok({ ok: true, key });
}

const SETTING_RULES = {
  timing: (v) => {
    const t = { ...DEFAULT_SETTINGS.timing, ...(v || {}) };
    return { theme: oneOf(t.theme, Object.keys(THEME_META), 'terminal'), fps: oneOf(Number(t.fps), [24, 30, 60], 30),
      identSeconds: clampN(t.identSeconds, 2, 20), finalSeconds: clampN(t.finalSeconds, 4, 30), minPageSeconds: clampN(t.minPageSeconds, 2, 10),
      overflow: oneOf(t.overflow, ['archive', 'extend'], 'archive'), emptyCategories: oneOf(t.emptyCategories, ['skip', 'card'], 'skip'),
      endCard: oneOf(t.endCard, Object.keys(END_CARDS), 'refund'), audio: !!t.audio, archiveUrl: cleanText(t.archiveUrl, 60) || 'STOOPIDTV.COM/CREDITS' };
  },
  leaderboard_top_n: (v) => clampN(v, 1, 20, true),
  dedupe: (v) => !!v,
  hall_supporters_shown: (v) => clampN(v, 0, 100, true),
  beans_auto_approve: (v) => !!v,
  name_blocklist: (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => cleanText(s, 30).toLowerCase()).filter(Boolean).slice(0, 200),
  episode_title_format: (v) => cleanText(v, 80) || DEFAULT_SETTINGS.episode_title_format,
  archive_public: (v) => !!v,
  join_open: (v) => !!v,
  export_formats: (v) => (Array.isArray(v) ? v : []).filter((f) => ['mp4', 'cards', 'alpha-cards', 'prores', 'webm-alpha'].includes(f)),
  links: (v) => Object.fromEntries(Object.entries(v || {}).slice(0, 12).map(([k, u]) => [slugify(k), safeUrl(u)]).filter(([, u]) => u)),
};
function clampN(v, lo, hi, integer = false) { let n = Number(v); if (!Number.isFinite(n)) n = lo; n = Math.max(lo, Math.min(hi, n)); return integer ? Math.round(n) : n; }

export async function getSettingsAdmin(env) {
  return ok({ settings: await getSettings(env), themes: Object.entries(THEME_META).map(([id, m]) => ({ id, name: m.name })),
    endCards: Object.entries(END_CARDS).map(([id, e]) => ({ id, name: e.name, card: e.card })) });
}

export async function putSettings(env, b, actor) {
  const t = now(), changed = [];
  for (const [k, v] of Object.entries(b)) {
    if (!SETTING_RULES[k]) continue;
    await env.DB.prepare('INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at')
      .bind(k, JSON.stringify(SETTING_RULES[k](v)), t).run();
    changed.push(k);
  }
  await audit(env, actor, 'update', 'settings', null, { keys: changed });
  return getSettingsAdmin(env);
}

// ── episodes ────────────────────────────────────────────────────────────────
export async function listEpisodes(env) {
  const { results } = await env.DB.prepare(`SELECT e.id, e.number, e.title, e.season, e.status, e.theme, e.published_on, e.current_version, e.snapshot_id, e.updated_at,
    (SELECT COUNT(*) FROM contributions c WHERE c.episode_id = e.id) AS contributions FROM episodes e ORDER BY e.number DESC`).all();
  return ok({ episodes: results || [] });
}

export async function createEpisode(env, b, actor) {
  const number = int(b.number, 0);
  if (number < 1 || number > 99999) fail(422, 'Episode number must be a positive whole number.');
  const title = cleanText(b.title, 120);
  if (!title) fail(422, 'Episode title is required.');
  if (await env.DB.prepare('SELECT id FROM episodes WHERE number = ?').bind(number).first()) fail(409, `Episode ${number} already exists.`);
  // Reuse the last episode's production choices so nothing is rebuilt from scratch.
  const prev = await env.DB.prepare('SELECT theme, draft_json FROM episodes ORDER BY number DESC LIMIT 1').first();
  const prevDraft = prev ? parseDraft(prev) : {};
  const draft = { timing: prevDraft.timing || {}, topN: prevDraft.topN };
  const settings = await getSettings(env);
  const t = now();
  const r = await env.DB.prepare('INSERT INTO episodes (number, title, season, published_on, episode_url, theme, draft_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(number, title, int(b.season, 1) || 1, isoDate(b.published_on), safeUrl(b.episode_url), oneOf(b.theme, Object.keys(THEME_META), prev?.theme || settings.timing.theme),
      JSON.stringify(draft), t, t).run();
  await audit(env, actor, 'create', 'episode', r.meta.last_row_id, { number, title });
  return ok({ ok: true, id: r.meta.last_row_id }, 201);
}

async function loadEpisode(env, id) {
  const ep = await env.DB.prepare('SELECT * FROM episodes WHERE id = ?').bind(id).first();
  if (!ep) fail(404, 'No such episode.');
  return ep;
}

export async function getEpisode(env, id) {
  const ep = await loadEpisode(env, id);
  const { results: versions } = await env.DB.prepare('SELECT id, revision, reason, snapshot_id, created_by, created_at FROM credit_versions WHERE episode_id = ? ORDER BY revision DESC').bind(id).all();
  const { results: contributions } = await env.DB.prepare('SELECT x.id, x.role, x.category_key, x.description, c.id AS contributor_id, c.display_name FROM contributions x JOIN contributors c ON c.id = x.contributor_id WHERE x.episode_id = ? ORDER BY x.id').bind(id).all();
  const { results: snapshots } = await env.DB.prepare('SELECT id, feed_asof, feed_updated, top_n, supersedes, reason, taken_by, taken_at FROM leaderboard_snapshots WHERE episode_id = ? ORDER BY id DESC').bind(id).all();
  let snapshot = null;
  if (ep.snapshot_id) snapshot = { ...(snapshots || []).find((s) => s.id === ep.snapshot_id), entries: (await env.DB.prepare('SELECT * FROM leaderboard_snapshot_entries WHERE snapshot_id = ? ORDER BY pos').bind(ep.snapshot_id).all()).results };
  return ok({ episode: { ...ep, draft: parseDraft(ep), draft_json: undefined }, versions, contributions, snapshots, snapshot });
}

export async function updateEpisode(env, id, b, actor) {
  const ep = await loadEpisode(env, id);
  const f = {};
  if ('title' in b) { f.title = cleanText(b.title, 120); if (!f.title) fail(422, 'Title is required.'); }
  if ('season' in b) f.season = int(b.season, 1) || 1;
  if ('published_on' in b) f.published_on = isoDate(b.published_on);
  if ('episode_url' in b) f.episode_url = safeUrl(b.episode_url);
  if ('theme' in b) f.theme = oneOf(b.theme, Object.keys(THEME_META), ep.theme);
  if ('draft' in b) f.draft_json = JSON.stringify(cleanDraft(b.draft));
  const cols = Object.keys(f);
  if (cols.length) await env.DB.prepare(`UPDATE episodes SET ${cols.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).bind(...cols.map((k) => f[k]), now(), id).run();
  await audit(env, actor, 'update', 'episode', id, { fields: cols });
  return getEpisode(env, id);
}

function cleanDraft(d) {
  d = d && typeof d === 'object' ? d : {};
  const ids = (a) => (Array.isArray(a) ? a.map((x) => int(x)).filter((x) => x > 0).slice(0, 500) : []);
  const t = d.timing && typeof d.timing === 'object' ? d.timing : {};
  const durations = {};
  for (const [k, v] of Object.entries(t.durations || {})) if (/^(ident|final|cat:[a-z0-9_]+)$/.test(k)) durations[k] = clampN(v, 1, 60);
  const timing = {
    ...(t.theme ? { theme: oneOf(t.theme, Object.keys(THEME_META), 'terminal') } : {}),
    ...(t.fps ? { fps: oneOf(Number(t.fps), [24, 30, 60], 30) } : {}),
    ...(t.endCard ? { endCard: oneOf(t.endCard, Object.keys(END_CARDS), 'refund') } : {}),
    ...(t.overflow ? { overflow: oneOf(t.overflow, ['archive', 'extend'], 'archive') } : {}),
    ...(t.emptyCategories ? { emptyCategories: oneOf(t.emptyCategories, ['skip', 'card'], 'skip') } : {}),
    ...('audio' in t ? { audio: !!t.audio } : {}),
    ...(t.minPageSeconds ? { minPageSeconds: clampN(t.minPageSeconds, 2, 10) } : {}),
    durations,
    disabled: Array.isArray(t.disabled) ? t.disabled.filter((s) => /^(ident|final|cat:[a-z0-9_]+)$/.test(s)) : [],
    order: Array.isArray(t.order) ? t.order.filter((s) => /^(ident|final|cat:[a-z0-9_]+)$/.test(s)) : null,
    notices: Array.isArray(t.notices) ? t.notices.map((s) => cleanText(s, 90)).filter(Boolean).slice(0, 20) : (t.notices === 'off' ? 'off' : 'auto'),
  };
  return { include: ids(d.include), exclude: ids(d.exclude), seed: d.seed ? cleanText(d.seed, 40) : undefined,
    topN: d.topN ? clampN(d.topN, 1, 20, true) : undefined, timing };
}

export async function previewEpisode(env, id, b) {
  const ep = await loadEpisode(env, id);
  const override = b && b.draft ? cleanDraft({ ...parseDraft(ep), ...b.draft }) : null;
  const r = await buildForEpisode(env, ep, override);
  return ok({ sequence: r.sequence, warnings: r.warnings, leaderboardSource: r.leaderboardSource, report: report(r.selection) });
}

function report(selection) {
  return selection.sections.map((s) => ({ key: s.key, name: s.name, kind: s.kind, included: s.items.map(({ id, name, role, rank, beans, featured, verification }) => ({ id, name, role, rank, beans, featured, verification })),
    anonymousCount: s.anonymousCount, deferred: s.deferred, excluded: s.excluded, note: s.note }));
}

export async function snapshotEpisode(env, id, b, actor) {
  const ep = await loadEpisode(env, id);
  const settings = await getSettings(env);
  const draft = parseDraft(ep);
  const reason = cleanText(b.reason || '', 200);
  if (ep.status === 'final' && !reason) fail(422, 'This episode is published. Give a reason; a corrected version will be issued and the original kept.');
  const snap = await takeSnapshot(env, { episodeId: id, topN: draft.topN || settings.leaderboard_top_n, actor, supersedes: ep.snapshot_id, reason: reason || null });
  await env.DB.prepare('UPDATE episodes SET snapshot_id = ?, updated_at = ? WHERE id = ?').bind(snap.id, now(), id).run();
  await audit(env, actor, ep.snapshot_id ? 'resnapshot' : 'snapshot', 'episode', id, { snapshot: snap.id, supersedes: ep.snapshot_id, asof: snap.asof, reason });
  if (ep.status === 'final') return finalizeEpisode(env, id, { reason: `Leaderboard correction: ${reason}` }, actor);
  return getEpisode(env, id);
}

/** Freeze an immutable version. First call publishes; later calls are corrections and need a reason. */
export async function finalizeEpisode(env, id, b, actor) {
  let ep = await loadEpisode(env, id);
  const reason = cleanText(b.reason || '', 200);
  if (ep.status === 'final' && !reason) fail(422, 'Corrections need a reason, so the archive can say what changed.');
  const cats = await categories(env);
  if (!ep.snapshot_id && cats.some((c) => c.kind === 'leaderboard' && c.enabled)) {
    const settings = await getSettings(env);
    const snap = await takeSnapshot(env, { episodeId: id, topN: parseDraft(ep).topN || settings.leaderboard_top_n, actor });
    await env.DB.prepare('UPDATE episodes SET snapshot_id = ? WHERE id = ?').bind(snap.id, id).run();
    await audit(env, actor, 'snapshot', 'episode', id, { snapshot: snap.id, asof: snap.asof, auto: true });
    ep = await loadEpisode(env, id);
  }
  const r = await buildForEpisode(env, ep);
  const prev = await env.DB.prepare('SELECT MAX(revision) AS r FROM credit_versions WHERE episode_id = ?').bind(id).first();
  const revision = (prev?.r || 0) + 1;
  const t = now();
  const ins = await env.DB.prepare('INSERT INTO credit_versions (episode_id, revision, reason, sequence_json, report_json, snapshot_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, revision, reason || 'Initial publication', JSON.stringify(r.sequence), JSON.stringify({ report: report(r.selection), warnings: r.warnings }), ep.snapshot_id, actor, t).run();
  const vid = ins.meta.last_row_id;
  const people = creditedPeople(r.sequence).filter((p) => p.id != null);
  const seen = new Set();
  const stmts = [];
  for (const p of people) {
    const k = p.id + ':' + p.category;
    if (seen.has(k)) continue; seen.add(k);
    stmts.push(env.DB.prepare('INSERT INTO episode_appearances (version_id, episode_id, episode_number, contributor_id, category_key, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(vid, id, ep.number, p.id, p.category, t));
  }
  stmts.push(env.DB.prepare("UPDATE episodes SET status = 'final', current_version = ?, theme = ?, updated_at = ? WHERE id = ?").bind(revision, r.sequence.theme, t, id));
  await env.DB.batch(stmts);
  await audit(env, actor, revision === 1 ? 'finalize' : 'correct', 'episode', id, { revision, reason: reason || null, credited: people.length });
  return ok({ ok: true, revision, versionId: vid, warnings: r.warnings });
}

export async function getVersion(env, vid) {
  const v = await env.DB.prepare('SELECT * FROM credit_versions WHERE id = ?').bind(vid).first();
  if (!v) fail(404, 'No such version.');
  return ok({ version: { ...v, sequence: JSON.parse(v.sequence_json), report: JSON.parse(v.report_json), sequence_json: undefined, report_json: undefined } });
}

// ── arcade ──────────────────────────────────────────────────────────────────
export async function beansAdmin(env) {
  const live = await moderatedLive(env);
  const { results: rules } = await env.DB.prepare('SELECT * FROM beans_name_rules ORDER BY updated_at DESC').all();
  const hist = await env.DB.prepare('SELECT COUNT(*) AS n, MIN(asof) AS first, MAX(asof) AS last FROM beans_feed_history').first();
  const { results: snaps } = await env.DB.prepare('SELECT s.id, s.feed_asof, s.top_n, s.supersedes, s.reason, s.taken_by, s.taken_at, e.number AS episode FROM leaderboard_snapshots s LEFT JOIN episodes e ON e.id = s.episode_id ORDER BY s.id DESC LIMIT 50').all();
  return ok({ live, rules, history: hist, week: await periodLeaders(env, 7, 5), month: await periodLeaders(env, 30, 5), snapshots: snaps,
    integration: await env.DB.prepare("SELECT * FROM integrations WHERE provider = 'beans_feed'").first() });
}

export async function putBeansRule(env, handle, b, actor) {
  handle = normalizeHandle(handle);
  if (!/^[a-z0-9_]{1,30}$/.test(handle)) fail(422, 'Not a valid handle.');
  const status = oneOf(b.status, ['approved', 'excluded'], null);
  if (!status) fail(422, 'Status must be approved or excluded.');
  await env.DB.prepare('INSERT INTO beans_name_rules (handle, status, reason, updated_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(handle) DO UPDATE SET status = excluded.status, reason = excluded.reason, updated_by = excluded.updated_by, updated_at = excluded.updated_at')
    .bind(handle, status, cleanText(b.reason || '', 120) || null, actor, now()).run();
  await audit(env, actor, 'beans_rule', 'beans_name', handle, { status, reason: b.reason || null });
  return ok({ ok: true });
}
export async function deleteBeansRule(env, handle, actor) {
  await env.DB.prepare('DELETE FROM beans_name_rules WHERE handle = ?').bind(normalizeHandle(handle)).run();
  await audit(env, actor, 'beans_rule_clear', 'beans_name', handle, null);
  return ok({ ok: true });
}
export async function backfill(env, actor) {
  const r = await backfillHistory(env);
  await audit(env, actor, 'backfill', 'beans_history', null, r);
  return ok(r);
}
export async function recordNow(env, actor) {
  const r = await liveFeed(env);
  if (!r) fail(502, 'Beans feed unreachable; nothing recorded. See Integrations for the error.');
  const added = await recordHistory(env, r.feed, r.raw, 'manual');
  await audit(env, actor, 'record', 'beans_history', r.feed.asof, { added });
  return ok({ ok: true, asof: r.feed.asof, added });
}

// ── submissions ─────────────────────────────────────────────────────────────
const CONTRIB_CATEGORY = { x_supporter: 'financially_irresponsible', youtube_witness: 'voluntary_witnesses', emotional_support: 'emotional_support' };

export async function listSubmissions(env, url) {
  const status = oneOf(url.searchParams.get('status') || 'pending', ['pending', 'approved', 'rejected', 'withdrawn', 'all'], 'pending');
  const { results } = await env.DB.prepare(`SELECT id, ref, kind, display_name, platform, handle, profile_url, contribution, consent_public, consent_link, note, status, parent_ref, contributor_id, reviewed_by, reviewed_at, created_at
    FROM submissions ${status === 'all' ? '' : 'WHERE status = ?'} ORDER BY created_at DESC LIMIT 300`).bind(...(status === 'all' ? [] : [status])).all();
  for (const s of results || []) {                            // duplicate hints
    const byHandle = s.handle ? await env.DB.prepare('SELECT c.id, c.display_name FROM external_accounts a JOIN contributors c ON c.id = a.contributor_id WHERE a.handle = ? AND c.merged_into IS NULL LIMIT 1').bind(s.handle).first() : null;
    const byName = await env.DB.prepare('SELECT id, display_name FROM contributors WHERE lower(display_name) = lower(?) AND merged_into IS NULL LIMIT 1').bind(s.display_name).first();
    s.possibleMatch = byHandle || byName || null;
  }
  return ok({ submissions: results || [] });
}

export async function approveSubmission(env, id, b, actor) {
  const s = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first();
  if (!s) fail(404, 'No such request.');
  if (s.status !== 'pending') fail(409, `This request is already ${s.status}.`);
  const visibility = s.consent_public ? 'public' : 'anonymous';    // didn't want a name on screen → counted, never named
  let cid = s.contributor_id || (b.contributor_id ? int(b.contributor_id) : null);
  const category = b.category_key === '' ? null : (b.category_key || CONTRIB_CATEGORY[s.contribution] || null);
  const t = now();
  if (cid) {
    const c = await env.DB.prepare('SELECT * FROM contributors WHERE id = ? AND merged_into IS NULL').bind(cid).first();
    if (!c) fail(404, 'The contributor to attach to no longer exists.');
    const f = { display_name: s.display_name, visibility, consent_public: 1, consent_link: s.consent_link,
      link_url: s.profile_url || c.link_url, link_approved: b.approve_link ? 1 : (s.profile_url && s.profile_url !== c.link_url ? 0 : c.link_approved) };
    await env.DB.prepare('UPDATE contributors SET display_name = ?, slug = ?, visibility = ?, consent_public = ?, consent_link = ?, link_url = ?, link_approved = ?, updated_at = ? WHERE id = ?')
      .bind(f.display_name, await uniqueSlug(env, f.display_name, cid), f.visibility, f.consent_public, f.consent_link, f.link_url, f.link_approved, t, cid).run();
    await recordConsent(env, cid, f, 'join_form', actor, `${s.kind} ${s.ref}`);
  } else {
    cid = await createContributor(env, { display_name: s.display_name, visibility, consent_public: 1, consent_link: s.consent_link,
      link_url: s.profile_url, link_approved: b.approve_link ? 1 : 0, consent_note: `join ${s.ref}` }, actor, 'join_form');
  }
  if (s.handle && s.platform && ['x', 'youtube'].includes(s.platform)) {
    try { await addAccount(env, cid, { provider: s.platform, handle: s.handle, verification: 'self_reported' }, 'join_form', actor); }
    catch (e) { if (e.status !== 409) throw e; }              // already someone's — admin sees the duplicate hint
  }
  if (category) await upsertMembership(env, cid, { category_key: category, verification: b.verification || 'self_reported' }, 'join_form', actor);
  await env.DB.prepare("UPDATE submissions SET status = 'approved', contributor_id = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?").bind(cid, actor, t, id).run();
  if (s.parent_ref) await env.DB.prepare('UPDATE submissions SET contributor_id = ? WHERE ref = ?').bind(cid, s.parent_ref).run();
  await audit(env, actor, 'approve', 'submission', s.ref, { contributor: cid, category });
  return ok({ ok: true, contributorId: cid });
}

export async function rejectSubmission(env, id, b, actor) {
  const s = await env.DB.prepare('SELECT ref, status FROM submissions WHERE id = ?').bind(id).first();
  if (!s) fail(404, 'No such request.');
  await env.DB.prepare("UPDATE submissions SET status = 'rejected', reviewed_by = ?, reviewed_at = ? WHERE id = ?").bind(actor, now(), id).run();
  await audit(env, actor, 'reject', 'submission', s.ref, { reason: cleanText(b.reason || '', 200) || null });
  return ok({ ok: true });
}

// ── spotlights, hall of fame, jokes (small tables) ──────────────────────────
const TABLES = {
  spotlights: { table: 'community_spotlights', fields: {
    contributor_id: (v) => { const n = int(v); if (!n) fail(422, 'Pick a contributor.'); return n; },
    headline: (v) => { const s = cleanText(v, 120); if (!s) fail(422, 'Headline is required.'); return s; },
    body: (v) => cleanText(v || '', 600) || null, starts_on: isoDate, ends_on: isoDate, active: bool } },
  fame: { table: 'hall_of_fame', fields: {
    contributor_id: (v) => (v ? int(v) : null), honoree: (v) => cleanText(v || '', 80) || null,
    title: (v) => { const s = cleanText(v, 120); if (!s) fail(422, 'Title is required.'); return s; },
    description: (v) => cleanText(v || '', 600) || null, season: (v) => (v ? int(v) : null), achieved_on: isoDate,
    sort_order: (v) => int(v), visible: bool } },
  jokes: { table: 'jokes', fields: {
    text: (v) => { const s = cleanText(v, 90).toUpperCase(); if (!s) fail(422, 'Joke text is required.'); return s; },
    themes: (v) => { const s = String(v || '*').split(',').map((x) => x.trim()).filter((x) => x === '*' || THEME_META[x]); return s.length ? s.join(',') : '*'; },
    enabled: bool } },
};

export async function listTable(env, name) {
  const T = TABLES[name];
  const extra = name === 'jokes' ? '' : ', (SELECT display_name FROM contributors c WHERE c.id = t.contributor_id) AS contributor_name';
  const { results } = await env.DB.prepare(`SELECT t.*${extra} FROM ${T.table} t ORDER BY t.id DESC`).all();
  return ok({ rows: results || [] });
}
export async function saveRow(env, name, id, b, actor) {
  const T = TABLES[name];
  const f = {};
  for (const [k, fn] of Object.entries(T.fields)) if (!id || k in b) f[k] = fn(b[k]);
  if (name === 'fame' && !id && !f.contributor_id && !f.honoree) fail(422, 'Name a contributor or an honoree.');
  const cols = Object.keys(f);
  let rid = id;
  if (id) {
    if (!(await env.DB.prepare(`SELECT id FROM ${T.table} WHERE id = ?`).bind(id).first())) fail(404, 'Not found.');
    if (cols.length) await env.DB.prepare(`UPDATE ${T.table} SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...cols.map((k) => f[k]), id).run();
  } else {
    const r = await env.DB.prepare(`INSERT INTO ${T.table} (${cols.join(', ')}, created_at) VALUES (${cols.map(() => '?').join(', ')}, ?)`).bind(...cols.map((k) => f[k]), now()).run();
    rid = r.meta.last_row_id;
  }
  await audit(env, actor, id ? 'update' : 'create', name, rid, { fields: cols });
  return ok({ ok: true, id: rid });
}
export async function deleteRow(env, name, id, actor) {
  await env.DB.prepare(`DELETE FROM ${TABLES[name].table} WHERE id = ?`).bind(id).run();
  await audit(env, actor, 'delete', name, id, null);
  return ok({ ok: true });
}
export const TABLE_NAMES = Object.keys(TABLES);

// ── import / export ─────────────────────────────────────────────────────────
export async function importCsv(env, b, actor) {
  const { headers, records } = parseCsv(b.csv || '');
  if (!headers.length) fail(422, 'The CSV is empty.');
  const mapping = { ...guessMapping(headers), ...(b.mapping || {}) };
  if (!mapping.display_name && !mapping.handle) fail(422, 'Map at least a name or a handle column.');
  const category = cleanText(b.category_key || 'financially_irresponsible', 60);
  if (!(await env.DB.prepare('SELECT key FROM credit_categories WHERE key = ?').bind(category).first())) fail(422, 'Unknown category.');
  const provider = oneOf(b.provider, ['x', 'youtube'], 'x');
  const verification = oneOf(b.verification, VERIF, 'manual');
  const defaultVis = oneOf(b.default_visibility, VIS, 'private');
  const dry = b.dry_run !== false;
  const out = { rows: records.length, create: 0, update: 0, skip: 0, errors: [], preview: [] };
  const seen = new Set();
  for (let i = 0; i < records.length; i++) {
    const r = records[i], line = i + 2;
    const handle = mapping.handle ? normalizeHandle(r[mapping.handle]) : '';
    const name = cleanText((mapping.display_name && r[mapping.display_name]) || (handle ? '@' + handle : ''), 80);
    if (!name) { out.errors.push({ line, error: 'no name or handle' }); out.skip++; continue; }
    if (handle && !/^[a-z0-9_.-]{1,60}$/.test(handle)) { out.errors.push({ line, error: `bad handle "${r[mapping.handle]}"` }); out.skip++; continue; }
    const key = handle || name.toLowerCase();
    if (seen.has(key)) { out.errors.push({ line, error: 'duplicate row in this file' }); out.skip++; continue; }
    seen.add(key);
    const st = String(mapping.status ? r[mapping.status] : '').toLowerCase();
    const status = /^(former|inactive|cancel|ended|expired|no|false|0)/.test(st) ? 'former' : 'active';
    const vv = String(mapping.visibility ? r[mapping.visibility] : '').toLowerCase();
    const visibility = /^(public|yes|true|1|named)$/.test(vv) ? 'public' : /^anon/.test(vv) ? 'anonymous' : /^(private|no|false|0|hidden)$/.test(vv) ? 'private' : defaultVis;
    const existing = handle ? await env.DB.prepare('SELECT c.id, c.display_name FROM external_accounts a JOIN contributors c ON c.id = a.contributor_id WHERE a.provider = ? AND a.handle = ?').bind(provider, handle).first()
      : await env.DB.prepare('SELECT id, display_name FROM contributors WHERE lower(display_name) = lower(?) AND merged_into IS NULL').bind(name).first();
    const action = existing ? 'update' : 'create';
    out[action]++;
    if (out.preview.length < 50) out.preview.push({ line, action, name, handle: handle || null, status, visibility: existing ? '(unchanged)' : visibility, existing: existing?.id || null });
    if (dry) continue;
    try {
      if (existing) {
        await upsertMembership(env, existing.id, { category_key: category, status, verification, since: isoDate(mapping.since && r[mapping.since]) }, 'import', actor);
      } else {
        await createContributor(env, { display_name: name, visibility, consent_public: visibility === 'private' ? 0 : 1, consent_link: 0,
          link_url: mapping.profile_url ? safeUrl(r[mapping.profile_url]) : null, private_note: mapping.note ? r[mapping.note] : null,
          accounts: handle ? [{ provider, handle, verification }] : [],
          memberships: [{ category_key: category, status, verification, since: isoDate(mapping.since && r[mapping.since]) }],
          consent_note: `CSV import${b.filename ? ' ' + cleanText(b.filename, 60) : ''}` }, actor, 'import');
      }
    } catch (e) {
      out[action]--; out.skip++;
      out.errors.push({ line, error: e.message });
    }
  }
  if (!dry) {
    await env.DB.prepare('INSERT INTO import_jobs (kind, filename, category_key, mapping_json, rows_total, created, updated, skipped, errors_json, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind('csv', cleanText(b.filename || '', 80) || null, category, JSON.stringify(mapping), out.rows, out.create, out.update, out.skip, JSON.stringify(out.errors.slice(0, 200)), 'done', actor, now()).run();
    await audit(env, actor, 'import', 'contributors', null, { category, rows: out.rows, created: out.create, updated: out.update, skipped: out.skip });
  }
  return ok({ dryRun: dry, mapping, headers, ...out });
}

export async function listImports(env) {
  const { results } = await env.DB.prepare('SELECT * FROM import_jobs ORDER BY id DESC LIMIT 50').all();
  return ok({ jobs: results || [] });
}

const EXPORT_TABLES = ['contributors', 'external_accounts', 'category_memberships', 'contributions', 'recognition_consents', 'credit_categories', 'episodes', 'credit_versions',
  'episode_appearances', 'leaderboard_snapshots', 'leaderboard_snapshot_entries', 'beans_name_rules', 'community_spotlights', 'hall_of_fame', 'jokes', 'settings', 'import_jobs'];

export async function exportAll(env, url) {
  if (url.searchParams.get('format') === 'csv') {
    const { results } = await env.DB.prepare(`SELECT c.id, c.display_name, c.visibility, c.consent_public, c.consent_link, c.link_url,
      (SELECT group_concat(provider || ':' || handle, ' ') FROM external_accounts a WHERE a.contributor_id = c.id) AS accounts,
      (SELECT group_concat(category_key || ':' || status, ' ') FROM category_memberships m WHERE m.contributor_id = c.id) AS categories, c.created_at
      FROM contributors c WHERE c.merged_into IS NULL ORDER BY c.id`).all();
    const headers = ['id', 'display_name', 'visibility', 'consent_public', 'consent_link', 'link_url', 'accounts', 'categories', 'created_at'];
    return new Response(toCsv(headers, results || []), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="credits-contributors.csv"', ...NO_STORE } });
  }
  const dump = { exported_at: now(), tables: {} };
  for (const t of EXPORT_TABLES) dump.tables[t] = (await env.DB.prepare(`SELECT * FROM ${t}`).all()).results || [];
  return new Response(JSON.stringify(dump), { headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="credits-backup.json"', ...NO_STORE } });
}

export async function auditLog(env, url) {
  const entity = url.searchParams.get('entity'), eid = url.searchParams.get('id');
  const where = [], bind = [];
  if (entity) { where.push('entity = ?'); bind.push(entity); }
  if (eid) { where.push('entity_id = ?'); bind.push(eid); }
  const { results } = await env.DB.prepare(`SELECT * FROM audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 300`).bind(...bind).all();
  return ok({ entries: results || [] });
}

export async function integrations(env) {
  const { results } = await env.DB.prepare('SELECT * FROM integrations ORDER BY provider').all();
  return ok({ integrations: results || [], capabilities: {
    beans_feed: 'AUTOMATIC — reads the public feed; daily history copy by cron.',
    x_supporters: 'MANUAL — no official X API endpoint lists paid subscribers. Add people or import a CSV.',
    x_creators: 'MANUAL — no official X API endpoint lists who you subscribe to. Curate in Creators.',
    youtube: 'VOLUNTARY — viewers opt in at /credits/join; labelled self-reported. OAuth verification is not enabled.',
  } });
}
export async function checkIntegration(env, provider) {
  if (provider !== 'beans_feed') fail(422, 'Only the Beans feed can be checked automatically; the others are manual by design.');
  const r = await liveFeed(env);
  return ok({ ok: !!r, integration: await env.DB.prepare('SELECT * FROM integrations WHERE provider = ?').bind(provider).first() });
}

