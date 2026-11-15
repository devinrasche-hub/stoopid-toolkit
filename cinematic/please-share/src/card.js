import { clamp, smooth, mulberry32 } from './util.js';
import { WRITE } from './timeline.js';

// The laminated card taped to the console. Printed rules, black on tired
// off-white; rule 7 scratched out so hard the marker tore the lamination; and,
// at the end, the new rule 7 written by hand, a letter at a time.
//
// Canvas space is CARD_W × CARD_H. Everything that the camera or the hand
// needs to find (a rule's line, the pen's position) is exported in canvas
// pixels; world.js maps them onto the card in the room.

export const CARD_W = 1024, CARD_H = 1660;
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
// Hand-printed capitals. Whatever font the system offers is jittered per letter
// so it reads as handwriting even where only a plain sans exists.
const HAND = '"Marker Felt", "Chalkboard SE", "Comic Sans MS", "Segoe Print", "Bradley Hand", sans-serif';

export const RULES = [
  'The test pattern stays on until 5:00 AM. If it changes, do not change it back.',
  'Monitor 3 shows the studio. If the chair in there is facing you, look at this card until it isn’t.',
  'If the talkback light comes on, do not answer. Nobody is in the booth.',
  'Do not microwave fish in the break room. This is unrelated. It is still a rule.',
  'There are three monitors. If you count four, count again.',
  'The station does not have a request line. If it rings, it is not for you.',
  'If the operator',   // the start of the real rule 7; the rest was never meant to be read
  'When your shift is over, leave this card where you found it.',
];

const M = 78, TOP = 74, LINE = 48, SIZE = 38;

