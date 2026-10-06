// ─────────────────────────────────────────────────────────────────────────────
// STILL HERE — STOOPID AFTER HOURS 03 — the master timeline.
//
//   THE ONE IDEA   Your family does not need an audience to notice your absence.
//   THE FLIP       The station presents leaving as disappearing; outside it,
//                  someone has been waiting for you to come home.
//   THE ANCHOR     A father's bedtime ritual: one more minute beside the bed.
//                  "You forgot our minute." (fictional; grounded in Dev's life as a dad)
// ─────────────────────────────────────────────────────────────────────────────

export const DURATION = 120;

export const CUE = {
  // 0–8 AUTOMATIC RETURN
  upNext: 2.0,
  pullStart: 4.0,
  selected: 6.0,
  // 8–20 HOME, APPARENTLY
  dad1: 11.0,
  pullStop: 11.0,
  turnStart: 13.0,
  knewYou: 16.0,
  turnEnd: 20.0,
  // 20–33 SOMETHING TOO PERFECT
  hallway: 20.0,
  learned: 24.0,
  doorway: 28.0,
  recOn: 30.0,
  // 33–45 THE ASSIGNMENT
  book: 33.0,
  slide: 34.6,
  bePresent: 37.0,
  lookNatural: 40.0,
  again: 42.0,
  // 45–58 THE REAL SIGNAL
  humCut: 45.0,
  knocks: [45.6, 46.15, 46.7],
  dad2: 48.0,
  minute: 51.0,
  tiltDown: 55.0,
  // 58–72 THE FLIP
  closer: 58.0,
  notRecorded: 60.0,
  chairShot: 64.0,
  backToStrip: 68.0,
  noticed: 68.0,
  doorForms: 68.6,
  // 72–87 THE PRICE OF LEAVING
  approach: 72.0,
  teal: 74.0,
  tallyInsert: 74.6,
  endSession: 74.9,
  audience: 78.0,
  turnBack: 79.0,
  keepWatching: 82.0,
  turnToDoor: 84.4,
  youCanGo: 85.0,
  // 87–101 THE HANDLE
  handle: 87.0,
  handleTurn: 89.0,
  silent: 92.0,
  doorOpen: 96.0,
  dad3: 96.4,
  // 101–114 OUR MINUTE
  realRoom: 101.0,
  walk: 103.0,
  sit: 106.0,
  handOut: 106.8,
  justAMinute: 108.0,
  imHere: 111.0,
  // 114–120 STILL HERE
  settle: 114.4,
  page: 115.2,
  title: 116.0,
  end: 118.0,
};

export const SHOTS = [
  { id: '1A', start: 0,                 end: CUE.hallway,      scene: 'home',  world: 'false', note: 'AUTOPLAY card on a CRT; pull back; DAD?; turn to the hallway' },
  { id: '2A', start: CUE.hallway,       end: CUE.doorway,      scene: 'home',  world: 'false', note: 'Hallway, three pictures of the same couch' },
  { id: '2B', start: CUE.doorway,       end: CUE.book,         scene: 'home',  world: 'false', note: 'The staged bedroom; the red light' },
  { id: '3A', start: CUE.book,          end: CUE.closer,       scene: 'home',  world: 'false', note: 'The book; the tally; knocks; the minute; the strip of light' },
  { id: '4A', start: CUE.closer,        end: CUE.chairShot,    scene: 'home',  world: 'false', note: 'Closer to the wall' },
  { id: '4B', start: CUE.chairShot,     end: CUE.backToStrip,  scene: 'home',  world: 'false', note: 'Dust on the chair; one sheet; the cord' },
  { id: '4C', start: CUE.backToStrip,   end: CUE.tallyInsert,  scene: 'home',  world: 'false', note: 'A door forms; the lights turn' },
  { id: '5A', start: CUE.tallyInsert,   end: CUE.turnBack,     scene: 'home',  world: 'false', note: 'The camera tally display' },
  { id: '5B', start: CUE.turnBack,      end: CUE.handle,       scene: 'home',  world: 'false', note: 'The audience through the doorway; turn to the door' },
  { id: '6A', start: CUE.handle,        end: CUE.doorOpen,     scene: 'home',  world: 'false', note: 'The handle' },
  { id: '6B', start: CUE.doorOpen,      end: CUE.realRoom,     scene: 'home',  world: 'false', note: 'The door opens on lamplight' },
  { id: '7A', start: CUE.realRoom,      end: CUE.title,        scene: 'real',  world: 'real',  note: 'Our minute' },
  { id: '8A', start: CUE.title,         end: DURATION,         scene: 'none',  world: 'real',  note: 'Title' },
];

export function shotAt(t) {
  for (const s of SHOTS) if (t >= s.start && t < s.end) return s;
  return SHOTS[SHOTS.length - 1];
}

// Spoken lines, shown as captions painted into the picture.
//   voice 'station'   — the station's imitation: uppercase, faint raster instability
//   voice 'algorithm' — the narrator
//   voice 'family'    — clean, stable typography; never touched by station effects
// Every line is an optional voice-over slot: put <id>.mp3|wav|ogg in a folder
// and open the page with ?vo=<folder>/. No voices are generated or bundled.
export const NARRATION = [
  { id: 'S01', voice: 'station',   start: 11.0,  end: 13.6,  text: 'DAD?' },
  { id: 'A01', voice: 'algorithm', start: 24.0,  end: 27.8,  text: 'It has learned what makes you stay.' },
  { id: 'F01', voice: 'family',    start: 48.0,  end: 50.4,  text: 'Dad?' },
  { id: 'F02', voice: 'family',    start: 51.0,  end: 55.2,  text: 'You forgot our minute.' },
  { id: 'A02', voice: 'algorithm', start: 60.0,  end: 63.6,  text: 'That wasn’t in the recording.' },
  { id: 'A03', voice: 'algorithm', start: 68.0,  end: 71.8,  text: 'Someone noticed you were gone.' },
  { id: 'A04', voice: 'algorithm', start: 82.0,  end: 84.6,  text: 'They can keep watching.' },
  { id: 'A05', voice: 'algorithm', start: 85.0,  end: 87.6,  text: 'You can go.' },
  { id: 'S02', voice: 'station',   start: 92.0,  end: 95.8,  text: 'WHO WILL YOU BE WITHOUT US?' },
  { id: 'F03', voice: 'family',    start: 96.4,  end: 99.4,  text: 'Dad.' },
  { id: 'F04', voice: 'family',    start: 108.0, end: 110.6, text: 'Just a minute?' },
  { id: 'F05', voice: 'family',    start: 111.0, end: 114.0, text: 'I’m here.' },
];

export function formatTime(t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
