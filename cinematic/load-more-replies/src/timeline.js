// ─────────────────────────────────────────────────────────────────────────────
// LOAD MORE REPLIES — STOOPID AFTER HOURS 09 — the master timeline.
//
//   THE ONE IDEA   Every voice telling you to keep going is someone who kept going.
//   THE FLIP       The reply box types by itself, "keep going", as you.
//   THE ANCHOR     The blue logbook on the console since 05: the moderation log.
// ─────────────────────────────────────────────────────────────────────────────

export const DURATION = 120;

export const CUE = {
  // 0–10 THE LOG
  log1: 1.0,
  // 10–22 THE COMMENT
  comment: 10.0,
  loadMore: 13.0,
  // 22–34 DEEPER
  deeper: 22.0,
  log2: 30.0,
  // 34–46 TOO NARROW
  narrow: 34.0,
  log3: 41.0,
  // 46–58 THE ONE JOKE
  popup: 46.0,
  keepScrolling: 56.6,
  // 58–72 THE BOTTOM
  bottom: 58.0,
  opens: 63.0,
  log4: 67.0,
  // 72–84 THE REPLY BOX
  box: 72.0,
  typing: 76.0,
  // 84–96 THE FLIP
  posted: 84.0,
  up: 85.2,
  top: 88.0,
  // 96–108 THE LAST ENTRY
  last: 96.0,
  // 108–112 THE ROOM
  room: 108.0,
  click: 110.4,
  // 112–120 TITLE
  title: 112.0,
  end: 115.0,
  credits: 117.0,
};

// The log, in the operator's hand. Each entry writes over [start, end].
export const LOG = [
  { start: 1.4, end: 8.6, lines: ['MOD LOG · 1:12 AM', 'old ep, top comment.', '1 reply won’t load.'] },
  { start: 30.4, end: 33.4, lines: ['1:31 · replies older', 'than the channel.'] },
  { start: 41.2, end: 45.2, lines: ['1:48 · too narrow to read.', 'going slower.'] },
  { start: 67.4, end: 70.6, lines: ['2:14 · I can hear it.'] },
  { start: 97.0, end: 104.4, lines: ['2:16 · it’s not so bad down h'] },
];

// The thread, top to bottom: [depth, author, age, text]
export const THREAD = [
  [0, '@nightowl_88', '6 yrs ago', 'does anyone else hear something at 2:14?'],
  [1, '@kev_on_the_couch', '6 yrs ago', 'lol no'],
  [1, '@mara.v', '6 yrs ago', 'yes. under the hum.'],
  [2, '[deleted]', '7 yrs ago', 'it’s not breathing it’s air moving'],
  [3, '@jules', '9 yrs ago', 'air moving where? the studio has no windows'],
  [4, '@user4471', '11 yrs ago', 'turn it up and keep going'],
  [5, '@user', '14 yrs ago', 'the channel is 6 years old. how is this reply 14'],
  [6, '[deleted]', '19 yrs ago', 'keep going'],
  [7, '[deleted]', '23 yrs ago', 'it gets narrow here but it opens up'],
  [8, '[deleted]', '31 yrs ago', 'keep'],
  [9, '[deleted]', '40 yrs ago', 'going'],
  [10, '[deleted]', '52 yrs ago', 'it’s'],
  [11, '[deleted]', '70 yrs ago', 'fine'],
  [12, '[deleted]', 'yrs ago', 'almost'],
  [13, '[deleted]', 'ago', 'there'],
  [0, '[deleted]', 'just now', 'you can come down now.'],
];
export const REPLY = 'keep going';

// The card on the desk keeps its handwriting from earlier nights (05, 06).
export const WRITE = [
  { rule: 7, start: -30, end: -26, text: 'IF YOU ARE READING THIS,' },
  { rule: 7, start: -25, end: -21, text: 'YOU ARE THE OPERATOR NOW.' },
  { rule: 9, start: -12, end: -8, text: '9. IF IT WANTS TO BE SHARED,' },
  { rule: 9, start: -7, end: -5, text: 'KEEP IT.' },
];

export const SHOTS = [
  { id: '1A', start: 0,                 end: CUE.comment,  scene: 'station', note: 'The log: 1:12 AM' },
  { id: '2A', start: CUE.comment,       end: CUE.deeper,   scene: 'station', note: 'The comment; LOAD MORE REPLIES' },
  { id: '3A', start: CUE.deeper,        end: CUE.log2,     scene: 'station', note: 'Deeper: narrower, older' },
  { id: '3B', start: CUE.log2,          end: CUE.narrow,   scene: 'station', note: 'The log: older than the channel' },
  { id: '4A', start: CUE.narrow,        end: CUE.log3,     scene: 'station', note: 'Too narrow: one word a line' },
  { id: '4B', start: CUE.log3,          end: CUE.popup,    scene: 'station', note: 'The log: going slower' },
  { id: '5A', start: CUE.popup,         end: CUE.bottom,   scene: 'none',    note: 'Take a break? KEEP SCROLLING' },
  { id: '6A', start: CUE.bottom,        end: CUE.log4,     scene: 'station', note: 'almost / there / it opens up' },
  { id: '6B', start: CUE.log4,          end: CUE.box,      scene: 'station', note: 'The log: I can hear it' },
  { id: '7A', start: CUE.box,           end: CUE.posted,   scene: 'station', note: 'The reply box types by itself' },
  { id: '8A', start: CUE.posted,        end: CUE.last,     scene: 'station', note: 'Posted. Back to the top: you, telling them to keep going' },
  { id: '9A', start: CUE.last,          end: CUE.room,     scene: 'station', note: 'The last entry stops mid-word' },
  { id: '10A', start: CUE.room,         end: CUE.title,    scene: 'station', note: 'The room; LOAD MORE REPLIES lights by itself' },
  { id: '11A', start: CUE.title,        end: DURATION,     scene: 'none',    note: 'Title and credits' },
];

export function shotAt(t) {
  for (const s of SHOTS) if (t >= s.start && t < s.end) return s;
  return SHOTS[SHOTS.length - 1];
}

// Nobody speaks. Everything is on screen or in the log.
export const NARRATION = [];

export function formatTime(t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
