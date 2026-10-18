// BEANS ADAPTER — read-only view of the existing Beans economy.
// Source of truth: STOOPIDshow/beans-feed/beans-leaderboard.json, written nightly by the STOOPID_VAULT tally.
// This module never computes, awards or edits Beans. It reads, moderates names for display, freezes
// snapshots for episodes, and records daily copies so weekly/monthly views can exist from real data.

import { cleanText, normalizeHandle } from '../../credits/engine/util.js';
import { now, fail, setIntegration, getSettings } from './lib.js';

export const DEFAULT_FEED_URL = 'https://raw.githubusercontent.com/STOOPIDshow/beans-feed/main/beans-leaderboard.json';
const GH_COMMITS = 'https://api.github.com/repos/STOOPIDshow/beans-feed/commits?path=beans-leaderboard.json&per_page=100';
const GH_RAW = (sha) => `https://raw.githubusercontent.com/STOOPIDshow/beans-feed/${sha}/beans-leaderboard.json`;

/** Validate and normalise a feed document. Throws on anything malformed — never guesses. */
export function parseFeed(doc) {
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.top)) throw new Error('feed has no "top" array');
  const entries = doc.top.map((p, i) => {
    const handle = normalizeHandle(p.h);
    if (!handle || !/^[a-z0-9_]{1,30}$/.test(handle)) throw new Error(`feed row ${i + 1}: bad handle`);
    const life = Number(p.life), pos = Number(p.pos);
    if (!Number.isInteger(life) || life < 0) throw new Error(`feed row ${i + 1}: bad Beans total`);
    if (!Number.isInteger(pos) || pos < 1) throw new Error(`feed row ${i + 1}: bad position`);
    return { pos, handle, display: '@' + cleanText(String(p.h).replace(/^@/, ''), 30), beans: life,
      balance: Number.isInteger(p.bal) ? p.bal : null, streak: Number.isInteger(p.streak) ? p.streak : null, title: cleanText(p.title || '', 40) };
  }).sort((a, b) => a.pos - b.pos);
  return { asof: String(doc.asof || '').slice(0, 10) || null, updated: doc.updated ? String(doc.updated).slice(0, 40) : null,
    players: Number.isInteger(doc.players) ? doc.players : entries.length, totalBeans: Number.isInteger(doc.beans) ? doc.beans : null, entries };
}

export async function fetchFeed(env) {
  const url = env.BEANS_FEED_URL || DEFAULT_FEED_URL;
  let res;
  try { res = await fetch(url, { headers: { 'user-agent': 'stoopid-credits' }, cf: { cacheTtl: 300 } }); }
  catch (e) { throw new Error(`Beans feed unreachable: ${e.message}`); }
  if (!res.ok) throw new Error(`Beans feed returned HTTP ${res.status}`);
  let doc;
  try { doc = await res.json(); } catch { throw new Error('Beans feed is not valid JSON'); }
  return { feed: parseFeed(doc), raw: doc };
}

/** Fetch + record integration health. Returns null (and records the error) instead of throwing. */
export async function liveFeed(env) {
  try {
    const r = await fetchFeed(env);
    await setIntegration(env, 'beans_feed', true, `Feed as of ${r.feed.asof} · ${r.feed.players} players`);
    return r;
  } catch (e) {
    await setIntegration(env, 'beans_feed', false, e.message);
    return null;
  }
}

/** Apply display moderation. Positions are never renumbered: the feed's pos is the truth. */
export function moderate(entries, rules, settings) {
  const map = new Map(rules.map((r) => [r.handle, r]));
  const block = (settings.name_blocklist || []).map((w) => String(w).toLowerCase()).filter(Boolean);
  return entries.map((e) => {
    const rule = map.get(e.handle);
    if (rule?.status === 'excluded') return { ...e, excluded: true, exclusionReason: rule.reason || 'excluded by moderation' };
    if (rule?.status === 'approved') return { ...e, excluded: false };
    if (block.some((w) => e.handle.includes(w))) return { ...e, excluded: true, exclusionReason: 'flagged by name filter — awaiting review', flagged: true };
    if (!settings.beans_auto_approve) return { ...e, excluded: true, exclusionReason: 'awaiting name review', flagged: true };
    return { ...e, excluded: false };
  });
}

export async function moderatedLive(env) {
  const r = await liveFeed(env);
  if (!r) return null;
  const settings = await getSettings(env);
  const { results: rules } = await env.DB.prepare('SELECT handle, status, reason FROM beans_name_rules').all();
  const links = await linkedContributors(env, r.feed.entries.map((e) => e.handle));
  const entries = moderate(r.feed.entries, rules || [], settings).map((e) => ({ ...e, contributorId: links.get(e.handle) ?? null }));
  return { ...r.feed, entries };
}

