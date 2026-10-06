import * as THREE from 'three';
import { CRT } from './crt.js';
import { makeCone, makeDust, Feed, Portal } from './fx.js';
import { mulberry32 } from './util.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });

function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
function plane(w, h, mat, parent = null) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
function cyl(rt, rb, h, mat, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
const repeat = (tex, x, y) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(x, y); return t; };

// ── The motif: amber HOLD indicators ───────────────────────────────────────
// One shared label texture; every lamp has its own material so it can switch
// independently. lamp.set(k): 0 = dark, 1 = lit (HDR, so it blooms a little).
let HOLD_TEX = null;
function holdTexture() {
  if (HOLD_TEX) return HOLD_TEX;
  const c = document.createElement('canvas'); c.width = 128; c.height = 48;
  const g = c.getContext('2d');
  g.fillStyle = '#2a1600'; g.fillRect(0, 0, 128, 48);
  g.fillStyle = '#ffb347'; g.font = 'bold 30px "DejaVu Sans Mono", "Courier New", monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HOLD', 64, 26);
  HOLD_TEX = new THREE.CanvasTexture(c);
  HOLD_TEX.colorSpace = THREE.SRGBColorSpace;
  return HOLD_TEX;
}
export function holdLamp({ w = 0.16, h = 0.06, light = 0, range = 2.5 } = {}) {
  const g = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.04), new THREE.MeshStandardMaterial({ color: 0x0c0d0d, roughness: 0.5 }));
  housing.position.z = -0.02;
  const mat = new THREE.MeshBasicMaterial({ map: holdTexture(), color: new THREE.Color(0.08, 0.08, 0.08), fog: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  face.position.z = 0.001;
  g.add(housing, face);
  if (light) { g.light = new THREE.PointLight(0xff9a30, 0, range, 2); g.light.position.z = 0.12; g.add(g.light); }
  g.set = (k) => {
    const v = 0.07 + k * 2.6;
    mat.color.setRGB(v, v, v);
    if (g.light) g.light.intensity = light * k;
  };
  return g;
}

// A lit sign whose text can change (EXIT → CONTINUE).
export function signBox(w, h, draw) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, h + 0.03, 0.06), new THREE.MeshStandardMaterial({ color: 0x141616, roughness: 0.6 }));
  housing.position.z = -0.03;
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1, 1, 1) });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  face.position.z = 0.002;
  g.add(housing, face);
  let key = null;
  g.draw = (k, brightness = 1) => {
    if (k !== key) { key = k; const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); draw(x, c.width, c.height, k); tex.needsUpdate = true; }
    mat.color.setRGB(brightness, brightness, brightness);
  };
  return g;
}

// Swivel chair. Local +z is the direction a sitter would face.
export function makeChair(vinyl, metal) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const leg = box(0.32, 0.025, 0.04, metal, 0, 0.06, 0, g);
    leg.geometry.translate(0.16, 0, 0);
    leg.rotation.y = (i / 5) * Math.PI * 2;
    const wheel = cyl(0.025, 0.025, 0.03, metal);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(Math.cos(-leg.rotation.y) * 0.3, 0.025, Math.sin(-leg.rotation.y) * 0.3);
    g.add(wheel);
  }
  const col = cyl(0.025, 0.03, 0.36, metal); col.position.y = 0.25; g.add(col);
  box(0.5, 0.08, 0.48, vinyl, 0, 0.47, 0, g);
  const back = box(0.46, 0.56, 0.07, vinyl, 0, 0.82, -0.25, g);
  back.rotation.x = -0.12;
  box(0.05, 0.04, 0.32, vinyl, -0.26, 0.66, -0.02, g);
  box(0.05, 0.04, 0.32, vinyl, 0.26, 0.66, -0.02, g);
  box(0.03, 0.17, 0.03, metal, -0.26, 0.56, -0.08, g);
  box(0.03, 0.17, 0.03, metal, 0.26, 0.56, -0.08, g);
  return g;
}

function textCanvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

const audienceVert = /* glsl */`
  attribute float aOn;     // wave arrival time
  attribute float aOff;    // time this group goes dark
  attribute float aSeed;
  varying vec2 vUv;
  varying float vOn, vOff, vSeed;
  void main(){
    vUv = uv; vOn = aOn; vOff = aOff; vSeed = aSeed;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const audienceFrag = /* glsl */`
  uniform sampler2D uText;
  uniform float uTime, uIdle, uBright;
  varying vec2 vUv;
  varying float vOn, vOff, vSeed;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    float on = smoothstep(vOn, vOn + 0.35, uTime) * (1.0 - smoothstep(vOff, vOff + 0.25, uTime));
    vec2 uv = vUv;
    vec3 txt = pow(texture2D(uText, uv).rgb, vec3(2.2));
    float sl = 0.65 + 0.35 * sin(uv.y * 240.0);
    vec2 c = uv - 0.5;
    float vig = 1.0 - smoothstep(0.25, 0.75, length(c * vec2(1.0, 1.25)));
    float idle = uIdle * (0.5 + 0.5 * h(vec2(vSeed, floor(uTime * 2.0 + vSeed * 7.0)))) * (1.0 - smoothstep(vOff, vOff + 0.25, uTime));
    vec3 base = vec3(0.04, 0.07, 0.07) * idle;
    vec3 col = base + (vec3(0.012, 0.02, 0.02) + txt * 1.1) * on * uBright;
    gl_FragColor = vec4(col * sl * vig, 1.0);
  }
