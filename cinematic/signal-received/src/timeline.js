// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL RECEIVED — STOOPID AFTER HOURS 04 — the master timeline.
//
//   THE ONE IDEA   What you make keeps traveling after you're gone.
//   THE FLIP       The bowl cuts appear: the watchers are fans. They aren't
//                  harvesting him. They're grieving him.
//   THE ANCHOR     The bedside minute from 03 is the last thing in the signal.
// ─────────────────────────────────────────────────────────────────────────────

export const DURATION = 120;

export const CUE = {
  // 0–8 THE END, AGAIN
  scan: 2.5,
  pullStart: 4.0,
  // 8–25 THE AUDIENCE
  audience: 8.0,
  habitat: 12.0,
  dolly: 17.0,
  headTurn: 18.2,
  longTime: 19.0,
  staticOn: 23.5,
  // 25–35 THE FLIP
  stoo: 25.0,
  crane: 28.0,
  cascade: 28.3,
  // 35–50 THE ONE JOKE
  region: 35.0,
  chime: 38.0,
  regionWide: 44.0,
  // 50–75 LIGHT DELAY
  origin: 50.0,
  transmitted: 52.0,
  lastFeed: 55.0,
  lastThing: 59.0,
  white: 63.5,
  noSignal: 64.5,
  sky: 66.0,
  fade: 69.0,
  ended: 71.0,
  // 75–100 THE GRIEF
  grief: 75.0,
  hand: 77.0,
  rewind: 80.0,
  replay: 82.0,
  imHere: 84.0,
  freeze: 88.0,
  profile: 89.0,
  tears: 91.0,
  hum: 90.5,
  madeIt: 93.0,
  nobody: 96.0,
  // 100–112 THE REPLY
  reply: 100.0,
  replyTo: 102.0,
  received: 104.0,
  arrival: 107.0,
  followBeam: 108.0,
  // 112–120 TITLE
  title: 112.0,
  end: 115.0,
  credits: 117.0,
};

export const SHOTS = [
  { id: '1A', start: 0,               end: CUE.audience,   scene: 'alien', world: 'alien', note: '03\'s END card on a CRT; pull back; a reflection' },
  { id: '2A', start: CUE.audience,    end: CUE.dolly,      scene: 'alien', world: 'alien', note: 'Behind the audience; heads lost in the dark' },
  { id: '2B', start: CUE.dolly,       end: CUE.stoo,       scene: 'alien', world: 'alien', note: 'Along the row; a head turns; static' },
  { id: '3A', start: CUE.stoo,        end: CUE.crane,      scene: 'alien', world: 'alien', note: 'Stoo on orange; bowl cuts in silhouette' },
  { id: '3B', start: CUE.crane,       end: CUE.region,     scene: 'alien', world: 'alien', note: 'Crane up; every screen switches to Stoo' },
  { id: '4A', start: CUE.region,      end: CUE.regionWide, scene: 'none',  world: 'alien', note: 'NO LONGER AVAILABLE IN YOUR REGION' },
  { id: '4B', start: CUE.regionWide,  end: CUE.origin,     scene: 'alien', world: 'alien', note: 'Every screen, the same message' },
  { id: '5A', start: CUE.origin,      end: CUE.sky,        scene: 'alien', world: 'alien', note: 'Origin; transmitted; the last transmission; white; NO SIGNAL' },
  { id: '5B', start: CUE.sky,         end: CUE.grief,      scene: 'alien', world: 'alien', note: 'The sky; a blue point goes out' },
  { id: '6A', start: CUE.grief,       end: CUE.profile,    scene: 'alien', world: 'alien', note: 'The hand on the CRT; rewind; the minute; Stoo' },
  { id: '6B', start: CUE.profile,     end: CUE.reply,      scene: 'alien', world: 'alien', note: 'They cry for Stoo; humming' },
  { id: '7A', start: CUE.reply,       end: CUE.title,      scene: 'alien', world: 'alien', note: 'The reply goes out' },
  { id: '8A', start: CUE.title,       end: DURATION,       scene: 'none',  world: 'alien', note: 'Title and credits' },
];

export function shotAt(t) {
  for (const s of SHOTS) if (t >= s.start && t < s.end) return s;
  return SHOTS[SHOTS.length - 1];
}

// The Algorithm's lines, painted into the picture as captions. Each is also an
// optional voice-over slot: put <id>.mp3|wav|ogg in a folder and open the page
// with ?vo=<folder>/. No voices are generated or bundled. The watchers never speak.
export const NARRATION = [
  { id: 'A01', voice: 'algorithm', start: 12.0, end: 16.4, text: 'Here we observe an audience in its natural habitat.' },
  { id: 'A02', voice: 'algorithm', start: 19.0, end: 23.0, text: 'It has been watching for a very long time.' },
  { id: 'A03', voice: 'algorithm', start: 59.0, end: 63.2, text: 'This is the last thing it sent.' },
  { id: 'A04', voice: 'algorithm', start: 71.0, end: 75.0, text: 'It ended forty years ago. They found out tonight.' },
  { id: 'A05', voice: 'algorithm', start: 93.0, end: 95.8, text: 'He made it anyway.' },
  { id: 'A06', voice: 'algorithm', start: 96.0, end: 99.8, text: 'He thought nobody was watching.' },
];

export function formatTime(t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
