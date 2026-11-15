import * as THREE from 'three';
import { CUE, NARRATION, CHAPTERS } from './timeline.js';
import { clamp, smooth, pulse } from './util.js';
import { waveState } from './world.js';

// The overlay: one 1920×1080 canvas composited in the final pass, so captures
// and frame renders include it. It carries everything typographic and every
// full-frame wipe: eyelids, fades, the split-screen divider, chapter cards,
// diagram labels (world-anchored ones arrive already projected), the
// narrator's captions and the closing title.

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const W = 1920, H = 1080;

function text(g, s, x, y, { size, weight = '400', color = '#fff', spacing = 0, alpha = 1, shadow = 0, align = 'center', glow = null }) {
  if (alpha <= 0.002) return;
  g.save();
  g.globalAlpha = clamp(alpha);
  g.font = `${weight} ${size}px ${SANS}`;
  g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`;
  if (glow) { g.shadowColor = glow; g.shadowBlur = size * 0.6; g.fillText(s, x, y); }
  if (shadow) { g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = shadow; }
  g.fillText(s, x, y);
  g.restore();
}

// A soft dark pool behind text, so it reads over the brightest frames.
function pool(g, y, a, rx = 560) {
  if (a <= 0.002) return;
  g.save(); g.globalAlpha = clamp(a);
  const gr = g.createRadialGradient(W / 2, y, 0, W / 2, y, rx);
  gr.addColorStop(0, 'rgba(0,0,0,0.92)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.setTransform(1, 0, 0, 0.2, 0, y * 0.8); g.fillStyle = gr; g.fillRect(0, y - rx, W, rx * 2);
  g.restore();
}

// Labels that live on the screen rather than in the world.
function screenLabels(t, cam) {
  const L = [];
  const add = (l) => { if (l.alpha > 0.002) L.push(l); };
  for (const c of CHAPTERS) add({ kind: 'chapter', n: c.n, text: c.title, alpha: pulse(t, c.start, c.end, 0.6, 0.8) });
  add({ kind: 'big', text: 'SAME PAST  →  SAME FUTURE', color: '#ff8b80', alpha: pulse(t, CUE.sameFuture + 0.2, CUE.dive + 0.2, 0.6, 0.5) });
  if (cam.split !== undefined) {
    const s = cam.split;
    const hdrA = smooth(48.0, 48.8, t);
    if (s > 0.02) {
      const ws = waveState(t, 'analytic');
      add({ kind: 'header', x: s * W / 2, text: 'ANALYTICAL MIND', sub: 'the gatekeeper', color: '#ff8b80', alpha: hdrA * smooth(0.1, 0.35, s) });
      add({ kind: 'wave', x: s * W / 2, text: ws.name, sub: ws.sub, color: '#ff8b80', alpha: hdrA * smooth(0.1, 0.35, s) });
    }
    const ws = waveState(t, 'meditate');
    const rx = (s + (1 - s) / 2) * W;
    const hex = ws.color === 0x00ffc6 ? '#5fffd9' : ws.color === 0x8a2be2 ? '#c89bff' : '#ff8b80';
    const rA = hdrA * (1 - smooth(CUE.merge + 0.4, CUE.merge + 1.6, t));
    add({ kind: 'header', x: rx, text: 'MEDITATION', sub: 'slowing down', color: '#c89bff', alpha: rA });
    add({ kind: 'wave', x: rx, text: ws.name, sub: ws.sub, color: hex, alpha: rA });
    add({ kind: 'big', text: 'THE PROGRAM  ·  unconscious habits', color: '#ffb3aa', y: 0.115, alpha: pulse(t, CUE.merge + 1.6, CUE.lidsClose, 0.6, 0.3) });
  }
  // the brain
  add({ kind: 'big', text: 'A RECORD OF THE PAST', color: '#e7a35c', alpha: pulse(t, CUE.brain + 1.6, CUE.shift + 1.2, 0.8, 0.9) });
  add({ kind: 'big', text: 'A MAP TO THE FUTURE', color: '#5fffd9', alpha: pulse(t, CUE.shiftEnd - 3.0, CUE.board - 0.6, 0.9, 0.8) });
  const reps = CUE.rehearse.filter((r) => t >= r).length;
  if (reps) add({ kind: 'tally', text: `REHEARSAL  ${reps}`, flash: 1 - smooth(CUE.rehearse[reps - 1], CUE.rehearse[reps - 1] + 0.8, t), alpha: pulse(t, CUE.rehearse[0], CUE.shift + 0.5, 0.4, 0.6) });
  // the field
  add({ kind: 'big', text: 'OUTSIDE  →  INSIDE', sub: 'cause and effect', color: '#d6dbe4', alpha: pulse(t, CUE.strike + 0.4, CUE.quantum + 0.2, 0.6, 0.6) });
  add({ kind: 'big', text: 'INSIDE  →  OUTSIDE', sub: 'the quantum model', color: '#5fffd9', alpha: pulse(t, CUE.path + 0.2, CUE.coda - 0.3, 0.8, 0.6) });
  return L;
}

export class Cards {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.textTexture = this.texture;
  }

  // labels: world labels already projected to { x, y } in 1920×1080 pixels
  update(t, { captions = true, cam, labels = [], fade = 0, lids = 0 } = {}) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);

    // split divider
    if (cam.split !== undefined && cam.split > 0.001 && cam.split < 0.999) {
      g.fillStyle = 'rgba(0,0,0,1)'; g.fillRect(cam.split * W - 3, 0, 6, H);
      g.fillStyle = 'rgba(230,236,255,0.55)'; g.fillRect(cam.split * W - 1, 0, 2, H);
    }

    // world labels
    for (const l of labels) {
      const st = {
        node: { size: 26, weight: '600', spacing: 7 },
        tag: { size: 24, weight: '600', spacing: 5 },
        word: { size: 30, weight: '300', spacing: 6 },
        flip: { size: 66, weight: '700', spacing: 20 },
      }[l.style] || { size: 24 };
      if (l.style === 'node' || l.style === 'tag') {
        g.save(); g.globalAlpha = l.alpha * 0.9; g.fillStyle = l.color;
        g.beginPath(); g.arc(l.x, l.y + st.size * 0.95, 3, 0, Math.PI * 2); g.fill(); g.restore();
      }
      text(g, l.text, l.x, l.y, { ...st, color: l.color, alpha: l.alpha, shadow: 14, glow: l.style === 'flip' ? 'rgba(204,85,0,0.9)' : null });
    }

    // screen labels
    for (const l of screenLabels(t, cam)) {
      if (l.kind === 'chapter') {
        g.save(); g.globalAlpha = l.alpha; g.fillStyle = '#00ffc6'; g.fillRect(120, 110, 54, 2); g.restore();
        text(g, l.n, 120, 84, { size: 24, weight: '700', color: '#00ffc6', spacing: 8, alpha: l.alpha, align: 'left' });
        text(g, l.text, 120, 150, { size: 42, weight: '300', color: '#f2f2f2', spacing: 12, alpha: l.alpha, align: 'left', shadow: 20 });
      } else if (l.kind === 'big') {
        const y = (l.y || 0.115) * H;
        pool(g, y + (l.sub ? 18 : 0), l.alpha);
        text(g, l.text, W / 2, y, { size: 40, weight: '300', color: l.color, spacing: 12, alpha: l.alpha, shadow: 22 });
        if (l.sub) text(g, l.sub, W / 2, y + 46, { size: 20, weight: '400', color: '#b9bfcc', spacing: 8, alpha: l.alpha * 0.85, shadow: 12 });
      } else if (l.kind === 'header') {
        text(g, l.text, l.x, 92, { size: 30, weight: '600', color: l.color, spacing: 12, alpha: l.alpha, shadow: 18 });
        text(g, l.sub, l.x, 132, { size: 19, weight: '400', color: '#b9bfcc', spacing: 7, alpha: l.alpha * 0.85, shadow: 12 });
      } else if (l.kind === 'wave') {
        text(g, `${l.text}   ·   ${l.sub}`, l.x, 190, { size: 22, weight: '600', color: l.color, spacing: 5, alpha: l.alpha, shadow: 14 });
      } else if (l.kind === 'tally') {
        text(g, l.text, W - 120, 96, { size: 24, weight: '600', color: l.flash > 0.01 ? '#ffffff' : '#5fffd9', spacing: 8, alpha: l.alpha, align: 'right', shadow: 14, glow: l.flash > 0.2 ? 'rgba(0,255,198,0.8)' : null });
      }
    }

    // eyelids: two soft curved shapes meeting in the middle
    if (lids > 0.001) {
      const a = clamp(lids);
      const reach = a * (H / 2 + 60);
      g.save(); g.fillStyle = '#000';
      for (const top of [true, false]) {
        g.beginPath();
        const edge = top ? reach : H - reach;
        const bow = (1 - a) * 160 * (top ? 1 : -1);
        g.moveTo(-20, top ? -20 : H + 20);
        g.lineTo(-20, edge - bow * 0.2);
        g.quadraticCurveTo(W / 2, edge + bow, W + 20, edge - bow * 0.2);
        g.lineTo(W + 20, top ? -20 : H + 20);
        g.closePath();
        g.shadowColor = 'rgba(0,0,0,1)'; g.shadowBlur = 60;
        g.fill();
      }
      g.restore();
    }
    if (fade > 0.001) { g.fillStyle = `rgba(0,0,0,${clamp(fade)})`; g.fillRect(0, 0, W, H); }

    // narrator captions
    if (captions) {
      for (const n of NARRATION) {
        if (t < n.start || t >= n.end) continue;
        const op = smooth(n.start, n.start + 0.35, t) * (1 - smooth(n.end - 0.4, n.end, t));
        const lines = n.text.split('\n');
        // a soft dark pool behind the words, for bright frames
        pool(g, H * 0.855 - (lines.length - 1) * 22, op);
        lines.forEach((ln, i) => text(g, ln, W / 2, H * 0.855 + (i - (lines.length - 1)) * 58 + (lines.length > 1 ? 14 : 0),
          { size: 44, weight: '300', color: '#f4f4f2', spacing: 1, alpha: op, shadow: 18 }));
      }
    }

    // closing title
    if (t >= CUE.title) {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const a1 = smooth(CUE.title + 0.2, CUE.title + 0.9, t);
      const a2 = smooth(CUE.title + 0.6, CUE.title + 1.4, t);
      const a3 = smooth(CUE.end, CUE.end + 0.6, t);
      text(g, 'THE STOOPID SHOW', W / 2, H * 0.4, { size: 26, color: '#d9d9d9', spacing: 16, alpha: a1 });
      text(g, 'A MAP TO THE FUTURE', W / 2, H * 0.5, { size: 70, weight: '300', color: '#f2f2f2', spacing: 22, alpha: a2 });
      g.save(); g.globalAlpha = a2; g.fillStyle = '#00ffc6'; g.fillRect(W / 2 - 40, H * 0.565, 80, 2); g.restore();
      text(g, 'after the teachings of Dr. Joe Dispenza', W / 2, H * 0.62, { size: 22, weight: '300', color: '#9aa0aa', spacing: 4, alpha: a3 });
      text(g, 'An explainer. Not affiliated with or endorsed by him. Not medical advice.', W / 2, H * 0.92, { size: 16, color: '#5d636c', spacing: 2, alpha: a3 });
    }
    this.texture.needsUpdate = true;
    return { mix: 0, textMix: 1 };
  }
}
