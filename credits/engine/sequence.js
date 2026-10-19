// CREDIT SEQUENCE — selection output + timing config → one JSON record that every renderer reads.
// The browser preview, the in-browser exporters, the headless render command and the public archive
// all consume this object, so nothing can quietly diverge.

import { fitName, shuffle, cleanText, pad } from './util.js';

export const SEQUENCE_VERSION = 1;

/** Fixed per-theme page capacities. Pagination never depends on font measurement, so it is identical
 *  on every machine; names are never shrunk below the theme's type size. */
export const THEME_META = {
  terminal: { name: 'THE TERMINAL', namesPerPage: 10, rolesPerPage: 6, creatorsPerPage: 3, boardRows: 10, maxNameChars: 26 },
  midnight: { name: 'MIDNIGHT BROADCAST', namesPerPage: 8, rolesPerPage: 5, creatorsPerPage: 3, boardRows: 10, maxNameChars: 26 },
  beans:    { name: 'DEPARTMENT OF BEANS', namesPerPage: 10, rolesPerPage: 6, creatorsPerPage: 3, boardRows: 10, maxNameChars: 24 },
};

export const END_CARDS = {
  refund: { name: 'THE REFUND (default)', lines: [
    { text: 'THANK YOU FOR GIVING US SOMETHING YOU CAN NEVER GET BACK.', at: 0.03, style: 'lead' },
    { text: 'YOUR TIME.', at: 0.36, style: 'big' },
    { text: 'We tried to refund it.', at: 0.55, style: 'aside' },
    { text: 'Customer service said no.', at: 0.66, style: 'aside' },
  ], card: 'END TRANSMISSION. AS IS.', cardAt: 0.80 },
  documented: { name: 'DOCUMENTED', lines: [
    { text: 'YOUR PARTICIPATION HAS BEEN DOCUMENTED.', at: 0.04, style: 'lead' },
    { text: 'THANK YOU.', at: 0.36, style: 'big' },
    { text: 'We meant that part.', at: 0.56, style: 'aside' },
  ], card: 'PLEASE REMAIN STOOPID. RESPONSIBLY.', cardAt: 0.78 },
  vicinity: { name: 'GENERAL VICINITY', lines: [
    { text: 'NOBODY MADE THIS ALONE.', at: 0.04, style: 'lead' },
    { text: 'UNFORTUNATELY, YOU’RE ALL IMPLICATED.', at: 0.30, style: 'big' },
    { text: 'Thank you for existing in our general vicinity.', at: 0.56, style: 'aside' },
  ], card: 'END TRANSMISSION. AS IS.', cardAt: 0.80 },
};

export const DEFAULT_TIMING = {
  theme: 'terminal', fps: 30, width: 1920, height: 1080,
  identSeconds: 4, finalSeconds: 7, minPageSeconds: 3,
  overflow: 'archive',            // 'archive' → "+N MORE IN THE ARCHIVE"; 'extend' → lengthen the segment
  emptyCategories: 'skip',        // 'skip' | 'card'
  endCard: 'refund',
  notices: 'auto',                // 'auto' (seeded from the joke library) | 'off' | [text, …] chosen by the producer
  archiveUrl: 'STOOPIDTV.COM/CREDITS',
  audio: true,
  order: null,                    // optional array of segment ids to reorder
  disabled: [],                   // segment ids switched off for this episode
  durations: {},                  // segment id → seconds
};

export function segmentIdFor(categoryKey) { return 'cat:' + categoryKey; }

/**
 * @param selection  output of selectCredits()
 * @param episode    { number, title, season }
 * @param timing     partial DEFAULT_TIMING
 * @param extras     { categories:[{key, segment_seconds}], jokes:[{id,text,themes,enabled}], seed }
 */
