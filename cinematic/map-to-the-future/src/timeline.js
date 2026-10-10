// ─────────────────────────────────────────────────────────────────────────────
// A MAP TO THE FUTURE — the master timeline.
//
//   THE ONE IDEA   The brain you wake up with is a record of the past, and
//                  rehearsal can turn it into a map to the future.
//   THE FLIP       The arrow reverses: outside → inside becomes inside → outside.
//   THE ANCHOR     The phone, first thing in the morning.
//
// An explainer of ideas taught by Dr. Joe Dispenza, in the show's own words and
// pictures. Every time below is read by shots, director, cards and audio.
// ─────────────────────────────────────────────────────────────────────────────

export const DURATION = 150;

export const CUE = {
  // 0–15 MORNING
  alarm: [0.8, 1.55, 2.3],
  screenOn: 2.6,
  notes: [4.1, 5.3, 6.5, 7.7, 8.9],
  push: 11.2,
  ring: 13.2,
  // 15–43 THE LOOP
  loop: 15.0,
  nodes: [16.0, 19.9, 21.9, 24.3, 28.5],
  memorize: 32.2,
  rise: 34.5,
  sameFuture: 36.6,
  dive: 40.2,
  // 43–69 THE MECHANICS
  split: 43.0,
  alpha: 56.0,
  theta: 59.0,
  gateOpen: 60.0,
  merge: 64.6,
  // 69–107 MENTAL REHEARSAL
  lidsClose: 69.4,
  brain: 72.4,
  rehearse: [77.6, 81.2, 84.8, 88.4],
  shift: 92.4,
  shiftEnd: 99.8,
  pullOut: 100.5,
  // 107–141 VICTIM → CREATOR
  board: 107.0,
  strike: 111.2,
  knocks: [115.0, 116.5, 117.9],
  quantum: 120.2,
  rise2: 122.0,
  intention: 125.0,
  emotion: 127.2,
  coherence: 129.6,
  path: 131.0,
  creator: 135.0,
  // 141–150 MORNING AGAIN
  coda: 141.0,
  lidsClose2: 145.2,
  title: 146.6,
  end: 148.6,
};

export const SHOTS = [
  { id: '1A', start: 0,             end: CUE.loop,      scene: 'bed',   chapter: 1, note: 'Black, alarm, the phone, notifications, push into the ring' },
  { id: '1B', start: CUE.loop,      end: CUE.split,     scene: 'loop',  chapter: 1, note: 'The loop' },
  { id: '2A', start: CUE.split,     end: CUE.lidsClose + 3.0, scene: 'gate', chapter: 2, note: 'Split screen: analytical mind | meditation' },
  { id: '3A', start: CUE.brain,     end: CUE.board,     scene: 'brain', chapter: 3, note: 'Neural network: record → map' },
  { id: '4A', start: CUE.board,     end: CUE.coda,      scene: 'field', chapter: 4, note: 'Cause and effect, then the quantum field' },
  { id: '5A', start: CUE.coda,      end: CUE.title,     scene: 'bed',   chapter: 5, note: 'Morning; the phone face down' },
  { id: '6A', start: CUE.title,     end: DURATION,      scene: 'none',  chapter: 5, note: 'Title' },
];

export function shotAt(t) {
  for (const s of SHOTS) if (t >= s.start && t < s.end) return s;
  return SHOTS[SHOTS.length - 1];
}

export const CHAPTERS = [
  { n: '01', title: 'THE LOOP',           start: 15.2,  end: 20.5 },
  { n: '02', title: 'THE MECHANICS',      start: 43.2,  end: 48.0 },
  { n: '03', title: 'MENTAL REHEARSAL',   start: 72.8,  end: 77.4 },
  { n: '04', title: 'VICTIM → CREATOR',   start: 107.2, end: 111.0 },
];

