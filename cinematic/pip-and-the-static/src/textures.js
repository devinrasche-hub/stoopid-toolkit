import * as THREE from 'three';
import { mulberry32 } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeat = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Speckle + blotch grime, the base of most surfaces.
function grime(g, w, h, rnd, base, amount = 1) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260 * amount; i++) {
    const x = rnd() * w, y = rnd() * h, r = 8 + rnd() * 70;
    const a = 0.02 + rnd() * 0.05;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() < 0.7;
    grd.addColorStop(0, dark ? `rgba(0,0,0,${a})` : `rgba(255,255,240,${a * 0.6})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 18;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

export function makeTextures() {
  const T = {};

  { // concrete (studio floor, walls)
    const rnd = mulberry32(11);
    const [c, g] = canvas(512, 512);
    grime(g, 512, 512, rnd, '#6d706c', 1.4);
    // hairline cracks
    g.strokeStyle = 'rgba(20,20,20,0.25)';
    for (let i = 0; i < 9; i++) {
      g.lineWidth = 0.6 + rnd();
      g.beginPath();
      let x = rnd() * 512, y = rnd() * 512;
      g.moveTo(x, y);
      for (let k = 0; k < 14; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.3) * 30; g.lineTo(x, y); }
      g.stroke();
    }
    T.concrete = tex(c, [4, 4]);
  }

  { // linoleum tile floor (corridor, control room)
    const rnd = mulberry32(23);
    const [c, g] = canvas(512, 512);
    grime(g, 512, 512, rnd, '#5c625d', 1);
    const n = 4, s = 512 / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = (rnd() - 0.5) * 22;
      g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 235 : 0},${Math.abs(v) / 255})`;
      g.fillRect(x * s, y * s, s, s);
      g.strokeStyle = 'rgba(10,12,12,0.55)';
      g.lineWidth = 2;
      g.strokeRect(x * s + 1, y * s + 1, s - 2, s - 2);
    }
    T.tile = tex(c, [1, 1]);
  }

  { // painted cinder block (corridor walls): off-white over dirty teal wainscot
    const rnd = mulberry32(37);
    const [c, g] = canvas(512, 512);
    grime(g, 512, 512, rnd, '#b9baa9', 1.2);
    const bw = 128, bh = 64;
    g.strokeStyle = 'rgba(40,40,35,0.35)';
    g.lineWidth = 3;
    for (let row = 0; row < 512 / bh; row++) {
      const off = (row % 2) * bw / 2;
      g.beginPath(); g.moveTo(0, row * bh); g.lineTo(512, row * bh); g.stroke();
      for (let x = -bw; x < 512 + bw; x += bw) {
        g.beginPath(); g.moveTo(x + off, row * bh); g.lineTo(x + off, row * bh + bh); g.stroke();
      }
    }
    // water stains running down
    for (let i = 0; i < 10; i++) {
      const x = rnd() * 512, w = 6 + rnd() * 30, len = 80 + rnd() * 300;
      const grd = g.createLinearGradient(0, 0, 0, len);
      grd.addColorStop(0, 'rgba(60,55,30,0.22)');
      grd.addColorStop(1, 'rgba(60,55,30,0)');
      g.fillStyle = grd;
      g.fillRect(x, 0, w, len);
    }
    T.block = tex(c, [1, 1]);
  }

  { // drop ceiling tiles
    const rnd = mulberry32(41);
    const [c, g] = canvas(512, 512);
    grime(g, 512, 512, rnd, '#9b9c92', 0.8);
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.1})`;
      g.fillRect(rnd() * 512, rnd() * 512, 1.5, 1.5);
    }
    g.strokeStyle = '#3b3d3a'; g.lineWidth = 10;
    g.strokeRect(0, 0, 512, 512);
    g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.stroke();
    // a brown leak ring
    const grd = g.createRadialGradient(360, 150, 10, 360, 150, 90);
    grd.addColorStop(0, 'rgba(90,70,30,0.0)');
    grd.addColorStop(0.75, 'rgba(90,70,30,0.25)');
    grd.addColorStop(1, 'rgba(90,70,30,0)');
    g.fillStyle = grd; g.fillRect(250, 40, 220, 220);
    T.ceiling = tex(c, [1, 1]);
  }

  { // acoustic fabric panels
    const rnd = mulberry32(53);
    const [c, g] = canvas(256, 256);
    grime(g, 256, 256, rnd, '#2c3133', 0.5);
    for (let y = 0; y < 256; y += 2) {
      g.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.08})`;
      g.fillRect(0, y, 256, 1);
    }
    T.fabric = tex(c, [1, 1]);
  }

  { // brushed metal / console panel
    const rnd = mulberry32(61);
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#3a3e3e'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) {
      g.fillStyle = `rgba(255,255,255,${rnd() * 0.04})`;
      g.fillRect(0, y, 256, 1);
    }
    T.metal = tex(c, [1, 1]);
  }

  T.silhouette = silhouetteTexture();
  T.hand = handTexture();
  return T;
}

