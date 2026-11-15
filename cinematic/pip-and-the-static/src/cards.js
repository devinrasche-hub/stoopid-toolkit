import * as THREE from 'three';
import { CUE, NARRATION } from './timeline.js';
import { clamp, smooth, hash, SETTINGS } from './util.js';

// Two 1920×1080 layers composited in the final pass (so recordings and frame
// renders include them):
//   card — opaque full frame: the notice (the one joke), the closing title and credits
//   text — transparent captions: The Algorithm, thin and helpful

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

  // Pip's words: round, yellow, outlined, the way a kids' show would caption them,
  // wavering a little on the tape.
  pipText(g, s, y, op, t) {
    const f = Math.floor(t * 12);
    g.save();
    g.globalAlpha = op;
    g.font = `800 60px "Comic Sans MS", "Chalkboard SE", ${SANS}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = 'rgba(20,14,6,0.95)';
    const dx = (hash(f * 1.3) - 0.5) * 4;
    g.strokeText(s, 960 + dx, y); g.fillStyle = '#f6e27a'; g.fillText(s, 960 + dx, y);
    g.restore();
  }

  // The tape's own marks: PLAY for the first seconds; a tracking band that
  // rolls down the picture now and then.
  tapeMarks(g, w, h, t) {
    if (t < CUE.tape + 3) {
      g.save(); g.font = `700 44px "DejaVu Sans Mono", monospace`; g.fillStyle = '#f2f2f2'; g.shadowColor = '#000'; g.shadowBlur = 6;
      g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('PLAY ▶', 70, 60); g.restore();
    }
    const cyc = 7.3, ph = ((t + 2.1) % cyc) / cyc;
    if (ph < 0.22 && SETTINGS.flicker) {
      const y = (ph / 0.22) * (h + 160) - 80, f = Math.floor(t * 24);
      for (let i = 0; i < 26; i++) {
        const yy = y + (hash(i * 3.7 + f) - 0.5) * 70, a = 0.06 + hash(i + f * 1.7) * 0.16;
        g.fillStyle = `rgba(230,230,225,${a})`; g.fillRect(hash(i * 9.1 + f) * w * 0.4, yy, w * (0.3 + hash(i * 2.2) * 0.7), 2 + hash(i * 5.3 + f) * 3);
      }
    }
  }

  update(t, { captions = true, scene = '' } = {}) {
    let cap = null;
    for (const n of NARRATION) if (t >= n.start && t < n.end) cap = n;
    const tape = scene === 'pip';
    let textMix = 0;
    if ((cap && captions) || tape) {
      textMix = 1;
      const op = cap ? smooth(cap.start, cap.start + 0.25, t) * (1 - smooth(cap.end - 0.4, cap.end, t)) : 0;
      const key = `${cap && captions ? cap.id : '-'}${Math.round(op * 40)}${Math.floor(t * 24)}${tape}`;
      this.paint(this.text, key, (g, w, h) => {
        if (tape) this.tapeMarks(g, w, h, t);
        if (!cap || !captions) return;
        if (cap.voice === 'pip') this.pipText(g, cap.text, h * 0.84, op, t);
        else this.stationText(g, cap.text, h * 0.85, op, t);
      });
    }

    // THE ONE JOKE: a commercial break, on the tape
    if (t >= CUE.grape && t < CUE.forgot) {
      const f = Math.floor(t * 12);
      this.paint(this.card, `grape${f}`, (g, w, h) => {
        const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#6b2f8f'); bg.addColorStop(1, '#e0702a');
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        // starburst
        g.save(); g.translate(w * 0.78, h * 0.26); g.fillStyle = '#f7d33a';
        g.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = i % 2 ? 110 : 150; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
        g.rotate(-0.2); g.font = `900 46px "Comic Sans MS", ${SANS}`; g.fillStyle = '#6b2f8f'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('NEW!', 0, -18); g.font = `800 30px "Comic Sans MS", ${SANS}`; g.fillText('GRAPE', 0, 26); g.restore();
        // the logo
        g.font = `900 140px "Comic Sans MS", "Chalkboard SE", ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineJoin = 'round'; g.lineWidth = 22; g.strokeStyle = '#2a0f3a'; g.strokeText('THE STATIC', w * 0.42, h * 0.2);
        g.fillStyle = '#fff2f8'; g.fillText('THE STATIC', w * 0.42, h * 0.2);
        g.font = `800 64px "Comic Sans MS", ${SANS}`; g.lineWidth = 12; g.strokeText('NOW IN GRAPE!', w * 0.42, h * 0.34); g.fillStyle = '#f7d33a'; g.fillText('NOW IN GRAPE!', w * 0.42, h * 0.34);
        // the bowl, full of static
        const bx = w * 0.5, by = h * 0.66, br = 330;
        g.save(); g.beginPath(); g.ellipse(bx, by, br, 120, 0, 0, Math.PI); g.lineTo(bx - br, by); g.closePath();
        g.fillStyle = '#f2efe6'; g.fill(); g.restore();
        g.save(); g.beginPath(); g.ellipse(bx, by, br - 20, 70, 0, 0, Math.PI * 2); g.clip();
        for (let y = by - 70; y < by + 70; y += 6) for (let x = bx - br; x < bx + br; x += 6) { const v = Math.floor(hash(x * 0.13 + y * 7.1 + f * 3.3) * 255); g.fillStyle = `rgb(${v},${v * 0.8},${v})`; g.fillRect(x, y, 6, 6); }
        g.restore();
        g.strokeStyle = '#d8d2c0'; g.lineWidth = 8; g.beginPath(); g.ellipse(bx, by, br, 70, 0, 0, Math.PI * 2); g.stroke();
        // a spoon, already in it
        g.save(); g.translate(bx + 180, by - 30); g.rotate(-0.6); g.fillStyle = '#c9ccd0'; g.fillRect(-10, -220, 20, 200); g.beginPath(); g.ellipse(0, 0, 34, 48, 0, 0, Math.PI * 2); g.fill(); g.restore();
        g.font = `600 28px ${SANS}`; g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillText('Part of a complete breakfast. Not a food.', w / 2, h * 0.93);
      });
      return { mix: 1, textMix };
    }
    if (t >= CUE.title) {
      const a1 = smooth(CUE.title + 0.2, CUE.title + 0.9, t);
      const a2 = smooth(CUE.title + 0.7, CUE.title + 1.5, t);
      const a3 = smooth(CUE.end, CUE.end + 0.5, t);
      const a4 = smooth(CUE.credits, CUE.credits + 0.6, t);
      this.paint(this.card, `t${q(a1)}${q(a2)}${q(a3)}${q(a4)}`, (g, w, h) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        text(g, 'THE STOOPID SHOW', w / 2, h * 0.4, { size: 26, color: '#d9d6c6', spacing: 16, alpha: a1 });
        text(g, 'PIP AND THE STATIC', w / 2, h * 0.495, { size: 72, weight: '300', color: '#efe9dc', spacing: 22, alpha: a2 });
        text(g, 'END.', w / 2, h * 0.6, { size: 20, color: '#9a958a', spacing: 12, alpha: a3 });
        text(g, 'Produced by @stoopidshow & The Internet', w / 2, h * 0.79, { size: 20, color: '#7d7a72', spacing: 2, alpha: a4 });
        text(g, 'Friends (all of them)  ·  Grape (static)  ·  Pip (remembers)', w / 2, h * 0.83, { size: 20, color: '#7d7a72', spacing: 2, alpha: a4 });
      });
      return { mix: smooth(CUE.title, CUE.title + 0.25, t), textMix };
    }
    if (t < 0.8) {
      this.paint(this.card, 'black', (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); });
      return { mix: 1 - smooth(0.2, 0.8, t), textMix };
    }
    return { mix: 0, textMix };
  }
}
const q = (x) => Math.round(clamp(x) * 30);