`;


// ── Small canvas materials for a house ─────────────────────────────────────
function canvasTex(w, h, draw, rep = [1, 1], srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function woodFloor(seed, rep, worn = 0) {
  const rnd = mulberry32(seed);
  return canvasTex(512, 512, (g, w, h) => {
    const n = 6, ph = h / n;
    for (let i = 0; i < n; i++) {
      const base = 120 + rnd() * 30;
      g.fillStyle = `rgb(${base},${base * 0.72},${base * 0.5})`; g.fillRect(0, i * ph, w, ph);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(60,35,20,${0.05 + rnd() * 0.08})`; g.fillRect(0, i * ph + rnd() * ph, w, 1 + rnd() * 2); }
      g.fillStyle = 'rgba(30,18,10,0.6)'; g.fillRect(0, i * ph, w, 2);
      const cut = rnd() * w; g.fillRect(cut, i * ph, 2, ph);
    }
    for (let k = 0; k < worn * 60; k++) { g.fillStyle = `rgba(255,240,220,${rnd() * 0.05})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 20 + rnd() * 60, 6 + rnd() * 12, rnd(), 0, 7); g.fill(); }
  }, rep);
}
function paint(seed, color, grime = 0.4) {
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.03 * grime})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    for (let k = 0; k < 20 * grime; k++) { const x = rnd() * w, y = rnd() * h, r = 10 + rnd() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(60,50,30,${0.05 * grime})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  }, [2, 2]);
}
function fabric(seed, color, rep = [2, 2]) {
  const rnd = mulberry32(seed);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.05})`; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.04})`; g.fillRect(x, 0, 1, h); }
  }, rep);
}
// A printed page of a picture book
function pageTex(text, { size = 64, serif = true, worn = false } = {}) {
  return canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = worn ? '#e9dfc8' : '#f3ecdb'; g.fillRect(0, 0, w, h);
    if (worn) { const rnd = mulberry32(5); for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(90,70,40,${rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * h, 3, 3); } }
    g.fillStyle = '#1c1a17';
    g.font = `${serif ? '600' : '700'} ${size}px ${serif ? 'Georgia, "Times New Roman", serif' : '"Helvetica Neue", Arial, sans-serif'}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = text.split('|');
    lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.25));
  });
}
// An amber digital display (station equipment)
function amberDisplay(w, h) {
  return signBox(w, h, (g, cw, ch, k) => {
    g.fillStyle = '#100800'; g.fillRect(0, 0, cw, ch);
    if (!k || k === ' ') return;
    g.fillStyle = '#ffb347'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = k.split('|');
    const size = Math.min(ch * 0.62 / lines.length, cw * 1.55 / Math.max(...lines.map((l) => l.length)));
    g.font = `bold ${Math.floor(size)}px "DejaVu Sans Mono", "Courier New", monospace`;
    g.shadowColor = '#ffb347'; g.shadowBlur = 10;
    lines.forEach((ln, i) => g.fillText(ln, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
  });
}

function toyTruck(colA = 0xb33a2a, colB = 0xd8b23c) {
  const g = new THREE.Group();
  const a = std(colA, 0.45), b = std(colB, 0.5), k = std(0x161616, 0.6);
  box(0.24, 0.07, 0.11, a, 0.02, 0.07, 0, g);
  box(0.08, 0.08, 0.1, b, -0.08, 0.14, 0, g);
  box(0.12, 0.06, 0.1, b, 0.07, 0.13, 0, g).rotation.z = -0.15;
  [[-0.07, 0.06], [0.08, 0.06], [-0.07, -0.06], [0.08, -0.06]].forEach(([x, z]) => {
    const wh = cyl(0.03, 0.03, 0.025, k, 14); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.03, z); g.add(wh);
  });
  return g;
}
function shoe(len, color, high = false) {
  const g = new THREE.Group();
  const m = std(color, 0.6);
  const sole = box(len, 0.025, len * 0.38, std(0x1b1a18, 0.8), 0, 0.0125, 0, g);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(len * 0.17, len * 0.62, 4, 10), m);
  body.rotation.z = Math.PI / 2; body.scale.set(1, 1, 1.05); body.position.set(0, len * 0.14, 0); body.castShadow = true; g.add(body);
  if (high) { const top = cyl(len * 0.16, len * 0.17, len * 0.35, m, 12); top.position.set(-len * 0.24, len * 0.3, 0); g.add(top); }
  return g;
}
function mug(color = 0xd9d4c8) {
  const g = new THREE.Group();
  const m = std(color, 0.35);
  const body = cyl(0.042, 0.038, 0.095, m, 20); body.position.y = 0.0475; g.add(body);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 16, Math.PI), m);
  handle.rotation.z = -Math.PI / 2; handle.position.set(0.045, 0.05, 0); g.add(handle);
  const coffee = cyl(0.037, 0.037, 0.002, std(0x2a1a10, 0.2), 20); coffee.position.y = 0.075; g.add(coffee);
  return g;
}
function chairWood(col = 0x6b4a32, worn = false) {
  const g = new THREE.Group();
  const m = std(col, worn ? 0.7 : 0.45);
  box(0.44, 0.04, 0.42, m, 0, 0.45, 0, g);
  [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]].forEach(([x, z]) => box(0.035, 0.45, 0.035, m, x, 0.225, z, g));
  box(0.035, 0.5, 0.035, m, -0.19, 0.72, -0.19, g);
  box(0.035, 0.5, 0.035, m, 0.19, 0.72, -0.19, g);
  box(0.42, 0.08, 0.025, m, 0, 0.92, -0.19, g);
  box(0.42, 0.05, 0.025, m, 0, 0.72, -0.19, g);
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE FALSE HOME. Living room (x −3…3, z 0…5) → hallway (x 3…10 at z≈3) →
// staged child's bedroom (x 10…14, z 1…5). Everything positioned as if
// waiting for a commercial shoot: centred, repeated, too tidy.
// ─────────────────────────────────────────────────────────────────────────────
export function buildHome(T, q) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x070909, 0.03);
  const H = { scene, warm: [], teal: [] };
  const H2 = 2.5;
  const wallMat = std(0xd9cfbd, 0.9, { map: paint(3, '#e8decb', 0.3) });
  const ceilMat = std(0xe6e0d3, 0.95);
  const floorMat = std(0xffffff, 0.55, { map: woodFloor(7, [3, 3]) });
  const trim = std(0xece6da, 0.5);

  // ── living room shell
  const f = plane(6, 5, floorMat, scene); f.rotation.x = -Math.PI / 2; f.position.set(0, 0, 2.5);
  const c = plane(6, 5, ceilMat, scene); c.rotation.x = Math.PI / 2; c.position.set(0, H2, 2.5);
  const back = plane(6, H2, wallMat, scene); back.position.set(0, H2 / 2, 0);
  const front = plane(6, H2, wallMat, scene); front.rotation.y = Math.PI; front.position.set(0, H2 / 2, 5);
  const left = plane(5, H2, wallMat, scene); left.rotation.y = Math.PI / 2; left.position.set(-3, H2 / 2, 2.5);
  // right wall, opening to the hallway at z 2.5…3.5
  const rA = plane(2.5, H2, wallMat, scene); rA.rotation.y = -Math.PI / 2; rA.position.set(3, H2 / 2, 1.25);
  const rB = plane(1.5, H2, wallMat, scene); rB.rotation.y = -Math.PI / 2; rB.position.set(3, H2 / 2, 4.25);
  const rC = plane(1.0, 0.4, wallMat, scene); rC.rotation.y = -Math.PI / 2; rC.position.set(3, 2.3, 3.0);
  [[0, 0.06, 0.01], [5, 0.06, -0.01]].forEach(() => {});
  box(6, 0.08, 0.015, trim, 0, 0.04, 0.008, scene);
  const rug = plane(2.6, 1.7, std(0x8a6c5a, 0.95, { map: fabric(4, '#8a6c5a', [6, 4]) }), scene); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.004, 2.0);

  // the television: a console CRT, centred, between two identical lamps
  box(1.5, 0.5, 0.48, std(0x4a3426, 0.55, { map: woodFloor(9, [1, 1]) }), 0, 0.25, 0.3, scene);
  H.tv = new CRT({ width: 0.75, height: 0.5625, depth: 0.45, canvasW: 1024, canvasH: 768, lines: 300, lightIntensity: 2.2, seed: 3, bezel: 0x24221f, lightOffset: 0.8 });
  H.tv.group.position.set(0, 0.5 + 0.5625 / 2 + 0.095, 0.48);
  scene.add(H.tv.group);
  [-1, 1].forEach((sd) => {
    box(0.42, 0.56, 0.4, std(0x4a3426, 0.55), sd * 1.12, 0.28, 0.32, scene);
    const base = cyl(0.05, 0.08, 0.32, std(0xcfc6b2, 0.4), 16); base.position.set(sd * 1.12, 0.72, 0.32); scene.add(base);
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0xf2e2c2, roughness: 0.9, emissive: new THREE.Color(0.9, 0.62, 0.32), emissiveIntensity: 0.6, side: THREE.DoubleSide });
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.19, 0.24, 24, 1, true), shadeMat); shade.position.set(sd * 1.12, 0.98, 0.32); scene.add(shade);
    const l = new THREE.PointLight(0xffc489, 3.6, 5, 2); l.position.set(sd * 1.12, 0.95, 0.42); scene.add(l);
    H.warm.push({ light: l, base: 3.6, shade: shadeMat });
  });
  // coffee table with two identical mugs and one dried ring
  box(1.0, 0.04, 0.55, std(0x5a3f2c, 0.5), 0, 0.4, 2.1, scene);
  [[-0.44, -0.24], [0.44, -0.24], [-0.44, 0.24], [0.44, 0.24]].forEach(([x, z]) => box(0.04, 0.4, 0.04, std(0x5a3f2c, 0.5), x, 0.2, 2.1 + z, scene));
  [-0.18, 0.18].forEach((x) => { const m = mug(); m.position.set(x, 0.42, 2.05); m.rotation.y = 0.4; scene.add(m); });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.038, 32), new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.6, transparent: true, opacity: 0.6 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0.02, 0.4215, 2.22); scene.add(ring);
  // the toy truck, tipped over, placed where a camera would want it
  const truck = toyTruck(); truck.rotation.set(0, 0.6, Math.PI / 2 * 0.98); truck.position.set(-0.62, 0.11, 1.2); scene.add(truck);
  // shoes by the hallway: work boots, and small sneakers, perfectly parallel
  [[2.55, 1.65, 0.3, 0x5b4128, true], [2.55, 1.88, 0.3, 0x5b4128, true], [2.6, 2.12, 0.17, 0x3d6d8f, false], [2.6, 2.26, 0.17, 0x3d6d8f, false]]
    .forEach(([x, z, len, col, hi]) => { const s = shoe(len, col, hi); s.rotation.y = Math.PI / 2; s.position.set(x, 0, z); scene.add(s); });
  // the couch, facing the television, empty
  {
    const cm = std(0x8a8f80, 0.95, { map: fabric(8, '#8a8f80', [3, 2]) });
    const g = new THREE.Group(); g.position.set(-0.1, 0, 2.95); g.rotation.y = Math.PI; scene.add(g);
    box(2.1, 0.42, 0.9, cm, 0, 0.21, 0, g);
    box(2.1, 0.5, 0.22, cm, 0, 0.62, -0.36, g);
    box(0.2, 0.62, 0.9, cm, -1.0, 0.31, 0, g); box(0.2, 0.62, 0.9, cm, 1.0, 0.31, 0, g);
    [-0.48, 0.48].forEach((x) => box(0.9, 0.12, 0.7, cm, x, 0.48, 0.08, g));
    H.couch = g;
  }
  // light spilling from the hallway
  H.hallLight = new THREE.PointLight(0xffc387, 4.0, 6, 2); H.hallLight.position.set(4.6, 2.15, 3.0); scene.add(H.hallLight);
  H.warm.push({ light: H.hallLight, base: 4.0 });
  H.ambient = new THREE.HemisphereLight(0x2c5752, 0x0a0806, 0.55); scene.add(H.ambient);   // teal in the shadows
  H.setLight = new THREE.SpotLight(0xffd6a2, 14, 9, 0.95, 0.8, 1.6);              // a key light no house has
  H.setLight.position.set(0.3, 2.45, 4.6); H.setLight.target.position.set(0, 0.4, 1.4); scene.add(H.setLight, H.setLight.target);
  H.warm.push({ light: H.setLight, base: 14 });

  // ── hallway (x 3…10, z 2.45…3.55)
  const L = 7, W = 1.1, zc = 3.0, xc = 6.5;
  { const hf = plane(L, W, floorMat, scene); hf.rotation.x = -Math.PI / 2; hf.position.set(xc, 0.001, zc);
    const runner = plane(L - 0.6, 0.6, std(0x7a5a48, 0.95, { map: fabric(12, '#7a5a48', [10, 1]) }), scene); runner.rotation.x = -Math.PI / 2; runner.position.set(xc, 0.005, zc);
    const hc = plane(L, W, ceilMat, scene); hc.rotation.x = Math.PI / 2; hc.position.set(xc, 2.4, zc);
    const ws = plane(L, 2.4, wallMat, scene); ws.position.set(xc, 1.2, zc - W / 2);
    const wn = plane(L, 2.4, wallMat, scene); wn.rotation.y = Math.PI; wn.position.set(xc, 1.2, zc + W / 2);
    box(L, 0.08, 0.015, trim, xc, 0.04, zc - W / 2 + 0.008, scene); box(L, 0.08, 0.015, trim, xc, 0.04, zc + W / 2 - 0.008, scene);
    const fix = cyl(0.16, 0.12, 0.06, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 1.1) }), 20); fix.position.set(4.6, 2.37, zc); scene.add(fix);
    const fix2 = fix.clone(); fix2.position.x = 8.0; scene.add(fix2);
    H.hallLight2 = new THREE.PointLight(0xffc387, 3.0, 5, 2); H.hallLight2.position.set(8.0, 2.15, zc); scene.add(H.hallLight2);
    H.warm.push({ light: H.hallLight2, base: 3.0 });
  }
  // three framed pictures: each the same empty couch, from a slightly different angle
  H.photoFeeds = [];
  [4.7, 6.2, 7.7].forEach((x, i) => {
    const fr = new THREE.Group(); fr.position.set(x, 1.55, zc + W / 2 - 0.01); fr.rotation.y = Math.PI; scene.add(fr);
    box(0.5, 0.4, 0.025, std(0x2c2420, 0.4), 0, 0, 0.012, fr);
    box(0.44, 0.34, 0.01, std(0xf0ece2, 0.8), 0, 0, 0.027, fr);
    const feed = new Feed(256, 192, 42);
    const cam = feed.camera;
    const a = [-0.35, 0.0, 0.32][i];
    cam.position.set(-0.1 + Math.sin(a) * 2.1, 1.05 + i * 0.12, 2.95 - Math.cos(a) * 2.1);
    cam.lookAt(-0.1, 0.55, 2.95);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.27), new THREE.MeshBasicMaterial({ map: feed.texture, color: new THREE.Color(1.1, 1.05, 0.95) }));
    pic.position.z = 0.033; fr.add(pic);
    H.photoFeeds.push({ feed, pic });
  });

  // ── the staged bedroom (x 10…14, z 1…5); doorway in the west wall at z 2.55…3.45
  const kidWall = std(0xd2d8c8, 0.92);
  {
    const bf = plane(4, 4, floorMat, scene); bf.rotation.x = -Math.PI / 2; bf.position.set(12, 0.002, 3);
    const bc = plane(4, 4, ceilMat, scene); bc.rotation.x = Math.PI / 2; bc.position.set(12, 2.4, 3);
    const be = plane(4, 2.4, kidWall, scene); be.rotation.y = -Math.PI / 2; be.position.set(14, 1.2, 3);
    const bs = plane(4, 2.4, kidWall, scene); bs.position.set(12, 1.2, 1);
    // west wall with the doorway we came through
    const w1 = plane(1.55, 2.4, kidWall, scene); w1.rotation.y = Math.PI / 2; w1.position.set(10, 1.2, 1.775);
    const w2 = plane(1.55, 2.4, kidWall, scene); w2.rotation.y = Math.PI / 2; w2.position.set(10, 1.2, 4.225);
    const w3 = plane(0.9, 0.35, kidWall, scene); w3.rotation.y = Math.PI / 2; w3.position.set(10, 2.225, 3.0);
    // north wall: plain, and where a door will turn out to have been
    H.doorX0 = 11.75; H.doorX1 = 12.65;
    const n1 = plane(1.75, 2.4, kidWall, scene); n1.rotation.y = Math.PI; n1.position.set(10.875, 1.2, 5);
    const n2 = plane(1.35, 2.4, kidWall, scene); n2.rotation.y = Math.PI; n2.position.set(13.325, 1.2, 5);
    const n3 = plane(0.9, 0.35, kidWall, scene); n3.rotation.y = Math.PI; n3.position.set(12.2, 2.225, 5);
    box(4, 0.08, 0.015, trim, 12, 0.04, 4.992, scene).visible = true;
  }
  // the door that isn't there yet: same paint as the wall, flush, hinged at x 11.75
  H.doorPivot = new THREE.Group(); H.doorPivot.position.set(11.75, 0, 5.0); scene.add(H.doorPivot);
  H.doorMat = new THREE.MeshStandardMaterial({ color: 0xd2d8c8, roughness: 0.92 });
  H.door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.05, 0.04), H.doorMat);
  H.door.position.set(0.45, 1.025, 0.02); H.doorPivot.add(H.door);
  H.handle = new THREE.Group(); H.handle.position.set(0.8, 1.0, -0.024); H.doorPivot.add(H.handle);
  { const brass = std(0xe2d2a8, 0.28, { metalness: 0.2 });
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.046, 0.17, 0.008, 2, 0.003), brass); plate.position.set(0, -0.035, -0.004); H.handle.add(plate);
    const key = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.02), new THREE.MeshBasicMaterial({ color: 0x050505 })); key.rotation.y = Math.PI; key.position.set(0, -0.085, -0.0085); H.handle.add(key);
    const rose = cyl(0.016, 0.016, 0.012, brass, 20); rose.rotation.x = Math.PI / 2; rose.position.z = -0.01; H.handle.add(rose);
    H.lever = new THREE.Group(); H.lever.position.z = -0.03; H.handle.add(H.lever);
    const neck = cyl(0.008, 0.008, 0.03, brass, 10); neck.rotation.x = Math.PI / 2; neck.position.z = 0.012; H.lever.add(neck);
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.115, 0.02, 0.02, 3, 0.008), brass); arm.position.set(-0.05, 0, 0); H.lever.add(arm); }
  H.handle.scale.set(1, 1, 0.001);
  // light from the other side: a strip under the door, then the seams
  H.seamMats = [];
  const seam = (w, h, x, y) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }); const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); s.rotation.y = Math.PI; s.position.set(x, y, 4.972); scene.add(s); H.seamMats.push(m); return m; };
  H.stripMat = seam(0.9, 0.012, 12.2, 0.006);
  H.seamL = seam(0.006, 2.05, 11.752, 1.025);
  H.seamR = seam(0.006, 2.05, 12.648, 1.025);
  H.seamT = seam(0.9, 0.006, 12.2, 2.048);
  H.beyondLight = new THREE.PointLight(0xffd2a0, 0, 0.9, 2); H.beyondLight.position.set(12.2, 0.03, 4.93); scene.add(H.beyondLight);

  // the bed, made perfectly
  {
    const frame = std(0xe9e4da, 0.6);
    box(1.0, 0.25, 1.75, frame, 13.12, 0.2, 3.0, scene);
    box(1.04, 0.85, 0.06, frame, 13.97, 0.42, 3.0, scene).rotation.y = Math.PI / 2;
    box(0.96, 0.14, 1.7, std(0xf2f0ea, 0.9), 13.12, 0.39, 3.0, scene);
    const blanket = box(0.99, 0.03, 1.32, std(0x8fb3c4, 0.9, { map: fabric(21, '#8fb3c4', [3, 3]) }), 12.92, 0.47, 3.0, scene);
    blanket.scale.x = 1;
    box(0.5, 0.11, 0.32, std(0xf6f4ee, 0.85), 13.64, 0.52, 3.0, scene);
  }
  // the storybook: one folded sheet, open to a single spread
  {
    H.book = new THREE.Group(); H.book.position.set(12.9, 0.49, 3.0); H.book.rotation.y = -Math.PI / 2; scene.add(H.book);
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), new THREE.MeshStandardMaterial({ map: pageTex('YOUR|BEST|MOMENT', { size: 76 }), roughness: 0.85 }));
    lp.rotation.set(-Math.PI / 2, 0.12, 0); lp.position.set(-0.098, 0.008, 0); H.book.add(lp);
    const rp = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), new THREE.MeshStandardMaterial({ map: pageTex('TAKE 01', { size: 76 }), roughness: 0.85 }));
    rp.rotation.set(-Math.PI / 2, -0.12, 0); rp.position.set(0.098, 0.008, 0); H.book.add(rp);
    const cover = box(0.42, 0.003, 0.26, std(0xc0392b, 0.6), 0, 0.0, 0, H.book);
    cover.castShadow = false;
  }
  // the bedside chair, set on its tape mark, facing the camera above the bed
  H.chair = chairWood(0x6b4a32);
  H.chair.position.set(12.05, 0, 2.15); H.chair.rotation.y = Math.atan2(13.97 - 12.05, 3.0 - 2.15);
  scene.add(H.chair);
  const dust = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.4), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => {
    const rnd = mulberry32(31); g.clearRect(0, 0, w, h);
    for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(210,205,190,${0.15 + rnd() * 0.5})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 1 + rnd() * 1.5); }
  }), transparent: true, roughness: 1 }));
  dust.rotation.x = -Math.PI / 2; dust.position.y = 0.472; H.chair.add(dust);
  const tape = new THREE.MeshStandardMaterial({ color: 0xd8cf58, roughness: 0.7 });
  [0.7, -0.7].forEach((r) => { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.045), tape); t.rotation.set(-Math.PI / 2, 0, r); t.position.set(12.05, 0.004, 2.15); scene.add(t); });
  // nightstand, night-light, and its cord running up into the camera
  box(0.42, 0.55, 0.38, std(0xe9e4da, 0.6), 13.72, 0.275, 4.2, scene);
  H.nightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.6, 0.8) });
  const nl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 12), H.nightMat); nl.position.set(13.72, 0.64, 4.2); scene.add(nl);
  H.nightLight = new THREE.PointLight(0xffb070, 1.6, 4, 2); H.nightLight.position.set(13.7, 0.78, 4.1); scene.add(H.nightLight);
  H.warm.push({ light: H.nightLight, base: 1.6, mat: H.nightMat });
  // the bedroom's own set key, aimed at the chair like a product shot
  H.chairKey = new THREE.SpotLight(0xffd6a2, 7, 6, 0.42, 0.7, 1.6);
  H.chairKey.position.set(11.0, 2.35, 1.3); H.chairKey.target.position.set(12.1, 0.45, 2.25); scene.add(H.chairKey, H.chairKey.target);
  H.warm.push({ light: H.chairKey, base: 7 });
  {
    const pts = [[13.72, 0.58, 4.25], [13.93, 0.56, 4.35], [13.97, 0.5, 4.2], [13.975, 1.2, 3.6], [13.975, 1.85, 3.15], [13.95, 2.0, 3.02]].map((p) => new THREE.Vector3(...p));
    const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.005, 6), std(0xf2efe8, 0.5)); scene.add(cord);
  }
  // the camera above the bed, with its red light and tally display
  {
    const g = new THREE.Group(); g.position.set(13.9, 2.05, 3.0); g.rotation.y = -Math.PI / 2; scene.add(g);
    const dk = std(0x1c1e1e, 0.45);
    box(0.16, 0.12, 0.22, dk, 0, 0, -0.02, g);
    const lens = cyl(0.045, 0.05, 0.08, dk, 18); lens.rotation.x = Math.PI / 2; lens.position.z = 0.12; g.add(lens);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.038, 20), std(0x050708, 0.1, { metalness: 0.6 })); glass.position.z = 0.161; g.add(glass);
    box(0.04, 0.12, 0.04, dk, 0, -0.1, -0.08, g);
    H.recMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.01, 0.01) });
    const rec = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), H.recMat); rec.position.set(0.055, 0.04, 0.09); g.add(rec);
    H.recLight = new THREE.PointLight(0xff2a14, 0, 1.4, 2); H.recLight.position.set(13.75, 2.1, 3.06); scene.add(H.recLight);
    H.camDisplay = amberDisplay(0.46, 0.13);
    H.camDisplay.position.set(0, -0.2, 0.0); g.add(H.camDisplay);
  }
  // the amber tally display beside the bed
  H.bedDisplay = amberDisplay(0.24, 0.08);
  {
    const st = new THREE.Group(); st.position.set(13.62, 0, 1.85); st.rotation.y = -Math.PI / 2 + 0.35; scene.add(st);
    box(0.03, 0.62, 0.03, std(0x1c1e1e, 0.5), 0, 0.31, -0.02, st);
    H.bedDisplay.position.set(0, 0.66, 0); st.add(H.bedDisplay);
  }
  H.doorwayLightMat = null;
  H.dust = makeDust(Math.round(q.dust * 0.4), [10.2, 0.3, 1.2], [13.8, 2.2, 4.8], 61);
  scene.add(H.dust);

  // portals: the bedroom doorway (looking back west) and the new door (north)
  H.toChamber = new Portal(q.w >> 1, q.h >> 1, 0.9, 2.05);
  H.toChamber.mesh.rotation.y = Math.PI / 2; H.toChamber.mesh.position.set(9.97, 1.025, 3.0);
  H.toChamber.mesh.visible = false; scene.add(H.toChamber.mesh);
  H.toChamber.fromAnchor.position.set(9.97, 0, 3.0); H.toChamber.fromAnchor.rotation.y = Math.PI / 2; scene.add(H.toChamber.fromAnchor);
  H.toReal = new Portal(q.w >> 1, q.h >> 1, 0.9, 2.05);
  H.toReal.mesh.rotation.y = Math.PI; H.toReal.mesh.position.set(12.2, 1.025, 5.06);
  H.toReal.mesh.visible = false; scene.add(H.toReal.mesh);
  H.toReal.fromAnchor.position.set(12.2, 0, 5.06); H.toReal.fromAnchor.rotation.y = Math.PI; scene.add(H.toReal.fromAnchor);
  // behind the false door: nothing at all
  box(1.0, 2.2, 0.04, std(0x000000, 1), 12.2, 1.1, 5.3, scene);
  return H;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE TRANSMISSION CHAMBER, as seen once more through a doorway.
