// PUBLIC ENDPOINTS — only approved, consented information ever leaves through here.

import { cleanText, normalizeHandle, safeUrl, shuffle, graphemes } from '../../credits/engine/util.js';
import { json, fail, readJson, bool, oneOf, now, ipHash, rateLimit, randomToken, sha256hex, getSettings, audit } from './lib.js';
import { moderatedLive, periodLeaders } from './beans.js';
import { enabled as ytEnabled } from './youtube.js';
import { publicIdSet, redactSequence, publicCredits, withdrawnHandles, sampleFilter, WITHDRAWN } from './data.js';

const PUBLIC_CACHE = { 'cache-control': 'public, max-age=60' };

/** SELECT fragment: contributors who may be named publicly. */
const PUBLIC_WHERE = (env) => `c.merged_into IS NULL AND c.visibility = 'public' AND c.consent_public = 1 AND ${sampleFilter(env)}`;
const link = (r) => (r.consent_link && r.link_approved ? safeUrl(r.link_url) : null);

export async function hall(env) {
  const settings = await getSettings(env);
  const day = new Date().toISOString().slice(0, 10);
  const { results: people } = await env.DB.prepare(`SELECT c.id, c.display_name, c.link_url, c.consent_link, c.link_approved, m.category_key, m.verification
    FROM contributors c JOIN category_memberships m ON m.contributor_id = c.id AND m.status = 'active'
    WHERE ${PUBLIC_WHERE(env)} AND m.category_key IN (SELECT key FROM credit_categories WHERE enabled = 1 AND kind IN ('rotating','curated','episode'))`).all();
  const byId = new Map();
  for (const r of people || []) {
    const p = byId.get(r.id) || { name: r.display_name, link: link(r), categories: [], selfReported: false };
    p.categories.push(r.category_key);
    if (r.verification === 'self_reported') p.selfReported = true;
    byId.set(r.id, p);
  }
  const anon = await env.DB.prepare(`SELECT COUNT(DISTINCT c.id) AS n FROM contributors c JOIN category_memberships m ON m.contributor_id = c.id AND m.status='active'
    WHERE c.merged_into IS NULL AND c.visibility = 'anonymous' AND c.consent_public = 1 AND ${sampleFilter(env)}`).first();
  const supporters = shuffle([...byId.values()], 'hall:' + day).slice(0, settings.hall_supporters_shown || 24);
  const live = await moderatedLive(env);
  return json({
    supporters, supporterCount: byId.size, anonymousCount: anon?.n || 0,
    creators: (await creatorRows(env)).filter((c) => c.featured).slice(0, 6),
    spotlight: await currentSpotlight(env),
    beans: live ? { asof: live.asof, updated: live.updated, players: live.players, totalBeans: live.totalBeans,
      top: live.entries.filter((e) => !e.excluded).slice(0, 10).map(({ pos, display, beans }) => ({ pos, name: display, beans })) } : null,
    hallOfFame: (await fameRows(env)).slice(0, 6),
    episodes: (await episodeRows(env)).slice(0, 6),
    categories: (await env.DB.prepare('SELECT key, name, tagline, kind FROM credit_categories WHERE enabled = 1 AND public_section = 1 ORDER BY sort_order').all()).results,
    links: settings.links, joinOpen: !!settings.join_open,
  }, 200, PUBLIC_CACHE);
}

async function creatorRows(env) {
  const { results } = await env.DB.prepare(`SELECT c.id, c.display_name, c.bio, c.link_url, c.consent_link, c.link_approved, c.avatar_url, m.featured, m.sort_order, m.label, m.reason,
      (SELECT handle FROM external_accounts a WHERE a.contributor_id = c.id AND a.provider = 'x' LIMIT 1) AS x
    FROM contributors c JOIN category_memberships m ON m.contributor_id = c.id AND m.category_key = 'mutual_enablers' AND m.status = 'active'
    WHERE ${PUBLIC_WHERE(env)} ORDER BY m.featured DESC, m.sort_order, c.display_name`).all();
  const { results: apps } = await env.DB.prepare('SELECT a.contributor_id, a.episode_number FROM episode_appearances a JOIN episodes e ON e.id = a.episode_id JOIN credit_versions v ON v.id = a.version_id AND v.revision = e.current_version').all();
  const eps = new Map();
  for (const a of apps || []) { if (!eps.has(a.contributor_id)) eps.set(a.contributor_id, new Set()); eps.get(a.contributor_id).add(a.episode_number); }
  return (results || []).map((r) => ({
    name: r.display_name, handle: r.x || null, xUrl: r.x ? `https://x.com/${encodeURIComponent(r.x)}` : null,
    link: link(r), bio: r.bio || '', work: r.label || '', reason: r.reason || '', featured: !!r.featured,
    avatar: r.consent_link ? safeUrl(r.avatar_url) : null, episodes: [...(eps.get(r.id) || [])].sort((a, b) => a - b),
  }));
}

