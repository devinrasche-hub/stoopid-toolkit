import * as THREE from 'three';
import { CRT } from './crt.js';
import { Entity } from './entity.js';
import { makeReflector, makeCone, makeDust, Feed } from './fx.js';
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
  const lw = plane(6, 2.7, wallMat, scene); lw.rotation.y = Math.PI / 2; lw.position.set(-4, 1.35, 3);
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
  const rack = new THREE.Group(); rack.position.set(-3.65, 0, 3.2); scene.add(rack);
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
  S.entity = new Entity({ layer: 0 });
  scene.add(S.entity.group);
  S.ghost = new Entity({ layer: 1 });
  scene.add(S.ghost.group);
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
// CORRIDOR: an impossibly repeating hallway along -z
// ─────────────────────────────────────────────────────────────────────────────
export function buildCorridor(T, q) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020303);
  scene.fog = new THREE.FogExp2(0x040707, 0.07);
  const C = { scene };
  const W = 2.4, H = 2.7, Z0 = 6, Z1 = -36, L = Z0 - Z1, ZC = (Z0 + Z1) / 2;

  const floor = plane(W, L, std(0x8f9690, 0.5, { map: repeat(T.tile, W / 1.2, L / 1.2) }), scene);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, ZC);
  C.floorRefl = makeReflector(W, L, { strength: 0.55, blur: 0.004, puddle: 0.75, res: q.reflect });
  C.floorRefl.rotation.x = -Math.PI / 2; C.floorRefl.position.set(0, 0.002, ZC);
  scene.add(C.floorRefl);
  const ceil = plane(W, L, std(0xdadad0, 0.95, { map: repeat(T.ceiling, W / 1.2, L / 1.2) }), scene);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, ZC);
  const upper = std(0xc4c5b4, 0.85, { map: repeat(T.block, L / 2.6, 1.7 / 1.3) });
  const lower = std(0x46706a, 0.7, { map: repeat(T.concrete, L / 2, 0.5) });
  [-1, 1].forEach((s) => {
    const u = plane(L, H - 1.0, upper, scene); u.rotation.y = -s * Math.PI / 2; u.position.set(s * W / 2, 1.0 + (H - 1.0) / 2, ZC);
    const l = plane(L, 1.0, lower, scene); l.rotation.y = -s * Math.PI / 2; l.position.set(s * W / 2, 0.5, ZC);
    box(0.02, 0.1, L, std(0x0b0d0d, 0.6), s * (W / 2 - 0.01), 0.05, ZC, scene);
    box(0.03, 0.03, L, std(0x1f2b29, 0.6), s * (W / 2 - 0.015), 1.0, ZC, scene);
  });
  const endWall = plane(W, H, std(0x050606, 1), scene); endWall.position.set(0, H / 2, Z1);

  // Missing ceiling tiles
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x010101 });
  [[0.3, -2.4], [-0.3, -9.6], [0.3, -14.4], [-0.3, 3.6], [0.3, -22.8]].forEach(([x, z]) => {
    const h = plane(0.6, 1.2, holeMat, scene); h.rotation.x = Math.PI / 2; h.position.set(x, H - 0.003, z);
  });

  // Repeated portal frames and alternating doors
  const frameMat = std(0x3a4a49, 0.55);
  const doorMat = std(0x6d8783, 0.6);
  const glassMat = std(0x050707, 0.15, { metalness: 0.3 });
  for (let k = 0; k < 14; k++) {
    const z = 3 - k * 3;
    box(0.12, H, 0.16, frameMat, -W / 2 + 0.06, H / 2, z, scene);
    box(0.12, H, 0.16, frameMat, W / 2 - 0.06, H / 2, z, scene);
    box(W, 0.22, 0.16, frameMat, 0, H - 0.11, z, scene);
    const side = k % 2 === 0 ? -1 : 1;
    const dz = z - 1.5;
    const door = box(0.04, 2.05, 0.9, doorMat, side * (W / 2 - 0.02), 1.025, dz, scene);
    box(0.05, 0.35, 0.22, glassMat, side * (W / 2 - 0.035), 1.55, dz, scene);
    box(0.05, 2.1, 0.06, frameMat, side * (W / 2 - 0.03), 1.05, dz - 0.48, scene);
    box(0.05, 2.1, 0.06, frameMat, side * (W / 2 - 0.03), 1.05, dz + 0.48, scene);
    box(0.05, 0.06, 1.02, frameMat, side * (W / 2 - 0.03), 2.1, dz, scene);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std(0x8a8a7a, 0.3, { metalness: 0.8 }));
    knob.position.set(side * (W / 2 - 0.07), 1.0, dz + 0.36); scene.add(knob);
    door.castShadow = false;
  }

  // Ceiling fixtures (between portals)
  C.fixtures = [];
  for (let k = 0; k < 11; k++) {
    const z = 1.5 - k * 3;
    const g = new THREE.Group();
    g.position.set(0, H - 0.04, z);
    scene.add(g);
    const housing = box(0.62, 0.07, 1.22, std(0x8b8d84, 0.6), 0, 0, 0, g);
    housing.castShadow = false;
    const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
    const panel = plane(0.56, 1.16, panelMat, g); panel.rotation.x = Math.PI / 2; panel.position.y = -0.037;
    const light = new THREE.PointLight(0xdbe6d2, 0, 7, 2);
    light.position.set(0, H - 0.35, z);
    scene.add(light);
    const cone = makeCone(1.25, 2.6, 0xd4dfcc, 0.0);
    cone.position.set(0, H - 0.08, z);
    scene.add(cone);
    const fx = { k, z, group: g, panel, panelMat, light, cone, damaged: k === 3 ? 'hanging' : k === 5 ? 'dead' : k === 7 ? 'flicker' : null };
    if (fx.damaged === 'hanging') { g.rotation.x = 0.42; g.position.y -= 0.24; g.position.z += 0.1; }
    C.fixtures.push(fx);
  }

  // The far CRT on an AV cart, with a red tally lamp
  C.crtZ = -19.6;
  const cart = new THREE.Group(); cart.position.set(0, 0, C.crtZ); scene.add(cart);
  const cm = std(0x1a1d1d, 0.5, { metalness: 0.4 });
  box(0.7, 0.03, 0.5, cm, 0, 0.82, 0, cart);
  box(0.7, 0.03, 0.5, cm, 0, 0.3, 0, cart);
  [[-0.33, -0.23], [0.33, -0.23], [-0.33, 0.23], [0.33, 0.23]].forEach(([x, z]) => {
    box(0.025, 0.82, 0.025, cm, x, 0.41, z, cart);
  });
  C.crt = new CRT({ width: 0.44, height: 0.33, depth: 0.42, canvasW: 512, canvasH: 384, lines: 240, lightIntensity: 3.5, seed: 9 });
  C.crt.group.position.set(0, 0.835 + 0.33 / 2 + 0.095, 0.05);
  cart.add(C.crt.group);
  C.tallyLamp = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.12, 0.05) }));
  C.tallyLamp.position.set(0.14, 0.835 + 0.33 + 0.2 + 0.02, -0.05);
  cart.add(C.tallyLamp);
  C.tally = new THREE.PointLight(0xff2a14, 1.2, 3, 2);
  C.tally.position.set(0.14, 1.45, C.crtZ + 0.1);
  scene.add(C.tally);
  C.crtWorld = new THREE.Vector3(0, C.crt.group.position.y, C.crtZ + 0.05);

  C.ambient = new THREE.HemisphereLight(0x1a2526, 0x040404, 0.22);
  scene.add(C.ambient);

  C.dust = makeDust(q.dust, [-1.1, 0.3, -12], [1.1, 2.6, 4], 13);
  scene.add(C.dust);

  C.entity = new Entity({ layer: 1 });
  scene.add(C.entity.group);
  C.rig = makeRig();
  scene.add(C.rig);

  // Surveillance view from a few feet behind the cinematic camera
  C.feed = new Feed(q.feed, Math.round(q.feed * 0.75), 44);
  return C;
}
