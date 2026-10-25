import * as THREE from 'three';
import { CRT } from './crt.js';
import { makeCone, makeDust, Feed } from './fx.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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

export const audienceVert = /* glsl */`
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
export const audienceFrag = /* glsl */`
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

// ─────────────────────────────────────────────────────────────────────────────
// THE WATCHERS' ROOM. A round, dark chamber (radius 9) a long way from Earth.
// One CRT on a pedestal at the centre faces the audience (+z). A ring of screens
// on the wall. An open roof onto the stars. A mast behind the set for the reply.
// ─────────────────────────────────────────────────────────────────────────────
export function stooFrame(g, w, h, img, { lower = true } = {}) {
  g.fillStyle = '#d97a30'; g.fillRect(0, 0, w, h);
  const s = Math.min(w, h) * (lower ? 0.92 : 1.0);
  g.drawImage(img, (w - s) / 2, lower ? h * 0.0 : (h - s) / 2, s, s);
  if (lower) {
    g.fillStyle = 'rgba(0,0,0,0.78)'; g.fillRect(0, h * 0.82, w, h * 0.12);
    g.fillStyle = '#f4efe6'; g.font = `700 ${Math.round(h * 0.06)}px "Courier New", monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = `${Math.round(h * 0.012)}px`;
    g.fillText('THE STOOPID SHOW', w / 2, h * 0.88);
  }
}

function watcherGeometry() {
  // A tall, thin figure in a long coat; everything faces +z. Body and hair are
  // separate meshes so the hair can catch a different light. No face.
  const parts = [];
  const coat = new THREE.CylinderGeometry(0.19, 0.31, 1.62, 18, 1); coat.translate(0, 0.81, 0); parts.push(coat);
  const sh = new THREE.SphereGeometry(1, 18, 10); sh.scale(0.34, 0.15, 0.21); sh.translate(0, 1.6, 0); parts.push(sh);
  const neck = new THREE.CylinderGeometry(0.048, 0.06, 0.24, 10); neck.translate(0, 1.76, 0); parts.push(neck);
  const head = new THREE.SphereGeometry(0.128, 22, 16); head.scale(0.95, 1.2, 1.05); head.translate(0, 1.98, 0); parts.push(head);
  [-1, 1].forEach((sd) => {
    const arm = new THREE.CylinderGeometry(0.045, 0.034, 1.0, 10); arm.translate(0, -0.5, 0);
    arm.rotateZ(sd * 0.06); arm.translate(sd * 0.31, 1.6, 0.0); parts.push(arm);
  });
  const body = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  // The bowl cut: a dome a little wider than the head, cut dead straight at the brow.
  const top = 0.15, k = 1.6;
  const bowl = new THREE.SphereGeometry(top, 30, 14, 0, Math.PI * 2, 0, k);
  bowl.scale(1, 0.92, 1.06); bowl.translate(0, 2.02, 0);
  const edgeY = 2.02 + top * 0.92 * Math.cos(k);
  const rim = new THREE.CylinderGeometry(top * 0.9995, top * 0.9995, 0.03, 30, 1, true); rim.scale(1, 1, 1.06); rim.translate(0, edgeY - 0.012, 0);
  const hair = mergeGeometries([bowl.toNonIndexed(), rim.toNonIndexed()]);
  return { body, hair };
}

function hairTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const rnd = mulberry32(31);
    g.fillStyle = '#4a2f1c'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) {
      const x = rnd() * w, l = 30 + rnd() * 90, y = rnd() * h;
      g.strokeStyle = rnd() < 0.5 ? `rgba(120,80,45,${0.2 + rnd() * 0.25})` : `rgba(20,12,6,${0.25 + rnd() * 0.25})`;
      g.lineWidth = 1 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y + l); g.stroke();
    }
  }, [4, 1]);
}

export function buildAlien(T, q, stooImg) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x020405, 0.035);
  const A = { scene };
  const R = 9, H = 8;

  // floor, wall, a roof with an open oculus
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshStandardMaterial({ color: 0x0b0e0f, roughness: 0.32, metalness: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 64, 1, true), std(0x0d1213, 0.85, { side: THREE.BackSide }));
  wall.position.y = H / 2; scene.add(wall);
  const roof = new THREE.Mesh(new THREE.RingGeometry(3.4, R, 64), std(0x070909, 0.9, { side: THREE.DoubleSide }));
  roof.rotation.x = Math.PI / 2; roof.position.y = H; scene.add(roof);
  // ribs: structure without ornament
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rib = box(0.18, H, 0.28, std(0x0a0d0e, 0.7), Math.sin(a) * (R - 0.15), H / 2, Math.cos(a) * (R - 0.15), scene);
    rib.rotation.y = a;
  }
  // a teal floor line around the room, the only light they keep for themselves
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.32, 0.3), fog: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.35, 0.012, 6, 128), ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; scene.add(ring);
  A.ringMat = ringMat;
  A.hemi = new THREE.HemisphereLight(0x1c3a3a, 0x050707, 0.35); scene.add(A.hemi);
  // a low teal wash on the far floor and lower wall: bodies stand out against it, heads stay lost
  A.floorGlow = new THREE.PointLight(0x2f8a80, 26, 11, 1.3); A.floorGlow.position.set(0, 0.35, -5.2); scene.add(A.floorGlow);
  // a small key on top of the set, for the hand
  A.handKey = new THREE.SpotLight(0xbfe6e0, 0, 4, 0.5, 0.7, 1.5); A.handKey.position.set(0.7, 2.9, 1.0); scene.add(A.handKey, A.handKey.target);
  A.backWash = new THREE.PointLight(0x3a8a82, 16, 18, 1.4); A.backWash.position.set(0, 3.4, -6.0); scene.add(A.backWash);

  // the set at the centre: a pedestal and one CRT, facing the audience
  box(0.9, 0.95, 0.7, std(0x111516, 0.6), 0, 0.475, -0.05, scene);
  A.tv = new CRT({ width: 0.92, height: 0.69, depth: 0.62, canvasW: 1024, canvasH: 768, lines: 300, lightColor: 0x9bd6cf, lightIntensity: 0, light: false, seed: 4 });
  A.tv.group.position.set(0, 0.95 + 0.4, 0.0); scene.add(A.tv.group);
  A.tvTop = new THREE.Vector3(0, 0.95 + 0.4 + 0.69 / 2 + 0.045, -0.12);
  // its light on the room: teal static, then Stoo's orange
  A.tvLight = new THREE.PointLight(0xffffff, 0, 16, 1.4); A.tvLight.position.set(0, 1.4, 0.9); scene.add(A.tvLight);
  A.tvSpill = new THREE.SpotLight(0xffffff, 0, 18, 0.9, 0.8, 1.2); A.tvSpill.position.set(0, 1.5, 0.3); A.tvSpill.target.position.set(0, 1.6, 8); scene.add(A.tvSpill, A.tvSpill.target);

  // the mast behind the set, for the reply
  const mast = cyl(0.035, 0.06, 6.2, std(0x1a1f20, 0.5, { metalness: 0.4 }), 10); mast.position.set(0, 3.1, -1.3); scene.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 8, 0, Math.PI * 2, 0, 0.9), std(0x20262a, 0.45, { metalness: 0.5, side: THREE.DoubleSide }));
  dish.rotation.x = Math.PI; dish.position.set(0, 6.35, -1.3); scene.add(dish);
  A.mastTop = new THREE.Vector3(0, 6.3, -1.3);

  // the sky through the oculus: stars, Sol, and a pale blue point beside it
  {
    const rnd = mulberry32(404);
    const n = 2600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * r * 110, Math.abs(u) * 110 + 4, Math.sin(a) * r * 110], i * 3);
      const b = 0.25 + Math.pow(rnd(), 3) * 1.6, w = rnd();
      col.set([b * (0.85 + 0.15 * w), b * 0.92, b * (1.05 - 0.2 * w)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
    scene.add(stars);
    // Sol: a small, ordinary yellow star, slightly off the zenith
    A.solDir = new THREE.Vector3(0.18, 1, -0.32).normalize();
    const solPos = A.solDir.clone().multiplyScalar(100);
    const glowTex = (rgb) => canvasTex(64, 64, (c, w, h) => { const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.25, `rgba(${rgb},0.55)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, [1, 1], false);
    A.sol = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,226,150'), color: new THREE.Color(2.2, 1.9, 1.3), fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    A.sol.position.copy(solPos); A.sol.scale.setScalar(2.4); scene.add(A.sol);
    // the third planet: a pale blue point, a hair to the side
    const side = new THREE.Vector3().crossVectors(A.solDir, new THREE.Vector3(1, 0, 0)).normalize();
    A.earth = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('150,190,255'), color: new THREE.Color(1.2, 1.5, 2.2), fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    A.earth.position.copy(solPos).addScaledVector(side, 2.6); A.earth.scale.setScalar(0.9); scene.add(A.earth);
    // a thin bracket around the third planet, as their instruments draw it
    const label = canvasTex(512, 256, (c, w, h) => {
      c.strokeStyle = 'rgba(120,230,215,0.9)'; c.lineWidth = 3;
      const bx = 50, by = 53, bw = 150, bh = 150;
      [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]].forEach(([x, y, dx, dy]) => { c.beginPath(); c.moveTo(x + dx * 26, y); c.lineTo(x, y); c.lineTo(x, y + dy * 26); c.stroke(); });
      c.fillStyle = 'rgba(140,240,225,0.95)'; c.font = '600 34px "Courier New", monospace'; c.textBaseline = 'middle';
      c.fillText('SOL III', bx + bw + 24, by + 30);
    }, [1, 1], false);
    A.labelMat = new THREE.SpriteMaterial({ map: label, fog: false, depthWrite: false, transparent: true, opacity: 0 });
    A.label = new THREE.Sprite(A.labelMat);
    A.label.position.copy(A.earth.position); A.label.scale.set(12, 6, 1);
    A.label.center.set(125 / 512, 1 - 128 / 256); scene.add(A.label);
    // the reply: a thin line of orange light from the mast toward Sol
    const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.95, 0.3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    A.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6, 1, true), beamMat);
    A.beamMat = beamMat; scene.add(A.beam);
    A.beamDir = A.earth.position.clone().sub(A.mastTop).normalize();
    A.beamLen = A.earth.position.distanceTo(A.mastTop);
  }

  // the ring of screens on the wall: every one will show the same thing
  {
    const P = [];
    const rnd = mulberry32(77);
    for (let tier = 0; tier < 4; tier++) {
      const nT = 26 - tier * 2;
      for (let i = 0; i < nT; i++) {
        const a = ((i + (tier % 2) * 0.5) / nT) * Math.PI * 2;
        P.push([a, 1.7 + tier * 1.45 + (rnd() - 0.5) * 0.2, tier, rnd()]);
      }
    }
    const n = P.length;
    const geo = new THREE.PlaneGeometry(1.2, 0.9);
    const aOn = new Float32Array(n), aOff = new Float32Array(n).fill(999), aSeed = new Float32Array(n);
    A.screenTex = { stoo: canvasTex(256, 192, (g, w, h) => stooFrame(g, w, h, stooImg, { lower: false }), [1, 1], false) };
    A.screens = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      uniforms: { uText: { value: A.screenTex.stoo }, uTime: { value: 0 }, uIdle: { value: 0.35 }, uBright: { value: 1 } },
      vertexShader: audienceVert, fragmentShader: audienceFrag, fog: false }), n);
    const housings = new THREE.InstancedMesh(new THREE.BoxGeometry(1.36, 1.04, 0.7), std(0x0e1213, 0.7), n);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(), e = new THREE.Euler();
    A.screenAngles = [];
    P.forEach(([a, y, tier, r], i) => {
      const rr = R - 0.75;
      e.set(-0.06 * tier, a + Math.PI, 0, 'YXZ'); qq.setFromEuler(e);
      v.set(Math.sin(a) * rr, y, Math.cos(a) * rr); m4.compose(v, qq, one); housings.setMatrixAt(i, m4);
      v.set(Math.sin(a) * (rr - 0.36), y, Math.cos(a) * (rr - 0.36)); m4.compose(v, qq, one); A.screens.setMatrixAt(i, m4);
      // the cascade starts at the screens nearest the set and runs round both ways
      const ang = Math.abs(Math.atan2(Math.sin(a + Math.PI), Math.cos(a + Math.PI)));
      aOn[i] = ang / Math.PI * 3.2 + tier * 0.25 + r * 0.25;   // relative; the director adds the start time
      aSeed[i] = r;
    });
    A.cascadeRel = Float32Array.from(aOn);
    geo.setAttribute('aOn', new THREE.InstancedBufferAttribute(aOn, 1));
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(aOff, 1));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
    A.screens.frustumCulled = false; housings.frustumCulled = false;
    scene.add(A.screens, housings);
    // their light, gathered into a few lamps around the ring
    A.ringLights = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const l = new THREE.PointLight(0xffa060, 0, 11, 1.5); l.position.set(Math.sin(a) * 6.8, 3.4, Math.cos(a) * 6.8);
      scene.add(l); A.ringLights.push({ light: l, a });
    }
  }

  // the audience: rows in arcs facing the set
  {
    const { body, hair } = watcherGeometry();
    const P = [];
    const rnd = mulberry32(2026);
    for (let row = 0; row < 6; row++) {
      const rr = 2.7 + row * 1.0;
      const spread = 0.95 - row * 0.06;
      const n = Math.floor((rr * spread * 2) / 0.78);
      for (let i = 0; i <= n; i++) {
        const a = -spread + (2 * spread * i) / n + (rnd() - 0.5) * 0.03;
        const s = 0.95 + rnd() * 0.12;
        P.push({ x: Math.sin(a) * rr, z: Math.cos(a) * rr, s, row, seed: rnd() });
      }
    }
    A.watchers = P;
    const bodyMat = std(0x0b0d0e, 0.8);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xb08a6a, map: hairTexture(), roughness: 0.7, metalness: 0.0 });
    A.bodies = new THREE.InstancedMesh(body, bodyMat, P.length);
    A.hair = new THREE.InstancedMesh(hair, hairMat, P.length);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    A.setWatcher = (i, yawExtra = 0, headDrop = 0) => {
      const w = P[i];
      qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-w.x, -w.z) + yawExtra);
      v.set(w.x, -headDrop, w.z); sc.set(w.s, w.s, w.s);
      m4.compose(v, qq, sc);
      A.bodies.setMatrixAt(i, m4); A.hair.setMatrixAt(i, m4);
    };
    P.forEach((w, i) => A.setWatcher(i));
    A.bodies.castShadow = true; A.hair.castShadow = true;
    scene.add(A.bodies, A.hair);
    // the one we see in profile: front row, just left of centre
    let best = 0, bd = 1e9;
    P.forEach((w, i) => { if (w.row === 0) { const d = Math.abs(w.x + 0.55); if (d < bd) { bd = d; best = i; } } });
    A.hero = best;
  }

  // a long, thin hand that will rest on top of the set
  {
    const sh = new THREE.Shape();
    sh.moveTo(-0.035, -0.16);
    sh.lineTo(-0.04, 0.0);
    const tips = [[-0.034, 0.21], [-0.011, 0.25], [0.012, 0.24], [0.034, 0.2]];
    let px = -0.04;
    tips.forEach(([x, y], i) => {
      sh.bezierCurveTo(px, y - 0.05, x - 0.007, y, x, y);
      const nx = i < 3 ? (x + tips[i + 1][0]) / 2 : 0.042, ny = i < 3 ? Math.min(y, tips[i + 1][1]) - 0.17 : 0.02;
      sh.bezierCurveTo(x + 0.007, y, nx, ny + 0.06, nx, ny);
      px = nx;
    });
    sh.lineTo(0.036, -0.16); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 4, curveSegments: 10 });
    geo.rotateX(-Math.PI / 2); geo.rotateY(Math.PI);
    const p = geo.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) { const z = p[i + 2]; const f = Math.max(0, z - 0.1); p[i + 1] -= 3.6 * f * f; }
    geo.computeVertexNormals();
    A.hand = new THREE.Group();
    const m = new THREE.Mesh(geo, std(0x5a6464, 0.55)); m.castShadow = true; A.hand.add(m);
    A.hand.scale.setScalar(1.25);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.55, 10), std(0x0b0d0e, 0.8)); fore.rotation.x = Math.PI / 2 - 0.25; fore.position.set(0, 0.06, -0.42); A.hand.add(fore);
    A.hand.visible = false; scene.add(A.hand);
  }

  // drops of light: tears, catching the screens
  {
    const n = 220;
    A.tearPos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(A.tearPos, 3));
    A.tears = new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(2.4, 1.3, 0.6), size: 6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    A.tears.frustumCulled = false; scene.add(A.tears);
    A.tearN = n;
  }

  A.dust = makeDust(Math.round(q.dust * 0.5), [-7, 0.2, -7], [7, 7, 9], 91);
  scene.add(A.dust);
  return A;
}
