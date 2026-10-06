import * as THREE from 'three';
import { CUE } from './timeline.js';
import { clamp, smooth, easeOut } from './util.js';

// Full-frame graphics: the station interruption card and the closing title.
// Painted on a 1920×1080 canvas and composited in the final pass.

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = '"DejaVu Sans Mono", "Courier New", monospace';

export class Cards {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1920; this.canvas.height = 1080;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.key = null;
  }

  // Progress: quick, then slower, then stuck at 99% for good.
  static progress(t) {
    const u = clamp((t - (CUE.card + 0.35)) / (CUE.cardStuck - CUE.card - 0.35));
    return Math.min(99, Math.floor(easeOut(u) * 99));
  }

  // Returns { mix, tear } for the final pass and repaints if needed.
  update(t) {
    if (t >= CUE.card && t < CUE.tearEnd) {
      const pct = Cards.progress(t);
      const spin = Math.floor(t / 0.11) % 8;
      this.paint(`card${pct}${spin}`, (g, w, h) => this.station(g, w, h, pct, spin));
      return { mix: 1, tear: clamp((t - CUE.tearStart) / (CUE.tearEnd - CUE.tearStart)) };
    }
    if (t >= CUE.titleCard && t < CUE.relayEnd) {
      const a1 = smooth(CUE.titleCard + 0.15, CUE.titleCard + 0.75, t);
      const a2 = smooth(CUE.titleLine2, CUE.titleLine2 + 0.7, t);
      this.paint(`title${Math.round(a1 * 30)}${Math.round(a2 * 30)}`, (g, w, h) => this.title(g, w, h, a1, a2));
      return { mix: 1, tear: 0 };
    }
    return { mix: 0, tear: 0 };
  }

  paint(key, fn) {
    if (key === this.key) return;
    this.key = key;
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    fn(g, this.canvas.width, this.canvas.height);
    this.texture.needsUpdate = true;
  }

  text(g, s, x, y, { size, weight = '400', color, align = 'center', spacing = 0, font = SANS, alpha = 1 }) {
    g.save();
    g.globalAlpha = alpha;
    g.font = `${weight} ${size}px ${font}`;
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
    g.fillText(s, x, y);
    g.restore();
  }

  station(g, w, h, pct, spin) {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#e6e9e2');
    grd.addColorStop(1, '#d6dbd3');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);

    // Station bug
    g.fillStyle = '#3d6f69';
    g.fillRect(120, 104, 34, 34);
    this.text(g, 'S', 137, 122, { size: 24, weight: '700', color: '#e6e9e2' });
    this.text(g, 'STOOPID AFTER HOURS  ·  VIEWER SERVICES', 172, 121, { size: 20, color: '#6c7471', align: 'left', spacing: 4 });
    this.text(g, 'CH 13', w - 120, 121, { size: 20, color: '#8a918e', align: 'right', spacing: 4, font: MONO });
    g.fillStyle = '#c3c9c1';
    g.fillRect(120, 160, w - 240, 2);

    this.text(g, 'YOUR FEAR IS IMPORTANT TO US.', w / 2, h * 0.44, { size: 70, weight: '700', color: '#1c2221', spacing: 3 });
    this.text(g, 'Please remain frightened.', w / 2, h * 0.53, { size: 36, color: '#4c5552', spacing: 1 });

    // A small progress indicator
    const bw = 300, bx = w / 2 - bw / 2, by = h * 0.64;
    g.fillStyle = '#c2c8c0';
    g.fillRect(bx, by, bw, 4);
    g.fillStyle = '#3d7a73';
    g.fillRect(bx, by, (bw * pct) / 100, 4);
    this.text(g, `${pct}%`, bx + bw + 22, by + 2, { size: 18, color: '#4c5552', align: 'left', font: MONO });
    // spinner, still spinning at 99%
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const k = ((i - spin + 8) % 8) / 8;
      g.fillStyle = `rgba(61,122,115,${0.15 + 0.85 * (1 - k)})`;
      g.beginPath();
      g.arc(bx - 30 + Math.cos(a) * 9, by + 2 + Math.sin(a) * 9, 2.2, 0, Math.PI * 2);
      g.fill();
    }

    this.text(g, 'This fear may be monitored for quality assurance purposes.', w / 2, h - 120, { size: 18, color: '#858d8a', spacing: 1 });
  }

  title(g, w, h, a1, a2) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    this.text(g, 'THE STOOPID SHOW', w / 2, h * 0.44, { size: 26, color: '#d9d6c6', spacing: 16, alpha: a1 });
    g.globalAlpha = a2 * 0.5;
    g.fillStyle = '#5f8e87';
    g.fillRect(w / 2 - 60, h * 0.485, 120, 1);
    g.globalAlpha = 1;
    this.text(g, 'PLEASE REMAIN SEEN', w / 2, h * 0.545, { size: 58, weight: '300', color: '#cfe2dc', spacing: 20, alpha: a2 });
  }
}