// The narrator, painted into the picture. Every line is an optional voice-over
// slot: put <id>.mp3|wav|ogg in a folder and open the page with ?vo=<folder>/.
// No voices are generated or bundled.
export const NARRATION = [
  { id: 'N01', start: 3.4,   end: 6.8,   text: 'Most mornings start the same way.' },
  { id: 'N02', start: 7.1,   end: 11.6,  text: 'Before your feet touch the floor,\nyou’re already back in the past.' },
  { id: 'N03', start: 15.8,  end: 19.6,  text: 'Familiar thoughts lead to the same choices.' },
  { id: 'N04', start: 19.9,  end: 24.0,  text: 'The same choices lead to the same\nbehaviors, and the same experiences.' },
  { id: 'N05', start: 24.3,  end: 28.2,  text: 'Those experiences create the same emotions…' },
  { id: 'N06', start: 28.5,  end: 31.9,  text: '…and those emotions drive the same thoughts.' },
  { id: 'N07', start: 32.2,  end: 36.3,  text: 'Do it long enough, Dispenza says,\nand the body memorizes the feeling.' },
  { id: 'N08', start: 36.6,  end: 40.4,  text: 'Your future starts to look\na lot like your past.' },
  { id: 'N09', start: 43.6,  end: 47.6,  text: 'Most of this runs on autopilot:\nunconscious habits.' },
  { id: 'N10', start: 48.0,  end: 52.3,  text: 'Between you and that program\nsits the analytical mind.' },
  { id: 'N11', start: 52.6,  end: 57.4,  text: 'Judging, planning, worrying. Fast beta waves\nkeep the gate shut.' },
  { id: 'N12', start: 57.7,  end: 62.2,  text: 'In meditation the waves slow down,\nto alpha, then theta.' },
  { id: 'N13', start: 62.5,  end: 67.4,  text: 'The analytical mind steps aside,\nand the program is open to change.' },
  { id: 'N14', start: 69.6,  end: 72.2,  text: 'Close your eyes.' },
  { id: 'N15', start: 72.8,  end: 77.4,  text: 'Rehearse a future you want, in detail.\nWho you’ll be. How you’ll act.' },
  { id: 'N16', start: 77.7,  end: 82.2,  text: 'Feel it before it happens.\nThen rehearse it again.' },
  { id: 'N17', start: 82.5,  end: 86.9,  text: 'Nerve cells that fire together\nwire together.' },
  { id: 'N18', start: 87.2,  end: 92.0,  text: 'Do it enough, and the brain looks\nas if it has already happened.' },
  { id: 'N19', start: 92.6,  end: 96.4,  text: 'It stops being a record of the past…' },
  { id: 'N20', start: 96.8,  end: 101.2, text: '…and becomes a map to the future.' },
  { id: 'N21', start: 107.4, end: 112.6, text: 'Cause and effect: we wait for something out there\nto change how we feel in here.' },
  { id: 'N22', start: 113.0, end: 119.4, text: 'Something happens, and we react.\nA victim of circumstance.' },
  { id: 'N23', start: 120.6, end: 124.6, text: 'The quantum model runs the other way.' },
  { id: 'N24', start: 124.9, end: 129.3, text: 'A clear intention, joined with\nan elevated emotion, comes first.' },
  { id: 'N25', start: 129.6, end: 134.6, text: 'You change on the inside\nbefore the outside shows it.' },
  { id: 'N26', start: 135.0, end: 140.4, text: 'From victim of your life\nto creator of it.' },
  { id: 'N27', start: 141.5, end: 145.6, text: 'Tomorrow, before the phone:\nrehearse who you’re becoming.' },
];

// The loop's light accelerates lap after lap. Angle (radians, from THOUGHTS,
// clockwise as seen head-on) as a pure function of t, shared by picture and sound.
const W0 = 0.55, ACC = 0.105;
export function loopAngle(t) {
  const u = Math.max(0, t - CUE.loop);
  return W0 * u + 0.5 * ACC * u * u;
}
// Times at which the light passes THOUGHTS (angle = 2πk), for the tick track.
export function loopLaps() {
  const out = [];
  for (let k = 1; k < 40; k++) {
    const th = 2 * Math.PI * k;
    const u = (-W0 + Math.sqrt(W0 * W0 + 2 * ACC * th)) / ACC;
    const t = CUE.loop + u;
    if (t > CUE.dive + 1.5) break;
    out.push(t);
  }
  return out;
}

export function formatTime(t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
