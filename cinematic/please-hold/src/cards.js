import * as THREE from 'three';
import { CUE, NARRATION } from './timeline.js';
import { clamp, smooth, hash, lerp } from './util.js';

// Two 1920×1080 layers painted on canvases and composited in the final pass:
//   card — opaque, full frame (the closing title)
//   text — transparent (The Algorithm's captions)
// Because both are part of the rendered picture, browser recordings and
// frame-accurate renders include them.

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';

function layer() {
  const canvas = document.createElement('canvas');
  canvas.width = 1920; canvas.height = 1080;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return { canvas, g: canvas.getContext('2d'), texture, key: null };
}

function text(g, s, x, y, { size, weight = '400', color, align = 'center', spacing = 0, alpha = 1, font = SANS, shadow = 0 }) {
  g.save();
  g.globalAlpha = alpha;
  g.font = `${weight} ${size}px ${font}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
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
  }

  paint(L, key, fn) {
    if (key === L.key) return;
    L.key = key;
    L.g.setTransform(1, 0, 0, 1, 0, 0);
    L.g.clearRect(0, 0, 1920, 1080);
    fn(L.g, 1920, 1080);
    L.texture.needsUpdate = true;
  }

  // Returns { mix, tear, textMix } for the final pass.
  update(t, { captions = true } = {}) {
    // captions
    let cap = null;
    for (const n of NARRATION) if (t >= n.start && t < n.end) cap = n;
    let textMix = 0;
    if (cap && captions) {
      const op = smooth(cap.start, cap.start + 0.45, t) * (1 - smooth(cap.end - 0.55, cap.end, t));
      textMix = 1;
      this.paint(this.text, `${cap.id}${Math.round(op * 40)}`, (g, w, h) => {
        const size = Math.round(54 * cap.size);
        // the narrator gets quieter: smaller, dimmer, closer to the centre line
        const y = h * lerp(0.855, 0.84, 1 - cap.size);
        const a = op * lerp(0.95, 0.78, (1 - cap.size) * 5);
        if (cap.label) text(g, 'THE ALGORITHM', w / 2, y - size * 1.05, { size: 22, color: '#6fa59d', spacing: 11, alpha: a * 0.8 });
        text(g, cap.text, w / 2, y, { size, weight: '300', color: '#e6e3d4', spacing: 1.5, alpha: a, shadow: 18 });
      });
    }

    if (t >= CUE.title) {
      const a1 = smooth(CUE.title + 0.25, CUE.title + 1.0, t);
      const a2 = smooth(CUE.title + 0.9, CUE.title + 1.7, t);
      const a3 = smooth(CUE.title + 1.8, CUE.title + 2.6, t);
      const lamp = t >= CUE.autoplayLamp ? 1 : 0;
      const auto = smooth(CUE.autoplayText, CUE.autoplayText + 0.35, t);
      this.paint(this.card, `t${q(a1)}${q(a2)}${q(a3)}${lamp}${q(auto)}`, (g, w, h) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        text(g, 'THE STOOPID SHOW', w / 2, h * 0.405, { size: 26, color: '#d9d6c6', spacing: 16, alpha: a1 });
        text(g, 'PLEASE HOLD', w / 2, h * 0.5, { size: 70, weight: '300', color: '#d6e6e0', spacing: 26, alpha: a2 });
        text(g, 'END OF TRANSMISSION', w / 2, h * 0.585, { size: 20, color: '#8a9692', spacing: 12, alpha: a3 });
        if (lamp) {
          const cx = w / 2, cy = h * 0.69;
          const grd = g.createRadialGradient(cx, cy, 0, cx, cy, 34);
          grd.addColorStop(0, 'rgba(255,170,70,0.55)'); grd.addColorStop(1, 'rgba(255,170,70,0)');
          g.fillStyle = grd; g.fillRect(cx - 40, cy - 40, 80, 80);
          g.fillStyle = '#ffb347';
          g.beginPath(); g.roundRect ? g.roundRect(cx - 9, cy - 4, 18, 8, 3) : g.rect(cx - 9, cy - 4, 18, 8); g.fill();
        }
        if (auto > 0) text(g, 'AUTOPLAY STARTING…', w / 2, h * 0.735, { size: 17, color: '#7d8682', spacing: 6, alpha: auto });
      });
      return { mix: 1, tear: 0, textMix };
    }
    return { mix: 0, tear: 0, textMix };
  }
}
const q = (x) => Math.round(clamp(x) * 30);