export async function creators(env) { return json({ creators: await creatorRows(env) }, 200, PUBLIC_CACHE); }

async function currentSpotlight(env) {
  const day = new Date().toISOString().slice(0, 10);
  const { results } = await env.DB.prepare(`SELECT s.id, s.headline, s.body, c.display_name, c.link_url, c.consent_link, c.link_approved FROM community_spotlights s
    JOIN contributors c ON c.id = s.contributor_id
    WHERE s.active = 1 AND (s.starts_on IS NULL OR s.starts_on <= ?) AND (s.ends_on IS NULL OR s.ends_on >= ?) AND ${PUBLIC_WHERE(env)} ORDER BY s.id`).bind(day, day).all();
  if (!results || !results.length) return null;
  const week = Math.floor(Date.now() / (7 * 86400000));                  // rotates weekly among active spotlights
  const s = results[week % results.length];
  return { name: s.display_name, headline: s.headline, body: s.body || '', link: link(s), rotation: results.length };
}

async function fameRows(env) {
  const allowed = await publicIdSet(env);
  const { results } = await env.DB.prepare(`SELECT h.*, c.display_name FROM hall_of_fame h LEFT JOIN contributors c ON c.id = h.contributor_id
    WHERE h.visible = 1 ORDER BY h.season DESC, h.sort_order, h.achieved_on DESC`).all();
  return (results || []).filter((h) => h.contributor_id == null || allowed.has(h.contributor_id))
    .map((h) => ({ honoree: h.contributor_id ? h.display_name : h.honoree, title: h.title, description: h.description || '', season: h.season, achievedOn: h.achieved_on }));
}

export async function hallOfFame(env) {
  const champions = await champs(env);
  return json({ entries: await fameRows(env), beanChampions: champions }, 200, PUBLIC_CACHE);
}

/** #1 of every finalised episode snapshot: historical champions from real frozen data. */
async function champs(env) {
  const { results } = await env.DB.prepare(`SELECT e.number, e.title, s.feed_asof, x.display_name, x.beans FROM episodes e
    JOIN leaderboard_snapshots s ON s.id = e.snapshot_id
    JOIN leaderboard_snapshot_entries x ON x.snapshot_id = s.id AND x.excluded = 0
    WHERE e.status = 'final' AND x.pos = (SELECT MIN(pos) FROM leaderboard_snapshot_entries y WHERE y.snapshot_id = s.id AND y.excluded = 0)
    ORDER BY e.number DESC`).all();
  const withdrawn = await withdrawnHandles(env);
  return (results || []).filter((r) => !withdrawn.has(r.display_name.replace(/^@/, '').toLowerCase()))
    .map((r) => ({ episode: r.number, title: r.title, asof: r.feed_asof, name: r.display_name, beans: r.beans }));
}

export function episodeLabel(fmt, e) {
  return String(fmt || 'EP {number} — {title}').replace(/\{number\}/g, String(e.number)).replace(/\{title\}/g, e.title).replace(/\{season\}/g, String(e.season ?? 1));
}

async function episodeRows(env) {
  const fmt = (await getSettings(env)).episode_title_format;
  const { results } = await env.DB.prepare(`SELECT e.number, e.title, e.season, e.published_on, e.episode_url, e.current_version, v.created_at AS finalized_at
    FROM episodes e JOIN credit_versions v ON v.episode_id = e.id AND v.revision = e.current_version
    WHERE e.status = 'final' ORDER BY e.number DESC`).all();
  return (results || []).map((r) => ({ number: r.number, title: r.title, label: episodeLabel(fmt, r), season: r.season, publishedOn: r.published_on, url: safeUrl(r.episode_url), revision: r.current_version, finalizedAt: r.finalized_at }));
}

