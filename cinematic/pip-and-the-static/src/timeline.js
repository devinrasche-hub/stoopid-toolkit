// ─────────────────────────────────────────────────────────────────────────────
// PIP AND THE STATIC — STOOPID AFTER HOURS 08 — the master timeline.
//
//   THE ONE IDEA   You remember it because it remembered you.
//   THE FLIP       Pip writes one more friend on the board: STOO.
//   THE ANCHOR     02's four-note hold melody is Pip's theme.
// ─────────────────────────────────────────────────────────────────────────────

export const DURATION = 120;

export const CUE = {
  // 0–10 THE THREAD
  posts: 0.8,
  hum: 7.2,
  // 10–20 THE ARCHIVE
  archive: 10.0,
  press: 17.2,
  // 20–36 THE TAPE
  tracking: 18.0,
  tape: 20.0,
  popUp: 24.5,
  hi: 26.0,
  hello: 30.5,
  // 36–48 THE BOARD
  board: 36.0,
  // 48–58 THE ONE JOKE
  grape: 48.0,
  note: 52.0,
  // 58–70 THE ONES WHO FORGOT
  forgot: 58.0,
  // 70–80 THE THREAD AGAIN
  paused: 70.0,
  // 80–98 ONE MORE FRIEND
  resume: 80.0,
  oneMore: 81.5,
  write: 84.5,
  written: 90.5,
  never: 91.5,
  stare: 94.5,
  // 98–106 THE THEME
  theme: 98.0,
  blue: 102.0,
  bars: 104.0,
  // 106–112 THE LABEL
  label: 106.0,
  airs: 107.6,
  // 112–120 TITLE
  title: 112.0,
  end: 115.0,
  credits: 117.0,
};

// The forum thread on the archive CRT: [time it appears, text]
export const POSTS = [
  [0.8, 'does anyone remember PIP AND THE STATIC?'],
  [2.4, 'the puppet with the button eyes'],
  [3.9, 'it came on after the sign-off'],
  [5.4, 'my brother says I made it up'],
  [6.9, 'the song went like this'],
  [72.0, 'it said hello to me by name'],
  [74.2, 'I think it said hello to everyone'],
  [76.6, 'did anyone ever stop watching?'],
];

// The names already on Pip's board, each in a different child's hand.
export const FRIENDS = ['SAM', 'NOOR', 'ELI', 'TESS', 'JUNO', 'BEN', 'RAY', 'MILO', 'IVY', 'OWEN', 'ADA', 'LEO'];

// Which friend Pip's hand is touching, over the board beat.
export const TOUCH = { start: 38.5, each: 0.75 };

export const SHOTS = [
  { id: '1A', start: 0,            end: CUE.archive,  scene: 'archive', note: 'The thread on a CRT in the dark' },
  { id: '2A', start: CUE.archive,  end: CUE.tracking, scene: 'archive', note: 'Pull back: the archive; the tape; PLAY' },
  { id: '2B', start: CUE.tracking, end: CUE.tape,     scene: 'archive', note: 'Tracking lines on the CRT' },
  { id: '3A', start: CUE.tape,     end: CUE.board,    scene: 'pip',     note: 'The tape: the stage, the sun, Pip pops up' },
  { id: '3B', start: CUE.board,    end: CUE.grape,    scene: 'pip',     note: 'The board of friends' },
  { id: '4A', start: CUE.grape,    end: CUE.forgot,   scene: 'none',    note: 'THE STATIC — NOW IN GRAPE!' },
  { id: '5A', start: CUE.forgot,   end: CUE.paused,   scene: 'pip',     note: 'Some friends stopped watching' },
  { id: '6A', start: CUE.paused,   end: CUE.resume,   scene: 'archive', note: 'Paused on Pip; the thread goes on' },
  { id: '7A', start: CUE.resume,   end: CUE.stare,    scene: 'pip',     note: 'One more friend: S T O O' },
  { id: '7B', start: CUE.stare,    end: CUE.blue,     scene: 'pip',     note: 'Pip looks at you; the theme' },
  { id: '8A', start: CUE.blue,     end: CUE.label,    scene: 'archive', note: 'Blue, then the station\'s bars' },
  { id: '8B', start: CUE.label,    end: CUE.title,    scene: 'archive', note: 'The label: (AIRS NIGHTLY)' },
  { id: '9A', start: CUE.title,    end: DURATION,     scene: 'none',    note: 'Title and credits' },
];

export function shotAt(t) {
  for (const s of SHOTS) if (t >= s.start && t < s.end) return s;
  return SHOTS[SHOTS.length - 1];
}

// Pip speaks only in captions, wavering on the tape. No voices are generated.
export const NARRATION = [
  { id: 'P01', voice: 'pip', start: 26.0, end: 28.6, text: 'Hi, friends! It’s me, Pip!' },
  { id: 'P02', voice: 'pip', start: 30.5, end: 34.0, text: 'Let’s say hello to everybody.' },
  { id: 'P03', voice: 'pip', start: 39.0, end: 44.5, text: 'Hello, Sam. Hello, Noor. Hello, Eli…' },
  { id: 'P04', voice: 'pip', start: 60.0, end: 63.4, text: 'Some friends stopped watching.' },
  { id: 'P05', voice: 'pip', start: 64.4, end: 68.6, text: 'That’s okay. I kept their names.' },
  { id: 'P06', voice: 'pip', start: 81.5, end: 84.2, text: 'One more friend.' },
  { id: 'P07', voice: 'pip', start: 91.5, end: 94.3, text: 'He never stopped watching.' },
];

export function formatTime(t) {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
