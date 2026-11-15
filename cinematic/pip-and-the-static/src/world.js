import * as THREE from 'three';
import { CRT } from './crt.js';
import { makeCone, makeDust, Feed } from './fx.js';
import { mulberry32 } from './util.js';

// ─────────────────────────────────────────────────────────────────────────────
// Two sets.
//   ARCHIVE — the station's tape room: shelves of tapes, one bulb, an AV cart
//             with a deck and a CRT. The operator is here.
//   PIP     — the tape: a cardboard stage, a painted sun, a chalkboard, and Pip.
//             It plays on the archive's CRT (a feed) and fills the frame for
//             the close shots.
// ─────────────────────────────────────────────────────────────────────────────

const std = (color, rough = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), fog: false });
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';

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
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  if (draw) draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.canvas = c;
  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE
// ─────────────────────────────────────────────────────────────────────────────
export function buildArchive(T, q) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x0a0d0c, 0.06);
  const A = { scene };
  const wall = std(0x7c827e, 0.92, { map: repeat(T.concrete, 2, 1) });
  const fl = plane(5, 4.4, std(0x7a7f7a, 0.6, { map: repeat(T.tile, 3, 3) }), scene); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, 1.9);
  const ce = plane(5, 4.4, std(0x8f9189, 0.95, { map: repeat(T.ceiling, 3, 3) }), scene); ce.rotation.x = Math.PI / 2; ce.position.set(0, 2.4, 1.9);
  const wb = plane(5, 2.4, wall, scene); wb.position.set(0, 1.2, -0.3);
  const wl = plane(4.4, 2.4, wall, scene); wl.rotation.y = Math.PI / 2; wl.position.set(-2.5, 1.2, 1.9);
  const wr = plane(4.4, 2.4, wall, scene); wr.rotation.y = -Math.PI / 2; wr.position.set(2.5, 1.2, 1.9);
  const wf = plane(5, 2.4, wall, scene); wf.rotation.y = Math.PI; wf.position.set(0, 1.2, 4.1);

  // shelves of tapes: steel uprights, five shelves, tapes standing on their ends
  {
    const steel = std(0x4a4f4e, 0.5, { metalness: 0.3 });
    const units = [[-1.6, -0.05, 0], [0, -0.05, 0], [1.6, -0.05, 0], [-2.25, 1.3, Math.PI / 2], [-2.25, 2.9, Math.PI / 2], [2.25, 1.3, -Math.PI / 2]];
    const rnd = mulberry32(808);
    const N = units.length * 5 * 26;
    const tapeGeo = new THREE.BoxGeometry(0.028, 0.19, 0.105);
    const bodies = new THREE.InstancedMesh(tapeGeo, std(0x111213, 0.55), N);
    const labels = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.022, 0.15), std(0xc9c3ad, 0.8), N);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), s1 = new THREE.Vector3(1, 1, 1);
    let k = 0;
    units.forEach(([ux, uz, ry]) => {
      const g = new THREE.Group(); g.position.set(ux, 0, uz); g.rotation.y = ry; scene.add(g);
      [-0.72, 0.72].forEach((x) => box(0.03, 2.0, 0.32, steel, x, 1.0, 0.16, g));
      for (let s = 0; s < 5; s++) {
        const y = 0.14 + s * 0.38;
        box(1.47, 0.02, 0.32, steel, 0, y, 0.16, g);
        let x = -0.68;
        for (let i = 0; i < 26 && x < 0.66; i++) {
          if (rnd() < 0.08) { x += 0.05; continue; }        // a gap where a tape was taken
          const lean = rnd() < 0.05 ? 0.25 : 0;
          const p = new THREE.Vector3(x, y + 0.105, 0.2); g.localToWorld(p);
          e.set(0, ry, lean * (rnd() < 0.5 ? -1 : 1)); qq.setFromEuler(e);
          m4.compose(p, qq, s1); bodies.setMatrixAt(k, m4);
          const lp = new THREE.Vector3(x, y + 0.105, 0.2 + 0.0535); g.localToWorld(lp);
          m4.compose(lp, qq, s1); labels.setMatrixAt(k, m4);
          labels.setColorAt(k, new THREE.Color().setHSL(0.12, 0.15, 0.55 + rnd() * 0.25));
          k++; x += 0.031 + rnd() * 0.004;
        }
      }
    });
    bodies.count = k; labels.count = k;
    scene.add(bodies, labels);
  }

  // the AV cart, the deck, the CRT
  {
    const cart = std(0x2a2e2d, 0.5, { metalness: 0.2 });
    A.cart = new THREE.Group(); A.cart.position.set(0, 0, 1.55); scene.add(A.cart);
    [0.25, 0.62].forEach((y) => box(0.8, 0.03, 0.5, cart, 0, y, 0, A.cart));
    [[-0.38, -0.23], [0.38, -0.23], [-0.38, 0.23], [0.38, 0.23]].forEach(([x, z]) => box(0.025, 0.62, 0.025, cart, x, 0.31, z, A.cart));
    // the deck
    const deck = std(0x1b1c1d, 0.45);
    box(0.44, 0.09, 0.32, deck, 0, 0.68, 0.02, A.cart);
    box(0.2, 0.026, 0.01, std(0x050505, 0.4), -0.06, 0.69, 0.181, A.cart);   // the slot
    A.deckDispTex = canvasTex(256, 48);
    A.deckDisp = plane(0.11, 0.02, new THREE.MeshBasicMaterial({ map: A.deckDispTex, color: new THREE.Color(2, 2, 2), fog: false }), A.cart);
    A.deckDisp.position.set(0.12, 0.7, 0.1805);
    A.playBtn = box(0.03, 0.012, 0.016, std(0x9a9a92, 0.5), 0.12, 0.664, 0.183, A.cart);
    for (let i = 0; i < 3; i++) box(0.022, 0.012, 0.016, std(0x5a5a56, 0.5), 0.06 + i * 0.028 + (i ? 0.04 : -0.07), 0.664, 0.183, A.cart);
    // the tape, half out of the slot, its label up
    A.tapeLabelTex = canvasTex(512, 200);
    A.tape = new THREE.Group(); A.tape.position.set(-0.06, 0.69, 0.23); A.cart.add(A.tape);
    box(0.19, 0.025, 0.105, std(0x111213, 0.55), 0, 0, 0, A.tape);
    const lab = plane(0.15, 0.0586, new THREE.MeshStandardMaterial({ map: A.tapeLabelTex, roughness: 0.8 }), A.tape);
    lab.rotation.x = -Math.PI / 2; lab.position.set(0, 0.0127, 0.012);
    // the CRT on top
    A.crt = new CRT({ width: 0.46, height: 0.345, depth: 0.44, canvasW: 640, canvasH: 480, lines: 262, lightIntensity: 2.2, seed: 4, lightOffset: 0.8 });
    A.crt.group.position.set(0, 0.725 + 0.345 / 2 + 0.095, 0.0);
    A.cart.add(A.crt.group);
  }

  // one bulb on a cord
  {
    const cord = cyl(0.004, 0.004, 0.5, std(0x111111, 0.5), 6); cord.position.set(0.15, 2.15, 1.95); scene.add(cord);
    A.bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), glow(3, 2.7, 2.0)); A.bulb.position.set(0.15, 1.87, 1.95); scene.add(A.bulb);
    A.bulbLight = new THREE.PointLight(0xffd9a0, 3.2, 6, 2); A.bulbLight.position.copy(A.bulb.position);
    A.bulbLight.castShadow = true; A.bulbLight.shadow.mapSize.set(q.shadow, q.shadow); A.bulbLight.shadow.bias = -0.001;
    scene.add(A.bulbLight);
  }
  A.ambient = new THREE.HemisphereLight(0x1d2a2b, 0x050505, 0.5); scene.add(A.ambient);

  // the operator's hand, flat, to press PLAY (the palm rig from 06)
  {
    const skin = new THREE.MeshPhysicalMaterial({ color: 0x7e5a46, roughness: 0.7, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.95, 0.6, 0.5) });
    A.palm = new THREE.Group();
    const pb = (r, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), skin); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; A.palm.add(m); return m; };
    pb(0.045, 1.0, 0.42, 1.2, 0, 0.03, 0.06);
    pb(0.012, 0.8, 0.7, 1.6, 0, 0.012, -0.004);   // one finger, out, pressing
    for (let k = 0; k < 3; k++) pb(0.015, 0.55, 0.5, 1.0, 0.016 + k * 0.016, 0.022, 0.02);
    const cuff = cyl(0.038, 0.044, 0.5, std(0x15181b, 0.9, { map: T.fabric }), 14);
    cuff.geometry.translate(0, 0.25, 0); cuff.position.set(0.004, 0.035, 0.11); cuff.rotation.set(1.35, 0, 0); cuff.castShadow = true; A.palm.add(cuff);
    A.palm.visible = false;
    scene.add(A.palm);
  }

  A.dust = makeDust(q.dust, [-1.5, 0.3, 0.5], [1.5, 2.2, 3.5], 41);
  A.dust.material.uniforms.uSize.value = 3.4;
  A.dust.layers.set(2);
  scene.add(A.dust);
  return A;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIP — the tape