export async function episodes(env, url) {
  const settings = await getSettings(env);
  if (!settings.archive_public) return json({ episodes: [], hidden: true }, 200, PUBLIC_CACHE);
  const q = cleanText(url.searchParams.get('q') || '', 60).toLowerCase();
  let rows = await episodeRows(env);
  if (q) {
    const allowed = await publicIdSet(env), withdrawn = await withdrawnHandles(env);
    const { results } = await env.DB.prepare(`SELECT e.number, v.sequence_json FROM episodes e JOIN credit_versions v ON v.episode_id = e.id AND v.revision = e.current_version WHERE e.status = 'final'`).all();
    const hits = new Map();
    for (const r of results || []) {
      const names = publicCredits(JSON.parse(r.sequence_json), allowed, withdrawn).map((p) => p.name);
      const m = names.filter((n) => n.toLowerCase().includes(q));
      if (m.length) hits.set(r.number, m);
    }
    rows = rows.filter((e) => hits.has(e.number) || e.title.toLowerCase().includes(q) || String(e.number) === q).map((e) => ({ ...e, matches: hits.get(e.number) || [] }));
  }
  return json({ episodes: rows, query: q || null }, 200, PUBLIC_CACHE);
}

async function finalVersion(env, number, revision) {
  const ep = await env.DB.prepare("SELECT * FROM episodes WHERE number = ? AND status = 'final'").bind(number).first();
  if (!ep) fail(404, 'No finalised credits for that episode.');
  const rev = revision || ep.current_version;
  const v = await env.DB.prepare('SELECT * FROM credit_versions WHERE episode_id = ? AND revision = ?').bind(ep.id, rev).first();
  if (!v) fail(404, 'No such revision.');
  return { ep, v };
}

export async function episode(env, number, url) {
  const settings = await getSettings(env);
  if (!settings.archive_public) fail(404, 'The archive is not public.');
  const { ep, v } = await finalVersion(env, number, Number(url.searchParams.get('rev')) || null);
  const allowed = await publicIdSet(env), withdrawn = await withdrawnHandles(env);
  const seq = JSON.parse(v.sequence_json);
  const { sequence, removed } = redactSequence(seq, allowed, withdrawn);
  const sections = sequence.segments.filter((s) => s.key).map((s) => ({ key: s.key, title: s.title, subtitle: s.subtitle, kind: s.kind, asof: s.asof || null, note: s.note || '',
    people: s.pages.flatMap((p) => p.items).filter((i) => !i.more).map((i) => ({ name: i.fullName || i.name, role: i.role || null, rank: i.rank ?? null, pos: i.pos ?? null, beans: i.beans ?? null, handle: s.kind === 'creators' || s.kind === 'leaderboard' ? i.handle || null : null, anonymous: !!i.anon })) }));
  const { results: revs } = await env.DB.prepare('SELECT revision, reason, created_at FROM credit_versions WHERE episode_id = ? ORDER BY revision').bind(ep.id).all();
  return json({ episode: { number: ep.number, title: ep.title, label: episodeLabel(settings.episode_title_format, ep), season: ep.season, publishedOn: ep.published_on, url: safeUrl(ep.episode_url) },
    revision: v.revision, finalizedAt: v.created_at, theme: seq.theme, duration: seq.duration, sections, redacted: removed,
    revisions: revs.map((r) => ({ revision: r.revision, reason: r.reason, at: r.created_at })) }, 200, PUBLIC_CACHE);
}

export async function episodeSequence(env, number, url) {
  const { v } = await finalVersion(env, number, Number(url.searchParams.get('rev')) || null);
  const allowed = await publicIdSet(env), withdrawn = await withdrawnHandles(env);
  const { sequence } = redactSequence(JSON.parse(v.sequence_json), allowed, withdrawn);
  for (const seg of sequence.segments) for (const p of seg.pages) for (const it of p.items) { delete it.id; delete it.cid; }
  return json({ revision: v.revision, sequence }, 200, PUBLIC_CACHE);
}

