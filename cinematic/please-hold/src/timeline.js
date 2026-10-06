// ─────────────────────────────────────────────────────────────────────────────
// PLEASE HOLD — STOOPID AFTER HOURS 02 — the master timeline.
// Every shot, caption, light change and sound reads its times from here.
// ─────────────────────────────────────────────────────────────────────────────

export const DURATION = 120;

export const CUE = {
  // 0–12 STILL HERE
  fadeUp: 0.0,
  thankYou: 3.2,           // "Stay?" → "THANK YOU FOR HOLDING."
  grip: 5.0,               // the hand tightens
  notice: 6.4,             // its owner notices something behind us
  doorLamp: 7.2,           // amber HOLD lamp clicks on over the service door
  pullBack: 9.2,

  // 12–27 THE FIRST EXIT
  exitWide: 12.0,
  doorAjar: 12.8,
  gesture: 13.6,
  passGlass: 15.5,
  reflHoldA: 17.2,         // the reflection discrepancy is easiest to read here
  reflHoldB: 21.6,
  signFlip: 24.6,          // EXIT → CONTINUE

  // 27–43 CONTINUITY
  corridor: 27.0,
  liftOpenStart: 33.6,
  liftOpenEnd: 35.0,
  portalShot: 33.5,
  corridorSwap: 36.0,      // the corridor behind us rebuilds itself while we look away
  turnBack: 38.5,
  turnEnd: 42.4,
  rackFocus: 41.6,
  ring: 43.2,

  // 43–54 CUSTOMER SUPPORT
  phone: 44.5,
  lift: 44.9,              // receiver rises
  waitText: 45.2,
  melody1: 45.5,
  melodyLow: 50.2,
  dontHangUp: 51.6,
  settle: 52.6,

  // 54–72 THE WRONG AUDIENCE
  liftCar: 54.0,
  insideCar: 59.0,
  doorsClose: 59.5,
  floorB1: 61.6, floorB2: 62.8, floorB3: 64.0, floorYou: 65.4,
  turnToGlass: 65.9,
  glassReveal: 67.6,
  block: 70.3,             // the entity steps between us and the bright screen

  // 72–91 END TRANSMISSION
  doorsOpen: 72.0,
  stepAside: 74.6,
  chamberWide: 77.5,
  walk: 83.0,
  wave: 85.0,

  // 91–107 LET IT END
  switchShot: 91.0,
  reach: 92.0,
  hesitate: 94.6,
  handOn: 102.4,
  throwSwitch: 103.6,
  groupsOff: 104.0,

  // 107–120 RELEASE
  release: 107.0,
  outside: 107.4,
  exitOpen: 108.6,
  moveOut: 111.0,
  title: 114.5,
  autoplayLamp: 118.0,
  autoplayText: 118.4,
};

export const SHOTS = [
  { id: '1A', start: 0,                 end: CUE.exitWide,     scene: 'station',  note: 'Previous ending; THANK YOU FOR HOLDING; pull back' },
  { id: '2A', start: CUE.exitWide,      end: CUE.passGlass,    scene: 'station',  note: 'Reverse: the service door, the gesture' },
  { id: '2B', start: CUE.passGlass,     end: CUE.corridor,     scene: 'station',  note: 'Past the glass: the reflection keeps the old layout' },
  { id: '3A', start: CUE.corridor,      end: CUE.portalShot,   scene: 'corridor', note: 'Continuity, symmetric dolly' },
  { id: '3B', start: CUE.portalShot,    end: CUE.turnBack,     scene: 'corridor', note: 'Elevator opens onto the control room (locked off)' },
  { id: '3C', start: CUE.turnBack,      end: CUE.phone,        scene: 'corridor', note: 'Turn back: the corridor is longer; rack focus' },
  { id: '4A', start: CUE.phone,         end: CUE.liftCar,      scene: 'corridor', note: 'The telephone (locked off)' },
  { id: '5A', start: CUE.liftCar,       end: CUE.insideCar,    scene: 'corridor', note: 'Ordinary elevator; it holds the door' },
  { id: '5B', start: CUE.insideCar,     end: CUE.doorsOpen,    scene: 'lift',     note: 'Inside: floors, the rear glass, the gallery' },
  { id: '6A', start: CUE.doorsOpen,     end: CUE.chamberWide,  scene: 'lift',     note: 'Doors open onto the chamber; it steps aside' },
  { id: '6B', start: CUE.chamberWide,   end: CUE.walk,         scene: 'lift',     note: 'The chamber, wide' },
  { id: '6C', start: CUE.walk,          end: CUE.switchShot,   scene: 'lift',     note: 'The walkway; the audience wakes' },
  { id: '7A', start: CUE.switchShot,    end: CUE.release,      scene: 'lift',     note: 'The switch (locked off, silent climax)' },
  { id: '8A', start: CUE.release,       end: CUE.title,        scene: 'lift',     note: 'Morning' },
  { id: '8B', start: CUE.title,         end: DURATION,         scene: 'none',     note: 'Title' },
];

export function shotAt(t) {
  for (const s of SHOTS) if (t >= s.start && t < s.end) return s;
  return SHOTS[SHOTS.length - 1];
}

// The Algorithm. Captions are painted into the picture, so recordings and
// frame renders include them. Each cue is also a voice-over slot: put
// `<id>.mp3|wav|ogg` in a folder and open the page with `?vo=<folder>/`.
//   size  — relative caption size; the narrator gets quieter as it understands
//   label — show "THE ALGORITHM" above the line
export const NARRATION = [
  { id: 'H01', start: 7.8,   end: 10.3,  label: true, size: 1.0,  text: 'The viewer has remained.' },
  { id: 'H02', start: 10.8,  end: 13.8,  size: 1.0,  text: 'That was not a request from me.' },
  { id: 'H03', start: 19.0,  end: 22.8,  size: 0.97, text: 'It appears to know a way out.' },
  { id: 'H04', start: 39.6,  end: 43.0,  size: 0.95, text: 'This corridor was shorter a moment ago.' },
  { id: 'H05', start: 66.6,  end: 69.6,  size: 0.92, text: 'I assumed you were the audience.' },
  { id: 'H06', start: 70.4,  end: 74.0,  size: 0.92, text: 'I may have been describing the wrong side of the glass.' },
  { id: 'H07', start: 85.6,  end: 88.2,  size: 0.88, text: 'It found the exit before.' },
  { id: 'H08', start: 88.9,  end: 91.4,  size: 0.88, text: 'It could not make itself use it.' },
  { id: 'H09', start: 96.4,  end: 99.6,  size: 0.84, text: 'You can let something end.' },
  { id: 'H10', start: 101.2, end: 103.6, size: 0.84, text: 'It still happened.' },
];

export function formatTime(t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
