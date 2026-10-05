// ─────────────────────────────────────────────────────────────────────────────
// PLEASE REMAIN SEEN — the master timeline.
// Every shot, caption, light change and sound is scheduled from this file.
// All times are seconds from the start of the broadcast.
// ─────────────────────────────────────────────────────────────────────────────

export const DURATION = 90;

// Named story beats. Visuals (world/shots) and audio both read these, so a beat
// can be retimed in one place.
export const CUE = {
  // 0–10 STATION IDENT
  fadeUp: 0.4,
  crtRelay: 0.95,          // relay click, CRT begins to warm
  crtOn: 1.15,
  identTitle: 2.2,          // "STOOPID AFTER HOURS"
  identSub: 3.3,            // "HALLOWEEN SPECIAL"
  identTextOut: 5.3,
  viewers1In: 5.7,          // "VIEWERS: 1"
  viewers1Out: 7.5,
  reverse: 7.2,             // cut: the doorway is empty in the real room
  metalFar1: 8.6,

  // 10–24 THE EMPTY CHAIR
  glassWide: 10.0,
  micDrift: 11.0,
  glassTight: 17.0,
  chairTurnStart: 18.4,
  chairTurnEnd: 23.2,
  shadowCrossStart: 21.2,
  shadowCrossEnd: 23.6,

  // 24–40 THE HALLWAY
  hallway: 24.0,
  hallInsert: 31.5,
  viewers2: 34.3,
  hallHold: 35.5,
  hallStop: 39.0,
  behindRustle: 37.6,

  // 40–49 REQUIRED INTERRUPTION
  card: 40.0,
  cardStuck: 42.6,          // progress freezes at 99%
  chime: 45.3,
  tearStart: 47.6,
  tearEnd: 48.9,

  // 49–67 THE OBSERVER
  arc: 47.6,                // the 3D shot is already running behind the card
  tallyAngle: 58.0,
  tallyOn: 60.9,
  monitorInsert: 63.5,

  // 67–81 DISCONNECTION
  disconnect: 67.0,
  m3Off: 68.6,
  m2Off: 71.4,
  m1Off: 74.2,
  finalCrt: 76.0,
  viewersFinal: 76.6,
  whoWatching: 78.4,
  soundFallaway: 78.6,

  // 81–90 THE REQUEST
  black: 81.0,
  stay: 82.6,
  pullBack: 84.4,
  handIn: 85.1,
  titleCard: 87.2,
  titleLine2: 87.9,
  relayEnd: 89.3,
};

// Shot list. `scene` selects which 3D environment renders; 'card' and 'none'
// render no 3D.
export const SHOTS = [
  { id: '1A', start: 0,               end: CUE.reverse,        scene: 'station',  note: 'Push to CRT through foreground clutter' },
  { id: '1B', start: CUE.reverse,     end: CUE.glassWide,      scene: 'station',  note: 'Reverse: the doorway is empty' },
  { id: '2A', start: CUE.glassWide,   end: CUE.glassTight,     scene: 'station',  note: 'Studio through glass, wide' },
  { id: '2B', start: CUE.glassTight,  end: CUE.hallway,        scene: 'station',  note: 'Chair through glass, long lens' },
  { id: '3A', start: CUE.hallway,     end: CUE.hallInsert,     scene: 'corridor', note: 'Forward track' },
  { id: '3B', start: CUE.hallInsert,  end: CUE.hallHold,       scene: 'corridor', note: 'Insert: the far CRT feed' },
  { id: '3C', start: CUE.hallHold,    end: CUE.card,           scene: 'corridor', note: 'Track decelerates; we do not turn' },
  { id: '4A', start: CUE.card,        end: CUE.tearStart,      scene: 'card',     note: 'Station card' },
  { id: '5A', start: CUE.tearStart,   end: CUE.tallyAngle,     scene: 'station',  note: 'Arc around the entity' },
  { id: '5B', start: CUE.tallyAngle,  end: CUE.monitorInsert,  scene: 'station',  note: 'Low angle past studio camera; tally' },
  { id: '5C', start: CUE.monitorInsert, end: CUE.disconnect,   scene: 'station',  note: 'Control-room monitor insert' },
  { id: '6A', start: CUE.disconnect,  end: CUE.finalCrt,       scene: 'station',  note: 'Monitors die; it approaches' },
  { id: '6B', start: CUE.finalCrt,    end: CUE.black,          scene: 'station',  note: 'Final CRT' },
  { id: '7A', start: CUE.black,       end: CUE.titleCard,      scene: 'station',  note: 'Stay?' },
  { id: '7B', start: CUE.titleCard,   end: DURATION,           scene: 'none',     note: 'Title card' },
];

export function shotAt(t) {
  for (const s of SHOTS) if (t >= s.start && t < s.end) return s;
  return SHOTS[SHOTS.length - 1];
}

// The Algorithm's narration. Rendered as captions. Each cue is also a
// voice-over slot: drop a recording named `<id>.mp3` (or .wav) into a folder
// and open the page with `?vo=<folder>/` — the audio engine will play it at
// `start` without touching anything else in this file.
//   decay    — fraction of characters lost by the end of the line (breakdown)
//   truncate — the line stops being drawn at this fraction of its length
export const NARRATION = [
  { id: 'N01', start: 11.4, end: 15.7, label: true, text: 'Here we observe a creator in its natural habitat.' },
  { id: 'N02', start: 17.7, end: 20.8, text: 'The creator is absent.' },
  { id: 'N03', start: 32.4, end: 37.4, text: 'Something has remained to maintain engagement.' },
  { id: 'N04', start: 51.6, end: 55.4, text: 'It does not want to hurt you.' },
  { id: 'N05', start: 59.4, end: 63.6, text: 'It wants you to keep watching.' },
  { id: 'N06', start: 68.2, end: 71.0, text: 'If you leave…', decay: 0.18 },
  { id: 'N07', start: 72.5, end: 75.6, text: '…does it stop existing?', decay: 0.32, truncate: 0.8 },
];

export function formatTime(t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