export async function beans(env, url) {
  const period = oneOf(url.searchParams.get('period') || 'all', ['all', 'week', 'month'], 'all');
  const settings = await getSettings(env);
  if (period === 'all') {
    const live = await moderatedLive(env);
    if (!live) return json({ period, available: false, reason: 'The Beans feed is unreachable right now.' }, 200);
    return json({ period, available: true, asof: live.asof, updated: live.updated, players: live.players,
      leaders: live.entries.filter((e) => !e.excluded).map(({ pos, display, beans }) => {
        const tiedWith = live.entries.filter((o) => o.beans === beans);
        return { rank: Math.min(...tiedWith.map((o) => o.pos)), pos, name: display, beans, tied: tiedWith.length > 1 };
      }) }, 200, PUBLIC_CACHE);
  }
  const r = await periodLeaders(env, period === 'week' ? 7 : 30, 10);
  return json({ period, ...r, leaders: (r.leaders || []).map((l) => ({ rank: l.rank, name: l.display, beans: l.beans })) }, 200, PUBLIC_CACHE);
}

// ── the opt-in form ─────────────────────────────────────────────────────────
export const CONTRIBUTION_TYPES = ['x_supporter', 'youtube_witness', 'arcade', 'creative', 'emotional_support', 'other'];
const PLATFORMS = ['x', 'youtube', 'web', 'other'];

