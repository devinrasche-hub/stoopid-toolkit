// Data assembly: database rows → Fair Recognition Engine input → sequence; and public redaction.

import { selectCredits } from '../../credits/engine/selection.js';
import { buildSequence, creditedPeople } from '../../credits/engine/sequence.js';
import { safeUrl } from '../../credits/engine/util.js';
import { getSettings } from './lib.js';
import { moderatedLive, snapshotLeaderboard } from './beans.js';

export const sampleFilter = (env, alias = 'c') => (env.ALLOW_SAMPLE === '1' ? '1=1' : `${alias}.is_sample = 0`);

export async function categories(env) {
  const { results } = await env.DB.prepare('SELECT * FROM credit_categories ORDER BY sort_order, key').all();
  return results || [];
}

export function parseDraft(ep) {
  try { const d = JSON.parse(ep.draft_json || '{}'); return d && typeof d === 'object' ? d : {}; } catch { return {}; }
}

/** All people with memberships and fairness history, as the selection engine expects. */
export async function loadPeople(env, beforeEpisodeNumber) {
  const { results: cs } = await env.DB.prepare(`SELECT id, display_name, visibility, consent_public, link_url, link_approved, consent_link FROM contributors c WHERE merged_into IS NULL AND ${sampleFilter(env)}`).all();
  const { results: ms } = await env.DB.prepare('SELECT * FROM category_memberships').all();
  const { results: xs } = await env.DB.prepare("SELECT contributor_id, provider, handle FROM external_accounts WHERE provider IN ('x','youtube')").all();
  const { results: ap } = await env.DB.prepare('SELECT contributor_id, MAX(episode_number) AS last, COUNT(DISTINCT episode_number) AS n FROM episode_appearances WHERE episode_number < ? GROUP BY contributor_id').bind(beforeEpisodeNumber ?? 1e9).all();
  const byId = new Map();
  for (const c of cs || []) byId.set(c.id, { id: c.id, name: c.display_name, visibility: c.visibility, consentPublic: c.consent_public,
    link: c.consent_link && c.link_approved ? safeUrl(c.link_url) : null, handles: {}, memberships: [], lastShown: null, timesShown: 0 });
  for (const m of ms || []) { const p = byId.get(m.contributor_id); if (p) p.memberships.push({ category: m.category_key, status: m.status, featured: m.featured, sortOrder: m.sort_order, label: m.label, reason: m.reason, since: m.since, verification: m.verification }); }
  for (const x of xs || []) { const p = byId.get(x.contributor_id); if (p && !p.handles[x.provider]) p.handles[x.provider] = x.handle; }
  for (const a of ap || []) { const p = byId.get(a.contributor_id); if (p) { p.lastShown = a.last; p.timesShown = a.n; } }
  return [...byId.values()];
}

/** Build the selection + sequence for an episode from its draft. Nothing is saved. */
export async function buildForEpisode(env, ep, draftOverride) {
  const settings = await getSettings(env);
  const draft = { ...parseDraft(ep), ...(draftOverride || {}) };
  const cats = await categories(env);
  const people = await loadPeople(env, ep.number);
  const { results: cr } = await env.DB.prepare('SELECT contributor_id, category_key, role FROM contributions WHERE episode_id = ?').bind(ep.id).all();
  const contributions = (cr || []).map((r) => ({ contributorId: r.contributor_id, category: r.category_key, role: r.role, episodeNumber: ep.number }));
  const topN = Number(draft.topN || settings.leaderboard_top_n || 5);

  let leaderboard = null, leaderboardSource = 'none';
  if (ep.snapshot_id) { leaderboard = await snapshotLeaderboard(env, ep.snapshot_id, topN); leaderboardSource = 'snapshot'; }
  else if (cats.some((c) => c.kind === 'leaderboard' && c.enabled)) {
    const live = await moderatedLive(env);
    if (live) { leaderboard = { asof: live.asof, topN, entries: live.entries }; leaderboardSource = 'live'; }
    else leaderboardSource = 'unavailable';
  }
  if (leaderboard) leaderboard.topN = topN;

  const seed = String(draft.seed || `ep${ep.number}`);
  const selection = selectCredits({ episode: { number: ep.number }, categories: cats, people, contributions, leaderboard,
    overrides: { include: draft.include || [], exclude: draft.exclude || [] }, seed, dedupe: settings.dedupe !== false });
  const timing = { ...settings.timing, ...(draft.timing || {}), theme: draft.timing?.theme || ep.theme || settings.timing.theme };
  const jokes = (await env.DB.prepare('SELECT id, text, themes, enabled FROM jokes').all()).results || [];
  const { sequence, warnings } = buildSequence(selection, ep, timing, { categories: cats, jokes, seed });
  if (leaderboardSource === 'live') warnings.unshift('Arcade rankings are LIVE in this preview. Freeze a snapshot before finalising (finalising freezes one automatically).');
  if (leaderboardSource === 'unavailable') warnings.unshift('The Beans feed could not be read; THE BEAN COUNTERS were left out of this preview.');
  return { selection, sequence, warnings: [...selection.warnings, ...warnings], leaderboardSource, draft };
}

/** Contributor ids whose names may currently appear publicly (follows merges). */
export async function publicIdSet(env) {
  const { results } = await env.DB.prepare(`SELECT c.id, t.visibility AS tv, t.consent_public AS tc, c.visibility AS v, c.consent_public AS cp, c.merged_into
    FROM contributors c LEFT JOIN contributors t ON t.id = c.merged_into WHERE ${sampleFilter(env)}`).all();
  const s = new Set();
  for (const r of results || []) {
    const vis = r.merged_into ? r.tv : r.v, cons = r.merged_into ? r.tc : r.cp;
    if (vis === 'public' && cons) s.add(r.id);
  }
  return s;
}

/** Withdrawal is honoured at read time: archived versions stay immutable, public output drops withdrawn people. */
export const WITHDRAWN = 'withdrew recognition';

export async function withdrawnHandles(env) {
  const { results } = await env.DB.prepare("SELECT handle FROM beans_name_rules WHERE status = 'excluded' AND reason = ?").bind(WITHDRAWN).all();
  return new Set((results || []).map((r) => r.handle));
}

export function redactSequence(seq, allowed, withdrawn = new Set()) {
  const out = structuredClone(seq);
  let removed = 0;
  for (const seg of out.segments) for (const p of seg.pages) {
    const before = p.items.length;
    p.items = p.items.filter((it) => (it.id == null || allowed.has(it.id)) && !(seg.kind === 'leaderboard' && withdrawn.has(it.handle)));
    removed += before - p.items.length;
  }
  return { sequence: out, removed };
}

export function publicCredits(seq, allowed, withdrawn) {
  return creditedPeople(redactSequence(seq, allowed, withdrawn).sequence).map(({ id, ...rest }) => rest);
}
