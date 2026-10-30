// ─────────────────────────────────────────────────────────────────────────────
// OVERNIGHT OPERATOR — STOOPID AFTER HOURS 05 — the master timeline.
//
//   THE ONE IDEA   Every rule was written by someone who learned it the hard way.
//   THE FLIP       A hand writes a new rule 7: "IF YOU ARE READING THIS,
//                  YOU ARE THE OPERATOR NOW." The rules were for whoever watches.
//   THE ANCHOR     01's empty operator's chair. This is the night before.
// ─────────────────────────────────────────────────────────────────────────────

export const DURATION = 120;

export const CUE = {
  // 0–8 SIGN-OFF
  relay: 0.8,
  crtOn: 1.2,
  // 8–18 THE CARD
  card: 8.0,
  lamp: 9.0,
  readDown: 14.0,
  // 18–30 RULE 1
  rule1: 18.0,
  feedIn: 20.0,
  feedOut: 27.0,
  // 30–42 RULE 2
  rule2: 30.0,
  turnStart: 31.2,
  faced: 35.5,
  awayAgain: 40.0,
  // 42–52 RULE 3
  rule3: 42.0,
  talkOn: 43.0,
  talkOff: 50.0,
  // 52–64 RULE 4 — THE ONE JOKE
  rule4: 52.0,
  silence: 56.0,
  beeps: 60.5,
  // 64–76 RULE 6
  rule6: 64.0,
  ring1: 64.6,
  ring2: 67.4,
  pickedUp: 70.2,
  hold: 71.0,
  // 76–88 RULE 7
  clock: 76.0,
  rule7: 78.0,
  rule8: 84.0,
  // 88–102 THE FLIP
  hand: 88.0,
  write1: 90.0,
  write2: 94.4,
  inkDry: 99.0,
  capOn: 99.6,
  withdraw: 100.0,
  // 102–112 SHIFT CHANGE
  wide: 102.0,
  five: 103.0,
  morning: 104.0,
  chair: 106.0,
  // 112–120 TITLE
  title: 112.0,
  end: 115.0,
  credits: 117.0,
};

// The first rule of the new line writes over this span; the second over the next.
export const WRITE = [
  { start: CUE.write1, end: CUE.write2 - 0.6, text: 'IF YOU ARE READING THIS,' },
  { start: CUE.write2, end: CUE.inkDry - 0.4, text: 'YOU ARE THE OPERATOR NOW.' },
];

export const SHOTS = [
  { id: '1A', start: 0,              end: CUE.card,      scene: 'station', note: 'Sign-off: the test pattern warms up; empty room, chair pushed back' },
  { id: '2A', start: CUE.card,       end: CUE.rule1,     scene: 'station', note: 'Down to the console; the lamp finds the card; read down to rule 1' },
  { id: '3A', start: CUE.rule1,      end: CUE.rule2,     scene: 'station', note: 'The main CRT: the test pattern becomes the room, from behind you' },
  { id: '4A', start: CUE.rule2,      end: CUE.faced,     scene: 'station', note: 'Monitor 3: the studio chair turns toward you' },
  { id: '4B', start: CUE.faced,      end: CUE.awayAgain, scene: 'station', note: 'Look at the card until it isn\'t' },
  { id: '4C', start: CUE.awayAgain,  end: CUE.rule3,     scene: 'station', note: 'Monitor 3 again: facing away' },
  { id: '5A', start: CUE.rule3,      end: CUE.rule4,     scene: 'station', note: 'The talkback lamp; do not answer' },
  { id: '6A', start: CUE.rule4,      end: CUE.rule6,     scene: 'station', note: 'Rule 4, held too long; a microwave, down the hall' },
  { id: '7A', start: CUE.rule6,      end: CUE.clock,     scene: 'station', note: 'The request line rings; somebody picks up' },
  { id: '8A', start: CUE.clock,      end: CUE.rule7,     scene: 'station', note: 'The clock: 4:58' },
  { id: '8B', start: CUE.rule7,      end: CUE.hand,      scene: 'station', note: 'Rule 7, scratched out; rule 8' },
  { id: '9A', start: CUE.hand,       end: CUE.wide,      scene: 'station', note: 'A hand writes the new rule 7' },
  { id: '10A', start: CUE.wide,      end: CUE.title,     scene: 'station', note: '5:00. Good morning. The chair turns to you' },
  { id: '11A', start: CUE.title,     end: DURATION,      scene: 'none',    note: 'Title and credits' },
];

export function shotAt(t) {
  for (const s of SHOTS) if (t >= s.start && t < s.end) return s;
  return SHOTS[SHOTS.length - 1];
}

// The only spoken lines: the talkback, painted as station captions (they waver
// on their raster). Each is also an optional voice-over slot: put <id>.mp3|wav|ogg
// in a folder and open the page with ?vo=<folder>/. No voices are generated.
export const NARRATION = [
  { id: 'T01', voice: 'station', start: 44.2, end: 46.6, text: 'Operator?' },
  { id: 'T02', voice: 'station', start: 47.0, end: 49.8, text: 'I can see you’re there.' },
];

export function formatTime(t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