// ─────────────────────────────────────────────────────────────────────────────
function drawBackdrop(g, w, h) {
  // a painted sky, faded; a sun with a face; cardboard hills; the show's name
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#6f9fb0'); sky.addColorStop(1, '#c9d6c2');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const rnd = mulberry32(31);
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(80,60,30,${rnd() * 0.06})`; g.fillRect(rnd() * w, rnd() * h, 3, 3); }
  // the sun
  const sx = w * 0.18, sy = h * 0.3, sr = h * 0.13;
  g.strokeStyle = '#d9a23a'; g.lineWidth = 10;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(sx + Math.cos(a) * sr * 1.2, sy + Math.sin(a) * sr * 1.2); g.lineTo(sx + Math.cos(a) * sr * 1.65, sy + Math.sin(a) * sr * 1.65); g.stroke(); }
  g.fillStyle = '#e8b84a'; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3a2a1a'; [-0.35, 0.35].forEach((dx) => { g.beginPath(); g.arc(sx + dx * sr, sy - 0.15 * sr, sr * 0.09, 0, Math.PI * 2); g.fill(); });
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 6; g.beginPath(); g.arc(sx, sy + 0.05 * sr, sr * 0.5, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  // hills
  [['#7c9a5a', 0.78, 0.25], ['#5f7f48', 0.86, 0.6]].forEach(([c, y, ph]) => {
    g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 20) g.lineTo(x, h * y + Math.sin(x / w * Math.PI * 3 + ph * 6) * h * 0.04);
    g.lineTo(w, h); g.closePath(); g.fill();
  });
  // the show's name, hand-painted across the top
  g.font = `900 ${Math.round(h * 0.085)}px "Comic Sans MS", "Chalkboard SE", ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = '#3a2a1a'; g.strokeText('PIP AND THE STATIC', w * 0.58, h * 0.12);
  g.fillStyle = '#f2d36b'; g.fillText('PIP AND THE STATIC', w * 0.58, h * 0.12);
}

