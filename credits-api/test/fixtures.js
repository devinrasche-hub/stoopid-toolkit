// SAMPLE DATA FOR TESTS AND LOCAL DEVELOPMENT ONLY. These people do not exist.
// The Beans feed fixture is a copy of the public STOOPIDshow/beans-feed file as of 2026-10-16.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const FEED_2026_10_16 = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./beans-feed-2026-10-16.json', import.meta.url)), 'utf8'));

export const CATEGORIES = [
  { key: 'financially_irresponsible', name: 'THE FINANCIALLY IRRESPONSIBLE', tagline: 'Paid $2 a month to watch this on purpose.', kind: 'rotating', enabled: 1, sort_order: 10, cap: 18, segment_seconds: 9 },
  { key: 'mutual_enablers', name: 'MUTUAL ENABLERS', tagline: 'Creators this show pays to watch. Go find them.', kind: 'creators', enabled: 1, sort_order: 20, cap: 6, segment_seconds: 8 },
  { key: 'bean_counters', name: 'THE BEAN COUNTERS', tagline: 'The STOOPIDTV arcade, top of the board.', kind: 'leaderboard', enabled: 1, sort_order: 30, cap: 5, segment_seconds: 8 },
  { key: 'human_resources', name: 'ACTUAL HUMAN RESOURCES', tagline: 'People who did real work on this episode.', kind: 'episode', enabled: 1, sort_order: 40, cap: 30, segment_seconds: 7 },
  { key: 'emotional_support', name: 'THE DEPARTMENT OF EMOTIONAL SUPPORT', tagline: 'Kept the lights on in the parts that matter.', kind: 'curated', enabled: 1, sort_order: 50, cap: 10, segment_seconds: 6 },
  { key: 'voluntary_witnesses', name: 'THE VOLUNTARY WITNESSES', tagline: 'Subscribed for free. Asked to be named. Brave.', kind: 'rotating', enabled: 1, sort_order: 60, cap: 18, segment_seconds: 7 },
];

const m = (category, extra = {}) => ({ category, status: 'active', featured: 0, sortOrder: 0, since: '2026-09-01', verification: 'manual', ...extra });
let n = 0;
const P = (name, memberships, extra = {}) => ({ id: ++n, name, visibility: 'public', consentPublic: 1, handles: {}, memberships, lastShown: null, timesShown: 0, ...extra });

export const SAMPLE_PEOPLE = [
  P('SAMPLE Ada Beanworth', [m('financially_irresponsible'), m('voluntary_witnesses')]),
  P('SAMPLE Bo Static', [m('financially_irresponsible')], { lastShown: 22, timesShown: 3 }),
  P('SAMPLE Ça Va Clément', [m('financially_irresponsible')]),
  P('SAMPLE 小豆 Azuki', [m('financially_irresponsible')]),
  P('SAMPLE Dee 🫘 Lux', [m('financially_irresponsible')]),
  P('SAMPLE Private Pat', [m('financially_irresponsible')], { visibility: 'private', consentPublic: 0 }),
  P('SAMPLE Anon One', [m('financially_irresponsible')], { visibility: 'anonymous' }),
  P('SAMPLE Wolfeschlegelsteinhausenbergerdorff The Third Of His Name', [m('financially_irresponsible')]),
  P('SAMPLE Creator Cass', [m('mutual_enablers', { label: 'pixel art', featured: 1 })], { handles: { x: 'samplecass' } }),
  P('SAMPLE Creator Dmitri', [m('mutual_enablers', { label: 'absurdist essays' })], { handles: { x: 'sampledmitri' } }),
  P('SAMPLE Writer Wren', [m('human_resources')]),
  P('SAMPLE Editor Eli', [m('human_resources'), m('financially_irresponsible')]),
  P('SAMPLE Kind Kofi', [m('emotional_support')]),
  P('SAMPLE Witness Wu', [m('voluntary_witnesses', { verification: 'self_reported' })]),
];
export const SAMPLE_CONTRIBUTIONS = (ep) => [
  { contributorId: 11, category: 'human_resources', role: 'Writer', episodeNumber: ep },
  { contributorId: 12, category: 'human_resources', role: 'Editor', episodeNumber: ep },
];

export function leaderboardFromFeed(feed, topN = 5) {
  return { asof: feed.asof, topN, entries: feed.top.map((p) => ({ pos: p.pos, handle: p.h.replace(/^@/, '').toLowerCase(), display: p.h, beans: p.life, excluded: false })) };
}