// The entity's outline as a soft alpha mask — used for the shadow it casts
// before its body is ever seen.
export function drawSilhouette(g, w, h) {
  const cx = w / 2;
  const u = h / 100;
  g.beginPath();
  // head, slightly tilted and too small
  g.ellipse(cx + 1.2 * u, 9 * u, 4.6 * u, 6.2 * u, 0.12, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(cx - 1.8 * u, 14 * u);
  g.lineTo(cx + 2.4 * u, 14 * u);
  g.lineTo(cx + 3.0 * u, 18 * u);
  // right shoulder, arm hanging long
  g.quadraticCurveTo(cx + 12 * u, 18.5 * u, cx + 13 * u, 24 * u);
  g.lineTo(cx + 14 * u, 52 * u);
  g.lineTo(cx + 13.2 * u, 63 * u);
  g.lineTo(cx + 11.2 * u, 63.5 * u);
  g.lineTo(cx + 10.4 * u, 40 * u);
  g.lineTo(cx + 8.4 * u, 46 * u);
  // right leg
  g.lineTo(cx + 6.8 * u, 99 * u);
  g.lineTo(cx + 2.2 * u, 99 * u);
  g.lineTo(cx + 0.4 * u, 58 * u);
  // left leg
  g.lineTo(cx - 1.6 * u, 99 * u);
  g.lineTo(cx - 6.2 * u, 99 * u);
  g.lineTo(cx - 7.8 * u, 46 * u);
  g.lineTo(cx - 10.0 * u, 40 * u);
  // left arm
  g.lineTo(cx - 10.8 * u, 64 * u);
  g.lineTo(cx - 12.8 * u, 64 * u);
  g.lineTo(cx - 13.4 * u, 50 * u);
  g.lineTo(cx - 12.4 * u, 24 * u);
  g.quadraticCurveTo(cx - 11 * u, 18 * u, cx - 2.6 * u, 18 * u);
  g.closePath();
  g.fill();
}

function silhouetteTexture() {
  const [c, g] = canvas(256, 512);
  g.filter = 'blur(7px)';
  g.fillStyle = '#fff';
  drawSilhouette(g, 256, 512);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// A hand seen from above, wrist at the top of the canvas, fingers pointing down.
// The lower ~45% of the canvas hangs over the front edge of the CRT.
function handTexture() {
  const [c, g] = canvas(256, 512);
  g.fillStyle = '#fff';
  g.filter = 'blur(1.5px)';
  // palm, narrowing toward the wrist
  g.beginPath();
  g.moveTo(92, 0); g.lineTo(168, 0);
  g.quadraticCurveTo(200, 120, 194, 236);
  g.lineTo(64, 240);
  g.quadraticCurveTo(62, 110, 92, 0);
  g.fill();
  // four long fingers with knuckle gaps
  const fingers = [[72, 214, 21], [110, 262, 22], [148, 272, 22], [185, 226, 19]];
  fingers.forEach(([x, len, wd], i) => {
    const x2 = x + (i - 1.5) * 9;
    g.beginPath();
    g.moveTo(x - wd / 2, 225);
    g.lineTo(x2 - wd / 2 + 1, 225 + len - wd / 2);
    g.arc(x2, 225 + len - wd / 2, wd / 2 - 1, Math.PI, 0, true);
    g.lineTo(x + wd / 2, 225);
    g.fill();
  });
  // thumb lying along the side of the cabinet top
  g.beginPath();
  g.ellipse(214, 175, 15, 60, -0.3, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  return t;
}