/** Beans players are 𝕏 handles; link to a contributor when one owns that handle. */
export async function linkedContributors(env, handles) {
  const map = new Map();
  if (!handles.length) return map;
  const qs = handles.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT a.handle, COALESCE(c.merged_into, c.id) AS cid FROM external_accounts a JOIN contributors c ON c.id = a.contributor_id WHERE a.provider = 'x' AND a.handle IN (${qs})`).bind(...handles).all();
  for (const r of results || []) map.set(r.handle, r.cid);
  return map;
}

export async function recordHistory(env, feed, raw, source) {
  if (!feed.asof) return false;
  const r = await env.DB.prepare('INSERT OR IGNORE INTO beans_feed_history (asof, updated, players, total_beans, raw_json, source, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(feed.asof, feed.updated, feed.players, feed.totalBeans, JSON.stringify(raw), source, now()).run();
  return (r.meta?.changes || 0) > 0;
}

/** Import every past version of the feed from its public git history. */
export async function backfillHistory(env) {
  const res = await fetch(GH_COMMITS, { headers: { 'user-agent': 'stoopid-credits', accept: 'application/vnd.github+json' } });
  if (!res.ok) fail(502, `GitHub returned HTTP ${res.status} listing feed history.`);
  const commits = await res.json();
  let added = 0, seen = 0;
  const errors = [];
  for (const c of commits) {
    seen++;
    try {
      const r = await fetch(GH_RAW(c.sha), { headers: { 'user-agent': 'stoopid-credits' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const raw = await r.json();
      if (await recordHistory(env, parseFeed(raw), raw, `backfill:${c.sha.slice(0, 7)}`)) added++;
    } catch (e) { errors.push(`${c.sha.slice(0, 7)}: ${e.message}`); }
  }
  return { commits: seen, added, errors };
}

/** Freeze the current moderated leaderboard. Immutable once written; corrections supersede. */
export async function takeSnapshot(env, { episodeId = null, topN, actor, supersedes = null, reason = null }) {
  const live = await moderatedLive(env);
  if (!live) fail(502, 'Could not read the Beans feed, so no snapshot was taken. Nothing was changed.');
  const t = now();
  const ins = await env.DB.prepare('INSERT INTO leaderboard_snapshots (episode_id, period, feed_asof, feed_updated, feed_players, top_n, supersedes, reason, raw_json, taken_by, taken_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(episodeId, 'all', live.asof, live.updated, live.players, topN, supersedes, reason, JSON.stringify(live.entries), actor, t).run();
  const id = ins.meta.last_row_id;
  const stmts = live.entries.map((e) => {
    const tied = live.entries.some((o) => o !== e && o.beans === e.beans) ? 1 : 0;
    return env.DB.prepare('INSERT INTO leaderboard_snapshot_entries (snapshot_id, pos, handle, display_name, beans, tied, excluded, exclusion_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, e.pos, e.handle, e.display, e.beans, tied, e.excluded ? 1 : 0, e.exclusionReason || null);
  });
  if (stmts.length) await env.DB.batch(stmts);
  return { id, asof: live.asof, entries: live.entries.length };
}

export async function snapshotLeaderboard(env, snapshotId, topN) {
  const snap = await env.DB.prepare('SELECT * FROM leaderboard_snapshots WHERE id = ?').bind(snapshotId).first();
  if (!snap) return null;
  const { results } = await env.DB.prepare('SELECT * FROM leaderboard_snapshot_entries WHERE snapshot_id = ? ORDER BY pos').bind(snapshotId).all();
  const links = await linkedContributors(env, (results || []).map((r) => r.handle));
  return { asof: snap.feed_asof, topN: topN || snap.top_n, snapshotId: snap.id,
    entries: (results || []).map((r) => ({ pos: r.pos, handle: r.handle, display: r.display_name, beans: r.beans, excluded: !!r.excluded, exclusionReason: r.exclusion_reason, contributorId: links.get(r.handle) ?? null })) };
}

/**
 * Leaders over a period, from recorded daily copies only. Returns available:false (with the date
 * collection started) when history doesn't reach back far enough — earlier results are never invented.
 */
export async function periodLeaders(env, days, topN = 10) {
  const latest = await env.DB.prepare('SELECT asof, raw_json FROM beans_feed_history ORDER BY asof DESC LIMIT 1').first();
  const first = await env.DB.prepare('SELECT asof FROM beans_feed_history ORDER BY asof ASC LIMIT 1').first();
  if (!latest) return { available: false, reason: 'No Beans history recorded yet.', collectingSince: null };
  const cutoff = new Date(Date.parse(latest.asof + 'T00:00:00Z') - days * 86400000).toISOString().slice(0, 10);
  const base = await env.DB.prepare('SELECT asof, raw_json FROM beans_feed_history WHERE asof <= ? ORDER BY asof DESC LIMIT 1').bind(cutoff).first();
  if (!base) return { available: false, reason: `Needs a recorded copy from on or before ${cutoff}.`, collectingSince: first.asof };
  const now_ = parseFeed(JSON.parse(latest.raw_json)), then = parseFeed(JSON.parse(base.raw_json));
  const before = new Map(then.entries.map((e) => [e.handle, e.beans]));
  const settings = await getSettings(env);
  const { results: rules } = await env.DB.prepare('SELECT handle, status, reason FROM beans_name_rules').all();
  const rows = moderate(now_.entries, rules || [], settings).filter((e) => !e.excluded)
    .map((e) => ({ handle: e.handle, display: e.display, beans: e.beans - (before.get(e.handle) || 0) }))
    .filter((e) => e.beans > 0).sort((a, b) => b.beans - a.beans || a.handle.localeCompare(b.handle));
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.beans !== prev) { rank = i + 1; prev = r.beans; } r.rank = rank; });
  return { available: true, from: base.asof, to: latest.asof, leaders: rows.slice(0, topN) };
}