function buttonTex() {
  return canvasTex(64, 64, (g) => {
    g.fillStyle = '#1d1712'; g.beginPath(); g.arc(32, 32, 31, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a2f26'; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 24, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#7a6a58'; [[24, 24], [40, 24], [24, 40], [40, 40]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); });
    g.strokeStyle = '#d8d0b8'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(24, 24); g.lineTo(40, 40); g.moveTo(40, 24); g.lineTo(24, 40); g.stroke();
  });
}

export function buildPip(T, q) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);
  const P = { scene };
  // the backdrop
  const back = plane(3.6, 2.2, new THREE.MeshStandardMaterial({ map: canvasTex(1024, 640, drawBackdrop), roughness: 0.95 }), scene);
  back.position.set(0, 1.45, -1.1);
  // the stage front (the apron Pip rises from behind) and the proscenium
  const paint = std(0xa8432e, 0.85, { map: T.fabric });
  box(3.6, 0.95, 0.06, paint, 0, 0.475, 0.25, scene);
  box(3.6, 0.06, 0.1, std(0xd8b04a, 0.7), 0, 0.97, 0.27, scene);
  box(0.25, 2.4, 0.1, paint, -1.9, 1.2, 0.25, scene); box(0.25, 2.4, 0.1, paint, 1.9, 1.2, 0.25, scene);
  box(4.05, 0.3, 0.1, paint, 0, 2.55, 0.25, scene);
  // the chalkboard on its easel, stage right
  P.boardTex = canvasTex(1024, 768);
  P.board = new THREE.Group(); P.board.position.set(0.9, 1.55, -0.35); P.board.rotation.y = -0.18; scene.add(P.board);
  box(1.12, 0.86, 0.04, std(0x6b4a2e, 0.7), 0, 0, -0.025, P.board);
  const face = plane(1.04, 0.78, new THREE.MeshStandardMaterial({ map: P.boardTex, roughness: 0.95 }), P.board); face.position.z = 0.0;
  [-0.4, 0.4].forEach((x) => { const leg = box(0.04, 1.6, 0.04, std(0x6b4a2e, 0.7), x, -0.6, 0.05, P.board); leg.rotation.x = 0.08; });
  P.boardPoint = (u, v) => new THREE.Vector3((u - 0.5) * 1.04, (0.5 - v) * 0.78, 0.01).applyMatrix4(P.board.matrixWorld);

  // Pip
  {
    const felt = std(0xd2aa48, 0.97);
    const dark = std(0x2a1610, 0.9);
    P.pip = new THREE.Group(); P.pip.position.set(-0.35, 0.95, 0.05); scene.add(P.pip);
    const body = cyl(0.17, 0.2, 0.55, felt, 20); body.position.y = 0.0; P.pip.add(body);
    P.head = new THREE.Group(); P.head.position.y = 0.42; P.pip.add(P.head);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 18), felt); head.scale.set(1.0, 0.92, 0.88); head.castShadow = true; P.head.add(head);
    // button eyes
    const btn = new THREE.MeshStandardMaterial({ map: buttonTex(), roughness: 0.4 });
    P.eyes = [-0.075, 0.075].map((x) => {
      const e = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.014, 24), [std(0x1d1712, 0.4), btn, btn]);
      e.rotation.x = Math.PI / 2; e.position.set(x, 0.04, 0.17); P.head.add(e); return e;
    });
    // the mouth: a dark felt half-disc that opens
    P.mouth = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20, Math.PI, Math.PI), dark);
    P.mouth.position.set(0, -0.055, 0.177); P.head.add(P.mouth);
    // antenna ears
    [-1, 1].forEach((s) => {
      const a = cyl(0.006, 0.006, 0.2, std(0x8a8a86, 0.4, { metalness: 0.4 }), 8); a.position.set(s * 0.09, 0.24, 0); a.rotation.z = -s * 0.45; P.head.add(a);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), std(0xa8432e, 0.7)); b.position.set(s * 0.135, 0.33, 0); P.head.add(b);
    });
    // arms: felt tubes from the shoulders, mitten hands
    P.arms = [-1, 1].map((s) => {
      const sh = new THREE.Group(); sh.position.set(s * 0.18, 0.16, 0.02); P.pip.add(sh);
      const arm = cyl(0.035, 0.04, 0.3, felt, 10); arm.geometry.translate(0, -0.15, 0); sh.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), felt); hand.scale.set(1, 1.15, 0.8); hand.position.y = -0.32; sh.add(hand);
      sh.rotation.z = s * 0.25;
      sh.userData.hand = hand;
      return sh;
    });
    P.pip.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  // chalk in Pip's hand (only for writing)
  P.chalk = cyl(0.008, 0.008, 0.06, std(0xf4f0e4, 0.9), 8); P.chalk.visible = false; scene.add(P.chalk);

  // flat studio light, and a dimmer it sinks to later
  P.key = new THREE.SpotLight(0xfff0d8, 40, 9, 0.6, 0.6, 2); P.key.position.set(0.6, 3.2, 3.2); P.key.target.position.set(0.1, 1.2, -0.3);
  P.key.castShadow = true; P.key.shadow.mapSize.set(q.shadow, q.shadow); P.key.shadow.bias = -0.0006;
  scene.add(P.key, P.key.target);
  P.fill = new THREE.HemisphereLight(0xe8eef0, 0x302820, 0.9); scene.add(P.fill);

  // the studio camera that taped it: fixed, slightly high
  P.camPos = [0.15, 1.45, 3.3]; P.camLook = [0.15, 1.35, 0];
  P.feed = new Feed(q.feed, Math.round(q.feed * 0.75), 40);
  P.feed.camera.position.set(...P.camPos); P.feed.camera.lookAt(...P.camLook); P.feed.camera.updateMatrixWorld();
  return P;
}
