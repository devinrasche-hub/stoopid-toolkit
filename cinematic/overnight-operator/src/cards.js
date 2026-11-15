import * as THREE from 'three';
import { CUE, NARRATION } from './timeline.js';
import { clamp, smooth, hash } from './util.js';

// Two 1920×1080 layers composited in the final pass (so recordings and frame
// renders include them):
//   card — opaque full frame: the closing title with its credits
//   text — transparent captions: the voice on the talkback, wavering on its raster

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';

function layer() {
  const canvas = document.createElement('canvas');
  canvas.width = 1920; canvas.height = 1080;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return { canvas, g: canvas.getContext('2d'), texture, key: null };
}

function text(g, s, x, y, { size, weight = '400', color, spacing = 0, alpha = 1, shadow = 0 }) {
  g.save();
  g.globalAlpha = alpha;
  g.font = `${weight} ${size}px ${SANS}`;
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  if (shadow) { g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = shadow; }
  g.fillText(s, x, y);
  g.restore();
}

export class Cards {
  constructor() {
    this.card = layer();
    this.text = layer();
    this.texture = this.card.texture;
    this.textTexture = this.text.texture;
    this.scratch = document.createElement('canvas');
    this.scratch.width = 1920; this.scratch.height = 200;
  }

  paint(L, key, fn) {
    if (key === L.key) return;
    L.key = key;
    L.g.setTransform(1, 0, 0, 1, 0, 0);
    L.g.clearRect(0, 0, 1920, 1080);
    fn(L.g, 1920, 1080);
    L.texture.needsUpdate = true;
  }

  // Station text: drawn once, then copied back in thin horizontal bands, some
  // nudged sideways for a frame or two. Deterministic per 1/12 s.
  stationText(g, s, y, op, t) {
    const sc = this.scratch, sg = sc.getContext('2d');
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.clearRect(0, 0, sc.width, sc.height);
    text(sg, s, 960, 100, { size: 58, weight: '600', color: '#ece6d6', spacing: 6, shadow: 16 });
    const f = Math.floor(t * 12);
    const band = 4;
    for (let yy = 0; yy < sc.height; yy += band) {
      const hsh = hash(yy * 0.37 + f * 13.1);
      const off = hsh > 0.86 ? (hash(yy + f) - 0.5) * 14 : 0;
      g.globalAlpha = op * (0.9 + 0.1 * hash(yy * 1.7 + f));
      g.drawImage(sc, 0, yy, sc.width, band, off, y - 100 + yy, sc.width, band);
    }
    // a faint misregistered ghost
    g.globalAlpha = op * 0.16;
    g.globalCompositeOperation = 'lighter';
    g.filter = 'hue-rotate(160deg)';
    g.drawImage(sc, 3, y - 100);
    g.filter = 'none';
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }

  update(t, { captions = true } = {}) {
    let cap = null;
    for (const n of NARRATION) if (t >= n.start && t < n.end) cap = n;
    let textMix = 0;
    if (cap && captions) {
      textMix = 1;
      const op = smooth(cap.start, cap.start + 0.35, t) * (1 - smooth(cap.end - 0.5, cap.end, t));
      const key = `${cap.id}${Math.round(op * 40)}${Math.floor(t * 12)}`;
      this.paint(this.text, key, (g, w, h) => {
        if (cap.id === 'T01') text(g, 'TALKBACK', w / 2, h * 0.85 - 58, { size: 22, color: '#d0584a', spacing: 11, alpha: op * 0.85 });
        this.stationText(g, cap.text, h * 0.85, op, t);
      });
    }

    if (t >= CUE.title) {
      const a1 = smooth(CUE.title + 0.2, CUE.title + 0.9, t);
      const a2 = smooth(CUE.title + 0.7, CUE.title + 1.5, t);
      const a3 = smooth(CUE.end, CUE.end + 0.5, t);
      const a4 = smooth(CUE.credits, CUE.credits + 0.6, t);
      this.paint(this.card, `t${q(a1)}${q(a2)}${q(a3)}${q(a4)}`, (g, w, h) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        text(g, 'THE STOOPID SHOW', w / 2, h * 0.4, { size: 26, color: '#d9d6c6', spacing: 16, alpha: a1 });
        text(g, 'OVERNIGHT OPERATOR', w / 2, h * 0.495, { size: 72, weight: '300', color: '#efe9dc', spacing: 22, alpha: a2 });
        text(g, 'END.', w / 2, h * 0.6, { size: 20, color: '#9a958a', spacing: 12, alpha: a3 });
        text(g, 'Produced by @stoopidshow & The Internet', w / 2, h * 0.79, { size: 20, color: '#7d7a72', spacing: 2, alpha: a4 });
        text(g, 'Rules (followed)  ·  Rule 7 (you)  ·  Fish (not microwaved)', w / 2, h * 0.83, { size: 20, color: '#7d7a72', spacing: 2, alpha: a4 });
      });
      return { mix: smooth(CUE.title, CUE.title + 0.25, t), textMix };
    }
    // the first moment: black, until the set warms up
    if (t < 1.6) {
      this.paint(this.card, 'black', (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); });
      return { mix: 1 - smooth(1.0, 1.6, t), textMix };
    }
    return { mix: 0, textMix };
  }
}
const q = (x) => Math.round(clamp(x) * 30);
