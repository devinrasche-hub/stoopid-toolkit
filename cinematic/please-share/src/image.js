import { mulberry32, hash } from './util.js';

// The image. An old flash photo, badly compressed: a dark hallway, a doorway,
// and in it a pale face, smiling a little too wide, its eyes catching the flash.
// Built once at low resolution, then degraded in 8×8 blocks like a cheap JPEG.
// Drawn top-down (rules: only on screens; loads one band at a time).

const IW = 160, IH = 120;

export const PHOTO = (() => {
  const c = document.createElement('canvas'); c.width = IW; c.height = IH;
  const g = c.getContext('2d');
  const rnd = mulberry32(606);
  // the flash falls off fast: near wall bright, far hall black
  const bg = g.createRadialGradient(IW * 0.5, IH * 0.55, 6, IW * 0.5, IH * 0.55, IW * 0.75);
  bg.addColorStop(0, '#5b5d58'); bg.addColorStop(0.6, '#2c2d2a'); bg.addColorStop(1, '#0d0e0d');
  g.fillStyle = bg; g.fillRect(0, 0, IW, IH);
  // wainscot line and a light switch, near the camera
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, IH * 0.66, IW, 2);
  g.fillStyle = '#8c8c84'; g.fillRect(IW * 0.2, IH * 0.42, 6, 10); g.fillStyle = '#5a5a54'; g.fillRect(IW * 0.2 + 2, IH * 0.42 + 3, 2, 4);
  // the doorway: frame lit by the flash, the inside black
  const dx = IW * 0.43, dw = IW * 0.22, dy = IH * 0.1, dh = IH * 0.86;
  g.fillStyle = '#9a9a90'; g.fillRect(dx - 4, dy - 4, dw + 8, dh + 4);
  g.fillStyle = '#030303'; g.fillRect(dx, dy, dw, dh);
  // the face, high in the doorway, tilted, pale and soft-edged
  // long, low in the frame: the eyes load at about 62%, the smile not until the very end
  const fx = dx + dw * 0.52, fy = IH * 0.765;
  g.save(); g.translate(fx, fy); g.rotate(0.12);
  const fg = g.createRadialGradient(0, -4, 1, 0, 0, 24);
  fg.addColorStop(0, '#bdbab0'); fg.addColorStop(0.7, '#8f8c84'); fg.addColorStop(1, 'rgba(10,10,10,0)');
  g.fillStyle = fg; g.beginPath(); g.ellipse(0, 0, 12.5, 24, 0, 0, Math.PI * 2); g.fill();
  // eyes: hollows, with the flash caught in them
  g.fillStyle = '#1a1916'; [-5, 5].forEach((ex) => { g.beginPath(); g.ellipse(ex, -17, 2.8, 1.9, 0, 0, Math.PI * 2); g.fill(); });
  g.fillStyle = '#ffffff'; [-5, 5].forEach((ex) => g.fillRect(ex - 0.6, -17.6, 1.4, 1.4));
  // the smile: a thin dark crescent, wider than the face should allow
  g.strokeStyle = '#151411'; g.lineWidth = 1.6;
  g.beginPath(); g.ellipse(0, 18.5, 12, 3.6, 0, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
  g.strokeStyle = 'rgba(220,216,205,0.6)'; g.lineWidth = 0.6;
  g.beginPath(); g.ellipse(0, 19.2, 10.6, 2.8, 0, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  g.restore();
  // something like shoulders, barely
  // film grain and the date stamp
  const img = g.getImageData(0, 0, IW, IH), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.1; }
  // cheap JPEG: average each 8×8 block a little toward its mean
  for (let by = 0; by < IH; by += 8) for (let bx = 0; bx < IW; bx += 8) {
    let m = [0, 0, 0], n = 0;
    for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 8; x++) { const o = (y * IW + x) * 4; m[0] += d[o]; m[1] += d[o + 1]; m[2] += d[o + 2]; n++; }
    m = m.map((v) => v / n);
    for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 8; x++) { const o = (y * IW + x) * 4; for (let ch = 0; ch < 3; ch++) d[o + ch] = d[o + ch] * 0.62 + m[ch] * 0.38; }
  }
  g.putImageData(img, 0, 0);
  g.font = '700 7px "DejaVu Sans Mono", monospace'; g.fillStyle = '#ff8a2a'; g.textAlign = 'right';
  g.fillText("10 26 '98", IW - 6, IH - 6);
  return c;
})();

// Draw the photo into a rectangle, loaded to `frac` (0–1) from the top.
// Below the loaded part: the last loaded row smeared down, then grey.
export function drawLoaded(g, x, y, w, h, frac, t, { grain = 1 } = {}) {
  g.save();
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#3e403e'; g.fillRect(x, y, w, h);
  const rows = Math.floor(IH * Math.min(1, frac));
  if (rows > 0) g.drawImage(PHOTO, 0, 0, IW, rows, x, y, w, h * rows / IH);
  if (rows < IH && rows > 0) {
    // the broken file: the last row, stretched to the bottom
    g.globalAlpha = 0.8;
    g.drawImage(PHOTO, 0, rows - 1, IW, 1, x, y + h * rows / IH, w, h * (1 - rows / IH) * 0.55);
    g.globalAlpha = 1;
  }
  // grain that moves
  if (grain) {
    const f = Math.floor(t * 12);
    const cell = Math.max(2, Math.round(w / 120));
    for (let i = 0; i < 160; i++) {
      const gx = x + hash(i * 3.1 + f) * w, gy = y + hash(i * 7.7 + f * 1.3) * h * Math.max(0.05, rows / IH);
      g.fillStyle = hash(i + f * 0.7) > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.18)';
      g.fillRect(gx, gy, cell, cell);
    }
  }
  g.restore();
}