export async function join(req, env) {
  const settings = await getSettings(env);
  if (!settings.join_open) fail(403, 'Recognition requests are closed right now.');
  const b = await readJson(req);
  if (b.website) return json({ ok: true, ref: 'CR-' + randomToken(8), key: randomToken(20) });   // honeypot: look normal, save nothing
  if (!(Number(b.elapsed_ms) >= 3000)) fail(422, 'That was fast. Take a breath and submit again.');
  if (!bool(b.age_ok)) fail(422, 'Please confirm you are 13 or older. If you are younger, ask a parent or guardian to contact the show instead.');
  const name = cleanText(b.display_name, 60);
  if (graphemes(name).length < 1) fail(422, 'A credit name is required.', { field: 'display_name' });
  const contribution = oneOf(b.contribution, CONTRIBUTION_TYPES, null);
  if (!contribution) fail(422, 'Choose what kind of contribution this is.', { field: 'contribution' });
  const platform = b.platform ? oneOf(b.platform, PLATFORMS, null) : null;
  const handle = b.handle ? normalizeHandle(b.handle) : null;
  if (handle && !/^[a-z0-9_.-]{1,60}$/.test(handle)) fail(422, 'That handle has characters platforms don’t allow.', { field: 'handle' });
  const profileUrl = b.profile_url ? safeUrl(b.profile_url) : null;
  if (b.profile_url && !profileUrl) fail(422, 'Profile links must start with https://', { field: 'profile_url' });
  const note = cleanText(b.note || '', 280);
  const clientKey = b.client_key ? String(b.client_key).replace(/[^\w-]/g, '').slice(0, 64) : null;

  const iph = await ipHash(req, env);
  if (clientKey) {
    const dup = await env.DB.prepare('SELECT ref FROM submissions WHERE client_key = ?').bind(clientKey).first();
    if (dup) return json({ ok: true, ref: dup.ref, duplicate: true });
  }
  if (!(await rateLimit(env, 'join', iph, 5))) fail(429, 'Too many requests from here this hour. The department is pacing itself.');

  const ref = 'CR-' + randomToken(8), key = randomToken(20);
  await env.DB.prepare(`INSERT INTO submissions (ref, kind, display_name, platform, handle, profile_url, contribution, consent_public, consent_link, note, key_hash, client_key, iph, created_at)
    VALUES (?, 'join', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(ref, name, platform, handle, profileUrl, contribution, bool(b.consent_public), bool(b.consent_link), note || null, await sha256hex(ref + ':' + key), clientKey, '', now()).run();   // IP hash used for rate limiting only, not stored with the request
  return json({ ok: true, ref, key }, 201);
}

export async function verifyKey(env, ref, key) {
  ref = String(ref || '').trim().toUpperCase(); key = String(key || '').trim().toUpperCase();
  const s = await env.DB.prepare('SELECT * FROM submissions WHERE ref = ?').bind(ref).first();
  if (!s || s.key_hash !== (await sha256hex(ref + ':' + key))) fail(404, 'That reference and key don’t match a request.');
  return s;
}

/** Withdrawal takes effect immediately — no review needed to stop being named. */
export async function withdraw(req, env) {
  const b = await readJson(req);
  if (!(await rateLimit(env, 'withdraw', await ipHash(req, env), 10))) fail(429, 'Too many attempts this hour.');
  const s = await verifyKey(env, b.ref, b.key);
  await env.DB.prepare("UPDATE submissions SET status = 'withdrawn' WHERE ref = ? OR parent_ref = ?").bind(s.ref, s.ref).run();
  if (s.contributor_id) {
    const t = now();
    await env.DB.prepare("UPDATE contributors SET visibility = 'private', consent_public = 0, consent_link = 0, updated_at = ? WHERE id = ?").bind(t, s.contributor_id).run();
    await env.DB.prepare("INSERT INTO recognition_consents (contributor_id, consent_public, consent_link, visibility, source, note, recorded_by, recorded_at) VALUES (?, 0, 0, 'private', 'withdrawal', ?, 'self', ?)").bind(s.contributor_id, `via ${s.ref}`, t).run();
    const { results } = await env.DB.prepare("SELECT handle FROM external_accounts WHERE contributor_id = ? AND provider = 'x'").bind(s.contributor_id).all();
    for (const r of results || []) {
      await env.DB.prepare("INSERT INTO beans_name_rules (handle, status, reason, updated_by, updated_at) VALUES (?, 'excluded', ?, 'self', ?) ON CONFLICT(handle) DO UPDATE SET status='excluded', reason=excluded.reason, updated_by='self', updated_at=excluded.updated_at").bind(r.handle, WITHDRAWN, t).run();
    }
  }
  await audit(env, 'self', 'withdraw', 'submission', s.ref, { contributor: s.contributor_id ?? null });
  return json({ ok: true, withdrawn: true });
}

/** Changes (new name, link, note) go back through review. */
export async function update(req, env) {
  const b = await readJson(req);
  if (!(await rateLimit(env, 'update', await ipHash(req, env), 10))) fail(429, 'Too many attempts this hour.');
  const s = await verifyKey(env, b.ref, b.key);
  if (s.status === 'withdrawn') fail(409, 'This request was withdrawn. Send a new one if you’d like to be credited again.');
  const name = cleanText(b.display_name || s.display_name, 60);
  const profileUrl = b.profile_url ? safeUrl(b.profile_url) : s.profile_url;
  if (b.profile_url && !profileUrl) fail(422, 'Profile links must start with https://');
  const ref = 'CR-' + randomToken(8);
  await env.DB.prepare(`INSERT INTO submissions (ref, kind, display_name, platform, handle, profile_url, contribution, consent_public, consent_link, note, key_hash, parent_ref, contributor_id, iph, created_at)
    VALUES (?, 'update', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(ref, name, s.platform, s.handle, profileUrl, s.contribution, b.consent_public == null ? s.consent_public : bool(b.consent_public),
      b.consent_link == null ? s.consent_link : bool(b.consent_link), cleanText(b.note || '', 280) || null, s.key_hash, s.ref, s.contributor_id, '', now()).run();
  return json({ ok: true, ref: s.ref, updateRef: ref, status: 'pending review' }, 201);
}

export async function status(req, env) {
  const b = await readJson(req);
  if (!(await rateLimit(env, 'status', await ipHash(req, env), 20))) fail(429, 'Too many attempts this hour.');
  const s = await verifyKey(env, b.ref, b.key);
  return json({ ok: true, ref: s.ref, status: s.status, displayName: s.display_name, submittedAt: s.created_at, youtube: s.yt_status || null });
}

export async function config(env) {
  const settings = await getSettings(env);
  return json({ joinOpen: !!settings.join_open, youtubeVerify: ytEnabled(env) }, 200, PUBLIC_CACHE);
}
