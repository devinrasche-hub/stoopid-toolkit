import { clamp, mulberry32 } from './util.js';
import { LOG } from './timeline.js';

// The moderation log: an open spread, 1400×900 canvas px (left page 0–700,
// right page 700–1400). Entries are written a letter at a time in the
// operator's hand; the pen's position is exported so the hand can follow it.

const HAND = '"Marker Felt", "Chalkboard SE", "Comic Sans MS", "Segoe Print", "Bradley Hand", sans-serif';
const SIZE = 40, LINE = 58;

// where each entry's lines go
const SLOTS = [[90, 150], [90, 400], [90, 560], [90, 720], [770, 150]];
export const LINES = LOG.flatMap((e, k) => e.lines.map((text, i) => ({ k, text, x: SLOTS[k][0], y: SLOTS[k][1] + i * LINE })));

const glyphs = (() => {
  const g = document.createElement('canvas').getContext('2d');
  return LINES.map((L, j) => {
    const rnd = mulberry32(300 + j);
    let x = L.x;
    return [...L.text].map((ch) => {
      const size = SIZE + (rnd() - 0.5) * 4;
      g.font = `600 ${size}px ${HAND}`;
      const w = g.measureText(ch).width * 0.96;
      const out = { ch, x, y: L.y + (rnd() - 0.5) * 3, rot: (rnd() - 0.5) * 0.08, size, w };
      x += w + (ch === ' ' ? 3 : 1);
      return out;
    });
  });
})();

// Letters written of each line at time t: an entry's letters are spread
// evenly over its [start, end].
function written(t) {
  return LINES.map((L, j) => {
    const e = LOG[L.k];
    const before = LINES.slice(0, j).filter((M) => M.k === L.k).reduce((n, M) => n + M.text.length, 0);
    const total = e.lines.reduce((n, s) => n + s.length, 0);
    const done = clamp((t - e.start) / (e.end - e.start)) * total - before;
    return clamp(done, 0, L.text.length);
  });
}

// The pen tip (canvas px) at time t, and whether it's on the paper.
export function penAt(t) {
  const w = written(t);
  let last = null;
  for (let j = 0; j < LINES.length; j++) {
    const e = LOG[LINES[j].k], G = glyphs[j];
    if (t < e.start) return { x: G[0].x - 8, y: G[0].y - 12, down: false, j };
    if (w[j] < G.length) {
      const i = Math.min(G.length - 1, Math.floor(w[j])), f = w[j] - i, gl = G[i];
      return { x: gl.x + gl.w * f, y: gl.y - gl.size * 0.3 + Math.sin(f * Math.PI * 3) * gl.size * 0.25, down: gl.ch !== ' ', j };
    }
    last = { x: G[G.length - 1].x + G[G.length - 1].w + 6, y: G[G.length - 1].y - 8, down: false, j };
  }
  return last;
}

export const logKey = (t) => written(t).map((x) => Math.round(x * 2)).join('.');

export function drawLog(g, w, h, t) {
  const rnd = mulberry32(12);
  g.fillStyle = '#bdb8a6'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(70,60,40,${rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * h, 1.6, 1.6); }
  // the gutter
  const gr = g.createLinearGradient(w / 2 - 60, 0, w / 2 + 60, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(60,50,30,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(w / 2 - 60, 0, 120, h);
  // ruled lines and the margin
  g.strokeStyle = 'rgba(80,110,160,0.35)'; g.lineWidth = 2;
  for (let y = 162; y < h - 20; y += LINE) { g.beginPath(); g.moveTo(30, y); g.lineTo(w / 2 - 30, y); g.moveTo(w / 2 + 30, y); g.lineTo(w - 30, y); g.stroke(); }
  g.strokeStyle = 'rgba(190,70,60,0.4)'; [74, w / 2 + 74].forEach((x) => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); });
  const wr = written(t);
  glyphs.forEach((G, j) => {
    G.forEach((gl, i) => {
      if (i >= wr[j] || gl.ch === ' ') return;
      const part = clamp(wr[j] - i);
      g.save(); g.translate(gl.x, gl.y); g.rotate(gl.rot);
      g.beginPath(); g.rect(-3, -gl.size, gl.w * part + 4, gl.size * 2); g.clip();
      g.font = `600 ${gl.size}px ${HAND}`; g.textBaseline = 'alphabetic';
      g.fillStyle = '#1d2433'; g.fillText(gl.ch, 0, gl.size * 0.3);
      g.restore();
    });
  });
}
