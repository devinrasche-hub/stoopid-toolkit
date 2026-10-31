// ─────────────────────────────────────────────────────────────────────────────
// PLEASE SHARE — STOOPID AFTER HOURS 06 — the master timeline.
//
//   THE ONE IDEA   The only way to get rid of it is to give it to someone.
//   THE FLIP       The cursor drifts to someone you love. You cancel. It stays,
//                  on every screen. Someone has to be where it stops.
//   THE ANCHOR     03's child: KIDDO, "night dad. one more minute?"
// ─────────────────────────────────────────────────────────────────────────────

export const DURATION = 120;

export const CUE = {
  // 0–8 THE NEXT NIGHT
  message: 4.0,
  // 8–20 IT LOADS
  open: 8.0,
  loadStart: 9.0,
  loadStop: 13.5,
  mustShare: 14.5,
  // 20–34 THE ALGORITHM SHARES IT
  shares: 20.0,
  share1: 21.0,
  share2: 25.0,
  share3: 29.0,
  // 34–46 MONITOR 3
  mon3: 34.0,
  // 46–58 THE ONE JOKE
  joke: 46.0,
  felt: 48.5,
  chime: 50.0,
  // 58–72 THE SHARE SHEET
  sheet: 58.0,
  drift: 62.0,
  onKiddo: 70.0,
  // 72–84 THE ANCHOR
  anchor: 72.0,
  // 84–96 THE CHOICE
  choice: 84.0,
  ball: 85.0,
  fight: 86.5,
  cancel: 92.0,
  // 96–104 IT STAYS
  stays: 96.0,
  // 104–112 RULE 9
  rule9: 104.0,
  // 112–120 TITLE
  title: 112.0,
  end: 115.0,
  credits: 117.0,
};

// Handwriting on the card. Rule 7 was written last night (05) and is long dry;
// rule 9 is written tonight, by you.
export const WRITE = [
  { rule: 7, start: -20, end: -16, text: 'IF YOU ARE READING THIS,' },
  { rule: 7, start: -15, end: -11, text: 'YOU ARE THE OPERATOR NOW.' },
  { rule: 9, start: 105.2, end: 108.8, text: '9. IF IT WANTS TO BE SHARED,' },
  { rule: 9, start: 109.2, end: 110.6, text: 'KEEP IT.' },
];

// How far the image has loaded (0–1) at time t. It only ever goes up.
export const LOAD = [
  [0, 0], [CUE.loadStart, 0], [CUE.loadStop, 0.18],
  [CUE.share1, 0.18], [CUE.share1 + 1.2, 0.34],
  [CUE.share2, 0.34], [CUE.share2 + 1.2, 0.51],
  [CUE.share3, 0.51], [CUE.share3 + 1.6, 0.67],
  [CUE.mon3 + 1, 0.67], [CUE.joke - 1, 0.78],
  [CUE.sheet, 0.93], [CUE.stays - 0.01, 0.93], [CUE.stays + 0.6, 1],
];

export const SHOTS = [
  { id: '1A', start: 0,             end: CUE.open,    scene: 'station', note: 'The next night: the wide; a message' },
  { id: '2A', start: CUE.open,      end: CUE.shares,  scene: 'station', note: 'The main CRT: it loads, then stops' },
  { id: '3A', start: CUE.shares,    end: CUE.mon3,    scene: 'station', note: 'Across to the monitors: shared, shared, shared' },
  { id: '3B', start: CUE.mon3,      end: CUE.joke,    scene: 'station', note: 'Monitor 3: two points of light' },
  { id: '4A', start: CUE.joke,      end: CUE.sheet,   scene: 'none',    note: '4,108,227 shares. 0 people felt better.' },
  { id: '5A', start: CUE.sheet,     end: CUE.anchor,  scene: 'station', note: 'The share sheet; the cursor drifts to KIDDO' },
  { id: '5B', start: CUE.anchor,    end: CUE.choice,  scene: 'station', note: 'night dad. one more minute?' },
  { id: '6A', start: CUE.choice,    end: CUE.stays,   scene: 'station', note: 'The hand on the trackball; up to CANCEL' },
  { id: '7A', start: CUE.stays,     end: CUE.rule9,   scene: 'station', note: 'It stays: every screen, the whole picture' },
  { id: '8A', start: CUE.rule9,     end: CUE.title,   scene: 'station', note: 'Rule 9, in your hand' },
  { id: '9A', start: CUE.title,     end: DURATION,    scene: 'none',    note: 'Title and credits' },
];

export function shotAt(t) {
  for (const s of SHOTS) if (t >= s.start && t < s.end) return s;
  return SHOTS[SHOTS.length - 1];
}

// The Algorithm's lines, painted as captions. Each is an optional voice-over
// slot: put <id>.mp3|wav|ogg in a folder and open the page with ?vo=<folder>/.
export const NARRATION = [
  { id: 'A01', voice: 'algorithm', start: 9.6, end: 13.6, text: 'Here’s something you might like.' },
  { id: 'A02', voice: 'algorithm', start: 30.6, end: 33.8, text: 'It’s already doing so well.' },
  { id: 'A03', voice: 'algorithm', start: 38.5, end: 42.5, text: 'Share it, and it goes away.' },
  { id: 'A04', voice: 'algorithm', start: 64.0, end: 68.8, text: 'Send it to someone you love. It loads faster.' },
  { id: 'A05', voice: 'algorithm', start: 98.5, end: 102.8, text: 'It will stay with you now.' },
];

export function formatTime(t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
