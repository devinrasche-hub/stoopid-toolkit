import * as THREE from 'three';
import { CRT } from './crt.js';
import { Entity, makeHand } from './entity.js';
import { makeReflector, makeCone, makeDust, Feed, Portal, FeedAtlas } from './fx.js';
import { mulberry32 } from './util.js';

export const SPOT = 320;
export const FIXTURE = 10;
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

// The cinematic camera itself, only visible to in-world surveillance feeds.
function makeRig() {
  const g = new THREE.Group();
  const m = std(0x121414, 0.45);
  const body = box(0.16, 0.16, 0.3, m, 0, 0, 0.04, g);
  const lens = cyl(0.05, 0.055, 0.18, m, 16); lens.rotation.x = Math.PI / 2; lens.position.set(0, 0, -0.18); g.add(lens);
  box(0.2, 0.16, 0.02, m, 0, 0, -0.29, g);
  box(0.06, 0.05, 0.12, m, 0.0, 0.11, 0.08, g);
  const head = cyl(0.04, 0.05, 0.1, m); head.position.y = -0.13; g.add(head);
  const legs = new THREE.Group(); legs.position.y = -0.18; g.add(legs);
  for (let i = 0; i < 3; i++) {
    const leg = cyl(0.012, 0.012, 1.4, m, 6);
    leg.geometry.translate(0, -0.7, 0);
    leg.rotation.z = 0.32;
    const p = new THREE.Group(); p.rotation.y = (i / 3) * Math.PI * 2 + 0.4; p.add(leg); legs.add(p);
  }
  g.traverse((o) => o.layers.set(1));
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATION: control room (z 0..6) looking through glass into the studio (z<0)
// ─────────────────────────────────────────────────────────────────────────────
export function buildStation(T, q) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x0a1010, 0.04);
  const S = { scene };

  const vinyl = std(0x151718, 0.5);
  const metal = std(0x2a2d2d, 0.4, { metalness: 0.6 });
  const wallMat = std(0x8a918d, 0.9, { map: repeat(T.concrete, 2, 1) });
  const panelMat = std(0x5a6264, 0.95, { map: T.fabric });
  const floorCR = std(0x8a908b, 0.55, { map: repeat(T.tile, 4, 3) });
  const floorST = std(0x9a9e9a, 0.45, { map: repeat(T.concrete, 5, 5) });
  const ceilMat = std(0x9a9c94, 0.95, { map: repeat(T.ceiling, 6, 4) });
  const black = std(0x050606, 0.9);

  // Control room shell
  const f = plane(8, 6, floorCR, scene); f.rotation.x = -Math.PI / 2; f.position.set(0, 0, 3);
  const c = plane(8, 6, ceilMat, scene); c.rotation.x = Math.PI / 2; c.position.set(0, 2.7, 3);
  // Left wall, cut for the backstage service door (z 1.75 … 2.65)
  const lwA = plane(1.75, 2.7, wallMat, scene); lwA.rotation.y = Math.PI / 2; lwA.position.set(-4, 1.35, 0.875);
  const lwB = plane(3.35, 2.7, wallMat, scene); lwB.rotation.y = Math.PI / 2; lwB.position.set(-4, 1.35, 4.325);
  const lwC = plane(0.9, 0.6, wallMat, scene); lwC.rotation.y = Math.PI / 2; lwC.position.set(-4, 2.4, 2.2);
  {
    const fm = std(0x1a1e1e, 0.6);
    box(0.12, 2.12, 0.06, fm, -3.98, 1.06, 1.72, scene);
    box(0.12, 2.12, 0.06, fm, -3.98, 1.06, 2.68, scene);
    box(0.12, 0.06, 1.02, fm, -3.98, 2.12, 2.2, scene);
    // the service door, hinged on its near edge, opening into the room
    S.serviceDoor = new THREE.Group();
    S.serviceDoor.position.set(-3.97, 0, 1.76);
    scene.add(S.serviceDoor);
    const leaf = box(0.045, 2.08, 0.88, std(0x4c5856, 0.55), 0, 1.04, 0.44, S.serviceDoor);
    leaf.castShadow = false;
    const bar = box(0.05, 0.04, 0.6, std(0x8a8d86, 0.35, { metalness: 0.7 }), 0.04, 1.02, 0.5, S.serviceDoor);
    bar.castShadow = false;
    // backstage passage seen through the gap
    const pas = new THREE.Group(); scene.add(pas);
    box(2.4, 0.04, 1.0, std(0x2e3532, 0.8), -5.2, 0, 2.2, pas);
    box(0.04, 2.3, 1.0, std(0x46514e, 0.9), -6.4, 1.15, 2.2, pas);
    box(2.4, 2.3, 0.04, std(0x3a4442, 0.9), -5.2, 1.15, 1.7, pas);
    box(2.4, 2.3, 0.04, std(0x3a4442, 0.9), -5.2, 1.15, 2.7, pas);
    S.passLight = new THREE.PointLight(0x7fb3a9, 1.4, 3.2, 2); S.passLight.position.set(-5.8, 2.0, 2.2); scene.add(S.passLight);
    // sign and HOLD lamp over the door, facing into the room (+x)
    S.exitSign = signBox(0.5, 0.17, (g, w, h, k) => {
      g.fillStyle = '#060707'; g.fillRect(0, 0, w, h);
      const amber = k === 'CONTINUE';
      g.fillStyle = amber ? '#ffb347' : '#ff4a22';
      g.font = `bold ${amber ? 92 : 120}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if ('letterSpacing' in g) g.letterSpacing = amber ? '10px' : '24px';
      g.fillText(k, w / 2, h / 2 + 6);
    });
    S.exitSign.rotation.y = Math.PI / 2; S.exitSign.position.set(-3.95, 2.36, 2.2);
    scene.add(S.exitSign);
    S.doorLamp = holdLamp({ light: 1.4, range: 3.5 });
    S.doorLamp.rotation.y = Math.PI / 2; S.doorLamp.position.set(-3.95, 2.58, 2.2);
    scene.add(S.doorLamp);
  }
  const rw = plane(6, 2.7, wallMat, scene); rw.rotation.y = -Math.PI / 2; rw.position.set(4, 1.35, 3);
  // Back wall with doorway at x = 2.6
  const bwMat = wallMat;
  const bwL = plane(6.15, 2.7, bwMat, scene); bwL.rotation.y = Math.PI; bwL.position.set(-0.925, 1.35, 6);
  const bwR = plane(0.925, 2.7, bwMat, scene); bwR.rotation.y = Math.PI; bwR.position.set(3.5375, 1.35, 6);
  const bwT = plane(0.95, 0.6, bwMat, scene); bwT.rotation.y = Math.PI; bwT.position.set(2.6, 2.4, 6);
  // Dark vestibule behind the doorway
  const vest = new THREE.Group(); scene.add(vest);
  box(0.95, 2.1, 0.04, std(0x7a8582, 0.9), 2.6, 1.05, 8.2, vest);
  const vf = plane(0.95, 2.2, std(0x2c3230, 0.7), vest); vf.rotation.x = -Math.PI / 2; vf.position.set(2.6, 0.001, 7.1);
  box(0.04, 2.1, 2.2, std(0x5f6966, 0.9), 2.1, 1.05, 7.1, vest);
  box(0.04, 2.1, 2.2, std(0x5f6966, 0.9), 3.1, 1.05, 7.1, vest);
  const vestLight = new THREE.PointLight(0x5fa7a0, 3.2, 4, 2); vestLight.position.set(2.6, 2.0, 7.4); scene.add(vestLight);
  // Door frame
  const frameMat = std(0x1a1e1e, 0.6);
  box(0.06, 2.12, 0.12, frameMat, 2.1, 1.06, 6, scene);
  box(0.06, 2.12, 0.12, frameMat, 3.1, 1.06, 6, scene);
  box(1.06, 0.06, 0.12, frameMat, 2.6, 2.12, 6, scene);

  // Partition: sill, header, glass
  box(8, 0.95, 0.16, wallMat, 0, 0.475, -0.08, scene);
  box(8, 0.35, 0.16, wallMat, 0, 2.525, -0.08, scene);
  box(0.4, 1.4, 0.16, wallMat, -3.8, 1.65, -0.08, scene);
  box(0.4, 1.4, 0.16, wallMat, 3.8, 1.65, -0.08, scene);
  box(7.2, 0.05, 0.12, frameMat, 0, 0.95, 0.0, scene);
  box(7.2, 0.05, 0.12, frameMat, 0, 2.35, 0.0, scene);
  S.glass = makeReflector(7.2, 1.4, { strength: 0.3, blur: 0.0015, axis: 1, fresnel: 0.6, res: q.reflect });
  S.glass.position.set(0, 1.65, 0.01);
  scene.add(S.glass);
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.4), new THREE.MeshBasicMaterial({ color: 0x9fb8b2, transparent: true, opacity: 0.025, depthWrite: false }));
  dirt.position.set(0, 1.65, 0.005); scene.add(dirt);

  // Console desk
  const deskMat = std(0x222626, 0.6, { map: T.metal });
  box(6.4, 0.06, 1.0, deskMat, 0, 0.78, 0.8, scene);
  box(6.4, 0.75, 0.05, black, 0, 0.375, 1.28, scene);
  const slope = box(2.2, 0.05, 0.62, deskMat, 0, 0.88, 0.6, scene);
  slope.rotation.x = 0.32;
  // Faders + knobs
  {
    const n = 22 * 3;
    const fader = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.022, 0.035), std(0x0d0f0f, 0.4), n);
    const knob = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.009, 0.01, 0.02, 10), std(0x0b0c0c, 0.35), n);
    const m4 = new THREE.Matrix4(), e = new THREE.Euler(0.32, 0, 0), qq = new THREE.Quaternion().setFromEuler(e);
    const rnd = mulberry32(3);
    let k = 0;
    for (let row = 0; row < 3; row++) for (let i = 0; i < 22; i++) {
      const x = -1.0 + i * 0.095;
      const zz = 0.42 + row * 0.18 + (row === 2 ? rnd() * 0.05 : 0);
      const y = 0.9 + (0.6 - zz) * Math.tan(0.32) + 0.015;
      m4.compose(new THREE.Vector3(x, y, zz), qq, new THREE.Vector3(1, 1, 1)); fader.setMatrixAt(k, m4);
      m4.compose(new THREE.Vector3(x, y + 0.005, zz - 0.07), qq, new THREE.Vector3(1, 1, 1)); knob.setMatrixAt(k, m4);
      k++;
    }
    scene.add(fader, knob);
    // A few LED meters, most dead
    const ledGeo = new THREE.BoxGeometry(0.008, 0.004, 0.008);
    for (let i = 0; i < 18; i++) {
      const lit = rnd() < 0.35;
      const col = lit ? (rnd() < 0.8 ? new THREE.Color(0.05, 0.9, 0.5) : new THREE.Color(2.0, 0.5, 0.05)) : new THREE.Color(0.02, 0.03, 0.03);
      const led = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: col }));
      led.position.set(-1.0 + i * 0.115, 0.99, 0.32);
      scene.add(led);
    }
  }
  // Ordinary equipment: a row of HOLD keys on the desk
  S.deskLamps = [];
  for (let i = 0; i < 5; i++) {
    const l = holdLamp({ w: 0.07, h: 0.026 });
    l.rotation.x = -Math.PI / 2 + 0.32;
    l.position.set(-1.02 + i * 0.1, 0.91, 1.0);
    scene.add(l); S.deskLamps.push(l);
  }
  // Clutter on the desk: paper, cup, talkback gooseneck (foreground obstruction in 1A)
  const paper = std(0xb8b8a8, 0.9);
  [[-0.5, 1.1, 0.2], [1.3, 1.05, -0.4], [-2.4, 1.0, 0.9]].forEach(([x, z, r]) => {
    const p = plane(0.21, 0.297, paper, scene); p.rotation.set(-Math.PI / 2, 0, r); p.position.set(x, 0.812, z);
  });
  const cup = cyl(0.04, 0.035, 0.1, std(0x8a8a80, 0.6)); cup.position.set(-0.95, 0.86, 1.1); scene.add(cup);
  {
    const pts = [new THREE.Vector3(-0.9, 0.81, 1.15), new THREE.Vector3(-0.9, 1.0, 1.15), new THREE.Vector3(-0.95, 1.16, 1.25), new THREE.Vector3(-1.06, 1.2, 1.32)];
    const goose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.008, 8), std(0x0c0d0d, 0.4));
    const head = cyl(0.016, 0.012, 0.07, std(0x0c0d0d, 0.4)); head.position.set(-1.09, 1.2, 1.35); head.rotation.z = 1.2;
    // Lens-side clutter only: layer 2 is seen by the cinematic camera, not by in-world feeds.
    [goose, head].forEach((m) => { m.layers.set(2); scene.add(m); });
  }

  // Main CRT
  S.crt = new CRT({ width: 0.46, height: 0.345, depth: 0.44, canvasW: 640, canvasH: 480, lines: 262, lightIntensity: 2.8, seed: 1, lightOffset: 0.8 });
  S.crt.group.position.set(-1.6, 0.81 + 0.345 / 2 + 0.095, 0.74);
  S.crt.group.rotation.y = 0.16;
  scene.add(S.crt.group);
  S.crtScreenWorld = new THREE.Vector3();

  // Monitor stack on the right
  S.monitors = [];
  const mons = [[1.85, 0.0, 0.68, -0.22], [2.42, 0.0, 0.7, -0.3], [2.13, 0.27, 0.72, -0.26]];
  mons.forEach(([x, dy, z, ry], i) => {
    const m = new CRT({ width: 0.27, height: 0.2, depth: 0.28, canvasW: 400, canvasH: 300, lines: 200, lightIntensity: 1.5, seed: 2 + i, lightColor: 0x8fd0c8, lightOffset: 0.9, bezel: 0x101212 });
    m.group.position.set(x, 0.81 + 0.2 / 2 + 0.095 + dy, z);
    m.group.rotation.y = ry;
    scene.add(m.group);
    S.monitors.push(m);
  });

  // Operator chair, pushed back and askew
  S.opChair = makeChair(vinyl, metal);
  S.opChair.position.set(0.15, 0, 2.15);
  S.opChair.rotation.y = Math.PI + 0.35;
  scene.add(S.opChair);

  // Equipment rack on the left wall
  const rack = new THREE.Group(); rack.position.set(-3.65, 0, 4.7); scene.add(rack);
  box(0.6, 1.9, 0.62, std(0x101212, 0.5), 0, 0.95, 0, rack);
  for (let i = 0; i < 9; i++) {
    box(0.02, 0.12, 0.52, std(0x1c1f1f, 0.5), 0.31, 0.3 + i * 0.17, 0, rack);
  }
  S.rackLeds = [];
  for (let i = 0; i < 6; i++) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    led.position.set(0.33, 0.36 + i * 0.27, -0.2 + (i % 2) * 0.1);
    rack.add(led); S.rackLeds.push(led);
  }

  // Cables: seeded curves across the floor and up into the desk
  {
    const rnd = mulberry32(19);
    const cmat = std(0x070808, 0.35);
    for (let i = 0; i < 9; i++) {
      const x0 = -2.6 + rnd() * 5.2;
      const pts = [new THREE.Vector3(x0, 0.78, 1.2), new THREE.Vector3(x0 + (rnd() - 0.5) * 0.3, 0.3, 1.35)];
      let x = x0, z = 1.5;
      for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 1.4; z += 0.3 + rnd() * 0.8; pts.push(new THREE.Vector3(x, 0.012, z)); }
      if (i % 3 === 0) pts.push(new THREE.Vector3(-3.3, 0.012, 3.2), new THREE.Vector3(-3.35, 0.4, 3.0));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.006 + rnd() * 0.006, 6), cmat);
      tube.receiveShadow = true;
      scene.add(tube);
    }
  }

  // Practical: a fluorescent strip over the back wall, and the exit lamp
  S.strip = box(0.9, 0.04, 0.06, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.4, 2.1) }), 0.7, 2.45, 5.95, scene);
  S.stripLight = new THREE.PointLight(0xd6e3cf, 6, 5.5, 2);
  S.stripLight.position.set(0.7, 2.3, 5.75);
  scene.add(S.stripLight);
  S.exit = box(0.26, 0.11, 0.05, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.7, 0.15) }), 2.6, 2.32, 5.96, scene);
  S.exitLight = new THREE.PointLight(0xff6a20, 0.9, 3, 2);
  S.exitLight.position.set(2.6, 2.2, 5.7);
  scene.add(S.exitLight);
  // A lamp on a filing cabinet against the back wall: it washes the wall
  // behind the camera so the glass has something to reflect.
  const cab = box(0.5, 1.0, 0.45, std(0x4a504d, 0.6, { metalness: 0.3 }), -0.35, 0.5, 5.7, scene);
  cab.castShadow = false;
  const shade = cyl(0.05, 0.11, 0.14, std(0x22302d, 0.6), 16); shade.position.set(-0.3, 1.22, 5.72); scene.add(shade);
  S.lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.9, 2.4) }));
  S.lampBulb.position.set(-0.3, 1.15, 5.72); scene.add(S.lampBulb);
  S.lamp = new THREE.PointLight(0xe4e0c4, 4.2, 4.5, 2);
  S.lamp.position.set(-0.3, 1.1, 5.66);
  scene.add(S.lamp);
  S.ambient = new THREE.HemisphereLight(0x1d2a2b, 0x050505, 1.0);
  scene.add(S.ambient);

  // The shadow that crosses the back wall (seen in the glass in 2B)
  S.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.3), new THREE.MeshBasicMaterial({
    color: 0x000000, alphaMap: T.silhouette, transparent: true, opacity: 0, depthWrite: false,
  }));
  S.shadow.rotation.y = Math.PI;
  S.shadow.position.set(2, 1.5, 5.97);
  scene.add(S.shadow);

  // ── Studio ──
  const sf = plane(12, 11, floorST, scene); sf.rotation.x = -Math.PI / 2; sf.position.set(0, 0, -5.5);
  S.studioFloorRefl = makeReflector(12, 11, { strength: 0.3, blur: 0.006, puddle: 0.35, res: q.reflect });
  S.studioFloorRefl.rotation.x = -Math.PI / 2; S.studioFloorRefl.position.set(0, 0.002, -5.5);
  scene.add(S.studioFloorRefl);
  const sc = plane(12, 11, black, scene); sc.rotation.x = Math.PI / 2; sc.position.set(0, 5, -5.5);
  const sbw = plane(12, 5, wallMat, scene); sbw.position.set(0, 2.5, -11);
  const slw = plane(11, 5, wallMat, scene); slw.rotation.y = Math.PI / 2; slw.position.set(-6, 2.5, -5.5);
  const srw = plane(11, 5, wallMat, scene); srw.rotation.y = -Math.PI / 2; srw.position.set(6, 2.5, -5.5);
  const sfw = plane(12, 5, wallMat, scene); sfw.rotation.y = Math.PI; sfw.position.set(0, 2.5, -0.17);
  // the studio side of the window must stay open
  sfw.visible = false;
  box(12, 0.95, 0.02, wallMat, 0, 0.475, -0.17, scene);
  box(12, 2.65, 0.02, wallMat, 0, 3.675, -0.17, scene);
  box(2.2, 1.4, 0.02, wallMat, -4.9, 1.65, -0.17, scene);
  box(2.2, 1.4, 0.02, wallMat, 4.9, 1.65, -0.17, scene);
  // acoustic panels
  for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) {
    box(1.4, 1.5, 0.08, panelMat, -5.1 + i * 1.7, 1.3 + j * 1.7, -10.95, scene);
  }
  for (let i = 0; i < 5; i++) {
    const p = box(0.08, 1.5, 1.4, panelMat, -5.95, 2.1, -2.2 - i * 1.75, scene);
    const p2 = p.clone(); p2.position.x = 5.95; scene.add(p2);
  }
  // lighting grid
  for (let i = 0; i < 5; i++) {
    const pipe = cyl(0.025, 0.025, 12, metal, 8); pipe.rotation.z = Math.PI / 2; pipe.position.set(0, 4.6, -1.5 - i * 2.1); scene.add(pipe);
  }
  for (let i = 0; i < 3; i++) {
    const pipe = cyl(0.025, 0.025, 10, metal, 8); pipe.rotation.x = Math.PI / 2; pipe.position.set(-3 + i * 3, 4.62, -5.5); scene.add(pipe);
  }
  // Studio chair under the microphone
  S.chairHome = new THREE.Vector3(0, 0, -5.2);
  S.chair = makeChair(vinyl, metal);
  S.chair.position.copy(S.chairHome);
  scene.add(S.chair);

  // Hanging microphone
  S.micPivot = new THREE.Group();
  S.micPivot.position.set(0, 4.6, -5.2);
  scene.add(S.micPivot);
  const cable = cyl(0.004, 0.004, 2.3, std(0x080909, 0.4), 5); cable.position.y = -1.15; S.micPivot.add(cable);
  const micG = new THREE.Group(); micG.position.y = -2.32; micG.rotation.x = 0.5; S.micPivot.add(micG);
  const micBody = cyl(0.028, 0.022, 0.19, std(0x1b1d1d, 0.35, { metalness: 0.7 }), 16); micBody.position.y = -0.06; micG.add(micBody);
  const grille = new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 12), std(0x3a3d3d, 0.3, { metalness: 0.8 }));
  grille.position.y = -0.17; grille.castShadow = true; micG.add(grille);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.004, 6, 24), std(0x101111, 0.4)); ring.rotation.x = Math.PI / 2; ring.position.y = -0.05; micG.add(ring);
  S.mic = micG;

  // Key light over the chair
  S.spot = new THREE.SpotLight(0xe7ecd8, SPOT, 10, 0.42, 0.65, 2);
  S.spot.position.set(0.25, 4.5, -4.75);
  S.spot.target.position.set(0, 0, -5.2);
  S.spot.castShadow = true;
  S.spot.shadow.mapSize.set(q.shadow, q.shadow);
  S.spot.shadow.bias = -0.0004;
  S.spot.shadow.radius = 4;
  scene.add(S.spot, S.spot.target);
  S.spotCone = makeCone(1.65, 4.6, 0xdfe6cf, 0.028);
  S.spotCone.position.copy(S.spot.position);
  S.spotCone.lookAt(new THREE.Vector3(0, 0, -5.2).add(new THREE.Vector3(0, 0, 0)));
  S.spotCone.rotateX(-Math.PI / 2);
  scene.add(S.spotCone);
  const fixture = cyl(0.12, 0.16, 0.28, std(0x0d0e0e, 0.5), 16); fixture.position.copy(S.spot.position).add(new THREE.Vector3(0, 0.1, 0)); scene.add(fixture);

  // Restrained ultraviolet: a low wash on the studio back wall
  S.uv = new THREE.PointLight(0x6b4cff, 2.5, 7, 2);
  S.uv.position.set(-3.2, 1.6, -10.3);
  scene.add(S.uv);
  S.uv2 = new THREE.PointLight(0x5a8f88, 5, 7, 2);
  S.uv2.position.set(4.5, 2.4, -8.5);
  scene.add(S.uv2);
  // A faint wash on the studio back wall so a dark figure has something to stand against
  S.cyc = new THREE.SpotLight(0x5c8f88, 30, 12, 0.6, 1.0, 2);
  S.cyc.position.set(0.3, 4.4, -6.5);
  S.cyc.target.position.set(0, 1.4, -11);
  scene.add(S.cyc, S.cyc.target);

  // Studio camera on a pedestal, with a tally lamp
  const ped = new THREE.Group(); ped.position.set(2.9, 0, -1.8); ped.rotation.y = 0.7; scene.add(ped);
  const pm = std(0x141616, 0.5);
  const col = cyl(0.06, 0.08, 1.1, pm); col.position.y = 0.6; ped.add(col);
  const base = cyl(0.42, 0.45, 0.12, pm, 3); base.position.y = 0.08; ped.add(base);
  const camBody = box(0.32, 0.3, 0.55, pm, 0, 1.32, 0.05, ped);
  const camLens = cyl(0.09, 0.1, 0.28, pm, 16); camLens.rotation.x = Math.PI / 2; camLens.position.set(0, 1.32, -0.34); ped.add(camLens);
  box(0.36, 0.22, 0.04, std(0x070808, 0.5), 0, 1.36, 0.32, ped);
  S.tallyLamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  S.tallyLamp.position.set(0, 1.5, -0.15); ped.add(S.tallyLamp);
  S.pedestal = ped;
  // Wall-mounted ON-AIR lamp above the window (studio side) – the "red tally"
  S.onAir = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.06), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  S.onAir.position.set(-2.4, 2.75, -0.22); scene.add(S.onAir);
  S.tally = new THREE.PointLight(0xff2a14, 0, 5, 2);
  S.tally.position.set(2.75, 1.65, -2.05);
  scene.add(S.tally);
  S.tally2 = new THREE.PointLight(0xff2a14, 0, 4, 2);
  S.tally2.position.set(-2.4, 2.55, -0.6);
  scene.add(S.tally2);

  // Dust: in the studio key light, and in the control room monitor glow
  S.dust = makeDust(q.dust, [-2.2, 0.2, -7.5], [2.2, 4.4, -2.8], 7);
  scene.add(S.dust);
  S.dustCR = makeDust(Math.round(q.dust * 0.5), [-2.6, 0.7, 0.3], [0.2, 1.9, 2.6], 9);
  scene.add(S.dustCR);

  // Entities: one in the world, one that only exists in camera feeds
  S.entity = new Entity({ layer: 0, strays: false });
  scene.add(S.entity.group);
  S.ghost = new Entity({ layer: 1 });
  scene.add(S.ghost.group);
  // The echo only exists in the glass: the reflection keeps the old layout.
  S.echo = new Entity({ layer: 0, strays: false });
  S.echo.group.visible = false;
  scene.add(S.echo.group);
  S.glass.userData.pre = () => { S._entVis = S.entity.group.visible; S.entity.group.visible = false; S.echo.group.visible = S.echoOn; };
  S.glass.userData.post = () => { S.entity.group.visible = S._entVis; S.echo.group.visible = false; };
  S.hand = makeHand(T.hand);
  S.hand.position.set(0.07, 0.345 / 2 + 0.045 + 0.003, 0.03 - 0.16);
  S.hand.rotation.y = -0.32;
  S.crt.group.add(S.hand);
  S.rig = makeRig();
  scene.add(S.rig);

  // Feeds
  S.feedC1 = new Feed(q.feed, Math.round(q.feed * 0.75), 64); // CRT's own view of the room
  S.feedC1.camera.position.set(-1.5, 1.2, 0.9);
  S.feedC1.camera.lookAt(2.2, 1.0, 6);
  S.feedC2 = new Feed(Math.round(q.feed * 0.8), Math.round(q.feed * 0.6), 58); // studio wide
  S.feedC2.camera.position.set(5.5, 3.3, -8.8);
  S.feedC2.camera.lookAt(1.9, 0.75, -2.3);

  scene.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshBasicMaterial) o.castShadow = false; });
  return S;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTINUITY: the backstage corridor, running along −z to the elevator.
// It exists in two versions behind the camera: short (a door back to the
// control room) and long (it keeps going). They swap while we look away.
// ─────────────────────────────────────────────────────────────────────────────
function landscape(lit) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 360;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 230);
  sky.addColorStop(0, '#2b3b4a'); sky.addColorStop(0.7, '#8a7f6a'); sky.addColorStop(1, '#b49a72');
  g.fillStyle = sky; g.fillRect(0, 0, 512, 240);
  g.fillStyle = '#3d4a3a';
  g.beginPath(); g.moveTo(0, 230); g.quadraticCurveTo(140, 170, 280, 215); g.quadraticCurveTo(400, 180, 512, 210); g.lineTo(512, 360); g.lineTo(0, 360); g.fill();
  g.fillStyle = '#2c372b'; g.fillRect(0, 262, 512, 98);
  // the small house
  g.fillStyle = '#5a4c3e'; g.fillRect(300, 196, 70, 44);
  g.fillStyle = '#3a2f28'; g.beginPath(); g.moveTo(292, 198); g.lineTo(335, 168); g.lineTo(378, 198); g.fill();
  g.fillStyle = lit ? '#ffd27a' : '#141414'; g.fillRect(338, 210, 14, 12);
  if (lit) { const gl = g.createRadialGradient(345, 216, 2, 345, 216, 30); gl.addColorStop(0, 'rgba(255,210,120,0.45)'); gl.addColorStop(1, 'rgba(255,210,120,0)'); g.fillStyle = gl; g.fillRect(310, 186, 70, 60); }
  // cheap print texture
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.fillRect(Math.random() * 512, Math.random() * 360, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildContinuity(T, q) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010202);
  scene.fog = new THREE.FogExp2(0x040706, 0.05);
  const C = { scene };
  const W = 1.8, H = 2.5, ZE = -12;          // elevator wall at z = −12
  const floorMat = std(0x8f9690, 0.5, { map: repeat(T.tile, W / 1.2, 60 / 1.2) });
  const wallMat = std(0xb0b2a3, 0.85, { map: repeat(T.block, 20, 1.4) });
  const lowMat = std(0x46706a, 0.7, { map: repeat(T.concrete, 20, 0.5) });
  const ceilMat = std(0xc8c9bf, 0.95, { map: repeat(T.ceiling, W / 1.2, 60 / 1.2) });
  const panelMat = std(0x9aa3a0, 0.95, { map: T.fabric });
  const conduitMat = std(0x7d837d, 0.45, { metalness: 0.5 });

  // A section of corridor from z0 down to z1 (z0 > z1)
  function section(z0, z1, parent, { fixtures = true, doors = false } = {}) {
    const L = z0 - z1, zc = (z0 + z1) / 2;
    const f = plane(W, L, floorMat, parent); f.rotation.x = -Math.PI / 2; f.position.set(0, 0, zc);
    const c = plane(W, L, ceilMat, parent); c.rotation.x = Math.PI / 2; c.position.set(0, H, zc);
    [-1, 1].forEach((sd) => {
      const u = plane(L, H - 0.9, wallMat, parent); u.rotation.y = -sd * Math.PI / 2; u.position.set(sd * W / 2, 0.9 + (H - 0.9) / 2, zc);
      const l = plane(L, 0.9, lowMat, parent); l.rotation.y = -sd * Math.PI / 2; l.position.set(sd * W / 2, 0.45, zc);
      box(0.02, 0.1, L, std(0x0b0d0d, 0.6), sd * (W / 2 - 0.01), 0.05, zc, parent);
      // cable conduits along the upper corner
      [0, 1, 2].forEach((k) => {
        const cy = cyl(0.018 + k * 0.006, 0.018 + k * 0.006, L, conduitMat, 8);
        cy.rotation.x = Math.PI / 2; cy.position.set(sd * (W / 2 - 0.05 - k * 0.055), H - 0.07 - (k % 2) * 0.04, zc);
        cy.castShadow = false; parent.add(cy);
      });
    });
    // acoustic panels
    const n = Math.floor(L / 0.75);
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 1.05, 0.62), panelMat, n * 2);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) [-1, 1].forEach((sd, j) => {
      m4.makeTranslation(sd * (W / 2 - 0.025), 1.5, z0 - 0.4 - i * 0.75);
      pm.setMatrixAt(i * 2 + j, m4);
    });
    pm.receiveShadow = true; parent.add(pm);
    const out = { fixtures: [] };
    if (fixtures) for (let z = z0 - 2; z > z1 + 0.5; z -= 4) {
      const g = new THREE.Group(); g.position.set(0, H - 0.03, z); parent.add(g);
      box(0.5, 0.05, 1.0, std(0x8b8d84, 0.6), 0, 0, 0, g).castShadow = false;
      const pmat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
      const p = plane(0.46, 0.96, pmat, g); p.rotation.x = Math.PI / 2; p.position.y = -0.027;
      out.fixtures.push({ z, panelMat: pmat });
    }
    if (doors) for (let z = z0 - 3; z > z1 + 1; z -= 4) {
      const sd = Math.round(z) % 2 === 0 ? -1 : 1;
      box(0.04, 2.05, 0.9, std(0x46514e, 0.6), sd * (W / 2 - 0.02), 1.025, z, parent);
      const lamp = holdLamp(); lamp.rotation.y = -sd * Math.PI / 2; lamp.position.set(sd * (W / 2 - 0.03), 2.22, z); parent.add(lamp);
      lamp.set(1);
    }
    return out;
  }

  // Main stretch: from the service door (z = +1) to the elevator wall
  const main = section(1, ZE, scene);
  C.fixtures = [];
  [-1.5, -5.5, -9.5].forEach((z, k) => {
    const light = new THREE.PointLight(0xdbe6d2, 0, 5.5, 2); light.position.set(0, H - 0.3, z); scene.add(light);
    const cone = makeCone(1.0, 2.4, 0xd4dfcc, 0); cone.position.set(0, H - 0.06, z); scene.add(cone);
    const fx = main.fixtures.find((f) => Math.abs(f.z - z) < 0.6) || main.fixtures[k];
    C.fixtures.push({ z, light, cone, panelMat: fx ? fx.panelMat : null, k });
  });
  C.ambient = new THREE.HemisphereLight(0x1a2526, 0x040404, 0.3); scene.add(C.ambient);

  // Behind the camera: short version …
  C.short = new THREE.Group(); scene.add(C.short);
  {
    box(W, H, 0.06, wallMat, 0, H / 2, 1.0, C.short);
    box(0.9, 2.08, 0.05, std(0x4c5856, 0.55), 0, 1.04, 0.96, C.short);
    const l = holdLamp(); l.rotation.y = Math.PI; l.position.set(0, 2.25, 0.95); C.short.add(l); l.set(1);
  }
  // … and long version, which keeps going and has HOLD lamps over every door
  C.long = new THREE.Group(); C.long.visible = false; scene.add(C.long);
  const longS = section(42, 1, C.long, { doors: true });
  C.longPanels = longS.fixtures;
  C.longPanels.forEach((f) => f.panelMat.color.setRGB(0.9, 1.0, 0.9).multiplyScalar(0.6 * Math.exp(-(f.z - 1) / 14)));
  {
    const far = plane(W, H, std(0x020303, 1), C.long); far.rotation.y = Math.PI; far.position.set(0, H / 2, 42);
    // a lamp in an impossible place: in the middle of the ceiling, far away
    for (let k = 0; k < 4; k++) {
      const l = holdLamp({ w: 0.3, h: 0.11 }); l.rotation.x = Math.PI / 2; l.position.set(0, H - 0.02, 6 + k * 7); C.long.add(l); l.set(1);
    }
    // … and set into the acoustic panels at eye height, where no lamp belongs
    for (let k = 0; k < 9; k++) [-1, 1].forEach((sd) => {
      const l = holdLamp({ w: 0.42, h: 0.15 });
      l.rotation.y = -sd * Math.PI / 2;
      l.position.set(sd * (W / 2 - 0.055), 1.5, 2.5 + k * 3.4 + (sd > 0 ? 1.7 : 0));
      C.long.add(l); l.set(1);
    });
  }

  // The telephone (right wall)
  {
    const ph = new THREE.Group(); ph.position.set(W / 2 - 0.005, 1.38, -4.2); ph.rotation.y = -Math.PI / 2; scene.add(ph);
    const beige = std(0xa9a491, 0.5);
    box(0.28, 0.32, 0.07, beige, 0.03, 0, 0.035, ph);
    box(0.17, 0.06, 0.02, std(0x1a1c1b, 0.5), 0, -0.1, 0.075, ph);   // keypad strip
    C.phoneDisplay = signBox(0.17, 0.07, (g, w, h, k) => {
      g.fillStyle = '#0e1a14'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#b8f0c8'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const lines = k ? k.split('|') : [];
      g.font = `600 ${lines.length > 1 ? 30 : 40}px "DejaVu Sans Mono", "Courier New", monospace`;
      lines.forEach((ln, i) => g.fillText(ln, w / 2, h * (lines.length > 1 ? 0.32 + i * 0.4 : 0.52)));
    });
    C.phoneDisplay.position.set(0.045, 0.075, 0.072); ph.add(C.phoneDisplay);
    C.phoneLamp = holdLamp({ w: 0.05, h: 0.018 }); C.phoneLamp.position.set(0.055, -0.035, 0.074); ph.add(C.phoneLamp);
    // cradle + handset (pivot at the hook)
    box(0.05, 0.22, 0.04, beige, -0.065, 0.0, 0.09, ph);
    C.handset = new THREE.Group(); C.handset.position.set(-0.065, -0.11, 0.11); ph.add(C.handset);
    const hs = new THREE.Group(); hs.position.y = 0.11; C.handset.add(hs);
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.17, 6, 12), beige); grip.castShadow = true; hs.add(grip);
    [0.11, -0.11].forEach((y) => { const cup = cyl(0.033, 0.03, 0.045, beige, 18); cup.rotation.x = Math.PI / 2; cup.position.set(0, y, 0.012); hs.add(cup); });
    const pts = [];
    for (let i = 0; i <= 120; i++) { const a = i / 120; pts.push(new THREE.Vector3(Math.cos(a * 60) * 0.012, -0.14 - a * 0.32, 0.05 + Math.sin(a * 60) * 0.012)); }
    const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.0035, 5), std(0x9a957f, 0.5));
    cord.position.x = -0.065; ph.add(cord);
    C.phone = ph;
  }

  // The framed landscape (left wall): a small house with one lit window
  {
    C.paintLit = landscape(true); C.paintDark = landscape(false);
    const fr = new THREE.Group(); fr.position.set(-W / 2 + 0.01, 1.55, -6.2); fr.rotation.y = Math.PI / 2; scene.add(fr);
    box(0.66, 0.5, 0.025, std(0x6b5233, 0.5), 0, 0, 0.012, fr);
    C.paintMat = new THREE.MeshStandardMaterial({ map: C.paintLit, roughness: 0.7 });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.41), C.paintMat); pic.position.z = 0.027; fr.add(pic);
    C.paintWindow = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.016), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.15, 0.5) }));
    C.paintWindow.position.set(0.58 * (345 / 512 - 0.5), 0.41 * (0.5 - 216 / 360), 0.028); fr.add(C.paintWindow);
    C.frame = fr;
  }

  // The modest sign
  {
    const sg = signBox(0.62, 0.13, (g, w, h) => {
      g.fillStyle = '#d8d8cc'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1d2221'; g.font = '600 64px "Helvetica Neue", Helvetica, Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; if ('letterSpacing' in g) g.letterSpacing = '14px';
      g.fillText('CONTINUITY', w / 2, h / 2 + 4);
    });
    sg.draw('c', 0.55); sg.position.set(0, 2.18, -7.6); scene.add(sg);
    const back = sg.clone(); back.rotation.y = Math.PI; back.position.z = -7.68; scene.add(back);
    box(0.012, 0.14, 0.012, std(0x222, 0.5), -0.2, 2.38, -7.64, scene);
    box(0.012, 0.14, 0.012, std(0x222, 0.5), 0.2, 2.38, -7.64, scene);
  }

  // The elevator
  {
    const steel = std(0x9ea3a0, 0.35, { metalness: 0.55, map: T.metal });
    box(W, H, 0.1, wallMat, 0, H / 2, ZE - 0.05, scene).visible = false;
    box((W - 1.1) / 2, H, 0.1, wallMat, -(W / 2 + 0.55) / 2 - 0.0, H / 2, ZE - 0.05, scene);
    box((W - 1.1) / 2, H, 0.1, wallMat, (W / 2 + 0.55) / 2, H / 2, ZE - 0.05, scene);
    box(1.1, H - 2.15, 0.1, wallMat, 0, 2.15 + (H - 2.15) / 2, ZE - 0.05, scene);
    box(0.06, 2.18, 0.12, steel, -0.58, 1.09, ZE, scene);
    box(0.06, 2.18, 0.12, steel, 0.58, 1.09, ZE, scene);
    box(1.22, 0.06, 0.12, steel, 0, 2.18, ZE, scene);
    C.doorL = box(0.55, 2.13, 0.03, steel, -0.275, 1.065, ZE + 0.02, scene);
    C.doorR = box(0.55, 2.13, 0.03, steel, 0.275, 1.065, ZE + 0.02, scene);
    C.liftLamp = holdLamp({ light: 1.2, range: 3 }); C.liftLamp.position.set(0, 2.32, ZE + 0.07); scene.add(C.liftLamp);
    C.callLamp = holdLamp({ w: 0.06, h: 0.022 }); C.callLamp.position.set(0.72, 1.2, ZE + 0.07); scene.add(C.callLamp);
    box(0.08, 0.18, 0.02, std(0x2a2c2c, 0.4), 0.72, 1.2, ZE + 0.045, scene);
    // the void behind the doors (dark until something is put there)
    box(1.14, 2.2, 0.04, std(0x010101, 1), 0, 1.1, ZE - 2.0, scene);
    // ordinary car interior, used from "THE WRONG AUDIENCE" on
    C.car = buildCar(T, ZE - 0.1);
    C.car.visible = false;
    scene.add(C.car);
    // a portal onto the control room, used for the impossible connection
    C.portal = new Portal(q.w >> 1, q.h >> 1, 1.1, 2.13);
    C.portal.mesh.position.set(0, 1.065, ZE - 0.04);
    C.portal.mesh.visible = false;
    scene.add(C.portal.mesh);
    C.portal.fromAnchor.position.set(0, 0, ZE - 0.04);
    scene.add(C.portal.fromAnchor);
  }

  C.dust = makeDust(Math.round(q.dust * 0.5), [-0.85, 0.3, -11.5], [0.85, 2.4, 0.8], 23);
  scene.add(C.dust);
  C.entity = new Entity({ layer: 0, strays: false });
  scene.add(C.entity.group);
  C.rig = makeRig(); scene.add(C.rig);
  // A camera high in the corridor; the control-room CRT shows this view.
  C.feed = new Feed(q.feed, Math.round(q.feed * 0.75), 62);
  C.feed.camera.position.set(0.6, 2.25, 0.7);
  C.feed.camera.lookAt(-0.1, 1.0, -9);
  return C;
}

// An ordinary elevator car. Local origin: centre of the threshold, interior
// extends toward −z for 1.6 m.
function buildCar(T, z0 = 0, { rearGlass = false } = {}) {
  const g = new THREE.Group(); g.position.z = z0;
  const steel = std(0xb3b8b4, 0.45, { metalness: 0.2, map: T.metal });
  const floor = plane(1.6, 1.6, std(0x1a1c1c, 0.8), g); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.002, -0.8);
  [-1, 1].forEach((sd) => { const w = plane(1.6, 2.3, steel, g); w.rotation.y = -sd * Math.PI / 2; w.position.set(sd * 0.8, 1.15, -0.8); });
  if (!rearGlass) { const r = plane(1.6, 2.3, steel, g); r.position.set(0, 1.15, -1.6); }
  const c = plane(1.6, 1.6, std(0x202322, 0.8), g); c.rotation.x = Math.PI / 2; c.position.set(0, 2.3, -0.8);
  g.ceilPanelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.95, 0.85) });
  const cp = plane(1.0, 0.9, g.ceilPanelMat, g); cp.rotation.x = Math.PI / 2; cp.position.set(0, 2.29, -0.8);
  g.light = new THREE.PointLight(0xdfe6da, 3.2, 4, 2); g.light.position.set(0, 2.05, -0.8); g.add(g.light);
  box(0.03, 0.04, 1.5, std(0x6d716e, 0.3, { metalness: 0.7 }), -0.77, 0.95, -0.8, g);
  box(0.03, 0.04, 1.5, std(0x6d716e, 0.3, { metalness: 0.7 }), 0.77, 0.95, -0.8, g);
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIFT + TRANSMISSION CHAMBER
// The car sits at the origin, doors facing +z. Behind its rear glass (−z) is a
// gallery of monitors. In front of the doors, the chamber: a walkway over a
// void, a switch, an audience of suspended CRTs, and one enormous frame.
// ─────────────────────────────────────────────────────────────────────────────
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

const galleryFrag = /* glsl */`
  uniform sampler2D uAtlas;
  uniform float uTime, uOn, uCols, uRows;
  varying vec2 vUv;
  varying float vOn, vOff, vSeed;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    float tile = floor(vSeed * uCols * uRows);
    vec2 tl = vec2(mod(tile, uCols), floor(tile / uCols));
    vec2 uv = (tl + vUv) / vec2(uCols, uRows);
    vec3 col = texture2D(uAtlas, uv).rgb * 4.5;
    col += h(floor(vUv * vec2(160.0, 120.0)) + floor(uTime * 24.0)) * 0.03;
    float sl = 0.62 + 0.38 * sin(vUv.y * 220.0);
    float on = smoothstep(vOn, vOn + 0.4, uOn);
    gl_FragColor = vec4(col * sl * on, 1.0);
  }
`;

export function buildLift(T, q) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x05060a, 0.016);
  const L = { scene };
  const dark = std(0x141617, 0.7, { metalness: 0.3 });

  // ── The car
  L.car = buildCar(T, 0, { rearGlass: true });
  scene.add(L.car);
  const steel = std(0xa9aeaa, 0.6, { metalness: 0.4, map: T.metal });
  // front wall with door opening
  box(0.25, 2.3, 0.06, steel, -0.675, 1.15, 0.0, scene);
  box(0.25, 2.3, 0.06, steel, 0.675, 1.15, 0.0, scene);
  box(1.6, 0.15, 0.06, steel, 0, 2.225, 0.0, scene);
  L.doorL = box(0.56, 2.15, 0.03, steel, -0.275, 1.075, 0.02, scene);
  L.doorR = box(0.56, 2.15, 0.03, steel, 0.275, 1.075, 0.02, scene);
  // floor indicator above the doors, inside
  L.indicator = signBox(0.24, 0.1, (g, w, h, k) => {
    g.fillStyle = '#120800'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffae3d'; g.font = `bold ${k === 'YOU' ? 150 : 180}px "DejaVu Sans Mono", "Courier New", monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k, w / 2, h / 2 + 10);
  });
  L.indicator.rotation.y = Math.PI; L.indicator.position.set(0, 2.24, -0.04); scene.add(L.indicator);
  L.panelLamp = holdLamp({ w: 0.06, h: 0.022 }); L.panelLamp.rotation.y = Math.PI; L.panelLamp.position.set(-0.68, 1.25, -0.04); scene.add(L.panelLamp);
  box(0.12, 0.42, 0.02, std(0x2a2c2c, 0.4), -0.68, 1.15, -0.02, scene);
  // the rear wall: dark glass that at first behaves like a mirror
  L.glass = makeReflector(1.6, 2.3, { strength: 0.85, blur: 0.0012, axis: 1, fresnel: 0.25, res: q.reflect });
  L.glass.position.set(0, 1.15, -1.59);
  scene.add(L.glass);
  L.glassBack = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.3), new THREE.MeshBasicMaterial({ color: 0x030404, transparent: true, opacity: 1, depthWrite: false }));
  L.glassBack.position.set(0, 1.15, -1.6);
  scene.add(L.glassBack);
  // the empty chair that sits where the camera is, in every monitor's view
  L.chair = makeChair(std(0x6b706e, 0.5), std(0x8a8d8a, 0.4, { metalness: 0.5 }));
  L.chair.traverse((o) => o.layers.set(1));
  scene.add(L.chair);

  // ── The gallery behind the glass: rows of monitors, each watching the car
  L.atlas = new FeedAtlas(3, 2, q.feed >> 1, Math.round((q.feed >> 1) * 0.75));
  const camPos = [[-0.6, 2.0, -1.35], [0.6, 2.0, -0.25], [0.0, 2.05, -0.2], [-0.6, 1.95, -0.25], [0.6, 1.95, -1.35], [0.0, 2.05, -1.4]];
  L.atlas.cameras.forEach((c, i) => { c.position.set(...camPos[i]); c.lookAt(0.1, 0.6, -0.72); c.fov = 52; c.updateProjectionMatrix(); });
  {
    const rows = 3, cols = 5, n = rows * cols + 1;
    const geo = new THREE.PlaneGeometry(0.42, 0.32);
    const aOn = new Float32Array(n), aOff = new Float32Array(n), aSeed = new Float32Array(n);
    const screens = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      uniforms: { uAtlas: { value: null }, uTime: { value: 0 }, uOn: { value: 0 }, uCols: { value: 3 }, uRows: { value: 2 } },
      vertexShader: audienceVert, fragmentShader: galleryFrag,
    }), n);
    const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.52, 0.42, 0.42), dark, n);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    let i = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * 0.78 + (r % 2) * 0.1, y = 0.45 + r * 0.66, z = -2.7 - r * 0.55 - Math.abs(c - 2) * 0.15;
      qq.setFromEuler(new THREE.Euler(-0.06 * r, -x * 0.08, 0));
      m4.compose(new THREE.Vector3(x, y, z + 0.215), qq, sc); screens.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x, y, z), qq, sc); bodies.setMatrixAt(i, m4);
      aOn[i] = (Math.abs(c - 2) + r) * 0.1; aOff[i] = 999; aSeed[i] = ((i * 7) % 6 + 0.5) / 6;
      i++;
    }
    // the bright screen in the middle, larger, closest
    m4.compose(new THREE.Vector3(0, 1.15, -2.1 + 0.215), new THREE.Quaternion(), new THREE.Vector3(1.4, 1.4, 1));
    screens.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(0, 1.15, -2.1), new THREE.Quaternion(), new THREE.Vector3(1.4, 1.4, 1));
    bodies.setMatrixAt(i, m4);
    aOn[i] = 0; aOff[i] = 999; aSeed[i] = 0.99;
    geo.setAttribute('aOn', new THREE.InstancedBufferAttribute(aOn, 1));
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(aOff, 1));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
    screens.frustumCulled = false; bodies.frustumCulled = false;
    scene.add(screens, bodies);
    L.gallery = screens;
    // the "dangerous" screen gets its own bright glare plane
    L.lure = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.5), new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAmt: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime, uAmt; varying vec2 vUv;
        void main(){ vec2 c = vUv - 0.5; float r = length(c * vec2(1.3, 1.0));
          float rings = 0.5 + 0.5 * sin(r * 60.0 - uTime * 3.0);
          vec3 col = mix(vec3(1.0, 0.62, 0.2), vec3(1.0, 0.95, 0.85), rings) * (1.6 - r * 2.0);
          gl_FragColor = vec4(col * uAmt * 2.2, 1.0); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    L.lure.position.set(0, 1.15, -2.1 + 0.222);
    scene.add(L.lure);
  }
  L.galleryLight = new THREE.PointLight(0x7fb6ac, 0, 6, 2); L.galleryLight.position.set(0, 1.4, -2.2); scene.add(L.galleryLight);
  L.lureLight = new THREE.PointLight(0xffa04a, 0, 4, 2); L.lureLight.position.set(0, 1.2, -1.75); scene.add(L.lureLight);
  // gallery walls (dark, just enough to bound the space)
  box(8, 5, 0.1, std(0x0b0d0d, 0.9), 0, 1.5, -6.2, scene);
  box(0.1, 5, 4.6, std(0x0b0d0d, 0.9), -3.6, 1.5, -3.9, scene);
  box(0.1, 5, 4.6, std(0x0b0d0d, 0.9), 3.6, 1.5, -3.9, scene);
  box(8, 0.1, 4.6, std(0x0b0d0d, 0.9), 0, -0.4, -3.9, scene);

  // ── The chamber
  // shaft column around the car, rising into the dark
  box(0.3, 70, 2.0, dark, -0.95, 4, -0.8, scene);
  box(0.3, 70, 2.0, dark, 0.95, 4, -0.8, scene);
  box(2.2, 66, 0.3, dark, 0, 35.3, 0.05, scene);
  box(2.2, 30, 0.3, dark, 0, -15.1, 0.05, scene);
  // walkway sections
  const SEG = 1.5;
  L.walkZ0 = 0.15; L.switchZ = 31.6; L.exitZ = 51.0;
  L.sections = [];
  const grate = std(0x2b2f2f, 0.55, { metalness: 0.5 });
  const segCount = Math.ceil((L.exitZ - L.walkZ0) / SEG);
  for (let k = 0; k < segCount; k++) {
    const z = L.walkZ0 + SEG * (k + 0.5);
    const onPlatform = z > L.switchZ - 1.8 && z < L.switchZ + 1.2;
    const w = onPlatform ? 3.0 : 0.95;
    const g = new THREE.Group(); g.position.z = z; scene.add(g);
    box(w, 0.06, SEG - 0.04, grate, 0, -0.03, 0, g);
    if (!onPlatform) [-1, 1].forEach((sd) => {
      box(0.025, 0.025, SEG, grate, sd * 0.47, 1.0, 0, g);
      box(0.025, 1.0, 0.025, grate, sd * 0.47, 0.5, -SEG / 2 + 0.02, g);
    });
    // under-rail light strips (the walkway "lights up")
    const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
    [-1, 1].forEach((sd) => { const st = box(0.02, 0.012, SEG - 0.1, stripMat, sd * (w / 2 - 0.03), 0.012, 0, g); st.castShadow = false; });
    // a small lamp on a post every other section, throwing a pool
    let cone = null;
    if (k % 2 === 0 && !onPlatform) {
      cone = makeCone(0.75, 2.3, 0xd8e2d0, 0); cone.position.set(0, 2.25, 0); g.add(cone);
      box(0.14, 0.05, 0.14, grate, 0, 2.28, 0, g);
      box(0.02, 1.3, 0.02, grate, 0.47, 1.65, 0, g);
    }
    L.sections.push({ k, z, g, stripMat, cone, platform: onPlatform });
  }
  // three moving lights that follow the lit sections nearest the camera
  L.walkLights = [0, 1, 2].map(() => { const p = new THREE.PointLight(0xd8e2d0, 0, 4.5, 2); scene.add(p); return p; });

  // the switch
  {
    const sw = new THREE.Group(); sw.position.set(0, 0, L.switchZ); scene.add(sw);
    box(0.08, 0.9, 0.08, dark, 0, 0.45, 0.12, sw);
    box(0.62, 0.66, 0.22, std(0x2a2e2d, 0.5, { metalness: 0.4 }), 0, 1.15, 0.12, sw);
    L.switchPlate = signBox(0.5, 0.09, (g, w, h) => {
      g.fillStyle = '#c9c6b4'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1b1f1e'; g.font = '700 42px "Helvetica Neue", Helvetica, Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; if ('letterSpacing' in g) g.letterSpacing = '3px';
      g.fillText('END TRANSMISSION', w / 2, h / 2 + 3);
    });
    L.switchPlate.rotation.y = Math.PI; L.switchPlate.position.set(0, 1.39, 0.0); sw.add(L.switchPlate);
    L.switchLamp = holdLamp({ w: 0.11, h: 0.04, light: 0.6, range: 1.6 }); L.switchLamp.rotation.y = Math.PI; L.switchLamp.position.set(0.19, 1.0, -0.005); sw.add(L.switchLamp);
    // the lever: pivot on the panel face, handle points up (ON) → down (OFF)
    L.lever = new THREE.Group(); L.lever.position.set(-0.08, 1.02, -0.01); sw.add(L.lever);
    const chrome = std(0xb9bdb9, 0.25, { metalness: 0.85 });
    const arm = box(0.035, 0.26, 0.035, chrome, 0, 0.13, -0.02, L.lever);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), std(0x1a1a1a, 0.4)); knob.position.set(0, 0.27, -0.02); L.lever.add(knob);
    L.leverTip = knob;
    const hub = cyl(0.045, 0.045, 0.03, chrome, 16); hub.rotation.x = Math.PI / 2; hub.position.set(-0.08, 1.02, -0.005); sw.add(hub);
    box(0.09, 0.02, 0.02, std(0x3a3d3c, 0.4), 0, 0.33, -0.015, sw);
    L.switchKey = new THREE.SpotLight(0xe7ecd8, 0, 7, 0.42, 0.7, 2);
    L.switchKey.position.set(0.6, 3.6, L.switchZ - 1.3); L.switchKey.target.position.set(0, 1.0, L.switchZ); scene.add(L.switchKey, L.switchKey.target);
    L.switchCone = makeCone(1.2, 3.6, 0xdfe6cf, 0); L.switchCone.position.copy(L.switchKey.position);
    L.switchCone.lookAt(L.switchKey.target.position); L.switchCone.rotateX(-Math.PI / 2); scene.add(L.switchCone);
    L.hand = makeHand(T.hand, { length: 0.24, sEdge: 0.24 });
    L.hand.uniforms.uBend.value = 0;
    L.hand.visible = false;
    sw.add(L.hand);
  }

  // the monumental frame and the back wall (the one silhouette)
  {
    const fz = 56, fy = 8.5;
    box(36, 3.5, 2, dark, 0, fy + 10.75, fz, scene);
    box(36, 3.5, 2, dark, 0, fy - 10.75, fz, scene);
    box(5, 25, 2, dark, -15.5, fy, fz, scene);
    box(5, 25, 2, dark, 15.5, fy, fz, scene);
    L.glow = new THREE.Mesh(new THREE.PlaneGeometry(56, 40), new THREE.ShaderMaterial({
      uniforms: { uAmt: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uAmt; varying vec2 vUv;
        void main(){ float v = smoothstep(0.0, 0.7, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
          float hz = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5));
          // a broad haze behind the frame, so the frame reads as one enormous silhouette
          vec2 c = (vUv - vec2(0.5, 0.45)) * vec2(1.0, 1.25);
          float haze = exp(-dot(c, c) * 7.0);
          vec3 col = mix(vec3(0.06, 0.04, 0.12), vec3(0.03, 0.07, 0.07), vUv.y) * haze;
          gl_FragColor = vec4(col * uAmt * 1.9, 1.0); }`,
    }));
    L.glow.position.set(0, fy, fz + 4); L.glow.rotation.y = Math.PI; scene.add(L.glow);
    // back wall with the real exit door
    box(26, 18, 0.3, std(0x060707, 0.95), 0, fy, L.exitZ + 0.6, scene).visible = false;
    const wall = new THREE.Group(); scene.add(wall);
    box(12, 8, 0.3, std(0x0c0e0e, 0.9), -6.55, 3.5, L.exitZ + 0.6, wall);
    box(12, 8, 0.3, std(0x0c0e0e, 0.9), 6.55, 3.5, L.exitZ + 0.6, wall);
    box(1.1, 5.9, 0.3, std(0x0c0e0e, 0.9), 0, 5.05, L.exitZ + 0.6, wall);
    L.dawnMat = new THREE.MeshBasicMaterial({ map: textCanvasTexture(256, 512, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#9fb6c8'); sky.addColorStop(0.55, '#f2dcc0'); sky.addColorStop(0.7, '#f7e2c6');
      sky.addColorStop(0.72, '#5b6650'); sky.addColorStop(1, '#3c4536');
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = '#3f4a3a';
      for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(i * 32 + 6, h * 0.71, 14 + (i % 3) * 8, Math.PI, 0); g.fill(); }
    }), color: new THREE.Color(0, 0, 0) });
    L.dawnMat.map.colorSpace = THREE.SRGBColorSpace;
    const dawn = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1), L.dawnMat);
    dawn.rotation.y = Math.PI; dawn.position.set(0, 1.05, L.exitZ + 0.8); scene.add(dawn);
    L.exitDoor = new THREE.Group(); L.exitDoor.position.set(-0.55, 0, L.exitZ + 0.45); scene.add(L.exitDoor);
    box(1.1, 2.1, 0.05, std(0x2f3533, 0.6), 0.55, 1.05, 0, L.exitDoor);
    L.dawn = new THREE.SpotLight(0xffe2bf, 0, 30, 0.5, 0.6, 1.4);
    L.dawn.position.set(0, 1.8, L.exitZ + 1.4); L.dawn.target.position.set(0, 0, L.exitZ - 16);
    L.dawn.castShadow = true; L.dawn.shadow.mapSize.set(q.shadow, q.shadow); L.dawn.shadow.bias = -0.0005;
    L.dawn.shadow.camera.near = 0.5; L.dawn.shadow.camera.far = 30;
    scene.add(L.dawn, L.dawn.target);
    L.bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) }));
    L.bulb.position.set(0.0, 2.5, 42.5); scene.add(L.bulb);
    box(0.006, 3, 0.006, dark, 0.0, 4.0, 42.5, scene);
    L.bulbLight = new THREE.PointLight(0xf2e2c4, 0, 7, 2); L.bulbLight.position.copy(L.bulb.position); scene.add(L.bulbLight);
  }

  // the audience: suspended CRTs on both sides and below the frame
  {
    const rnd = mulberry32(99);
    const P = [];
    for (const sd of [-1, 1]) for (let zi = 0; zi < 26; zi++) for (let k = 0; k < 9; k++) {
      const z = 3 + zi * 1.75 + rnd() * 0.6;
      const x = sd * (4.6 + k * 1.75 + rnd() * 0.5 + Math.max(0, zi - 15) * 0.25);
      const y = -7 + k * 1.95 + rnd() * 0.7 + Math.sin(zi * 0.3) * 0.4;
      P.push([x, y, z]);
    }
    for (let xi = 0; xi < 14; xi++) for (let k = 0; k < 4; k++) {
      const x = (xi - 6.5) * 1.75 + rnd() * 0.4;
      if (Math.abs(x) < 2.0) continue;
      P.push([x, -7 + k * 1.95 + rnd() * 0.6, 46 + rnd() * 2]);
    }
    const n = P.length;
    L.audienceCount = n;
    const sGeo = new THREE.PlaneGeometry(0.62, 0.47);
    const aOn = new Float32Array(n), aOff = new Float32Array(n), aSeed = new Float32Array(n);
    L.audienceText = textCanvasTexture(256, 192, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffb347'; g.font = 'bold 34px "DejaVu Sans Mono", "Courier New", monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ffb347'; g.shadowBlur = 8;
      g.fillText('PLEASE HOLD.', w / 2, h / 2);
    });
    L.audience = new THREE.InstancedMesh(sGeo, new THREE.ShaderMaterial({
      uniforms: { uText: { value: L.audienceText }, uTime: { value: 0 }, uIdle: { value: 1 }, uBright: { value: 1 } },
      vertexShader: audienceVert, fragmentShader: audienceFrag,
    }), n);
    const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.74, 0.6, 0.6), std(0x101213, 0.7), n);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    const cable = [];
    const sw = new THREE.Vector3(0, 1.2, L.switchZ);
    P.forEach(([x, y, z], i) => {
      // face a point above the walkway, a little toward the elevator
      const look = new THREE.Vector3(0, 1.5, Math.min(z, 44) - 4);
      const dir = look.clone().sub(new THREE.Vector3(x, y, z)).normalize();
      qq.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      v.set(x, y, z).add(dir.clone().multiplyScalar(0.305));
      m4.compose(v, qq, one); L.audience.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x, y, z), qq, one); bodies.setMatrixAt(i, m4);
      const d = new THREE.Vector3(x, y, z).distanceTo(sw);
      aOn[i] = d * 0.12 + rnd() * 0.25;              // the wave rolls outward from the switch, slowly
      aSeed[i] = rnd();
      aOff[i] = 0;                                   // set per group by the director
      if (i % 3 === 0) cable.push(x, y + 0.3, z, x, 40, z);
    });
    L.audienceDist = Float32Array.from(P.map(([x, y, z]) => new THREE.Vector3(x, y, z).distanceTo(sw)));
    sGeo.setAttribute('aOn', new THREE.InstancedBufferAttribute(aOn, 1));
    sGeo.setAttribute('aOff', new THREE.InstancedBufferAttribute(aOff, 1));
    sGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
    L.audience.frustumCulled = false; bodies.frustumCulled = false;
    scene.add(L.audience, bodies);
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cable, 3));
    scene.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x0b0d0e, transparent: true, opacity: 0.6 })));
    // the audience's light on the room, as two broad washes
    L.audienceWashL = new THREE.PointLight(0xffa850, 0, 40, 1.2); L.audienceWashL.position.set(-9, 3, 22); scene.add(L.audienceWashL);
    L.audienceWashR = new THREE.PointLight(0xffa850, 0, 40, 1.2); L.audienceWashR.position.set(9, 3, 22); scene.add(L.audienceWashR);
  }
  // a few distant shafts of light hitting nothing, for depth
  L.shafts = [];
  [[-11, 30, 14], [12, 26, 24], [-6, 34, 38], [7, 28, 44]].forEach(([x, hgt, z]) => {
    const c = makeCone(2.2, hgt, 0x9a8fd0, 0.0); c.position.set(x, hgt - 8, z); scene.add(c); L.shafts.push(c);
  });
  L.ambient = new THREE.HemisphereLight(0x1a2226, 0x020202, 0.25); scene.add(L.ambient);
  L.dust = makeDust(q.dust, [-1.6, 0.0, 1], [1.6, 3.2, 34], 41); scene.add(L.dust);

  L.entity = new Entity({ layer: 0, strays: false });
  scene.add(L.entity.group);
  // something that is no longer there, still casting its shadow
  L.absent = new Entity({ layer: 0, shadowOnly: true, strays: false });
  scene.add(L.absent.group);
  return L;
}