export function buildSequence(selection, episode, timing = {}, extras = {}) {
  const cfg = { ...DEFAULT_TIMING, ...timing, durations: { ...(timing.durations || {}) } };
  const meta = THEME_META[cfg.theme] || THEME_META.terminal;
  const seed = String(extras.seed ?? `ep${episode.number}`);
  const warnings = [];
  const catSeconds = new Map((extras.categories || []).map((c) => [c.key, c.segment_seconds]));
  const disabled = new Set(cfg.disabled || []);

  // Joke notices: producer's picks, or a seeded draw from enabled jokes for this theme. Never names anyone.
  let notices = [];
  if (Array.isArray(cfg.notices)) notices = cfg.notices.map((t) => cleanText(t, 90)).filter(Boolean);
  else if (cfg.notices !== 'off') {
    const pool = (extras.jokes || []).filter((j) => j.enabled && (j.themes === '*' || String(j.themes).split(',').map((s) => s.trim()).includes(cfg.theme)));
    notices = shuffle(pool.map((j) => cleanText(j.text, 90)), seed + ':jokes');
  }
  let noticeIdx = 0;
  const nextNotice = () => (notices.length ? notices[noticeIdx++ % notices.length] : '');

  let segments = [];
  segments.push({ id: 'ident', kind: 'ident', title: 'END OF TRANSMISSION',
    subtitle: `DEPARTMENT OF UNNECESSARY APPRECIATION · FORM CD-${pad(episode.number)}`,
    duration: cfg.durations.ident ?? cfg.identSeconds, pages: [{ items: [] }] });

  for (const sec of selection.sections) {
    const id = segmentIdFor(sec.key);
    const base = cfg.durations[id] ?? catSeconds.get(sec.key) ?? 8;
    const kind = sec.kind === 'leaderboard' ? 'leaderboard' : sec.kind === 'creators' ? 'creators' : 'names';
    const items = sec.items.map((it) => {
      const [name, cut] = fitName(cleanText(it.name, 80), meta.maxNameChars);
      if (cut) warnings.push(`${sec.name}: "${it.name}" shortened on screen to "${name}" (full name stays in the archive).`);
      return { ...it, name, fullName: it.name };
    });
    if (sec.anonymousCount) items.push({ id: null, name: `+ ${sec.anonymousCount} ANONYMOUS`, anon: true });

    if (!items.length) {
      if (cfg.emptyCategories === 'card' && kind !== 'leaderboard') {
        segments.push({ id, kind: 'empty', key: sec.key, title: sec.name, subtitle: sec.tagline, duration: Math.min(base, 4),
          pages: [{ items: [] }], note: 'THIS DEPARTMENT IS CURRENTLY ACCEPTING APPLICANTS.', notice: '' });
      } else if (kind === 'leaderboard' && cfg.emptyCategories === 'card') {
        segments.push({ id, kind: 'empty', key: sec.key, title: sec.name, subtitle: sec.tagline, duration: Math.min(base, 4),
          pages: [{ items: [] }], note: 'NO BEANS ON RECORD YET. THE BOARD IS OPEN.', notice: '' });
      } else {
        warnings.push(`${sec.name}: nobody to show, segment skipped.`);
      }
      continue;
    }

    const per = kind === 'leaderboard' ? meta.boardRows
      : kind === 'creators' ? meta.creatorsPerPage
      : items.some((i) => i.role) ? meta.rolesPerPage : meta.namesPerPage;
    let pages = chunk(items, per);
    let duration = base;
    const maxPages = Math.max(1, Math.floor(base / cfg.minPageSeconds));
    if (pages.length > maxPages) {
      if (cfg.overflow === 'extend') {
        duration = pages.length * cfg.minPageSeconds;
        warnings.push(`${sec.name}: extended to ${duration}s to fit ${pages.length} pages.`);
      } else {
        const keep = maxPages * per - 1;
        const hidden = items.length - keep;
        pages = chunk(items.slice(0, keep).concat([{ id: null, name: `+ ${hidden} MORE IN THE ARCHIVE`, more: true, url: cfg.archiveUrl }]), per);
        warnings.push(`${sec.name}: ${hidden} names didn't fit in ${base}s and point to the archive instead (switch overflow to "extend" to show everyone on screen).`);
      }
    }
    segments.push({ id, kind, key: sec.key, title: sec.name, subtitle: sec.tagline, duration, pages: pages.map((p) => ({ items: p })),
      note: sec.note || '', asof: sec.asof || null, notice: kind === 'leaderboard' ? '' : nextNotice() });
  }

  const end = END_CARDS[cfg.endCard] || END_CARDS.refund;
  segments.push({ id: 'final', kind: 'final', title: 'FINAL TRANSMISSION', duration: cfg.durations.final ?? cfg.finalSeconds,
    pages: [{ items: [] }], endCard: { id: cfg.endCard in END_CARDS ? cfg.endCard : 'refund', ...end } });

  if (Array.isArray(cfg.order) && cfg.order.length) {
    const rank = new Map(cfg.order.map((id, i) => [id, i]));
    segments = segments.slice().sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
  }
  segments = segments.filter((s) => !disabled.has(s.id));
  for (const s of segments) s.duration = Math.max(1, Math.round(Number(s.duration) * 100) / 100);

  const seq = {
    v: SEQUENCE_VERSION, seed,
    episode: { number: episode.number, title: cleanText(episode.title, 120), season: episode.season ?? 1 },
    theme: THEME_META[cfg.theme] ? cfg.theme : 'terminal',
    fps: [24, 30, 60].includes(Number(cfg.fps)) ? Number(cfg.fps) : 30,
    width: 1920, height: 1080, audio: !!cfg.audio,
    archiveUrl: cfg.archiveUrl, segments,
  };
  seq.duration = totalDuration(seq);
  return { sequence: seq, warnings };
}