// ─────────────────────────────────────────────────────────────────────────────
export function buildChamber(T, q) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x05060a, 0.016);
  const C = { scene };
  const dark = std(0x141617, 0.7, { metalness: 0.3 });
  const grate = std(0x2b2f2f, 0.55, { metalness: 0.5 });
  for (let k = 0; k < 22; k++) {
    const z = 0.75 + 1.5 * k;
    const g = new THREE.Group(); g.position.z = z; scene.add(g);
    box(0.95, 0.06, 1.46, grate, 0, -0.03, 0, g);
    [-1, 1].forEach((sd) => { box(0.025, 0.025, 1.5, grate, sd * 0.47, 1.0, 0, g); box(0.025, 1.0, 0.025, grate, sd * 0.47, 0.5, -0.73, g); });
    const sm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.27, 0.24) });
    [-1, 1].forEach((sd) => box(0.02, 0.012, 1.4, sm, sd * 0.44, 0.012, 0, g));
    if (k % 2 === 0) { const cn = makeCone(0.75, 2.3, 0xd8e2d0, 0.02); cn.position.set(0, 2.25, 0); g.add(cn); }
  }
  const pl = new THREE.PointLight(0xd8e2d0, 3, 5, 2); pl.position.set(0, 2, 3); scene.add(pl);
  const pl2 = new THREE.PointLight(0xd8e2d0, 2, 5, 2); pl2.position.set(0, 2, 8); scene.add(pl2);
  // the frame
  { const fz = 56, fy = 8.5;
    box(36, 3.5, 2, dark, 0, fy + 10.75, fz, scene); box(36, 3.5, 2, dark, 0, fy - 10.75, fz, scene);
    box(5, 25, 2, dark, -15.5, fy, fz, scene); box(5, 25, 2, dark, 15.5, fy, fz, scene);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(56, 40), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec2 vUv; void main(){ vec2 c = (vUv - vec2(0.5, 0.45)) * vec2(1.0, 1.25);
        float haze = exp(-dot(c, c) * 7.0); vec3 col = mix(vec3(0.06, 0.04, 0.12), vec3(0.03, 0.07, 0.07), vUv.y) * haze * 1.9;
        gl_FragColor = vec4(col, 1.0); }` }));
    glow.position.set(0, fy, fz + 4); glow.rotation.y = Math.PI; scene.add(glow); }
  // the audience: every screen says the same word
  {
    const rnd = mulberry32(99);
    const P = [];
    for (const sd of [-1, 1]) for (let zi = 0; zi < 26; zi++) for (let k = 0; k < 9; k++) {
      const z = 3 + zi * 1.75 + rnd() * 0.6;
      P.push([sd * (4.6 + k * 1.75 + rnd() * 0.5 + Math.max(0, zi - 15) * 0.25), -7 + k * 1.95 + rnd() * 0.7 + Math.sin(zi * 0.3) * 0.4, z]);
    }
    for (let xi = 0; xi < 14; xi++) for (let k = 0; k < 4; k++) { const x = (xi - 6.5) * 1.75 + rnd() * 0.4; if (Math.abs(x) < 2) continue; P.push([x, -7 + k * 1.95 + rnd() * 0.6, 46 + rnd() * 2]); }
    const n = P.length;
    const geo = new THREE.PlaneGeometry(0.62, 0.47);
    const aOn = new Float32Array(n), aOff = new Float32Array(n).fill(999), aSeed = new Float32Array(n);
    const text = textCanvasTexture(256, 192, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffb347'; g.font = 'bold 64px "DejaVu Sans Mono", "Courier New", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ffb347'; g.shadowBlur = 10;
      g.fillText('STAY.', w / 2, h / 2);
    });
    C.audience = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      uniforms: { uText: { value: text }, uTime: { value: 0 }, uIdle: { value: 1 }, uBright: { value: 1 } },
      vertexShader: audienceVert, fragmentShader: audienceFrag }), n);
    const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.74, 0.6, 0.6), std(0x101213, 0.7), n);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    const cable = [];
    P.forEach(([x, y, z], i) => {
      const dir = new THREE.Vector3(0, 1.5, Math.min(z, 44) - 6).sub(new THREE.Vector3(x, y, z)).normalize();
      qq.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      v.set(x, y, z).add(dir.clone().multiplyScalar(0.305)); m4.compose(v, qq, one); C.audience.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x, y, z), qq, one); bodies.setMatrixAt(i, m4);
      aOn[i] = -10; aSeed[i] = rnd();
      if (i % 3 === 0) cable.push(x, y + 0.3, z, x, 40, z);
    });
    geo.setAttribute('aOn', new THREE.InstancedBufferAttribute(aOn, 1));
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(aOff, 1));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
    C.audience.frustumCulled = false; bodies.frustumCulled = false;
    scene.add(C.audience, bodies);
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cable, 3));
    scene.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x0b0d0e, transparent: true, opacity: 0.6 })));
    // a few sets right beside the walkway, near enough to read from the doorway
    const nearMat = new THREE.MeshBasicMaterial({ map: text, color: new THREE.Color(1.5, 1.4, 1.3), fog: false });
    [[-1.25, 1.35, 3.2], [1.3, 1.1, 4.4], [-1.45, 2.15, 5.8], [1.5, 2.0, 7.2], [-1.2, 0.55, 8.6], [1.35, 0.6, 2.4]].forEach(([x, y, z]) => {
      const g = new THREE.Group(); g.position.set(x, y, z); g.lookAt(0, 1.5, z - 3); scene.add(g);
      box(0.82, 0.64, 0.6, std(0x101213, 0.7), 0, 0, -0.3, g);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.5), nearMat); scr.position.z = 0.005; g.add(scr);
    });
    const wl = new THREE.PointLight(0xffa850, 5, 40, 1.2); wl.position.set(-9, 3, 18); scene.add(wl);
    const wr = new THREE.PointLight(0xffa850, 5, 40, 1.2); wr.position.set(9, 3, 18); scene.add(wr);
  }
  scene.add(new THREE.HemisphereLight(0x1a2226, 0x020202, 0.25));
  C.anchor = new THREE.Object3D(); C.anchor.position.set(0, 0, 0.0); C.anchor.rotation.y = Math.PI; scene.add(C.anchor);
  return C;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE REAL ROOM. Smaller than the station, more substantial. Ordinary light,
// specific wear, nothing staged. Room x 0…3.6, z 0…3.6, door in the south wall.
// ─────────────────────────────────────────────────────────────────────────────
function drawing() {
  return canvasTex(400, 300, (g, w, h) => {
    g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(77);
    const scrib = (col, pts, wd = 6) => { g.strokeStyle = col; g.lineWidth = wd; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + rnd() * 4, y + rnd() * 4) : g.moveTo(x, y))); g.stroke(); };
    scrib('#e2a12a', [[320, 40], [350, 70], [330, 100], [300, 75], [320, 40]], 8);
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; scrib('#e2a12a', [[325 + Math.cos(a) * 40, 70 + Math.sin(a) * 40], [325 + Math.cos(a) * 58, 70 + Math.sin(a) * 58]], 5); }
    scrib('#b4462f', [[90, 180], [160, 110], [230, 180]], 8);
    scrib('#3b5f8a', [[100, 180], [100, 260], [220, 260], [220, 180]], 8);
    scrib('#3b5f8a', [[145, 260], [145, 215], [175, 215], [175, 260]], 6);
    scrib('#3d8a4a', [[0, 270], [80, 262], [200, 274], [400, 266]], 10);
  });
}
function bentBook() {
  const g = new THREE.Group();
  const cover = std(0x2f6f8f, 0.75, { map: canvasTex(256, 320, (c, w, h) => {
    c.fillStyle = '#2f6f8f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f2d36b'; c.beginPath(); c.arc(w * 0.5, h * 0.42, 60, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.15)'; for (let i = 0; i < 40; i++) c.fillRect(Math.random() * w, Math.random() * h, 3, 1);
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w, h * 0.7); c.lineTo(w * 0.72, h); c.stroke();
  }) });
  box(0.2, 0.014, 0.25, std(0xeee6d2, 0.9), 0, 0.008, 0, g);
  const top = box(0.205, 0.004, 0.255, cover, 0, 0.017, 0, g);
  // the dog-eared corner, bent up
  const ear = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), cover);
  ear.rotation.set(-Math.PI / 2 + 0.6, 0, Math.PI / 4); ear.position.set(0.09, 0.03, 0.11); g.add(ear);
  return g;
}
function hand(scale = 1, skin = 0xc79a7c) {
  // a relaxed hand lying flat: one soft outline (fingers together, thumb tucked), rounded at every edge.
  // Read as a silhouette in lamplight, not as anatomy.
  const sh = new THREE.Shape();
  sh.moveTo(-0.026, -0.09);
  sh.lineTo(-0.031, -0.012);
  sh.bezierCurveTo(-0.045, -0.006, -0.054, 0.014, -0.053, 0.036);   // thumb, tucked
  sh.bezierCurveTo(-0.052, 0.05, -0.045, 0.054, -0.04, 0.046);
  sh.bezierCurveTo(-0.04, 0.038, -0.039, 0.04, -0.038, 0.05);
  const tips = [[-0.0285, 0.1], [-0.0095, 0.116], [0.0095, 0.113], [0.0275, 0.098]];
  let px = -0.038;
  tips.forEach(([x, y], i) => {
    const r = 0.0095;
    sh.bezierCurveTo(px, y - 0.012, x - r, y, x, y);
    const nx = i < 3 ? (x + tips[i + 1][0]) / 2 : 0.037;
    const ny = i < 3 ? Math.min(y, tips[i + 1][1]) - 0.004 : y - 0.03;
    sh.bezierCurveTo(x + r, y, nx, ny + 0.01, nx, ny);
    px = nx;
  });
  sh.bezierCurveTo(0.038, 0.04, 0.036, 0.0, 0.033, -0.02);
  sh.lineTo(0.026, -0.09);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.0065, bevelSegments: 5, curveSegments: 10 });
  geo.translate(0, 0, -0.004);
  geo.rotateX(-Math.PI / 2);   // lie flat: outline in x/z, fingers toward -z
  geo.rotateY(Math.PI);        // fingers toward +z
  const p = geo.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    const z = p[i + 2];
    const f = Math.max(0, z - 0.05); p[i + 1] -= 2.4 * f * f;          // fingertips settle onto the surface
    p[i + 1] += 0.004 * Math.exp(-(((z - 0.035) / 0.02) ** 2)) * (p[i + 1] > 0 ? 1 : 0); // knuckles
    p[i + 1] *= p[i + 1] < 0 ? 0.6 : 1;                                  // flatter palm
  }
  geo.computeVertexNormals();
  const m = new THREE.MeshPhysicalMaterial({ color: skin, roughness: 0.6, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.95, 0.6, 0.5) });
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  g.scale.setScalar(scale);
  return g;
}

export function buildReal(T, q) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const R = { scene };
  const wall = std(0xcfc7b8, 0.92, { map: paint(41, '#d8cfbe', 0.9) });
  const floor = std(0xffffff, 0.6, { map: woodFloor(43, [2, 2], 1) });
  const fl = plane(3.6, 3.6, floor, scene); fl.rotation.x = -Math.PI / 2; fl.position.set(1.8, 0, 1.8);
  const ce = plane(3.6, 3.6, std(0xd6d0c4, 0.95), scene); ce.rotation.x = Math.PI / 2; ce.position.set(1.8, 2.4, 1.8);
  const wn = plane(3.6, 2.4, wall, scene); wn.rotation.y = Math.PI; wn.position.set(1.8, 1.2, 3.6);
  const ww = plane(3.6, 2.4, wall, scene); ww.rotation.y = Math.PI / 2; ww.position.set(0, 1.2, 1.8);
  const we = plane(3.6, 2.4, wall, scene); we.rotation.y = -Math.PI / 2; we.position.set(3.6, 1.2, 1.8);
  // south wall with the door we come through at x 0.85…1.75
  const s1 = plane(0.85, 2.4, wall, scene); s1.position.set(0.425, 1.2, 0);
  const s2 = plane(1.85, 2.4, wall, scene); s2.position.set(2.675, 1.2, 0);
  const s3 = plane(0.9, 0.35, wall, scene); s3.position.set(1.3, 2.225, 0);
  const trim = std(0xe6ded0, 0.6);
  box(3.6, 0.08, 0.015, trim, 1.8, 0.04, 3.592, scene);
  const rug = plane(1.5, 1.0, std(0x9a6f5b, 0.95, { map: fabric(45, '#9a6f5b', [5, 3]) }), scene); rug.rotation.set(-Math.PI / 2, 0, 0.12); rug.position.set(1.5, 0.004, 1.5);
  // the bed against the east wall, headboard at the north end
  const bedX = 3.0, bedZ = 1.9;
  box(1.0, 0.25, 1.75, std(0x8a6a4c, 0.6), bedX, 0.2, bedZ, scene);
  box(1.04, 0.7, 0.06, std(0x8a6a4c, 0.6), bedX, 0.35, bedZ + 0.9, scene);
  box(0.96, 0.14, 1.7, std(0xefece4, 0.9), bedX, 0.39, bedZ, scene);
  // the pillow: flat, wide, dented where the head is
  {
    const geo = new RoundedBoxGeometry(0.6, 0.1, 0.34, 4, 0.045);
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      if (y > 0) p[i + 1] -= 0.035 * Math.exp(-((x - 0.06) ** 2 + (z + 0.03) ** 2) / 0.012) + 0.012 * (Math.abs(x) / 0.31) ** 2;
    }
    geo.computeVertexNormals();
    const pillow = new THREE.Mesh(geo, std(0xddd4c4, 0.92, { map: fabric(57, '#ddd4c4', [3, 2]) }));
    pillow.position.set(bedX - 0.02, 0.51, bedZ + 0.7); pillow.rotation.y = 0.07;
    pillow.castShadow = true; pillow.receiveShadow = true; scene.add(pillow);
  }
  // the child, turned toward the wall: only the back of a head of hair above the blanket
  {
    const hairTex = canvasTex(256, 256, (g, w, h) => {
      const rnd = mulberry32(59);
      g.fillStyle = '#2e2018'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 1400; k++) {
        const x = rnd() * w, y = rnd() * h, l = 10 + rnd() * 30;
        g.strokeStyle = rnd() < 0.5 ? `rgba(110,80,55,${0.15 + rnd() * 0.2})` : `rgba(15,10,6,${0.2 + rnd() * 0.2})`;
        g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 3, y + l / 2, x + (rnd() - 0.5) * 8, y + l); g.stroke();
      }
    }, [2, 1]);
    const hm = std(0xffffff, 0.68, { map: hairTex });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.082, 24, 16), hm);
    head.scale.set(0.95, 1.0, 1.1); head.position.set(bedX + 0.0, 0.59, bedZ + 0.7); head.rotation.set(0.2, 0.4, 0.15);
    head.castShadow = true; scene.add(head);
  }
  // the quilt: faded patchwork, pulled up to the ear, rising with breathing
  {
    const quilt = canvasTex(512, 640, (g, w, h) => {
      const rnd = mulberry32(47);
      const cols = ['#6f8aa6', '#c9b994', '#a5776c', '#8b9a7a', '#d5ccb8', '#b8925a', '#7d7f9c'];
      const nx = 6, ny = 8, sw = w / nx, sh = h / ny;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.fillRect(i * sw, j * sh, sw, sh);
        if (rnd() < 0.35) { g.fillStyle = 'rgba(255,250,235,0.18)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(i * sw + rnd() * sw, j * sh + rnd() * sh, 3 + rnd() * 4, 0, 7); g.fill(); } }
        if (rnd() < 0.3) { g.strokeStyle = 'rgba(40,30,20,0.12)'; g.lineWidth = 3; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(i * sw, j * sh + k * sh / 4); g.lineTo(i * sw + sw, j * sh + k * sh / 4); g.stroke(); } }
      }
      // seams and quilting stitches
      g.strokeStyle = 'rgba(40,30,22,0.35)'; g.lineWidth = 2;
      for (let i = 0; i <= nx; i++) { g.beginPath(); g.moveTo(i * sw, 0); g.lineTo(i * sw, h); g.stroke(); }
      for (let j = 0; j <= ny; j++) { g.beginPath(); g.moveTo(0, j * sh); g.lineTo(w, j * sh); g.stroke(); }
      g.strokeStyle = 'rgba(245,238,220,0.35)'; g.setLineDash([5, 5]); g.lineWidth = 1.5;
      for (let i = 0; i < nx; i++) { g.beginPath(); g.moveTo(i * sw + 6, 0); g.lineTo(i * sw + 6, h); g.stroke(); }
      g.setLineDash([]);
      // washed out and slightly worn
      for (let k = 0; k < 4000; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,250,240' : '0,0,0'},${rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
      g.fillStyle = 'rgba(235,228,212,0.16)'; g.fillRect(0, 0, w, h);
    }, [1, 1]);
    const nx = 40, nz = 44, wx = 1.18, wz = 1.42;
    const geo = new THREE.PlaneGeometry(wx, wz, nx, nz);
    geo.rotateX(-Math.PI / 2);
    R.blanketGeo = geo;
    R.blanketBase = Float32Array.from(geo.attributes.position.array);
    R.blanket = new THREE.Mesh(geo, std(0xffffff, 0.95, { map: quilt, side: THREE.DoubleSide }));
    R.blanket.position.set(bedX, 0.465, bedZ - 0.1);
    R.blanket.castShadow = true; R.blanket.receiveShadow = true;
    scene.add(R.blanket);
    // a body lying on its side facing the wall (+x), knees drawn up, head toward the pillow (+z).
    // one smooth form along a centreline so it reads as a person, not a row of lumps
    const prof = [ // s, centre x, height, half-width
      [-0.71, 0.0, 0.07, 0.11], [-0.55, 0.03, 0.1, 0.12], [-0.3, 0.1, 0.15, 0.14], [-0.02, -0.03, 0.2, 0.15],
      [0.22, 0.0, 0.16, 0.14], [0.48, 0.04, 0.2, 0.14], [0.71, 0.05, 0.17, 0.13]];
    const at = (z) => {
      let k = 0; while (k < prof.length - 2 && z > prof[k + 1][0]) k++;
      const a0 = prof[k], a1 = prof[k + 1];
      let u = Math.min(1, Math.max(0, (z - a0[0]) / (a1[0] - a0[0]))); u = u * u * (3 - 2 * u);
      return [a0[1] + (a1[1] - a0[1]) * u, a0[2] + (a1[2] - a0[2]) * u, a0[3] + (a1[3] - a0[3]) * u];
    };
    const heightAt = (x, z, breath) => {
      const [cx, hh, r] = at(z);
      const h = hh + 0.012 * breath * Math.exp(-(((z - 0.4) / 0.2) ** 2));
      const d = (x - cx) / r;
      const body = h * Math.pow(1 / (1 + d * d), 1.25) + 0.05 * Math.min(1, Math.max(0, (z - 0.5) / 0.21)) * Math.exp(-((x / 0.36) ** 2));
      const fold = 0.0045 * Math.sin(x * 9 + z * 4 + 0.8) + 0.003 * Math.sin(z * 11 - x * 6);
      const over = Math.max(0, Math.abs(x) - 0.5);
      return body + fold * (1 - Math.min(1, over * 8)) - over * 1.5;
    };
    const breathAt = (t) => Math.sin(t * 2 * Math.PI / 3.6) * 0.5 + 0.5;
    // world-space height of the quilt surface (for resting hands on it)
    R.blanketHeight = (wx, wz, t) => R.blanket.position.y + heightAt(wx - R.blanket.position.x, wz - R.blanket.position.z, breathAt(t));
    R.blanketShape = (t) => {
      const p = geo.attributes.position.array, b = R.blanketBase, br = breathAt(t);
      for (let i = 0; i < p.length; i += 3) p[i + 1] = heightAt(b[i], b[i + 2], br);
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    };
    R.blanketShape(0);
  }
  // the child's hand, which comes out from under the blanket edge
  R.childHand = hand(0.6, 0xc8977a);
  scene.add(R.childHand);
  // the father's hand and sleeve, resting on the bed edge (appears once he sits)
  {
    R.dadArm = new THREE.Group(); scene.add(R.dadArm);
    // forearm rises from the wrist toward an elbow resting on his knee
    const fore = new THREE.Group(); fore.rotation.x = 0.3; R.dadArm.add(fore);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 18), std(0x4f5a66, 0.9, { map: fabric(49, '#4f5a66', [2, 3]) }));
    sleeve.rotation.x = Math.PI / 2; sleeve.position.set(0, 0.01, -0.39); fore.add(sleeve);
    const cuff = cyl(0.042, 0.042, 0.03, std(0x46505b, 0.9), 18); cuff.rotation.x = Math.PI / 2; cuff.position.set(0, 0.008, -0.085); fore.add(cuff);
    sleeve.castShadow = cuff.castShadow = true;
    const dh = hand(1.0, 0xa97a5e); R.dadArm.add(dh);
  }
  // the chair, angled toward the pillow, a sweater over its back
  R.chair = chairWood(0x7a5a3e, true);
  R.chair.position.set(2.0, 0, 1.92); R.chair.rotation.y = 0.96; scene.add(R.chair);
  { const sw = box(0.44, 0.3, 0.05, std(0x8a4f45, 0.95, { map: fabric(51, '#8a4f45', [2, 2]) }), 0, 0.82, -0.22, R.chair); sw.rotation.x = 0.15; }
  // nightstand beside the head of the bed: lamp, a glass of water on a coaster, the bent book
  // (laid out at its old spot by the headboard, then moved as a group to the bed's open side)
  const ns = new THREE.Group(); ns.position.set(-1.16, 0, -0.6); scene.add(ns);
  box(0.42, 0.55, 0.38, std(0x8a6a4c, 0.6), 3.25, 0.275, 3.15, ns);
  const coaster = cyl(0.045, 0.045, 0.006, std(0x9c7b5a, 0.8), 20); coaster.position.set(3.12, 0.553, 3.05); ns.add(coaster);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xdfe8ea, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35 });
  const glass = cyl(0.033, 0.028, 0.11, glassMat, 20); glass.position.set(3.12, 0.612, 3.05); ns.add(glass);
  const water = cyl(0.03, 0.026, 0.07, new THREE.MeshStandardMaterial({ color: 0xbfd2d6, transparent: true, opacity: 0.4, roughness: 0.1 }), 20); water.position.set(3.12, 0.593, 3.05); ns.add(water);
  const lampBase = cyl(0.05, 0.07, 0.24, std(0xcfc3a8, 0.5), 16); lampBase.position.set(3.33, 0.67, 3.24); ns.add(lampBase);
  R.lampShadeMat = new THREE.MeshStandardMaterial({ color: 0xf0e4cc, roughness: 0.9, emissive: new THREE.Color(0.95, 0.75, 0.5), emissiveIntensity: 0.45, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.18, 24, 1, true), R.lampShadeMat); shade.position.set(3.33, 0.88, 3.24); ns.add(shade);
  R.lamp = new THREE.SpotLight(0xffd8ac, 9, 6, 1.1, 0.9, 1.6);
  R.lamp.position.set(3.3, 0.86, 3.18); R.lamp.target.position.set(3.95, 0.35, 2.5);
  R.lamp.castShadow = true; R.lamp.shadow.mapSize.set(q.shadow, q.shadow); R.lamp.shadow.bias = -0.0006; R.lamp.shadow.radius = 3;
  ns.add(R.lamp, R.lamp.target);
  R.lampFill = new THREE.PointLight(0xffd2a0, 1.3, 5, 2); R.lampFill.position.set(3.3, 1.05, 3.2); ns.add(R.lampFill);
  const book = bentBook(); book.position.set(3.32, 0.552, 3.03); book.rotation.y = 0.5; ns.add(book);
  R.book = book;
  // a toy half under the bed, a sock, a drawing taped to the wall, a shelf of uneven books
  const t2 = toyTruck(0x3b7f5a, 0xe0a33a); t2.position.set(2.45, 0, 1.35); t2.rotation.y = 2.2; scene.add(t2);
  const sock = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.12, 4, 8), std(0xd9d2c4, 0.95)); sock.rotation.set(Math.PI / 2, 0, 0.7); sock.position.set(1.7, 0.025, 1.0); scene.add(sock);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshStandardMaterial({ map: drawing(), roughness: 0.9 }));
  art.rotation.set(0, -Math.PI / 2, 0.04); art.position.set(3.59, 1.45, 1.35); scene.add(art);
  [[-0.17, 0.14], [0.17, 0.14]].forEach(([dz, dy]) => { const tp = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.02), std(0xe8e2c8, 0.8)); tp.rotation.set(0, -Math.PI / 2, 0.6); tp.position.set(3.585, 1.45 + dy, 1.35 + dz); scene.add(tp); });
  {
    box(0.9, 0.025, 0.24, std(0x8a6a4c, 0.6), 0.6, 1.35, 3.47, scene);
    const rnd = mulberry32(53); let x = 0.2;
    const cols = [0xa2453a, 0x3b6f8f, 0xd9b23c, 0x4f7f4a, 0x8a5c8f, 0xc9c1ae];
    while (x < 0.98) { const w = 0.025 + rnd() * 0.03, hh = 0.14 + rnd() * 0.08; const b = box(w, hh, 0.16, std(cols[Math.floor(rnd() * cols.length)], 0.8), x, 1.3625 + hh / 2, 3.47, scene); b.rotation.z = (rnd() - 0.5) * 0.08; x += w + 0.004; }
  }
  // the window: night, curtains not quite closed
  {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.03, 0.045, 0.07) }));
    win.rotation.y = Math.PI / 2; win.position.set(0.005, 1.45, 2.4); scene.add(win);
    [-1, 1].forEach((sd) => { const cu = box(0.04, 1.3, 0.42, std(0xa89d82, 0.95, { map: fabric(55, '#a89d82', [1, 3]) }), 0.03, 1.4, 2.4 + sd * 0.33, scene); cu.castShadow = false; });
    R.moon = new THREE.PointLight(0x8aa0c0, 0.5, 4, 2); R.moon.position.set(0.35, 1.6, 2.4); scene.add(R.moon);
  }
  scene.add(new THREE.HemisphereLight(0x2a2620, 0x0c0a08, 0.35));
  // the doorway we come through (for the portal from the false room)
  R.anchor = new THREE.Object3D(); R.anchor.position.set(1.3, 0, 0.0); R.anchor.rotation.y = Math.PI; scene.add(R.anchor);
  // the open door leaf, inside the room
  const leaf = box(0.88, 2.04, 0.04, std(0xd8d0c0, 0.7), 0.85 + 0.03, 1.02, 0.45, scene); leaf.rotation.y = Math.PI / 2; leaf.position.set(0.87, 1.02, 0.45);
  return R;
}
