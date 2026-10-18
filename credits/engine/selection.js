// THE FAIR RECOGNITION ENGINE.
// Rules, not rankings: no engagement scores, no AI, nothing opaque. Every decision lands in the report
// with a plain-language reason so the producer can see who is in, who is deferred, and why.
//
// Input (built by the Worker from the database):
//   episode      { number }
//   categories   [{ key, name, tagline, kind, enabled, cap, sort_order }]
//   people       [{ id, name, visibility, consentPublic, handles:{x,youtube}, link,
//                   memberships:[{ category, status, featured, sortOrder, label, reason, since, verification }],
//                   lastShown, timesShown }]            lastShown = last episode number credited in, or null
//   contributions [{ contributorId, category, role, episodeNumber }]   only this episode's
//   leaderboard  { entries:[{ pos, handle, display, beans, excluded, exclusionReason, contributorId }], asof, topN } | null
//   overrides    { include:[id], exclude:[id] }          per-episode producer choices
//   seed, dedupe (default true)
//
// Output: { sections:[{ key, name, tagline, kind, items, anonymousCount, deferred, excluded, note }], warnings }

import { shuffle, hash32 } from './util.js';

const CLAIM_ORDER = { episode: 0, creators: 1, curated: 2, rotating: 3 };

export function isPublic(p) {
  return p.visibility === 'public' && !!p.consentPublic;
}

/** Fairness order for rotating sections. Lower sorts first. */
export function rotationCompare(seed) {
  return (a, b) =>
    (b.featured - a.featured) ||
    ((a.lastShown == null ? -1 : a.lastShown) - (b.lastShown == null ? -1 : b.lastShown)) ||
    (a.timesShown - b.timesShown) ||
    (String(a.since || '9999').localeCompare(String(b.since || '9999'))) ||
    (hash32(seed + ':' + a.id) - hash32(seed + ':' + b.id));
}