function chunk(a, n) {
  const out = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out.length ? out : [[]];
}

export function totalDuration(seq) {
  return Math.round(seq.segments.reduce((s, x) => s + x.duration, 0) * 1000) / 1000;
}

/** Flat list of every page with absolute start/end seconds. */
export function timeline(seq) {
  const out = [];
  let t = 0;
  seq.segments.forEach((seg, si) => {
    const n = seg.pages.length, pd = seg.duration / n;
    seg.pages.forEach((page, pi) => {
      out.push({ si, pi, seg, page, start: t + pi * pd, end: t + (pi + 1) * pd, segStart: t, segEnd: t + seg.duration });
    });
    t += seg.duration;
  });
  return out;
}

/** Where is time t? Returns the timeline entry plus local times. */
export function locate(seq, t, tl = timeline(seq)) {
  const total = tl.length ? tl[tl.length - 1].end : 0;
  const tt = Math.max(0, Math.min(t, total - 1e-6));
  let e = tl[tl.length - 1];
  for (const x of tl) if (tt < x.end) { e = x; break; }
  return { ...e, t: tt, segT: tt - e.segStart, pageT: tt - e.start, pageDur: e.end - e.start, segDur: e.seg.duration };
}

/** The moment in a page when everything is fully revealed — used for still PNG cards. */
export function cardTime(entry) {
  const d = entry.end - entry.start;
  return entry.start + d * (entry.seg.kind === 'final' || entry.seg.kind === 'ident' ? 0.93 : 0.72);
}

/** Every name shown in a sequence, for archive search and appearance records. */
export function creditedPeople(seq) {
  const out = [];
  for (const seg of seq.segments) for (const p of seg.pages) for (const it of p.items) {
    if (it.anon || it.more) continue;
    out.push({ id: it.id ?? null, name: it.fullName || it.name, category: seg.key, role: it.role || null, pos: it.pos ?? null, rank: it.rank ?? null, beans: it.beans ?? null, handle: it.handle || null });
  }
  return out;
}
