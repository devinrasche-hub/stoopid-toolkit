// ─────────────────────────────────────────────────────────────────────────────
// COUNT AGAIN — STOOPID AFTER HOURS 07 — the master timeline.
//
//   THE ONE IDEA   You get out by noticing what's wrong, not by running.
//   THE FLIP       The fourth monitor is a window onto the real room, where
//                  someone new reads the card. Rule 5 is about the last operator.
//   THE ANCHOR     The coffee mug: warm in the real room, cold in the copies.
// ─────────────────────────────────────────────────────────────────────────────

export const DURATION = 120;

export const CUE = {
  // 0–8 4:58
  warmClose: 8.0,
  // 14–22 THE HALL
  hall: 14.0,
  door1: 21.0,
  // 22–34 COPY 1
  copy1: 22.0,
  cold: 28.0,
  // 34–46 COPY 2
  out2: 34.0,
  door2: 37.0,
  copy2: 37.6,
  // 46–58 THE ONE JOKE
  out3: 46.0,
  fish: 48.5,
  beeps: 51.0,
  silence: 53.0,
  // 58–66 COPY 3
  copy3: 58.0,
  four: 62.0,
  // 66–78 RULE 5
  rule5: 66.0,
  count: 69.5,
  // 78–90 COUNT AGAIN
  again: 78.0,
  window: 84.0,
  // 90–102 THE NEW OPERATOR
  hood: 90.0,
  slide: 93.0,
  looks: 97.0,
  // 102–108 THEY COUNT AGAIN
  turns: 102.0,
  snow: 104.0,
  black: 105.6,
  // 108–112 4:59
  ours: 108.0,
  tick: 109.0,
  // 112–120 TITLE
  title: 112.0,
  end: 115.0,
  credits: 117.0,
};

// The card's handwriting is all from earlier nights (05's rule 7, 06's rule 9).
// In copy 2 and 3 the station shows rule 9's ink wet again.
export const WRITE = [
  { rule: 7, start: -30, end: -26, text: 'IF YOU ARE READING THIS,' },
  { rule: 7, start: -25, end: -21, text: 'YOU ARE THE OPERATOR NOW.' },
  { rule: 9, start: -12, end: -8, text: '9. IF IT WANTS TO BE SHARED,' },
  { rule: 9, start: -7, end: -5, text: 'KEEP IT.' },
];

// Which room the camera is in: 0 = the real room, 1–3 = copies.
export function roomAt(t) {
  if (t < CUE.copy1) return 0;
  if (t < CUE.copy2) return 1;
  if (t < CUE.copy3) return 2;
  if (t < CUE.ours) return 3;
  return 4;   // 4:59 — ours again, and time moves
}

export const SHOTS = [
  { id: '1A', start: 0,             end: CUE.warmClose, scene: 'station', note: '4:58: the wide; steam off the mug' },
  { id: '1B', start: CUE.warmClose, end: CUE.hall,      scene: 'station', note: 'The card and the warm mug' },
  { id: '2A', start: CUE.hall,      end: CUE.copy1,     scene: 'station', note: 'Out the back door, down the hall, a door' },
  { id: '3A', start: CUE.copy1,     end: CUE.cold,      scene: 'station', note: 'In through the back door: the control room again' },
  { id: '3B', start: CUE.cold,      end: CUE.out2,      scene: 'station', note: 'The mug: cold' },
  { id: '4A', start: CUE.out2,      end: CUE.copy2,     scene: 'station', note: 'Out, a door' },
  { id: '4B', start: CUE.copy2,     end: CUE.out3,      scene: 'station', note: 'Copy 2: dimmer, bars backwards, wet ink' },
  { id: '5A', start: CUE.out3,      end: CUE.fish,      scene: 'station', note: 'The hall: the break-room door ajar' },
  { id: '5B', start: CUE.fish,      end: CUE.copy3,     scene: 'station', note: 'FISH. Three beeps. Held.' },
  { id: '6A', start: CUE.copy3,     end: CUE.rule5,     scene: 'station', note: 'Copy 3: four monitors' },
  { id: '6B', start: CUE.rule5,     end: CUE.count,     scene: 'station', note: 'Rule 5 on the card' },
  { id: '6C', start: CUE.count,     end: CUE.window,    scene: 'station', note: 'Count: 1, 2, 3, 4. Count again.' },
  { id: '7A', start: CUE.window,    end: CUE.ours,      scene: 'station', note: 'The fourth monitor is a window: the real room, someone new' },
  { id: '8A', start: CUE.ours,      end: CUE.title,     scene: 'station', note: '4:59; steam' },
  { id: '9A', start: CUE.title,     end: DURATION,      scene: 'none',    note: 'Title and credits' },
];

export function shotAt(t) {
  for (const s of SHOTS) if (t >= s.start && t < s.end) return s;
  return SHOTS[SHOTS.length - 1];
}

// The Algorithm, twice, the same words.
export const NARRATION = [
  { id: 'A01', voice: 'algorithm', start: 23.4, end: 26.8, text: 'Welcome back.' },
  { id: 'A02', voice: 'algorithm', start: 59.0, end: 62.4, text: 'Welcome back.' },
];

export function formatTime(t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