export function selectCredits(input) {
  const { episode, categories = [], people = [], contributions = [], leaderboard = null,
    overrides = {}, seed = 'stoopid', dedupe = true } = input;
  const include = new Set(overrides.include || []);
  const exclude = new Set(overrides.exclude || []);
  const byId = new Map(people.map((p) => [p.id, p]));
  const claimed = new Map(); // contributorId -> section name
  const warnings = [];

  const cats = categories.filter((c) => c.enabled).slice().sort((a, b) => a.sort_order - b.sort_order);
  // Fixed credits claim people before rotating ones, whatever the on-screen order.
  const work = cats.slice().sort((a, b) => (CLAIM_ORDER[a.kind] ?? 9) - (CLAIM_ORDER[b.kind] ?? 9));
  const out = new Map();

  for (const cat of work) {
    const sec = { key: cat.key, name: cat.name, tagline: cat.tagline || '', kind: cat.kind,
      items: [], anonymousCount: 0, deferred: [], excluded: [], note: '' };
    out.set(cat.key, sec);

    if (cat.kind === 'leaderboard') {
      fillLeaderboard(sec, cat, leaderboard, warnings);
      continue;
    }

    if (cat.kind === 'episode') {
      const rows = contributions.filter((c) => c.category === cat.key && c.episodeNumber === episode.number);
      for (const c of rows) {
        const p = byId.get(c.contributorId);
        if (!p) continue;
        if (exclude.has(p.id)) { sec.excluded.push({ id: p.id, name: p.name, reason: 'removed by producer for this episode' }); continue; }
        if (!isPublic(p)) { sec.excluded.push({ id: p.id, name: p.name, reason: 'no public consent' }); continue; }
        sec.items.push({ id: p.id, name: p.name, role: c.role });
        claimed.set(p.id, cat.name);
      }
      if (sec.items.length > cat.cap) {
        warnings.push(`${cat.name}: ${sec.items.length} episode credits exceed the cap of ${cat.cap}; all are kept (episode credits are never dropped).`);
      }
      continue;
    }

    // creators / curated / rotating: membership-driven
    const pool = [];
    for (const p of people) {
      const m = (p.memberships || []).find((x) => x.category === cat.key && x.status === 'active');
      if (!m) continue;
      const row = { id: p.id, name: p.name, featured: (m.featured || include.has(p.id)) ? 1 : 0,
        sortOrder: m.sortOrder || 0, since: m.since, lastShown: p.lastShown ?? null, timesShown: p.timesShown || 0,
        label: m.label || '', handle: p.handles?.x || '', verification: m.verification };
      if (exclude.has(p.id)) { sec.excluded.push({ id: p.id, name: p.name, reason: 'removed by producer for this episode' }); continue; }
      if (p.visibility === 'anonymous' && p.consentPublic) { sec.anonymousCount++; continue; }
      if (!isPublic(p)) { sec.excluded.push({ id: p.id, name: p.name, reason: 'no public consent' }); continue; }
      if (dedupe && claimed.has(p.id)) { sec.excluded.push({ id: p.id, name: p.name, reason: `already credited in ${claimed.get(p.id)}` }); continue; }
      pool.push(row);
    }

    let ordered;
    if (cat.kind === 'creators') {
      ordered = pool.slice().sort((a, b) => (b.featured - a.featured) || (a.sortOrder - b.sortOrder) || rotationCompare(seed)(a, b));
    } else {
      ordered = pool.slice().sort(rotationCompare(seed));
    }
    const chosen = ordered.slice(0, cat.cap);
    for (const r of ordered.slice(cat.cap)) {
      sec.deferred.push({ id: r.id, name: r.name, reason: r.lastShown == null ? 'cap reached — first in line next episode' : `cap reached — last shown in EP ${r.lastShown}` });
    }
    // On-screen order: featured first, then a seeded shuffle so nobody is always last.
    const feat = chosen.filter((r) => r.featured);
    const rest = shuffle(chosen.filter((r) => !r.featured), seed + ':' + cat.key);
    const display = cat.kind === 'creators' ? chosen : feat.concat(rest);
    for (const r of display) {
      sec.items.push({ id: r.id, name: r.name, label: r.label, handle: cat.kind === 'creators' ? r.handle : '',
        featured: !!r.featured, verification: r.verification });
      claimed.set(r.id, cat.name);
    }
  }

  const sections = cats.map((c) => out.get(c.key));
  return { sections, warnings };
}

function fillLeaderboard(sec, cat, lb, warnings) {
  if (!lb || !lb.entries || !lb.entries.length) {
    sec.note = 'NO BEANS ON RECORD YET';
    return;
  }
  const n = lb.topN || cat.cap || 5;
  const eligible = lb.entries.filter((e) => !e.excluded).sort((a, b) => a.pos - b.pos);
  for (const e of lb.entries.filter((e) => e.excluded)) sec.excluded.push({ id: null, name: e.display, reason: e.exclusionReason || 'excluded by moderation' });
  const top = eligible.slice(0, n);
  // Shared (competition) rank: players with equal Beans share the best position among them.
  // `pos` stays the feed's own position, so ranks can always be checked against the source.
  for (const e of top) {
    const same = lb.entries.filter((o) => o.beans === e.beans);
    const rank = Math.min(...same.map((o) => o.pos));
    // id stays null: a ranking is a public fact from the feed, not a consent-based credit. cid links identity.
    sec.items.push({ id: null, cid: e.contributorId ?? null, name: e.display, handle: e.handle, pos: e.pos, rank, beans: e.beans, tied: same.length > 1 });
  }
  const last = top[top.length - 1];
  if (last) {
    const tiedOut = eligible.slice(n).filter((e) => e.beans === last.beans).length;
    if (tiedOut) sec.note = `+${tiedOut} MORE TIED AT ${last.beans} BEANS`;
  }
  for (const e of eligible.slice(n)) sec.deferred.push({ id: e.contributorId ?? null, name: e.display, reason: `position ${e.pos} (outside top ${n})` });
  sec.asof = lb.asof || null;
  if (eligible.length < n) warnings.push(`${cat.name}: only ${eligible.length} eligible players (top ${n} requested).`);
}
