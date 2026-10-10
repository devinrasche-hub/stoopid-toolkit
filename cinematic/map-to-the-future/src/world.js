import * as THREE from 'three';
import { CUE, loopAngle } from './timeline.js';
import { clamp, smooth, lerp, pulse, keyed, easeInOut, easeOut, noise1, mulberry32, hash } from './util.js';

// ─────────────────────────────────────────────────────────────────────────────
// The five spaces of A MAP TO THE FUTURE. Each builder returns
//   { scene, update(t) → labels[] }
// where labels are world-anchored annotations that cards.js paints after
// main.js projects them. Everything is a pure function of timeline time t.
//
// Colour: SIGNAL. Past = red / dim amber. Future = teal / violet.
// Burnt Orange only where the flip lands.
// ─────────────────────────────────────────────────────────────────────────────

export const C = {
  red: 0xff2d2d, teal: 0x00ffc6, violet: 0x8a2be2, orange: 0xcc5500, amber: 0xd8892f, white: 0xffffff,
};
const col = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const Y = new THREE.Vector3(0, 1, 0);

let SPRITE = null;
function sprite() {
  if (SPRITE) return SPRITE;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  SPRITE = new THREE.CanvasTexture(c);
  return SPRITE;
}
function pointsMat(size, opacity = 1) {
  return new THREE.PointsMaterial({ size, map: sprite(), vertexColors: true, transparent: true, opacity,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
}
// Faint dust in a box, for depth in the voids.
function dust(n, size, spread, seed, color = 0x8f9aa8, k = 0.25) {
  const rnd = mulberry32(seed);
  const pos = new Float32Array(n * 3), cl = new Float32Array(n * 3);
  const c = col(color, k);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (rnd() - 0.5) * spread[0]; pos[i * 3 + 1] = (rnd() - 0.5) * spread[1]; pos[i * 3 + 2] = (rnd() - 0.5) * spread[2];
    const f = 0.3 + rnd() * 0.7;
    cl[i * 3] = c.r * f; cl[i * 3 + 1] = c.g * f; cl[i * 3 + 2] = c.b * f;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  return new THREE.Points(g, pointsMat(size));
}
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · THE BED — the phone in the dark; the same bed in the morning
// ═════════════════════════════════════════════════════════════════════════════
const NOTES = [
  { app: 'MEMORIES', when: '3y ago', title: 'On this day', body: 'Look back at the worst week of 2023.' },
  { app: 'CALENDAR', when: '9:00', title: 'Weekly sync', body: 'Same meeting as last week. And the week before.' },
  { app: 'MESSAGES', when: '11:48 PM', title: 'Last night', body: 'We should talk about what you said.' },
  { app: 'BANK', when: 'now', title: 'Payment due', body: 'Same as last month.' },
  { app: 'NEWS', when: 'now', title: 'Yesterday’s top stories', body: 'Everything you worried about, again.' },
];
export const PHONE = { w: 0.072, h: 0.152, sw: 0.066, sh: 0.1435, cw: 460, ch: 1000 };

function drawPhone(g, t) {
  const W = PHONE.cw, H = PHONE.ch;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  g.save();
  g.beginPath(); g.roundRect ? g.roundRect(0, 0, W, H, 58) : g.rect(0, 0, W, H); g.clip();
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#141a2c'); bg.addColorStop(0.55, '#0a0d18'); bg.addColorStop(1, '#050609');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const fadeUI = 1 - smooth(CUE.push, CUE.push + 1.4, t);
  const font = (w, s) => `${w} ${s}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  g.globalAlpha = fadeUI;
  g.fillStyle = '#e8ecf4'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = font(500, 22); g.fillText('Tuesday, October 13', W / 2, 150);
  g.font = font(200, 150); g.fillText('6:02', W / 2, 290);
  g.font = font(600, 18); g.textAlign = 'left'; g.fillText('6:02', 34, 44);
  g.fillRect(W - 64, 30, 30, 14); g.fillRect(W - 34, 34, 3, 6);
  // notifications: newest on top, older ones pushed down
  const shown = CUE.notes.filter((n) => t >= n).length;
  for (let i = 0; i < shown; i++) {
    const age = shown - 1 - i;                       // 0 = newest
    const tin = smooth(CUE.notes[i], CUE.notes[i] + 0.35, t);
    const prevShift = i < shown - 1 ? smooth(CUE.notes[shown - 1], CUE.notes[shown - 1] + 0.35, t) : 0;
    const y = 340 + (age - (i < shown - 1 ? 1 - prevShift : 0)) * 128 - (1 - tin) * 26;
    const n = NOTES[i];
    g.globalAlpha = fadeUI * tin * (age > 3 ? 0.5 : 1);
    g.fillStyle = 'rgba(52,58,76,0.92)';
    g.beginPath(); g.roundRect ? g.roundRect(22, y, W - 44, 114, 24) : g.rect(22, y, W - 44, 114); g.fill();
    g.fillStyle = i === 2 ? '#ff6b5e' : '#9aa3b8'; g.font = font(700, 15); g.textAlign = 'left';
    g.fillText(n.app, 44, y + 30);
    g.fillStyle = '#9aa3b8'; g.textAlign = 'right'; g.font = font(400, 15); g.fillText(n.when, W - 44, y + 30);
    g.textAlign = 'left'; g.fillStyle = '#f2f4f8'; g.font = font(600, 21); g.fillText(n.title, 44, y + 62);
    g.fillStyle = '#c4c9d6'; g.font = font(400, 18); g.fillText(n.body, 44, y + 92, W - 88);
  }
  g.globalAlpha = 1;
  // the ring: a spinner that closes into a loop
  const ra = smooth(CUE.push + 0.6, CUE.ring, t);
  if (ra > 0) {
    const r = lerp(46, 150, smooth(CUE.ring - 0.4, CUE.loop, t));
    const span = lerp(1.2, Math.PI * 2, smooth(CUE.ring - 0.6, CUE.ring + 0.9, t));
    const rot = t * 5.2;
    g.strokeStyle = `rgba(255,70,60,${ra})`; g.lineWidth = lerp(9, 6, smooth(CUE.ring, CUE.loop, t)); g.lineCap = 'round';
    g.shadowColor = 'rgba(255,45,45,0.9)'; g.shadowBlur = 24;
    g.beginPath(); g.arc(W / 2, H / 2, r, rot, rot + span); g.stroke();
    g.shadowBlur = 0;
  }
  g.restore();
}

export function buildBed() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  // phone
  const phone = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedRect(PHONE.w, PHONE.h, 0.011), { depth: 0.007, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 3, curveSegments: 10 }),
    new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.35, metalness: 0.2 }));
  body.position.z = -0.0075;
  body.castShadow = true;
  phone.add(body);
  const cv = document.createElement('canvas'); cv.width = PHONE.cw; cv.height = PHONE.ch;
  const pg = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const screenMat = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(PHONE.sw, PHONE.sh), screenMat);
  screen.position.z = 0.0008;
  phone.add(screen);
  // camera bump on the back (seen in the morning, face down)
  const bump = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(0.03, 0.03, 0.008), { depth: 0.0018, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.3 }));
  bump.position.set(-0.016, 0.052, -0.0105);
  phone.add(bump);
  [[-0.022, 0.058], [-0.01, 0.046]].forEach(([x, y]) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.002, 20), new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.1 }));
    l.rotation.x = Math.PI / 2; l.position.set(x, y, -0.0115); phone.add(l);
  });
  scene.add(phone);
  const glow = new THREE.PointLight(0xa9c2ff, 0, 6, 2);
  scene.add(glow);
  // the ceiling in the dark
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0x8c8f96, roughness: 0.95 }));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 2.3;
  scene.add(ceiling);
  // the bed, for the morning
  const bg = new THREE.PlaneGeometry(3, 3, 120, 120);
  const p = bg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const z = 0.022 * Math.sin(x * 6 + Math.sin(y * 3) * 1.5) + 0.014 * Math.sin(y * 9 + x * 2) + 0.035 * (noise1(x * 2 + 9, 2) - 0.5) + 0.006 * Math.sin(x * 19 - y * 5);
    const flat = smooth(0.1, 0.35, Math.hypot(x, y));
    p.setZ(i, z * flat * 1.8);
  }
  bg.computeVertexNormals();
  // a striped duvet cover, so it reads as a bed and not a void
  const dc = document.createElement('canvas'); dc.width = dc.height = 512;
  const dg = dc.getContext('2d');
  dg.fillStyle = '#c9cfd8'; dg.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { dg.fillStyle = '#9fb0c6'; dg.fillRect(x, 0, 22, 512); dg.fillStyle = '#b6c1d0'; dg.fillRect(x + 30, 0, 4, 512); }
  const rn = mulberry32(3);
  for (let i = 0; i < 9000; i++) { dg.fillStyle = `rgba(0,0,0,${rn() * 0.05})`; dg.fillRect(rn() * 512, rn() * 512, 1, 1 + rn() * 3); }
  const dtex = new THREE.CanvasTexture(dc); dtex.colorSpace = THREE.SRGBColorSpace; dtex.wrapS = dtex.wrapT = THREE.RepeatWrapping; dtex.repeat.set(3, 3); dtex.anisotropy = 8;
  const blanket = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ map: dtex, roughness: 0.95 }));
  blanket.rotation.x = -Math.PI / 2; blanket.position.y = -0.0105;
  blanket.receiveShadow = true;
  scene.add(blanket);
  const sun = new THREE.DirectionalLight(0xffd2a0, 0);
  sun.position.set(-1.6, 1.4, 0.9); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -0.6; sun.shadow.camera.right = 0.6; sun.shadow.camera.top = 0.6; sun.shadow.camera.bottom = -0.6;
  sun.shadow.bias = -0.0004; sun.shadow.radius = 4;
  scene.add(sun);
  const sky = new THREE.HemisphereLight(0xcfe0ff, 0x6b5a48, 0);
  scene.add(sky);

  let lastKey = '';
  function update(t, cam) {
    const morning = t >= CUE.coda;
    if (!morning) {
      // held above the face, tilted to it
      phone.position.set(0, 0.62 + 0.004 * Math.sin(t * 0.9), 0.06);
      phone.up.set(0, 0, -1);
      phone.lookAt(cam.pos[0], cam.pos[1], cam.pos[2]);
      phone.rotateZ(0.05 * Math.sin(t * 0.4));
      const on = smooth(CUE.screenOn, CUE.screenOn + 0.25, t);
      screenMat.color.setScalar(on * 1.15);
      glow.intensity = on * 0.22;
      glow.position.copy(phone.position).lerp(new THREE.Vector3(...cam.pos), 0.12);
      sun.intensity = 0; sky.intensity = 0;
      ceiling.visible = true; blanket.visible = false;
      const key = `${Math.round(t * 30)}`;
      if (key !== lastKey && on > 0) { drawPhone(pg, t); tex.needsUpdate = true; lastKey = key; }
    } else {
      // morning: face down on the bed, the screen against the blanket
      phone.position.set(0, -0.0098, 0);
      phone.rotation.set(Math.PI / 2, 0, 0.35);
      screenMat.color.setScalar(0);
      glow.intensity = 0;
      sun.intensity = 2.4; sky.intensity = 0.55;
      ceiling.visible = false; blanket.visible = true;
    }
    return [];
  }
  return { scene, update, lights: [sun] };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · THE LOOP — and the coil it really is
// ═════════════════════════════════════════════════════════════════════════════
export const LOOP_R = 1.6;
const NODE_NAMES = ['THOUGHTS', 'CHOICES', 'BEHAVIORS', 'EXPERIENCES', 'EMOTIONS'];
const COIL = [];
for (let k = -9; k <= 14; k++) if (k !== 0) COIL.push(k);
export const COIL_STEP = 1.15;
const onRing = (th, r = LOOP_R, z = 0) => [r * Math.sin(th), r * Math.cos(th), z];

export function buildLoop() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020103);
  const ringMat = new THREE.MeshBasicMaterial({ color: col(C.red, 2.2) });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(LOOP_R, 0.026, 16, 256), ringMat);
  scene.add(ring);
  const grooveMat = new THREE.MeshBasicMaterial({ color: col(C.red, 0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const groove = new THREE.Mesh(new THREE.TorusGeometry(LOOP_R, 0.1, 20, 256), grooveMat);
  scene.add(groove);
  // nodes
  const nodeGeo = new THREE.SphereGeometry(0.065, 24, 16);
  const nodes = NODE_NAMES.map((_, i) => {
    const m = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color: col(C.red, 0.4) }));
    m.position.set(...onRing((i / 5) * Math.PI * 2));
    scene.add(m);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.115, 48), new THREE.MeshBasicMaterial({ color: col(C.red, 1.4), transparent: true, opacity: 0, side: THREE.DoubleSide }));
    halo.position.copy(m.position); scene.add(halo);
    return { m, halo };
  });
  // arrows between nodes, pointing the way round
  const coneGeo = new THREE.ConeGeometry(0.05, 0.13, 20);
  const arrows = NODE_NAMES.map((_, i) => {
    const th = ((i + 0.5) / 5) * Math.PI * 2;
    const a = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: col(C.red, 1.6), transparent: true, opacity: 0 }));
    a.position.set(...onRing(th));
    a.quaternion.setFromUnitVectors(Y, new THREE.Vector3(Math.cos(th), -Math.sin(th), 0));
    scene.add(a);
    return a;
  });
  // the light running the loop, with a trail
  const TRAIL = 70;
  const trail = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }), TRAIL);
  trail.frustumCulled = false;
  scene.add(trail);
  const headLight = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshBasicMaterial({ color: col(0xffd0c8, 1.2), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(headLight);
  // the coil: the same loop, behind (past) and ahead (future)
  const coilGeo = new THREE.TorusGeometry(LOOP_R, 0.02, 10, 160);
  const coil = COIL.map((k) => {
    const m = new THREE.Mesh(coilGeo, new THREE.MeshBasicMaterial({ color: col(C.red, 1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.z = -k * COIL_STEP;
    scene.add(m);
    return m;
  });
  const coilHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }), COIL.length);
  coilHeads.frustumCulled = false;
  scene.add(coilHeads);
  scene.add(dust(900, 0.03, [26, 16, 40], 11, 0x9a8a90, 0.35));

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), CC = new THREE.Color();
  function update(t) {
    const th = loopAngle(t);
    const u = Math.max(0, t - CUE.loop);
    const omega = 0.55 + 0.105 * u;
    const laps = th / (Math.PI * 2);
    // the ring brightens and thickens with every lap: memorized
    const mem = smooth(CUE.memorize, CUE.rise, t);
    ringMat.color.copy(col(C.red, 1.6 + Math.min(laps, 8) * 0.18));
    grooveMat.opacity = 0.18 + 0.6 * mem;
    grooveMat.color.copy(col(C.red, 0.35 + 0.5 * mem));
    groove.visible = t > CUE.loop + 0.5;
    grooveMat.opacity *= smooth(CUE.loop + 0.5, CUE.loop + 3, t);
    nodes.forEach((n, i) => {
      const lit = smooth(CUE.nodes[i], CUE.nodes[i] + 0.5, t);
      // a flash each time the light passes
      const d = Math.abs(((th - (i / 5) * Math.PI * 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2));
      const pass = Math.exp(-d * 8) * lit;
      n.m.material.color.copy(col(C.red, 0.35 + 1.8 * lit)).lerp(col(0xffffff, 3), pass * 0.7);
      n.halo.material.opacity = lit * (0.35 + 0.65 * pass);
      n.halo.scale.setScalar(1 + pass * 0.6);
    });
    arrows.forEach((a, i) => (a.material.opacity = smooth(CUE.nodes[Math.min(4, i + 1)] - 0.6, CUE.nodes[Math.min(4, i + 1)], t) * 0.9));
    // trail: longer as it speeds up
    const span = Math.min(2.4, 0.5 + omega * 0.35);
    for (let i = 0; i < TRAIL; i++) {
      const k = i / (TRAIL - 1);
      const a = th - k * span;
      P.set(...onRing(a));
      const s = (1 - k) * (1 - k) * 1.0 + 0.08;
      S.setScalar(i === 0 ? 1.1 : s);
      M.compose(P, Q, S);
      trail.setMatrixAt(i, M);
      CC.copy(col(0xffffff, 4)).lerp(col(C.red, 2.2), Math.min(1, k * 2.2)).multiplyScalar(1 - k * 0.85);
      trail.setColorAt(i, CC);
    }
    trail.instanceMatrix.needsUpdate = true; trail.instanceColor.needsUpdate = true;
    headLight.position.set(...onRing(th));
    // coil
    const reveal = smooth(CUE.memorize + 1.0, CUE.rise + 1.2, t);
    coil.forEach((m, j) => {
      const k = COIL[j];
      m.material.opacity = reveal * (k < 0 ? 0.7 : 0.85) * Math.exp(-Math.abs(k) * 0.07);
      P.set(...onRing(th, LOOP_R, -k * COIL_STEP));
      S.setScalar(reveal > 0.01 ? 1 : 0);
      M.compose(P, Q, S);
      coilHeads.setMatrixAt(j, M);
    });
    coilHeads.material.opacity = reveal;
    coilHeads.instanceMatrix.needsUpdate = true;

    const labels = [];
    NODE_NAMES.forEach((name, i) => {
      const a = smooth(CUE.nodes[i], CUE.nodes[i] + 0.6, t) * (1 - smooth(CUE.rise - 0.6, CUE.rise + 0.4, t)) * (1 - smooth(CUE.dive - 1, CUE.dive, t));
      if (a > 0) labels.push({ text: name, pos: onRing((i / 5) * Math.PI * 2, LOOP_R * 1.24), style: 'node', alpha: a, color: '#ff8b80' });
    });
    const ca = reveal * (1 - smooth(CUE.dive - 0.4, CUE.dive + 0.4, t));
    if (ca > 0) {
      labels.push({ text: 'PAST', pos: [0, LOOP_R + 0.5, 6.5 * COIL_STEP], style: 'tag', alpha: ca, color: '#ff8b80' });
      labels.push({ text: 'NOW', pos: [0, LOOP_R + 0.5, 0], style: 'tag', alpha: ca, color: '#ffffff' });
      labels.push({ text: 'FUTURE', pos: [0, LOOP_R + 0.5, -7 * COIL_STEP], style: 'tag', alpha: ca, color: '#ff8b80' });
    }
    return labels;
  }
  return { scene, update, lights: [] };
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · THE GATE — the analytical mind as a wall; meditation as the way through
//      Built twice: 'analytic' (left) and 'meditate' (right).
// ═════════════════════════════════════════════════════════════════════════════
export const WALL = { cols: 15, rows: 7, size: 0.34, gap: 0.025, z: 0, y: -0.3 };
export const CORE_Z = -5.2;
const WORDS = [
  { w: 'JUDGING', p: [-1.05, 0.95, 1.1] }, { w: 'PLANNING', p: [0.95, 0.55, 1.3] }, { w: 'WORRYING', p: [-0.75, -0.35, 1.2] },
  { w: 'ANALYZING', p: [0.8, -0.85, 1.0] }, { w: 'WHAT IF…', p: [0.05, 0.15, 1.5] },
];
// Wave: cycles across the view and amplitude by state (beta → alpha → theta).
export function waveState(t, mode) {
  if (mode === 'analytic' || t < CUE.alpha - 1.2) return { cyc: 11, amp: 0.07, noise: 0.05, color: C.red, name: 'β  BETA', sub: 'fast · busy · alert' };
  const a = smooth(CUE.alpha - 1.2, CUE.alpha + 0.4, t), b = smooth(CUE.theta - 1.0, CUE.theta + 0.6, t);
  return {
    cyc: lerp(lerp(11, 4.5, a), 2.0, b), amp: lerp(lerp(0.07, 0.12, a), 0.16, b), noise: lerp(0.05, 0.0, a),
    color: b > 0.5 ? C.teal : a > 0.5 ? C.violet : C.red,
    mix: [a, b],
    name: b > 0.5 ? 'θ  THETA' : a > 0.5 ? 'α  ALPHA' : 'β  BETA',
    sub: b > 0.5 ? 'slow · the gate opens' : a > 0.5 ? 'calm · inward' : 'fast · busy · alert',
  };
}

export function buildGate(mode) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040509);
  scene.fog = new THREE.Fog(0x040509, 6, 16);
  const { cols, rows, size, gap } = WALL;
  const N = cols * rows;
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size * 0.9), new THREE.MeshStandardMaterial({ color: 0x8a909c, roughness: 0.6, metalness: 0.05 }), N);
  blocks.castShadow = false;
  blocks.frustumCulled = false;
  scene.add(blocks);
  const base = [];
  const rnd = mulberry32(mode === 'analytic' ? 5 : 5);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = (c - (cols - 1) / 2) * (size + gap), y = (r - (rows - 1) / 2) * (size + gap) + WALL.y;
    base.push({ x, y, d: Math.hypot(x, (y - WALL.y) * 1.2), s: rnd(), s2: rnd(), s3: rnd() });
  }
  scene.add(new THREE.HemisphereLight(0x8090b0, 0x101015, 0.5));
  const key = new THREE.DirectionalLight(0xdfe6ff, 1.6); key.position.set(-3, 3, 5); scene.add(key);
  const rim = new THREE.PointLight(0xff5a3c, 0, 12, 2); rim.position.set(0, 0.2, -2.2); scene.add(rim);
  // the program: a knot of habit, glowing behind the wall
  const coreMat = new THREE.MeshBasicMaterial({ color: col(C.red, 2.0) });
  const core = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.045, 320, 12, 3, 7), coreMat);
  core.position.set(0, WALL.y, CORE_Z);
  scene.add(core);
  const core2 = new THREE.Mesh(new THREE.TorusKnotGeometry(0.42, 0.02, 240, 8, 2, 5), new THREE.MeshBasicMaterial({ color: col(C.amber, 1.6) }));
  core2.position.copy(core.position); scene.add(core2);
  const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 24), new THREE.MeshBasicMaterial({ color: col(C.red, 0.05), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  coreGlow.position.copy(core.position); scene.add(coreGlow);
  scene.add(dust(500, 0.025, [10, 6, 14], 21, 0x9aa0b0, 0.25));
  // brain-wave ribbon across the top
  const NP = 420;
  const wpos = new Float32Array(NP * 2 * 3);
  const wgeo = new THREE.BufferGeometry();
  wgeo.setAttribute('position', new THREE.BufferAttribute(wpos, 3));
  const idx = [];
  for (let i = 0; i < NP - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  wgeo.setIndex(idx);
  const waveMat = new THREE.MeshBasicMaterial({ color: col(C.red, 2.2), side: THREE.DoubleSide, fog: false });
  const wave = new THREE.Mesh(wgeo, waveMat);
  wave.frustumCulled = false;
  scene.add(wave);
  const WAVE_Y = 1.08, WAVE_Z = 2.2, WAVE_W = 3.2;

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();
  function update(t, cam) {
    const busy = mode === 'analytic' ? 1 : 1 - smooth(CUE.alpha - 1.5, CUE.alpha + 1, t);
    const open = mode === 'meditate' ? smooth(CUE.gateOpen - 0.3, CUE.gateOpen + 3.5, t) : 0;
    for (let i = 0; i < N; i++) {
      const b = base[i];
      // busy: blocks shuffle and push forward a little, never settling
      const f = Math.floor(t * 7 + b.s * 13);
      const jig = busy * (hash(f * 3.1 + i) - 0.5) * 0.05;
      const pushz = busy * 0.08 * Math.max(0, Math.sin(t * 2.3 + b.s * 20)) ;
      // opening: from the centre outward, drifting apart and back
      const delay = b.d * 0.38;
      const o = easeInOut(clamp((open * 4.2 - delay) / 1.6));
      const dir = Math.atan2(b.y - WALL.y, b.x);
      const out = o * (1.6 + b.s2 * 2.2);
      P.set(b.x + Math.cos(dir) * out + jig, b.y + Math.sin(dir) * out * 0.8 + jig * 0.6, pushz - o * (1.5 + b.s3 * 3));
      E.set(o * (b.s - 0.5) * 2.2, o * (b.s2 - 0.5) * 2.2, o * (b.s3 - 0.5) * 1.4 + jig * 0.4);
      Q.setFromEuler(E);
      S.setScalar(1 - o * 0.85);
      M.compose(P, Q, S);
      blocks.setMatrixAt(i, M);
    }
    blocks.instanceMatrix.needsUpdate = true;
    // the knot: busy red in the analytic view; calming once you reach it
    core.rotation.set(t * 0.25, t * 0.4, 0); core2.rotation.set(-t * 0.3, t * 0.2, t * 0.1);
    const near = mode === 'meditate' ? smooth(CUE.gateOpen + 1, CUE.merge + 2, t) : 0;
    rim.intensity = 6 + near * 4;
    coreGlow.material.color.copy(col(C.red, 0.05 * (1 - near * 0.7)));
    // wave ribbon (positions relative to the camera's x so it spans the view)
    const ws = waveState(t, mode);
    waveMat.color.copy(col(ws.color, 2.2)).multiplyScalar(1 - near);
    const cx = cam ? cam.pos[0] : 0;
    const zoff = cam ? Math.min(0, cam.pos[2] - 7.5) : 0;   // travels with the dolly
    for (let i = 0; i < NP; i++) {
      const u = i / (NP - 1);
      const x = cx + (u - 0.5) * WAVE_W * 2;
      const ph = u * ws.cyc * Math.PI * 2 - t * (ws.cyc * 0.9);
      let y = Math.sin(ph) * ws.amp + (noise1(u * 60 + t * 9, 3) - 0.5) * ws.noise * 2 + (noise1(u * 140 - t * 13, 7) - 0.5) * ws.noise;
      y *= 0.6 + 0.4 * Math.sin(u * Math.PI);
      const th = 0.012;
      wpos[i * 6] = x; wpos[i * 6 + 1] = WAVE_Y + y + th; wpos[i * 6 + 2] = WAVE_Z + zoff;
      wpos[i * 6 + 3] = x; wpos[i * 6 + 4] = WAVE_Y + y - th; wpos[i * 6 + 5] = WAVE_Z + zoff;
    }
    wgeo.attributes.position.needsUpdate = true;

    const labels = [];
    if (mode === 'analytic') {
      WORDS.forEach((w, i) => {
        const a = smooth(CUE.split + 4.5 + i * 0.7, CUE.split + 5.1 + i * 0.7, t);
        const jx = (noise1(t * 1.3, i * 5) - 0.5) * 0.12, jy = (noise1(t * 1.1, i * 5 + 2) - 0.5) * 0.1;
        if (a > 0) labels.push({ text: w.w, pos: [w.p[0] + jx, w.p[1] + jy, w.p[2]], style: 'word', alpha: a * 0.9, color: '#ffb3aa' });
      });
    }
    return labels;
  }
  return { scene, update, lights: [], wave: { y: WAVE_Y, z: WAVE_Z } };
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · THE BRAIN — a record of the past rewired into a map to the future
// ═════════════════════════════════════════════════════════════════════════════
function inBrain(x, y, z) {
  const e = (cx, cy, cz, rx, ry, rz) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
  const hemi = Math.min(e(-0.37, 0.08, 0, 0.47, 0.58, 0.92), e(0.37, 0.08, 0, 0.47, 0.58, 0.92));
  const flat = y < -0.32 + 0.12 * Math.cos(z * 2.2) && z < 0.55 && z > -0.55 ? 2 : 1;   // temporal underside
  const cereb = e(0, -0.42, -0.62, 0.48, 0.22, 0.3);
  return Math.min(hemi * flat, cereb);
}
export function buildBrain() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070402);
  const rnd = mulberry32(77);
  const pts = [];
  while (pts.length < 1250) {
    const x = (rnd() - 0.5) * 1.9, y = (rnd() - 0.5) * 1.5 - 0.1, z = (rnd() - 0.5) * 2.0;
    const v = inBrain(x, y, z);
    if (v > 1) continue;
    if (v < 0.55 && rnd() < 0.7) continue;          // favour the cortex (the shell)
    if (Math.abs(x) < 0.04) continue;               // the fissure between hemispheres
    pts.push([x, y, z]);
  }
  const N = pts.length;
  // edges: nearest neighbours
  const old = [], fresh = [];
  for (let i = 0; i < N; i++) {
    const d = [];
    for (let j = 0; j < N; j++) if (j !== i) {
      const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], dz = pts[i][2] - pts[j][2];
      const dd = dx * dx + dy * dy + dz * dz;
      if (dd < 0.05) d.push([dd, j]);
    }
    d.sort((a, b) => a[0] - b[0]);
    d.slice(0, 3).forEach(([, j]) => { if (j > i) old.push([i, j]); });
    d.slice(3, 7).forEach(([, j]) => { if (j > i && rnd() < 0.6) fresh.push([i, j, Math.floor(rnd() * 4)]); });
  }
  const mkLines = (edges) => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(edges.length * 6), cl = new Float32Array(edges.length * 6);
    edges.forEach((e, k) => { pos.set(pts[e[0]], k * 6); pos.set(pts[e[1]], k * 6 + 3); });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cl, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    l.frustumCulled = false;
    return l;
  };
  const oldL = mkLines(old), freshL = mkLines(fresh);
  scene.add(oldL, freshL);
  const ng = new THREE.BufferGeometry();
  const npos = new Float32Array(N * 3), ncl = new Float32Array(N * 3);
  pts.forEach((p, i) => npos.set(p, i * 3));
  ng.setAttribute('position', new THREE.BufferAttribute(npos, 3));
  ng.setAttribute('color', new THREE.BufferAttribute(ncl, 3));
  const neurons = new THREE.Points(ng, pointsMat(0.045));
  neurons.frustumCulled = false;
  scene.add(neurons);
  // pulses travelling along connections
  const NPUL = 420;
  const pg = new THREE.BufferGeometry();
  const ppos = new Float32Array(NPUL * 3), pcl = new Float32Array(NPUL * 3);
  pg.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  pg.setAttribute('color', new THREE.BufferAttribute(pcl, 3));
  const pulses = new THREE.Points(pg, pointsMat(0.06));
  pulses.frustumCulled = false;
  scene.add(pulses);
  const pul = Array.from({ length: NPUL }, (_, i) => ({ fresh: i % 2 === 1, e: Math.floor(rnd() * 1e6), sp: 0.5 + rnd() * 0.9, ph: rnd() }));
  const haze = dust(700, 0.03, [9, 6, 9], 31, 0xb08a60, 0.2);
  scene.add(haze);

  const bgPast = new THREE.Color(0x070402), bgMap = new THREE.Color(0x05031a);
  const cPast = col(C.amber, 0.55), cPastDim = col(C.amber, 0.12), cTeal = col(C.teal, 1), cViolet = col(C.violet, 1.3);
  const tmp = new THREE.Color(), tmp2 = new THREE.Color();
  // rehearsal fronts sweep front → back
  const frontZ = (t, k) => lerp(1.1, -1.1, clamp((t - CUE.rehearse[k]) / 2.4));
  function update(t) {
    const shift = smooth(CUE.shift, CUE.shiftEnd, t);
    scene.background.copy(bgPast).lerp(bgMap, shift);
    haze.material.opacity = 1;
    // old wiring: amber, the record; fades to a quiet violet as the map takes over
    const oc = oldL.geometry.attributes.color.array;
    for (let k = 0; k < old.length; k++) {
      const z = pts[old[k][0]][2];
      const s = smooth(0, 1, shift * 1.6 - (z + 1) * 0.3);
      tmp.copy(cPast).lerp(tmp2.copy(cViolet).multiplyScalar(0.35), s);
      tmp.multiplyScalar(0.85 + 0.15 * Math.sin(t * 1.3 + k));
      oc.set([tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b], k * 6);
    }
    oldL.geometry.attributes.color.needsUpdate = true;
    // new wiring: appears as each rehearsal front passes; stronger each time it is rehearsed
    const fc = freshL.geometry.attributes.color.array;
    const reps = CUE.rehearse.map((r) => smooth(r, r + 2.4, t));
    for (let k = 0; k < fresh.length; k++) {
      const [i, j, wave] = fresh[k];
      const z = (pts[i][2] + pts[j][2]) / 2;
      let a = 0;
      for (let w = wave; w < 4; w++) {
        if (t < CUE.rehearse[w]) continue;
        const passed = frontZ(t, w) < z ? 1 : 0;
        a = Math.max(a, passed * (0.35 + 0.22 * (w - wave + 1)));
      }
      a = Math.max(a * (1 + shift * 0.6), 0);
      const flash = CUE.rehearse.reduce((m, r, w) => Math.max(m, t > r ? Math.exp(-Math.abs(frontZ(t, w) - z) * 14) * (t < r + 2.6 ? 1 : 0) : 0), 0);
      tmp.copy(cTeal).lerp(cViolet, (k % 3) / 3 * 0.8).multiplyScalar(a * 1.4 + flash * 1.5);
      fc.set([tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b], k * 6);
    }
    freshL.geometry.attributes.color.needsUpdate = true;
    // neurons
    for (let i = 0; i < N; i++) {
      const z = pts[i][2];
      let flash = 0;
      for (let w = 0; w < 4; w++) if (t > CUE.rehearse[w] && t < CUE.rehearse[w] + 2.8) flash = Math.max(flash, Math.exp(-Math.abs(frontZ(t, w) - z) * 18));
      const s = smooth(0, 1, shift * 1.6 - (z + 1) * 0.3);
      tmp.copy(cPast).multiplyScalar(1.3).lerp(tmp2.copy(cTeal).multiplyScalar(0.9), s);
      tmp.lerp(tmp2.setRGB(2.5, 3, 3), flash * 0.8);
      tmp.multiplyScalar(0.75 + 0.25 * noise1(t * 0.8 + i * 0.37, 1));
      ncl[i * 3] = tmp.r; ncl[i * 3 + 1] = tmp.g; ncl[i * 3 + 2] = tmp.b;
    }
    ng.attributes.color.needsUpdate = true;
    // pulses: old ones run the old wiring; fresh ones appear once a path exists
    const freshOn = Math.max(...reps.map((r, i) => r * (0.4 + i * 0.2)));
    for (let p = 0; p < NPUL; p++) {
      const q = pul[p];
      const set = q.fresh ? fresh : old;
      const cyc = t * q.sp + q.ph;
      const e = set[(q.e + Math.floor(cyc) * 7919) % set.length];
      const u = cyc - Math.floor(cyc);
      const a = pts[e[0]], b = pts[e[1]];
      ppos[p * 3] = lerp(a[0], b[0], u); ppos[p * 3 + 1] = lerp(a[1], b[1], u); ppos[p * 3 + 2] = lerp(a[2], b[2], u);
      const fade = Math.sin(Math.PI * u);
      if (q.fresh) tmp.copy(cTeal).multiplyScalar(2.2 * fade * clamp(freshOn + shift));
      else tmp.copy(cPast).multiplyScalar(2.6 * fade).lerp(tmp2.copy(cViolet).multiplyScalar(0.6 * fade), shift);
      pcl[p * 3] = tmp.r; pcl[p * 3 + 1] = tmp.g; pcl[p * 3 + 2] = tmp.b;
    }
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
    return [];
  }
  return { scene, update, lights: [] };
}

// ═════════════════════════════════════════════════════════════════════════════
// 5 · THE FIELD — a board of cause and effect that becomes a field of possibility
// ═════════════════════════════════════════════════════════════════════════════
export const BALL_R = 0.17;
// Where "how you feel" is, as a function of t (it gets knocked around).
const B_KEYS = [[0, [0, 0, 0]], [CUE.strike, [0, 0, 0]], [CUE.strike + 1.6, [1.35, 0, 0.55]],
  [CUE.knocks[0], [1.35, 0, 0.55]], [CUE.knocks[0] + 1.0, [0.55, 0, 1.5]],
  [CUE.knocks[1], [0.55, 0, 1.5]], [CUE.knocks[1] + 1.0, [-0.65, 0, 0.9]],
  [CUE.knocks[2], [-0.65, 0, 0.9]], [CUE.knocks[2] + 1.1, [-0.2, 0, -0.35]],
  [CUE.quantum + 0.3, [-0.2, 0, -0.35]], [CUE.rise2 + 2.0, [0, 0, 0]]];
export function bPos(t) {
  const p = keyed(B_KEYS, t, easeOut);
  const lift = smooth(CUE.rise2, CUE.rise2 + 2.4, t);
  return [p[0], BALL_R + lift * 0.85, p[2]];
}
// The things that strike it: [label, from, hit time].
const STRIKERS = [
  { label: 'SOMETHING OUT THERE', from: [-4.6, 0, -1.9], hit: CUE.strike, enter: CUE.board + 1.6, color: 0xe8e8ee },
  { label: 'THE JOB', from: [4.2, 0, -1.6], hit: CUE.knocks[0], enter: CUE.knocks[0] - 1.4, color: 0x9aa0aa },
  { label: 'THE NEWS', from: [1.0, 0, 4.4], hit: CUE.knocks[1], enter: CUE.knocks[1] - 1.3, color: 0x9aa0aa },
  { label: 'THEM', from: [-3.4, 0, 3.4], hit: CUE.knocks[2], enter: CUE.knocks[2] - 1.3, color: 0x9aa0aa },
];
export function buildField() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030308);
  scene.fog = new THREE.Fog(0x030308, 8, 22);
  // the board
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.75, transparent: true });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), boardMat);
  board.rotation.x = -Math.PI / 2; board.receiveShadow = true;
  scene.add(board);
  const grid = new THREE.GridHelper(14, 28, 0x55606e, 0x2f3540);
  grid.position.y = 0.002; grid.material.transparent = true;
  scene.add(grid);
  scene.add(new THREE.HemisphereLight(0x9aa8c8, 0x15151a, 0.6));
  const spot = new THREE.SpotLight(0xffffff, 60, 20, 0.7, 0.5, 2);
  spot.position.set(1.5, 7, 2.5); spot.target.position.set(0, 0, 0); spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005;
  scene.add(spot, spot.target);
  // you: "how you feel"
  const youMat = new THREE.MeshStandardMaterial({ color: 0xd84040, roughness: 0.3, emissive: new THREE.Color(C.red), emissiveIntensity: 0.15 });
  const you = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), youMat);
  you.castShadow = true;
  scene.add(you);
  const youGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite(), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  youGlow.scale.setScalar(1.6);
  scene.add(youGlow);
  const youLight = new THREE.PointLight(0xffffff, 0, 6, 2);
  scene.add(youLight);
  const strikers = STRIKERS.map((s) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R * (s.label.length > 10 ? 1.0 : 0.85), 40, 28), new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.35, transparent: true }));
    m.castShadow = true; scene.add(m);
    return { ...s, m };
  });
  // intention (teal) and emotion (violet) rings
  const mkRing = (c, r) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 12, 128), new THREE.MeshBasicMaterial({ color: col(c, 2.4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(m); return m;
  };
  const ringI = mkRing(C.teal, 0.36), ringE = mkRing(C.violet, 0.5);
  // the coherence wavefront
  const front = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.0, 160), new THREE.MeshBasicMaterial({ color: col(C.teal, 1.5), transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  front.rotation.x = -Math.PI / 2;
  scene.add(front);
  // the field of possibility
  const GX = 150, GZ = 150, SPAN = 15;
  const fpos = new Float32Array(GX * GZ * 3), fcl = new Float32Array(GX * GZ * 3);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  fg.setAttribute('color', new THREE.BufferAttribute(fcl, 3));
  const fieldMat = pointsMat(0.075, 0);
  fieldMat.fog = true;
  const field = new THREE.Points(fg, fieldMat);
  field.frustumCulled = false;
  scene.add(field);
  const rnd = mulberry32(99);
  const SRC = Array.from({ length: 6 }, () => ({ x: (rnd() - 0.5) * 14, z: (rnd() - 0.5) * 14, k: 2 + rnd() * 3, w: 1 + rnd() * 2.5, p: rnd() * 6 }));
  const jit = Array.from({ length: GX * GZ }, () => [(rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.06]);
  const cDim = col(0x7a68b8, 0.95), cT = col(C.teal, 1.1), cV = col(C.violet, 1.4), cO = col(C.orange, 2.6), cW = col(0xffffff, 1.6);
  const tmp = new THREE.Color();

  function update(t) {
    const q = smooth(CUE.quantum - 0.4, CUE.quantum + 1.8, t);           // board → field
    boardMat.opacity = 1 - q; grid.material.opacity = 1 - q;
    board.visible = q < 0.999; grid.visible = q < 0.999;
    spot.intensity = 60 * (1 - q);
    const bp = bPos(t);
    you.position.set(...bp);
    // victim → light
    const glow = smooth(CUE.rise2, CUE.intention, t);
    const coh = smooth(CUE.coherence, CUE.coherence + 1.2, t);
    youMat.color.setHex(0xd84040).lerp(new THREE.Color(0xffffff), glow);
    youMat.emissive.setHex(C.red).lerp(new THREE.Color(0xfff2e6), glow);
    youMat.emissiveIntensity = 0.15 + glow * 2.6 + coh * 1.5;
    youGlow.position.copy(you.position);
    youGlow.material.opacity = glow * 0.55 + coh * 0.3;
    youGlow.material.color.copy(col(0xffffff, 1)).lerp(col(C.teal, 1), smooth(CUE.intention, CUE.emotion, t) * 0.4);
    youLight.position.copy(you.position); youLight.intensity = glow * 3 + coh * 2;
    strikers.forEach((s) => {
      const tHit = s.hit;
      // travel in, strike, roll off a little, then vanish into the field
      const target = keyed(B_KEYS, tHit, easeOut);
      const dir = [target[0] - s.from[0], target[2] - s.from[2]];
      const len = Math.hypot(dir[0], dir[1]);
      const contact = [target[0] - dir[0] / len * BALL_R * 1.9, target[2] - dir[1] / len * BALL_R * 1.9];
      let p;
      if (t < tHit) p = keyed([[s.enter, [s.from[0], s.from[2]]], [tHit, contact]], t, (x) => x * (0.6 + 0.4 * x));
      else p = keyed([[tHit, contact], [tHit + 1.2, [contact[0] + dir[0] / len * 0.25, contact[1] + dir[1] / len * 0.25]]], t, easeOut);
      const vis = smooth(s.enter - 0.4, s.enter, t) * (1 - q);
      s.m.position.set(p[0], BALL_R - (1 - vis) * 0.4, p[1]);
      s.m.material.opacity = vis;
      s.m.visible = vis > 0.01;
    });
    // intention + emotion
    const ia = smooth(CUE.intention, CUE.intention + 0.8, t), ea = smooth(CUE.emotion, CUE.emotion + 0.8, t);
    ringI.position.set(bp[0], bp[1] + 0.05, bp[2]); ringE.position.set(bp[0], bp[1] - 0.02, bp[2]);
    ringI.rotation.set(Math.PI / 2 + 0.35 * Math.sin(t * 0.9), t * 0.8, 0);
    ringE.rotation.set(Math.PI / 2 + 0.4 * Math.cos(t * 0.7), -t * 0.6, 0.3);
    const merge = coh;
    ringI.material.opacity = ia * (1 - merge * 0.5); ringE.material.opacity = ea * (1 - merge * 0.5);
    ringI.scale.setScalar(1 + merge * 0.25); ringE.scale.setScalar(1 - merge * 0.12);
    // coherence wavefront
    const R = Math.max(0, (t - CUE.coherence) * 2.6);
    front.position.set(bp[0], 0.02, bp[2]);
    front.scale.setScalar(Math.max(0.01, R));
    front.material.opacity = t > CUE.coherence ? Math.exp(-R * 0.18) * 0.9 : 0;
    // the field
    fieldMat.opacity = q;
    const pathFront = Math.max(0, (t - CUE.path) * 2.2);
    const crea = smooth(CUE.creator, CUE.creator + 1.0, t);
    if (q > 0) {
      let n = 0;
      for (let iz = 0; iz < GZ; iz++) for (let ix = 0; ix < GX; ix++, n++) {
        const x = (ix / (GX - 1) - 0.5) * SPAN + jit[n][0], z = (iz / (GZ - 1) - 0.5) * SPAN + jit[n][1];
        // incoherent: several sources out of step
        let h = 0;
        for (const s of SRC) { const d = Math.hypot(x - s.x, z - s.z); h += Math.sin(d * s.k - t * s.w + s.p); }
        h *= 0.032;
        const r = Math.hypot(x - bp[0], z - bp[2]);
        const inside = clamp((R - r) / 1.2);
        const coherent = 0.07 * Math.sin(r * 5.0 - t * 3.2) * Math.exp(-r * 0.08);
        let y = lerp(h, coherent, inside);
        // the path ahead (towards −z): rises and lights as it is laid
        const along = bp[2] - z, side = Math.abs(x - bp[0]);
        let pa = 0;
        if (along > 0.3 && side < 0.55) pa = clamp((pathFront - along) / 1.0) * (1 - smooth(0.12, 0.55, side + along * 0.012));
        y += pa * (0.06 + 0.04 * Math.sin(along * 3 - t * 4));
        fpos[n * 3] = x; fpos[n * 3 + 1] = y; fpos[n * 3 + 2] = z;
        const e = 0.45 + 0.55 * clamp((y + 0.1) * 5);
        tmp.copy(cDim).multiplyScalar(0.6 + e * 0.6);
        if (inside > 0) tmp.lerp(cV, inside * 0.5).lerp(cT, inside * clamp(0.5 + coherent * 6) * 0.6);
        if (pa > 0) tmp.lerp(cW, pa * 0.6).lerp(cO, pa * crea * 0.65);
        fcl[n * 3] = tmp.r; fcl[n * 3 + 1] = tmp.g; fcl[n * 3 + 2] = tmp.b;
      }
      fg.attributes.position.needsUpdate = true; fg.attributes.color.needsUpdate = true;
    }

    const labels = [];
    const vic = 1 - q;
    const youLab = t < CUE.quantum + 1.5;
    if (youLab) labels.push({ text: 'HOW YOU FEEL', pos: [bp[0], bp[1] + 0.42, bp[2]], style: 'tag', alpha: smooth(CUE.board + 0.8, CUE.board + 1.6, t) * vic, color: '#ff8b80' });
    strikers.forEach((s) => {
      const a = s.m.material.opacity * (1 - smooth(s.hit + 1.2, s.hit + 2.0, t)) * (s.label === 'SOMETHING OUT THERE' ? 1 : 0.95);
      if (a > 0.01 && s.m.visible) labels.push({ text: s.label, pos: [s.m.position.x, 0.62, s.m.position.z], style: 'tag', alpha: a, color: '#d6dbe4' });
    });
    const va = smooth(CUE.knocks[2] + 0.6, CUE.knocks[2] + 1.2, t) * (1 - smooth(CUE.quantum - 0.2, CUE.quantum + 0.6, t));
    if (va > 0) labels.push({ text: 'VICTIM', pos: [bp[0], bp[1] + 0.42, bp[2]], style: 'tag', alpha: va, color: '#ff6b5e' });
    if (ia > 0) labels.push({ text: 'CLEAR INTENTION', pos: [bp[0] - 0.75, bp[1] + 0.42, bp[2]], style: 'tag', alpha: ia * (1 - smooth(CUE.creator - 0.6, CUE.creator, t)), color: '#5fffd9' });
    if (ea > 0) labels.push({ text: 'ELEVATED EMOTION', pos: [bp[0] + 0.8, bp[1] - 0.18, bp[2]], style: 'tag', alpha: ea * (1 - smooth(CUE.creator - 0.6, CUE.creator, t)), color: '#c89bff' });
    if (crea > 0) labels.push({ text: 'CREATOR', pos: [bp[0], bp[1] + 0.48, bp[2]], style: 'flip', alpha: crea, color: '#e0701a' });
    return labels;
  }
  return { scene, update, lights: [spot] };
}