function wrap(g, s, width) {
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (g.measureText(next).width > width && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Layout once, with a scratch canvas: where each rule's lines go.
export const LAYOUT = (() => {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `400 ${SIZE}px ${SANS}`;
  const rules = [];
  let y = TOP + 200;
  RULES.forEach((s, i) => {
    const lines = i === 6 ? [s] : wrap(g, s, CARD_W - M * 2 - 64);
    rules.push({ n: i + 1, lines, y });
    y += lines.length * LINE + (i === 6 ? 210 : 22);   // rule 7 keeps room for what gets written there
  });
  // rule 7's handwriting sits in the space under the scratched rule; rule 9's under rule 8
  const r7 = rules[6];
  const after8 = y + 30;
  let k7 = 0, k9 = 0;
  const hand = WRITE.map((w) => (w.rule === 7
    ? { ...w, x: M + 40, y: r7.y + 74 + (k7++) * 58 }
    : { ...w, x: M + (k9 === 0 ? -6 : 40), y: after8 + (k9++) * 58 }));
  return { rules, hand, bottom: y };
})();

// Centre (canvas px) of a rule's text block, for the camera to frame.
export function ruleCenter(n) {
  const r = LAYOUT.rules[n - 1];
  return [CARD_W / 2, r.y + (r.lines.length - 1) * LINE / 2];
}

// Per-letter placement for the handwriting: deterministic jitter.
const glyphs = (() => {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  return LAYOUT.hand.map((h, k) => {
    const out = [];
    let x = h.x;
    const rnd = mulberry32(700 + k);
    for (const ch of h.text) {
      const size = 42 + (rnd() - 0.5) * 4;
      g.font = `700 ${size}px ${HAND}`;
      const w = g.measureText(ch).width * 0.98;
      out.push({ ch, x, y: h.y + (rnd() - 0.5) * 4, rot: (rnd() - 0.5) * 0.09, size, w });
      x += w + (ch === ' ' ? 4 : 1.5);
    }
    return out;
  });
})();

// How much of each handwritten line exists at time t (in letters, fractional).
function written(t) {
  return LAYOUT.hand.map((h, k) => {
    const n = glyphs[k].length;
    return clamp((t - h.start) / (h.end - h.start)) * n;
  });
}

// The pen's tip on the card at time t (canvas px), and whether it's on the card.
export function penAt(t) {
  const w = written(t);
  for (let k = 0; k < w.length; k++) {
    const G = glyphs[k], h = LAYOUT.hand[k];
    if (t < h.start) {
      // travelling to the start of this line
      return { x: G[0].x - 6, y: G[0].y - 10, down: false };
    }
    if (t <= h.end) {
      const i = Math.min(G.length - 1, Math.floor(w[k]));
      const f = w[k] - i;
      const gl = G[i];
      // inside a letter the tip makes a small up-and-down scribble
      const wob = Math.sin(f * Math.PI * 3) * gl.size * 0.28;
      return { x: gl.x + gl.w * f, y: gl.y - gl.size * 0.32 + wob, down: gl.ch !== ' ' };
    }
  }
  const G = glyphs[glyphs.length - 1], last = G[G.length - 1];
  return { x: last.x + last.w + 10, y: last.y - 6, down: false };
}

// Fresh ink dries over 2.2 s after its line's last letter.
const dryness = (t) => smooth(WRITE[WRITE.length - 1].end, WRITE[WRITE.length - 1].end + 2.2, t);

export function cardKey(t) {
  const w = written(t);
  const ink = Math.round(dryness(t) * 12);
  return `${w.map((x) => Math.round(x * 3)).join('.')}:${ink}`;
}

export function drawCard(g, w, h, t) {
  const rnd = mulberry32(5);
  // paper, a little yellowed toward the edges
  g.fillStyle = '#cfc9b6'; g.fillRect(0, 0, w, h);
  const grd = g.createRadialGradient(w * 0.5, h * 0.45, h * 0.2, w * 0.5, h * 0.5, h * 0.8);
  grd.addColorStop(0, 'rgba(255,250,235,0)'); grd.addColorStop(1, 'rgba(120,100,50,0.22)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(60,50,30,${rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * h, 1.6, 1.6); }
  // a coffee ring, years old
  g.strokeStyle = 'rgba(120,80,30,0.16)'; g.lineWidth = 9;
  g.beginPath(); g.arc(w * 0.8, h * 0.9, 92, 0.3, Math.PI * 1.85); g.stroke();
  g.lineWidth = 3; g.strokeStyle = 'rgba(120,80,30,0.1)'; g.beginPath(); g.arc(w * 0.8, h * 0.9, 80, 0, Math.PI * 2); g.stroke();

  const txt = (s, x, y, font, color, align = 'left', spacing = 0) => {
    g.save(); g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`; g.fillText(s, x, y); g.restore();
  };
  txt('RULES FOR WHOEVER RUNS', w / 2, TOP + 40, `700 50px ${SANS}`, '#151513', 'center', 3);
  txt('THE STATION AFTER MIDNIGHT', w / 2, TOP + 102, `700 50px ${SANS}`, '#151513', 'center', 3);
  g.fillStyle = '#151513'; g.fillRect(M, TOP + 146, w - M * 2, 4);

  for (const r of LAYOUT.rules) {
    txt(`${r.n}.`, M, r.y, `700 ${SIZE}px ${SANS}`, '#1a1a17');
    r.lines.forEach((s, i) => txt(s, M + 64, r.y + i * LINE, `400 ${SIZE}px ${SANS}`, '#24231f'));
  }

  // Rule 7: scratched out hard, again and again, until the lamination tore.
  const r7 = LAYOUT.rules[6];
  {
    const sr = mulberry32(77);
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let pass = 0; pass < 9; pass++) {
      g.strokeStyle = pass < 7 ? '#0b0b0a' : '#1c1c1a';
      g.lineWidth = 22 + sr() * 14;
      g.beginPath();
      let x = M + 50, y = r7.y + (sr() - 0.5) * 16;
      g.moveTo(x, y);
      while (x < w - M - 10) { x += 26 + sr() * 30; y = r7.y + (sr() - 0.5) * 34; g.lineTo(x, y); }
      g.stroke();
    }
    // the tears in the lamination: pale, ragged, catching the lamp
    g.strokeStyle = 'rgba(225,228,220,0.75)'; g.lineWidth = 2.2;
    for (let k = 0; k < 7; k++) {
      g.beginPath();
      let x = M + 70 + sr() * 600, y = r7.y + (sr() - 0.5) * 24;
      g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += 10 + sr() * 26; y += (sr() - 0.5) * 9; g.lineTo(x, y); }
      g.stroke();
    }
    g.restore();
  }

  // The new rule 7, a letter at a time. Fresh ink is glossy and catches the
  // lamp (burnt orange); it dries to black.
  const wr = written(t);
  const dry = dryness(t);
  glyphs.forEach((G, k) => {
    const n = wr[k];
    G.forEach((gl, i) => {
      if (i >= n || gl.ch === ' ') return;
      const part = clamp(n - i);   // the letter being written is drawn partly
      const age = n - i;           // letters since this one
      const wet = LAYOUT.hand[k].end < 0 ? 0 : (1 - dry) * clamp(1 - age / 14);
      g.save();
      g.translate(gl.x, gl.y); g.rotate(gl.rot);
      g.beginPath(); g.rect(-4, -gl.size, gl.w * part + 6, gl.size * 2); g.clip();
      g.font = `700 ${gl.size}px ${HAND}`; g.textBaseline = 'alphabetic';
      g.fillStyle = '#0d0c0b';
      g.lineWidth = 3.2; g.strokeStyle = '#0d0c0b'; g.lineJoin = 'round';
      g.strokeText(gl.ch, 0, gl.size * 0.36);
      g.fillText(gl.ch, 0, gl.size * 0.36);
      if (wet > 0.01) {
        g.globalAlpha = wet * 0.85; g.fillStyle = '#cc5500';
        g.fillText(gl.ch, -1, gl.size * 0.36 - 1);
      }
      g.restore();
    });
  });

  // tape at the corners
  g.fillStyle = 'rgba(235,230,200,0.55)';
  [[0, 0, -0.6], [w, 0, 0.6], [0, h, 0.6], [w, h, -0.6]].forEach(([x, y, r]) => {
    g.save(); g.translate(x, y); g.rotate(r); g.fillRect(-90, -26, 180, 52); g.restore();
  });
  // the lamination's edge
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
}
